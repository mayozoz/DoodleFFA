import { describe, expect, it } from 'vitest';
import { DEFAULT_SWING, validateWeaponSpec } from '../src';
import thornwhip from '../fixtures/thornwhip.json';

describe('validateWeaponSpec', () => {
  it('accepts a well-formed fixture unchanged (apart from clamps)', () => {
    const { spec, issues } = validateWeaponSpec(thornwhip, DEFAULT_SWING);
    expect(spec.archetype).toBe('whip');
    expect(spec.name).toBe('Thornwhip of the Ember Garden');
    expect(issues).toEqual([]);
  });

  it('falls back per field and never throws', () => {
    const { spec, issues } = validateWeaponSpec(
      { name: 'Ok', archetype: 'laser-cannon', range: 900, on_hit: ['burn', 'explode', 'slow', 'chain'], vfx: [{ type: 'nuke' }] },
      DEFAULT_SWING,
    );
    expect(spec.name).toBe('Ok');
    expect(spec.archetype).toBe(DEFAULT_SWING.archetype);
    expect(spec.range).toBe(1);
    expect(spec.on_hit).toEqual(['burn', 'slow']);
    expect(spec.vfx).toEqual([]);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('handles garbage input', () => {
    expect(validateWeaponSpec('not json', DEFAULT_SWING).spec).toBe(DEFAULT_SWING);
    expect(validateWeaponSpec(null, DEFAULT_SWING).spec).toBe(DEFAULT_SWING);
  });

  it('drops projectile on non-shoot archetypes', () => {
    const { spec } = validateWeaponSpec({ ...DEFAULT_SWING, projectile: { count: 3, spread_deg: 10, speed: 1, behavior: 'arc' } }, DEFAULT_SWING);
    expect(spec.projectile).toBeNull();
  });

  it('rescales 0–10 / 0–100 answers instead of clamping them to max', () => {
    const { spec } = validateWeaponSpec({ ...DEFAULT_SWING, range: 7, area: 45, motion: { elasticity: 0.5, weight: 4, wobble: 0.2 } }, DEFAULT_SWING);
    expect(spec.range).toBeCloseTo(0.7);
    expect(spec.area).toBeCloseTo(0.45);
    expect(spec.motion.weight).toBeCloseTo(0.4);
  });

  it('drops duplicate vfx types', () => {
    const { spec } = validateWeaponSpec({
      ...DEFAULT_SWING,
      vfx: [{ type: 'poison', where: 'trail', intensity: 0.5 }, { type: 'poison', where: 'impact', intensity: 0.9 }],
    }, DEFAULT_SWING);
    expect(spec.vfx.map((v) => v.type)).toEqual(['poison']);
  });
});
