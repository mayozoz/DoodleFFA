import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'spacetimedb';

afterEach(() => vi.restoreAllMocks());

describe('server clock during battle updates', () => {
  it('counts down to the second ability use despite repeated room updates', async () => {
    vi.resetModules();
    const clock = await import('../src/net/clock');
    let localMs = 105_000;
    vi.spyOn(Date, 'now').mockImplementation(() => localMs);
    const phaseStart = new Timestamp(100_000_000n);
    clock.syncFromPhaseStart(phaseStart);
    // Ability pressed 2 seconds into the round, with an 8-second cooldown.
    const readyAt = new Timestamp(110_000_000n);
    for (let elapsed = 2; elapsed <= 11; elapsed++) {
      localMs = 105_000 + elapsed * 1000;
      clock.syncFromPhaseStart(new Timestamp(phaseStart.microsSinceUnixEpoch));
      expect(clock.secondsLeft(readyAt)).toBe(Math.max(0, 10 - elapsed));
      expect(clock.serverNowMs()).toBe(100_000 + elapsed * 1000);
    }
    expect(clock.secondsOverdue(readyAt)).toBe(1);
    // A new phase can establish a fresh clock offset.
    clock.syncFromPhaseStart(new Timestamp(120_000_000n));
    expect(clock.serverNowMs()).toBe(120_000);
  });
});
