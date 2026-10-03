import { SenderError } from 'spacetimedb/server';
import spacetimedb, { tickSchedule } from '../schema';
import { isAfterOrEqual } from '../lib/time';
import { advancePhase } from '../lib/phases';
import { cleanupFx, stepBattle } from '../lib/sim';
import { GAME } from '../balance';

/**
 * 20 Hz global tick (see GAME.tickHz). For every non-lobby room:
 * phase timers → transitions (incl. fallbacks at Reveal), and during Battle the full
 * simulation: movement, attacks, projectiles, collisions, effects, storm, round end.
 */
export const tick = spacetimedb.reducer(
  { onSchedule: tickSchedule },
  { arg: tickSchedule.rowType },
  (ctx) => {
    // The scheduler calls with the database's own identity. (senderAuth.isInternal is false for
    // every reducer call, scheduled or not, so it can't be used here.)
    if (!ctx.sender.isEqual(ctx.databaseIdentity)) throw new SenderError('tick is scheduler-only');
    const dt = 1 / GAME.tickHz;
    for (const r of [...ctx.db.room.iter()]) {
      if (r.phase === 'lobby') continue;
      if (isAfterOrEqual(ctx.timestamp, r.phaseEndsAt)) {
        advancePhase(ctx, r);
        continue;
      }
      if (r.phase === 'battle') stepBattle(ctx, r, dt);
      cleanupFx(ctx, r.code);
    }
  },
);
