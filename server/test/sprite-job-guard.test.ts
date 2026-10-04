import { describe, expect, it, vi } from 'vitest';
import { writeIfStillPending, type GenJob, type PCtx } from '../src/procedures/common';

const png = new Uint8Array([1, 2, 3]);
const job = { roomCode: 'TEST', round: 1, seed: 42, epoch: 'one', png } as GenJob;

function attempt(overrides: { round?: number; phase?: string; png?: Uint8Array; code?: string; spriteUrl?: string } = {}) {
  const update = vi.fn();
  const tx = { db: {
    generation: { player: { find: () => ({ epoch: 'one' }) } },
    weapon: { player: { find: () => ({ spriteUrl: overrides.spriteUrl ?? '' }), update } },
    player: { identity: { find: () => ({ roomCode: 'TEST' }) } },
    room: { code: { find: () => ({ code: overrides.code ?? 'TEST', round: overrides.round ?? 1, seed: 42, phase: overrides.phase ?? 'reveal' }) } },
    drawing: { player: { find: () => ({ png: overrides.png ?? png }) } },
  } };
  const ctx = { sender: {}, withTx: (fn: (value: unknown) => void) => fn(tx) } as unknown as PCtx;
  writeIfStillPending(ctx, 'spriteUrl', 'data:image/png;base64,AQID', false, job);
  return update;
}

describe('sprite response lifetime', () => {
  it('accepts current art during Reveal', () => { expect(attempt()).toHaveBeenCalledOnce(); });
  it.each([{ round: 2 }, { phase: 'battle' }, { png: new Uint8Array([4, 5, 6]) }, { code: 'NEXT' }, { spriteUrl: 'existing' }])('discards stale or duplicate art: %j', (change) => {
    expect(attempt(change)).not.toHaveBeenCalled();
  });
});
