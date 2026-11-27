export type TextBlock = { type: 'text'; text: string; page?: number };
export type ImageBlock = { type: 'image'; src: string; alt: string; page?: number };
export type Block = TextBlock | ImageBlock;
export type Reading = {
  id: string; title: string; format: string; blocks: Block[];
  addedAt: number; openedAt: number; position: number; completed: boolean; cover: number;
};
export type Step = (TextBlock | ImageBlock) & { offset: number; endOffset: number; blockIndex: number };
export type Settings = { words: number; fontSize: number; font: 'serif' | 'sans'; theme: 'light' | 'dark' | 'system'; wpm: number };
export const DEFAULT_SETTINGS: Settings = { words: 6, fontSize: 36, font: 'serif', theme: 'light', wpm: 240 };
export const wordCount = (blocks: Block[]) => blocks.reduce((n, b) => n + (b.type === 'text' ? b.text.trim().split(/\s+/u).filter(Boolean).length : 0), 0);
export const imageCount = (blocks: Block[]) => blocks.filter(b => b.type === 'image').length;

/** Images are atomic steps. Flush leftover words before every image, never across it. */
export function makeSteps(blocks: Block[], requestedWords: number): Step[] {
  const size = Math.max(1, Math.min(12, Math.floor(requestedWords) || 6));
  const steps: Step[] = [];
  let offset = 0;
  blocks.forEach((block, blockIndex) => {
    if (block.type === 'image') {
      steps.push({ ...block, blockIndex, offset, endOffset: ++offset });
    } else {
      const words = block.text.trim().split(/\s+/u).filter(Boolean);
      for (let i = 0; i < words.length; i += size) {
        const chunk = words.slice(i, i + size);
        steps.push({ ...block, text: chunk.join(' '), blockIndex, offset, endOffset: offset + chunk.length });
        offset += chunk.length;
      }
    }
  });
  return steps;
}

export function stepAtOffset(steps: Step[], offset: number): number {
  const i = steps.findIndex(s => s.endOffset > offset);
  return i < 0 ? Math.max(0, steps.length - 1) : i;
}

export const samples: Reading[] = [
  {
    id: 'sample-noticing', title: 'The art of noticing', format: 'ESSAY', addedAt: 1, openedAt: 3, position: 0, completed: false, cover: 0,
    blocks: [
      { type: 'text', text: 'There is a quiet kind of freedom in paying attention. To the light moving across a wall. To the way a familiar path changes with the season. To the small things that have been there all along.' },
      { type: 'image', src: '/quiet-landscape.svg', alt: 'A small fox beside a winding path through green hills at sunset.' },
      { type: 'text', text: 'You do not need to go somewhere new to see something new. Sometimes all it takes is a slower pace, a little curiosity, and the willingness to look again. Let the next few words be enough. There is no hurry to arrive.' },
    ],
  },
  {
    id: 'sample-six', title: 'Six words, then a picture', format: 'DEMO', addedAt: 2, openedAt: 2, position: 0, completed: false, cover: 1,
    blocks: [{ type: 'text', text: 'the quick brown fox jumps over the lazy dog' }, { type: 'image', src: '/quiet-landscape.svg', alt: 'A fox exploring a quiet green landscape.' }],
  },
  {
    id: 'sample-guide', title: 'Make yourself at home', format: 'GUIDE', addedAt: 3, openedAt: 1, position: 0, completed: false, cover: 2,
    blocks: [{ type: 'text', text: 'Welcome to Origin Reader. A little room for your words. Tap the right half of the page to move forward. Tap the left half to go back. Choose how many words appear at once. When a picture comes along, take your time. Tap right when you are ready to continue. Add a document, paste something worth reading, or bring your own pictures. Your library and your place are saved on this device.' }],
  },
];
