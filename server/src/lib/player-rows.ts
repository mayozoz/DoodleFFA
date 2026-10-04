import type { Identity } from 'spacetimedb';
import type { Ctx } from './ctx';

/**
 * Remove one identity's per-round rows (drawing, doodle, weapon, fighter, input) from *any*
 * room. These tables are keyed by identity, so a stale row left in an old room would block the
 * same player from getting a new one (it once froze every room via a fighter insert).
 */
export function clearPlayerRoundRows(ctx: Ctx, id: Identity) {
  ctx.db.drawing.player.delete(id);
  ctx.db.doodle.player.delete(id);
  ctx.db.weapon.player.delete(id);
  ctx.db.weaponVoice.player.delete(id);
  ctx.db.fighter.player.delete(id);
  ctx.db.input.player.delete(id);
}
