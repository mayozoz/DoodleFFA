import { ScheduleAt } from 'spacetimedb';
import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from '../schema';
import { GAME } from '../balance';

/** Runs once on first publish (and after `--delete-data`). */
export const init = spacetimedb.init((ctx) => {
  // The publisher becomes the admin who may call set_secret.
  ctx.db.admin.insert({ identity: ctx.sender });
  // One global 20 Hz tick. Each tick loops over all active rooms.
  ctx.db.tickSchedule.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.interval(BigInt(Math.round(1_000_000 / GAME.tickHz))),
  });
});

/** Store an API key. Owner only. Values are never logged or exposed to clients. */
export const setSecret = spacetimedb.reducer(
  { key: t.string(), value: t.string() },
  (ctx, { key, value }) => {
    if (!ctx.db.admin.identity.find(ctx.sender)) throw new SenderError('not allowed');
    const existing = ctx.db.secrets.key.find(key);
    if (existing) ctx.db.secrets.key.update({ key, value });
    else ctx.db.secrets.insert({ key, value });
  },
);
