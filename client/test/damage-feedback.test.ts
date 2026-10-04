import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Identity } from 'spacetimedb';
import type { PlayCtx } from '../src/routes/play/types';
import { mountDamageFeedback } from '../src/routes/play/damage-feedback';
const feedback = vi.hoisted(() => ({ hit: vi.fn(), dispose: vi.fn() }));
vi.mock('../src/ui/haptics', () => ({ createDamageHaptics: () => feedback }));

const me = Identity.fromString('1'.padStart(64, '0'));
const other = Identity.fromString('2'.padStart(64, '0'));
function setup() {
  let listener: any;
  let phase = 'battle';
  const remove = vi.fn();
  const ctx = { identity: me, roomCode: 'TEST', el: {}, conn: { db: {
    room: { code: { find: () => ({ phase }) } },
    fxEvent: { iter: () => [{ id: 5n }], onInsert: (fn: any) => { listener = fn; }, removeOnInsert: remove },
  } } } as unknown as PlayCtx;
  const dispose = mountDamageFeedback(ctx);
  let id = 6n;
  const emit = (patch = {}, tag = 'Transaction') => listener({ event: { tag } }, {
    id: id++, roomCode: 'TEST', type: 'damage', owner: me, value: 10, ...patch,
  });
  return { emit, dispose, remove, phase: (p: string) => { phase = p; } };
}
beforeEach(() => vi.clearAllMocks());
describe('controller damage events', () => {
  it('only reacts to fresh positive damage for this player and room during battle', () => {
    const s = setup();
    s.emit({ type: 'attack' }); s.emit({ type: 'hit' }); s.emit({ owner: other });
    s.emit({ roomCode: 'OTHER' }); s.emit({ value: 0 }); s.emit({ value: -1 });
    s.emit({ id: 5n }); s.emit({}, 'SubscribeApplied');
    expect(feedback.hit).not.toHaveBeenCalled();
    s.emit({ id: 100n }); s.emit({ id: 100n });
    expect(feedback.hit).toHaveBeenCalledTimes(1);
    s.phase('results'); s.emit({ id: 101n });
    expect(feedback.hit).toHaveBeenCalledTimes(1);
    s.dispose();
    expect(s.remove).toHaveBeenCalledOnce(); expect(feedback.dispose).toHaveBeenCalledOnce();
  });
});
