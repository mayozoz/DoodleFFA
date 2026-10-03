import { t } from 'spacetimedb/server';
import spacetimedb from '../schema';

// Intent only. The tick decides what actually happens.

/** Joystick vector. Controllers send only on change, max 20/s. */
export const setInput = spacetimedb.reducer(
  { dx: t.f32(), dy: t.f32() },
  (ctx, { dx, dy }) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const row = ctx.db.input.player.find(ctx.sender);
    if (row) ctx.db.input.player.update({ ...row, dx, dy });
    else ctx.db.input.insert({ player: ctx.sender, dx, dy, attackBuffered: false });
  },
);

/** One buffered press: fires the instant the cooldown is ready. Mashing never fires faster. */
export const pressAttack = spacetimedb.reducer((ctx) => {
  const row = ctx.db.input.player.find(ctx.sender);
  if (row) ctx.db.input.player.update({ ...row, attackBuffered: true });
  else ctx.db.input.insert({ player: ctx.sender, dx: 0, dy: 0, attackBuffered: true });
});
