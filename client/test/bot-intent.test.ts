import { expect, it } from 'vitest';
import { botIntent } from '../src/routes/solo/bot-intent';

const self = { id: 'bot', x: 0, y: 0, hp: 100 };
it('pursues the nearest living opponent and ignores itself and dead fighters', () => {
  const intent = botIntent(self, [self, { id: 'dead', x: .1, y: 0, hp: 0 }, { id: 'far', x: -8, y: 0, hp: 100 }, { id: 'near', x: 2, y: 0, hp: 100 }], false);
  expect(intent).toEqual({ dx: .75, dy: 0, attack: true, special: true });
});
it('holds ranged attack distance while continuing to face the target', () => {
  const intent = botIntent(self, [{ id: 'player', x: 0, y: -4, hp: 100 }], true);
  expect(intent.dy).toBe(-.08); expect(intent.attack).toBe(true);
});
it('moves toward distant opponents without attacking outside range', () => {
  const intent = botIntent(self, [{ id: 'player', x: 20, y: 0, hp: 100 }], false);
  expect(intent.dx).toBe(.75); expect(intent.attack).toBe(false); expect(intent.special).toBe(false);
});
it('stops after elimination or when no opponents remain', () => {
  expect(botIntent(self, [self], false)).toEqual({ dx: 0, dy: 0, attack: false, special: false });
  expect(botIntent({ ...self, hp: 0 }, [{ id: 'player', x: 1, y: 0, hp: 100 }], false).attack).toBe(false);
});
