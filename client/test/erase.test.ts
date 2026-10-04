import { describe, expect, it } from 'vitest';
import type { Stroke } from '@doodle/spec';
import { extractFeatures } from '@doodle/spec';
import { eraseAt } from '../src/routes/play/erase';

const line: Stroke = { color: '#ff3b3b', width: 10, points: [[0, 50, 0], [100, 50, 100]] };
describe('drawing eraser', () => {
  it('splits ink crossed by the eraser even when a segment has no points inside it', () => {
    const result = eraseAt([line], 50, 50, 10);
    expect(result).toHaveLength(2);
    expect(result[0]!.points).toEqual([[0, 50, 0], [35, 50, 35]]);
    expect(result[1]!.points).toEqual([[65, 50, 65], [100, 50, 100]]);
    expect(line.points).toHaveLength(2);
  });
  it('preserves distant strokes and their colors', () => {
    expect(eraseAt([line], 50, 150, 10)).toEqual([line]);
    expect(eraseAt([line], 200, 50, 10)).toEqual([line]);
  });
  it('removes fully erased ink from submitted features', () => {
    const strokes = eraseAt([line], 50, 50, 100);
    expect(strokes).toEqual([]);
    expect(extractFeatures({ width: 512, height: 512, strokes }).isEmpty).toBe(true);
  });
  it('erases dots and repeated points', () => {
    const dot: Stroke = { ...line, points: [[50, 50, 0]] };
    expect(eraseAt([dot], 50, 50, 10)).toEqual([]);
    expect(eraseAt([dot], 100, 100, 10)).toEqual([dot]);
    expect(eraseAt([{ ...dot, points: [[50, 50, 0], [50, 50, 1]] }], 50, 50, 10)).toEqual([]);
  });
});
