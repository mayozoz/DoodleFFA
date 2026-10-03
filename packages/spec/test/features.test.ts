import { describe, expect, it } from 'vitest';
import { extractFeatures, type Drawing } from '../src';

const line = (x0: number, y0: number, x1: number, y1: number, n = 20): [number, number, number][] =>
  Array.from({ length: n }, (_, i) => [x0 + ((x1 - x0) * i) / (n - 1), y0 + ((y1 - y0) * i) / (n - 1), i * 10]);

describe('extractFeatures', () => {
  it('flags an empty canvas', () => {
    expect(extractFeatures({ width: 512, height: 512, strokes: [] }).isEmpty).toBe(true);
  });

  it('a long horizontal line is wide and not closed', () => {
    const d: Drawing = { width: 512, height: 512, strokes: [{ color: '#000000', width: 6, points: line(20, 250, 490, 260) }] };
    const f = extractFeatures(d);
    expect(f.isEmpty).toBe(false);
    expect(f.aspect).toBeGreaterThan(5);
    expect(f.closedShapes).toBe(0);
    expect(f.colors['#000000']).toBeCloseTo(1);
  });

  it('a circle counts as a closed shape', () => {
    const pts: [number, number, number][] = Array.from({ length: 60 }, (_, i) => {
      const a = (i / 59) * Math.PI * 2;
      return [256 + Math.cos(a) * 100, 256 + Math.sin(a) * 100, i * 10];
    });
    const f = extractFeatures({ width: 512, height: 512, strokes: [{ color: '#ff0000', width: 6, points: pts }] });
    expect(f.closedShapes).toBe(1);
    expect(f.symmetry).toBeGreaterThan(0.8);
  });
});

import { REVEAL, revealSeconds, revealSlot } from '../src';

describe('reveal timing', () => {
  it('walks intro → each weapon → 3‥2‥1', () => {
    const n = 3, total = revealSeconds(n);
    expect(revealSlot(0.1, n)).toEqual({ kind: 'intro' });
    expect(revealSlot(REVEAL.introS + 0.01, n)).toMatchObject({ kind: 'weapon', index: 0 });
    expect(revealSlot(REVEAL.introS + REVEAL.perWeaponS * 2 + 0.1, n)).toMatchObject({ kind: 'weapon', index: 2 });
    expect(revealSlot(total - 2.5, n)).toEqual({ kind: 'countdown', number: 3 });
    expect(revealSlot(total - 0.2, n)).toEqual({ kind: 'countdown', number: 1 });
  });

  it('a full 12-player room fits the cap and still shows every weapon', () => {
    const total = revealSeconds(12);
    expect(total).toBeLessThanOrEqual(REVEAL.maxS);
    expect(revealSlot(total - REVEAL.countdownS - 0.01, 12)).toMatchObject({ kind: 'weapon', index: 11 });
  });
});
