import { describe, expect, it } from 'vitest';
import { MYSTERY_STICK, type StoredWeapon } from '@doodle/spec';
import { weaponGuide } from '../src/routes/play/weapon-guide';
const base: StoredWeapon = { spec: { ...MYSTERY_STICK, vfx: [], decor: [] }, stats: { rangeUnits: 2, cooldown: .6 } as StoredWeapon['stats'] };
describe('weapon element descriptions', () => {
  it('shows combined elements while preserving attack type and reach', () => {
    const info = weaponGuide({ ...base, spec: { ...base.spec, vfx: [{type:'fire',where:'trail',intensity:.6},{type:'ice',where:'trail',intensity:.6}], decor: [{type:'flames',at:'edge',color:'#f00',intensity:.6}] } });
    expect(info.element).toBe('Fire + Ice');
    expect(info.type).toBe('Swing');
    expect(info.range).toContain('2.0');
    expect(info.elementDescription).toContain('Frost');
  });
  it('identifies thunder from electric effects and physical weapons with no effects', () => {
    expect(weaponGuide({ ...base, spec: { ...base.spec, vfx: [{type:'electric',where:'impact',intensity:.6}] } }).element).toBe('Thunder');
    expect(weaponGuide(base).element).toBe('Physical');
  });
});
