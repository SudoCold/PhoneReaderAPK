import { describe, expect, it } from 'vitest';
import { makeSteps, stepAtOffset, type Block } from '../src/lib/model';

const picture: Block = { type: 'image', src: 'example.png', alt: 'A fox' };
describe('tap reading sequence', () => {
  it('matches the requested six-word example exactly', () => {
    const steps = makeSteps([{ type: 'text', text: 'the quick brown fox jumps over the lazy dog' }, picture], 6);
    expect(steps.map(s => s.type === 'text' ? s.text : '[image]')).toEqual(['the quick brown fox jumps over', 'the lazy dog', '[image]']);
  });
  it('flushes partial chunks before images and restarts after them', () => {
    const steps = makeSteps([{ type: 'text', text: 'one two' }, picture, { type: 'text', text: 'three four five six seven eight nine' }], 6);
    expect(steps.map(s => s.type === 'text' ? s.text : '[image]')).toEqual(['one two', '[image]', 'three four five six seven eight', 'nine']);
  });
  it('preserves consecutive, first and last images with no phantom text', () => {
    expect(makeSteps([picture, { type: 'text', text: ' \n ' }, picture], 6).map(s => s.type)).toEqual(['image', 'image']);
  });
  it('keeps the same location when the number of words changes', () => {
    const blocks: Block[] = [{ type: 'text', text: 'one two three four five six seven eight nine' }, picture];
    const before = makeSteps(blocks, 6);
    const after = makeSteps(blocks, 3);
    expect(stepAtOffset(after, before[1].offset)).toBe(2);
    expect(after[stepAtOffset(after, before[2].offset)].type).toBe('image');
  });
  it('handles unicode whitespace, empty input and invalid chunk sizes', () => {
    expect(makeSteps([], 6)).toEqual([]);
    expect(makeSteps([{ type: 'text', text: 'hi\nthere\tfriend' }], -4).map(s => s.type === 'text' && s.text)).toEqual(['hi', 'there', 'friend']);
  });
});
