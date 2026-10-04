import { describe, expect, it } from 'vitest';
import { ABILITIES, ABILITY_DESCRIPTIONS, ABILITY_STYLES, abilityStyle, rollAbility, type AbilityStyle } from '../src/abilities';
import { mulberry32 } from '../src/rng';

describe('play style ability rolls', () => {
  it('places every playable ability in exactly one pool with a description', () => {
    const ids = Object.values(ABILITY_STYLES).flatMap(style => [...style.abilities]);
    expect(ids.sort()).toEqual(Object.keys(ABILITIES).sort());
    for (const id of ids) expect(ABILITY_DESCRIPTIONS[id].length).toBeGreaterThan(20);
  });
  it.each(Object.keys(ABILITY_STYLES) as AbilityStyle[])('only rolls %s abilities and retains the chosen style across rounds', style => {
    const pool = ABILITY_STYLES[style].abilities;
    const random = mulberry32(12345);
    let selected: string = pool[0];
    const seen = new Set<string>();
    for (let round = 0; round < 100; round++) {
      selected = rollAbility(selected, random);
      expect(pool).toContain(selected);
      expect(abilityStyle(selected)).toBe(style);
      seen.add(selected);
    }
    expect(seen.size).toBe(pool.length);
  });
  it('defaults old or invalid selections to mobility and handles pool boundaries', () => {
    expect(rollAbility('unknown', () => 0)).toBe('flash');
    expect(rollAbility('flash', () => 0.99999)).toBe('fire_steps');
  });
});
