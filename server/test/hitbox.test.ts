import { describe, expect, it } from 'vitest';
import type { BalancedStats } from '@doodle/spec';
import { contains, meleeShape } from '../src/lib/hitbox';

const stats = (rangeUnits: number, areaUnits = 0.8): BalancedStats =>
  ({ cooldown: 0.6, damagePerHit: 1, dotPerSecond: 0, dotSeconds: 0, rangeUnits, areaUnits, moveSpeedMul: 1 });
const O = { x: 0, y: 0 };
const PAD = 0.5;
const hits = (a: Parameters<typeof meleeShape>[0], p: { x: number; y: number }, range = 2, area = 0.8) =>
  contains(meleeShape(a, O, 0, stats(range, area))!, p, PAD);

describe('melee hitboxes (attacker at origin, facing +x)', () => {
  it('swing: arc in front, not behind', () => {
    expect(hits('swing', { x: 1.8, y: 0.5 })).toBe(true);
    expect(hits('swing', { x: -1.5, y: 0 })).toBe(false);
  });
  it('thrust: narrow and long — misses to the side', () => {
    expect(hits('thrust', { x: 2.3, y: 0 }, 2.5)).toBe(true);
    expect(hits('thrust', { x: 1.2, y: 1.4 }, 2.5)).toBe(false);
  });
  it('slam: circle ahead, size from area', () => {
    expect(hits('slam', { x: 1.2, y: 1.1 }, 2, 1.0)).toBe(true);
    expect(hits('slam', { x: 1.2, y: 2.2 }, 2, 0.4)).toBe(false);
  });
  it('spin: full ring, hits behind too', () => {
    expect(hits('spin', { x: -1.6, y: 0 })).toBe(true);
    expect(hits('spin', { x: 0, y: -1.6 })).toBe(true);
    expect(hits('spin', { x: 3, y: 0 })).toBe(false);
  });
  it('beam: very long, very thin', () => {
    expect(hits('beam', { x: 11, y: 0 }, 12)).toBe(true);
    expect(hits('beam', { x: 6, y: 1.2 }, 12)).toBe(false);
  });
  it('whip: reaches along a curve', () => {
    expect(hits('whip', { x: 2.6, y: 0.4 }, 3)).toBe(true);
    expect(hits('whip', { x: -1, y: 0 }, 3)).toBe(false);
  });
  it('shoot/throw have no melee shape (they fire projectiles)', () => {
    expect(meleeShape('shoot', O, 0, stats(8))).toBeNull();
    expect(meleeShape('throw', O, 0, stats(6))).toBeNull();
  });
});
