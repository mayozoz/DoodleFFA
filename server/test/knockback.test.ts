import { describe, expect, it } from 'vitest';
import { DEFAULT_SWING, type WeaponSpec } from '@doodle/spec';
import { knockbackDistance } from '../src/lib/sim';

const spec = (patch: Partial<WeaponSpec>): WeaponSpec => ({ ...DEFAULT_SWING, ...patch });

describe('knockbackDistance', () => {
  it('differs per weapon class: slam > thrust > swing > beam', () => {
    const d = (archetype: WeaponSpec['archetype']) => knockbackDistance(spec({ archetype }));
    expect(d('slam')).toBeGreaterThan(d('thrust'));
    expect(d('thrust')).toBeGreaterThan(d('swing'));
    expect(d('swing')).toBeGreaterThan(d('beam'));
  });

  it('heavier weapons and the knockback/goo effects push further', () => {
    const light = knockbackDistance(spec({ motion: { ...DEFAULT_SWING.motion, weight: 0 } }));
    const heavy = knockbackDistance(spec({ motion: { ...DEFAULT_SWING.motion, weight: 1 } }));
    expect(heavy).toBeGreaterThan(light);
    expect(knockbackDistance(spec({ on_hit: ['knockback'] }))).toBeGreaterThan(knockbackDistance(spec({ on_hit: [] })));
    expect(knockbackDistance(spec({ vfx: [{ type: 'goo', where: 'impact', intensity: 1 }] }))).toBeGreaterThan(knockbackDistance(spec({ vfx: [] })));
  });
});

import { PROJECTILE } from '../src/balance';

describe('boomerang budget', () => {
  it('out + back legs together are worth at most one hit', () => {
    expect(PROJECTILE.throwOutMul + PROJECTILE.throwBackMul).toBeLessThanOrEqual(1);
  });
});
