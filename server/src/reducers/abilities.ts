import { t } from 'spacetimedb/server';
import { isAbilityId } from '@doodle/spec';
import spacetimedb from '../schema';

export const selectAbility = spacetimedb.reducer({ abilityId: t.string() }, (ctx, { abilityId }) => {
  if (!isAbilityId(abilityId)) return;
  const p = ctx.db.player.identity.find(ctx.sender);
  const r = p && ctx.db.room.code.find(p.roomCode);
  if (!p || !r || !['lobby', 'draw', 'drop'].includes(r.phase)) return;
  ctx.db.player.identity.update({ ...p, abilityId });
});

export const pressAbility = spacetimedb.reducer((ctx) => {
  const f = ctx.db.fighter.player.find(ctx.sender);
  const r = f && ctx.db.room.code.find(f.roomCode);
  if (!f || !r || r.phase !== 'battle' || f.hp <= 0 || f.abilityCharges === 0 ||
      ctx.timestamp.microsSinceUnixEpoch < f.abilityReadyAt.microsSinceUnixEpoch) return;
  const row = ctx.db.input.player.find(ctx.sender);
  if (row) ctx.db.input.player.update({ ...row, abilityBuffered: true });
  else ctx.db.input.insert({ player: ctx.sender, dx: 0, dy: 0, attackBuffered: false, abilityBuffered: true });
});
