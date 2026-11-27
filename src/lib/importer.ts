import { marked } from 'marked';
import type { Block, Reading } from './model';

const MAX_FILE = 100 * 1024 * 1024;
const IMAGE = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;
export const ACCEPT = '.pdf,.txt,.md,.markdown,.html,.htm,.png,.jpg,.jpeg,.webp,.gif,.avif,.bmp';
export type ImportProgress = (message: string) => void;

export function validateFile(file: File) {
  if (file.size > MAX_FILE) throw new Error(`${file.name} is too large. Choose a file under 100 MB.`);
  if (!file.size) throw new Error(`${file.name} is empty.`);
}

export function readDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This image could not be read. Try selecting it again.'));
    reader.readAsDataURL(file);
  });
}

/** Rasterize once at import, so images remain available offline without huge camera files. */
export async function storeImage(file: Blob): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif|avif|bmp)$/i.test(file.type)) throw new Error('Choose a PNG, JPG, WebP, GIF, AVIF, or BMP image.');
  const url = await readDataURL(file);
  const image = new Image();
  image.src = url;
  try { await image.decode(); } catch { throw new Error('This image could not be opened. Try a different image.'); }
  const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is unavailable on this device.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.88);
}

export async function parseRichText(source: string, html: boolean, attachments: Map<string, string> = new Map()): Promise<Block[]> {
  const parsed = new DOMParser().parseFromString(html ? source : await marked.parse(source), 'text/html');
  const blocks: Block[] = [];
  let text = '';
  const flush = () => { if (text.trim()) blocks.push({ type: 'text', text: text.replace(/\s+/gu, ' ').trim() }); text = ''; };
  const walk = async (node: Node): Promise<void> => {
    if (node.nodeType === Node.TEXT_NODE) { text += node.textContent || ''; return; }
    if (!(node instanceof Element)) return;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'TEMPLATE', 'HEAD'].includes(node.tagName)) return;
    if (node.tagName === 'IMG') {
      flush();
      const raw = node.getAttribute('src') || '';
      let src = attachments.get(raw) || attachments.get(decodeURIComponentSafe(raw).split('/').pop() || '');
      if (!src && /^data:image\/(png|jpeg|webp|gif|avif|bmp);base64,/i.test(raw)) {
        const response = await fetch(raw);
        src = await storeImage(await response.blob());
      }
      if (!src && /^https:\/\//i.test(raw)) {
        try {
          const response = await fetch(raw, { signal: AbortSignal.timeout(15000), referrerPolicy: 'no-referrer', credentials: 'omit' });
          if (!response.ok) throw new Error();
          const blob = await response.blob();
          if (blob.size > MAX_FILE) throw new Error();
          src = await storeImage(blob);
        } catch { throw new Error('An image could not be downloaded. Attach it locally or use an HTML file with embedded images.'); }
      }
      if (!src) throw new Error(`Image “${node.getAttribute('alt') || raw || 'untitled'}” is missing. Select the document and its image files together, or attach the image in Paste text.`);
      blocks.push({ type: 'image', src, alt: node.getAttribute('alt') || 'Image from your document' });
      return;
    }
    const separate = /^(P|DIV|BR|H[1-6]|LI|BLOCKQUOTE|TR|SECTION|ARTICLE|HR|PRE)$/.test(node.tagName);
    if (separate) text += ' ';
    for (const child of node.childNodes) await walk(child);
    if (separate) text += ' ';
  };
  await walk(parsed.body);
  flush();
  if (!blocks.length) throw new Error('There is nothing to read yet. Add some text or an image.');
  return blocks;
}

function decodeURIComponentSafe(s: string) { try { return decodeURIComponent(s); } catch { return s; } }

export function newReading(title: string, format: string, blocks: Block[]): Reading {
  return { id: crypto.randomUUID(), title: title.trim() || 'Untitled reading', format, blocks, addedAt: Date.now(), openedAt: Date.now(), position: 0, completed: false, cover: Math.floor(Math.random() * 4) };
}

export async function importFiles(files: File[], progress: ImportProgress, password?: string): Promise<Reading[]> {
  files.forEach(validateFile);
  const images = files.filter(file => IMAGE.test(file.name));
  const documents = files.filter(file => !IMAGE.test(file.name));
  const attachments = new Map<string, string>();
  for (const file of images) { progress(`Preparing ${file.name}…`); attachments.set(file.name, await storeImage(file)); }
  if (!documents.length) return images.length ? [newReading(images.length === 1 ? images[0].name.replace(/\.[^.]+$/, '') : 'My image collection', 'IMAGES', images.map(file => ({ type: 'image' as const, src: attachments.get(file.name)!, alt: file.name })))] : [];
  const readings: Reading[] = [];
  for (const file of documents) {
    progress(`Opening ${file.name}…`);
    const ext = file.name.split('.').pop()?.toLowerCase();
    let blocks: Block[];
    if (ext === 'pdf') {
      const { importPDF } = await import('./pdf');
      blocks = await importPDF(file, progress, password);
    } else if (['md', 'markdown', 'html', 'htm'].includes(ext || '')) {
      blocks = await parseRichText(await file.text(), ext === 'html' || ext === 'htm', attachments);
    } else if (ext === 'txt') {
      const text = (await file.text()).trim();
      if (!text) throw new Error(`${file.name} has no text to read.`);
      blocks = [{ type: 'text', text }];
    } else throw new Error(`“${file.name}” is not a supported document. Choose PDF, TXT, Markdown, HTML, or images.`);
    readings.push(newReading(file.name.replace(/\.[^.]+$/, ''), ext?.toUpperCase() || 'TEXT', blocks));
  }
  return readings;
}
