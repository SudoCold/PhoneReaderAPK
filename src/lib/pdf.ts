import { getDocument, GlobalWorkerOptions, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs';
import worker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { Block } from './model';
import type { ImportProgress } from './importer';

GlobalWorkerOptions.workerSrc = worker;
type Matrix = [number, number, number, number, number, number];
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
type Region = { x: number; y: number; width: number; height: number };

/** PDF coordinates are a best-effort visual order; scanned pages remain whole images. */
export async function importPDF(file: File, progress: ImportProgress, password?: string): Promise<Block[]> {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), password, cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' });
  try {
    const pdf = await task.promise;
    const blocks: Block[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      progress(`Preparing page ${pageNo} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNo);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1800 / Math.max(natural.width, natural.height)) });
      const content = await page.getTextContent();
      const textItems = content.items.filter((item): item is Extract<typeof item, { str: string }> => 'str' in item && !!item.str.trim());
      const events: { x: number; y: number; block: Block }[] = textItems.map(item => {
        const position = Util.transform(viewport.transform, item.transform);
        return { x: position[4], y: position[5] - Math.hypot(position[2], position[3]), block: { type: 'text', text: item.str, page: pageNo } };
      });
      const ops = await page.getOperatorList();
      const regions: Region[] = [];
      let matrix = identity();
      const stack: Matrix[] = [];
      const addRegion = (transform: number[]) => {
        const t = Util.transform(viewport.transform, transform);
        const points = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([x, y]) => [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]]);
        const x = Math.max(0, Math.min(...points.map(p => p[0])));
        const y = Math.max(0, Math.min(...points.map(p => p[1])));
        const right = Math.min(viewport.width, Math.max(...points.map(p => p[0])));
        const bottom = Math.min(viewport.height, Math.max(...points.map(p => p[1])));
        if (right - x >= 24 && bottom - y >= 24) regions.push({ x, y, width: right - x, height: bottom - y });
      };
      for (let i = 0; i < ops.fnArray.length; i++) {
        const op = ops.fnArray[i], args = ops.argsArray[i];
        if (op === OPS.save) stack.push([...matrix]);
        else if (op === OPS.restore) matrix = stack.pop() || identity();
        else if (op === OPS.transform) matrix = Util.transform(matrix, args) as Matrix;
        else if (op === OPS.paintFormXObjectBegin) { stack.push([...matrix]); if (args[0]) matrix = Util.transform(matrix, args[0]) as Matrix; }
        else if (op === OPS.paintFormXObjectEnd) matrix = stack.pop() || identity();
        else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) addRegion(matrix);
        else if (op === OPS.paintImageXObjectRepeat) {
          const [, sx, sy, positions] = args;
          for (let k = 0; k < positions.length; k += 2) addRegion(Util.transform(matrix, [sx, 0, 0, sy, positions[k], positions[k + 1]]));
        }
      }
      if (regions.length || !textItems.length) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d')!;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!textItems.length) {
          blocks.push({ type: 'image', src: canvas.toDataURL('image/webp', 0.9), alt: `Page ${pageNo} of ${file.name}`, page: pageNo });
          page.cleanup();
          continue;
        }
        const unique = regions.filter((r, i) => !regions.slice(0, i).some(other => Math.abs(r.x - other.x) < 2 && Math.abs(r.y - other.y) < 2 && Math.abs(r.width - other.width) < 2 && Math.abs(r.height - other.height) < 2));
        for (const [index, region] of unique.entries()) {
          const crop = document.createElement('canvas');
          crop.width = Math.ceil(region.width); crop.height = Math.ceil(region.height);
          crop.getContext('2d')!.drawImage(canvas, region.x, region.y, region.width, region.height, 0, 0, crop.width, crop.height);
          events.push({ x: region.x, y: region.y, block: { type: 'image', src: crop.toDataURL('image/webp', 0.9), alt: `Image ${index + 1} on page ${pageNo}`, page: pageNo } });
        }
        canvas.width = 0; canvas.height = 0;
      }
      events.sort((a, b) => a.y - b.y || a.x - b.x);
      // Normalize text baselines into rows before ordering horizontally.
      for (let i = 0; i < events.length;) {
        let end = i + 1;
        if (events[i].block.type === 'text') {
          while (end < events.length && events[end].block.type === 'text' && Math.abs(events[end].y - events[i].y) < 4) end++;
          events.splice(i, end - i, ...events.slice(i, end).sort((a, b) => a.x - b.x));
        }
        i = end;
      }
      for (const event of events) {
        const last = blocks[blocks.length - 1];
        if (event.block.type === 'text' && last?.type === 'text' && last.page === pageNo) last.text += ' ' + event.block.text;
        else blocks.push(event.block);
      }
      page.cleanup();
    }
    if (!blocks.length) throw new Error('This PDF has no readable pages.');
    return blocks;
  } finally { await task.destroy(); }
}
