import { mulberry32, type Phase } from '@doodle/spec';
import { GAME, PHASE_SECONDS } from '../balance';
import { addSeconds } from './time';
import { applyFallbacks } from './weapons';
import type { Ctx, RoomRow } from './ctx';

const NEXT: Record<Phase, Phase> = {
  lobby: 'draw', draw: 'drop', drop: 'reveal', reveal: 'battle', battle: 'results', results: 'lobby',
};

export function advancePhase(ctx: Ctx, r: RoomRow) {
  if (r.phase === 'battle') finishBattle(ctx, r);
  enterPhase(ctx, r, NEXT[r.phase as Phase]);
}

/** Single place that mutates `room.phase`. Runs the on-enter side effects. */
export function enterPhase(ctx: Ctx, r: RoomRow, phase: Phase) {
  const seconds = phase === 'lobby' ? 0 : PHASE_SECONDS[phase];
  const next: RoomRow = { ...r, phase, phaseStartedAt: ctx.timestamp, phaseEndsAt: addSeconds(ctx.timestamp, seconds) };

  switch (phase) {
    case 'draw':
      resetRound(ctx, r.code);
      next.winner = '';
      break;
    case 'reveal':
      applyFallbacks(ctx, r.code, r.seed);
      break;
    case 'battle':
      Object.assign(next, spawnFighters(ctx, r));
      break;
  }
  ctx.db.room.code.update(next);
}

function resetRound(ctx: Ctx, code: string) {
  for (const p of ctx.db.player.roomCode.filter(code)) {
    ctx.db.player.identity.update({ ...p, alive: true, dropX: -1, dropY: -1, placement: 0 });
    ctx.db.input.player.delete(p.identity);
  }
  ctx.db.drawing.roomCode.delete(code);
  ctx.db.doodle.roomCode.delete(code);
  ctx.db.weapon.roomCode.delete(code);
  ctx.db.fighter.roomCode.delete(code);
  ctx.db.projectile.roomCode.delete(code);
  ctx.db.fxEvent.roomCode.delete(code);
}

/** Arena + storm scale with player count. Fighters spawn at their drop (or a seeded random spot). */
function spawnFighters(ctx: Ctx, r: RoomRow): Partial<RoomRow> {
  const players = [...ctx.db.player.roomCode.filter(r.code)];
  const arenaR = GAME.arenaBaseRadius + GAME.arenaPerPlayer * players.length;
  const rand = mulberry32(r.seed);
  for (const p of players) {
    let nx = p.dropX, ny = p.dropY;
    if (nx < 0 || ny < 0) { nx = rand(); ny = rand(); }
    // Map the unit square onto the arena disc.
    let x = (nx * 2 - 1) * arenaR, y = (ny * 2 - 1) * arenaR;
    const len = Math.hypot(x, y), max = arenaR - 1;
    if (len > max) { x *= max / len; y *= max / len; }
    ctx.db.fighter.insert({
      player: p.identity, roomCode: r.code, x, y, facing: 0, hp: GAME.maxHp,
      cooldownReadyAt: ctx.timestamp, lastAttackAt: ctx.timestamp, effects: '{}',
    });
  }
  return { arenaR, stormX: 0, stormY: 0, stormR: arenaR };
}

/** Assign placements to survivors and pick the winner (highest HP% on a tie). */
function finishBattle(ctx: Ctx, r: RoomRow) {
  const fighters = [...ctx.db.fighter.roomCode.filter(r.code)].sort((a, b) => b.hp - a.hp);
  const best = fighters[0];
  // enterPhase() writes the room row right after this, so mutate rather than update.
  if (best && !r.winner) r.winner = best.player.toHexString();
  fighters.forEach((f, i) => {
    const p = ctx.db.player.identity.find(f.player);
    if (p && p.placement === 0) ctx.db.player.identity.update({ ...p, placement: i + 1 });
  });
}
