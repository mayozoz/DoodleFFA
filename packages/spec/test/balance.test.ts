import { describe, expect, it } from 'vitest';
import { ARCHETYPES, balance, DEFAULT_SWING, type WeaponSpec } from '../src';
import { BALANCE } from '../../../server/src/balance';

const effectiveDps = (spec: WeaponSpec) => {
  const s = balance(spec, BALANCE);
  const projectiles = spec.projectile?.count ?? 1;
  return (s.damagePerHit * projectiles + s.dotPerSecond * s.dotSeconds) / s.cooldown;
};

describe('balance', () => {
  it('never exceeds the target DPS budget', () => {
    for (const archetype of ARCHETYPES) {
      for (const weight of [0, 0.5, 1]) {
        const spec: WeaponSpec = { ...DEFAULT_SWING, archetype, motion: { ...DEFAULT_SWING.motion, weight } };
        expect(effectiveDps(spec)).toBeLessThanOrEqual(BALANCE.targetDps + 1e-9);
      }
    }
  });

  it('clamps cooldown to [0.25, 1.5]', () => {
    for (const archetype of ARCHETYPES) {
      for (const weight of [0, 1]) {
        const { cooldown } = balance({ ...DEFAULT_SWING, archetype, motion: { ...DEFAULT_SWING.motion, weight } }, BALANCE);
        expect(cooldown).toBeGreaterThanOrEqual(0.25);
        expect(cooldown).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('long range costs damage per hit', () => {
    const short = balance({ ...DEFAULT_SWING, range: 0 }, BALANCE);
    const long = balance({ ...DEFAULT_SWING, range: 1 }, BALANCE);
    expect(long.damagePerHit).toBeLessThan(short.damagePerHit);
  });

  it('cosmetic effects are free', () => {
    const plain = balance({ ...DEFAULT_SWING, vfx: [] }, BALANCE);
    const sparkly = balance({ ...DEFAULT_SWING, vfx: [{ type: 'sparkles', where: 'trail', intensity: 1 }] }, BALANCE);
    expect(sparkly.damagePerHit).toBe(plain.damagePerHit);
  });
});
