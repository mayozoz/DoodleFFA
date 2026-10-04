import { describe, expect, it } from 'vitest';
import { ABILITIES } from '@doodle/spec';
import { createAbilityPreview } from '../src/routes/play/ability-preview';

function advance(id: keyof typeof ABILITIES, seconds: number) {
  const demo = createAbilityPreview(id);
  for (let i = 0; i < seconds * 20; i++) demo.step();
  return demo;
}

describe('ability demonstrations use battle mechanics', () => {
  it.each(Object.keys(ABILITIES) as (keyof typeof ABILITIES)[])('%s activates once without requiring a live server', id => {
    const demo = advance(id, 7);
    expect(demo.fighters.get(demo.you.toHexString())!.abilityCharges).toBe(1);
  });
  it('shows hook actually pulling the opponent close', () => {
    const demo = advance('hook', 2);
    const you = demo.fighters.get(demo.you.toHexString())!, foe = demo.fighters.get(demo.foe.toHexString())!;
    expect(Math.hypot(you.x - foe.x, you.y - foe.y)).toBeCloseTo(1);
  });
  it('shows frozen opponents unable to move before thawing', () => {
    const demo = advance('freeze', 2);
    expect(demo.fighters.get(demo.foe.toHexString())!.x).toBe(0);
    for (let i = 0; i < 50; i++) demo.step();
    expect(demo.fighters.get(demo.foe.toHexString())!.x).toBeGreaterThan(0);
  });
  it('shows life drain restoring health equal to the damage dealt', () => {
    const demo = advance('life_drain', 2);
    const you = demo.fighters.get(demo.you.toHexString())!, foe = demo.fighters.get(demo.foe.toHexString())!;
    expect(you.hp).toBeGreaterThan(3000);
    expect(you.hp - 3000).toBeCloseTo(5000 - foe.hp);
  });
  it('shows traps poisoning an opponent who walks into them', () => {
    const demo = advance('mushrooms', 4);
    expect(JSON.parse(demo.fighters.get(demo.foe.toHexString())!.effects).poison).toBeDefined();
    expect(demo.fighters.get(demo.foe.toHexString())!.hp).toBeLessThan(5000);
  });
});
