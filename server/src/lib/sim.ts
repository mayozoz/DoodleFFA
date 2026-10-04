import { activateAbility, battleGeometry, type BattleGeometry, damage, hasEffect, hitRadius, moveFighter, stepAbilityObjects, stepStatuses, timeSeconds, untargetable } from './abilities';
import { ABILITY_TUNING, hashString, mulberry32, rollDamage, stormStartRadius, type StoredWeapon } from '@doodle/spec';
import { BALANCE, GAME } from '../balance';
import { addSeconds, secondsBetween } from './time';
import { readWeapon } from './weapons';
import type { Ctx, FighterRow, RoomRow } from './ctx';

// Battle simulation for one room, one tick. Server-authoritative; clients only render.
// Budget: O(n²) over ≤12 fighters + projectiles. No spatial index.

export function stepBattle(ctx: Ctx, r: RoomRow, dt: number) {
  const now = ctx.timestamp;
  const seconds = timeSeconds(ctx);
  const elapsed = secondsBetween(r.phaseStartedAt, now);
  const rand = mulberry32(r.seed ^ hashString(`${Math.floor(elapsed * GAME.tickHz)}`));

  const fighters = new Map<string, FighterRow>();
  const weapons = new Map<string, StoredWeapon>();
  for (const f of ctx.db.fighter.roomCode.filter(r.code)) {
    if (f.hp <= 0) continue;
    const id = f.player.toHexString();
    fighters.set(id, { ...f });
    weapons.set(id, readWeapon(ctx.db.weapon.player.find(f.player)));
  }

  stepStatuses(ctx, fighters, dt);

  const geometry = battleGeometry(ctx, r);

  // 1. Movement (clamped to the screen-shaped arena rectangle)
  for (const [id, f] of fighters) {
    const input = ctx.db.input.player.find(f.player);
    if (!input || f.hp <= 0 || hasEffect(f, 'frozen', seconds)) continue;
    const speed = GAME.moveSpeed * weapons.get(id)!.stats.moveSpeedMul; // TODO(M2): × slow effect
    if (input.dx !== 0 || input.dy !== 0) f.facing = Math.atan2(input.dy, input.dx);
    moveFighter(ctx, r, f, f.x + input.dx * speed * dt, f.y + input.dy * speed * dt, geometry);
  }

  // Consume special requests once, including requests rejected by cooldown/status checks.
  for (const f of fighters.values()) {
    const input = ctx.db.input.player.find(f.player);
    if (!input?.abilityBuffered) continue;
    ctx.db.input.player.update({ ...input, abilityBuffered: false });
    if (!hasEffect(f, 'frozen', seconds)) activateAbility(ctx, r, f, fighters);
  }

  const aimGeometry = battleGeometry(ctx, r);

  // 2. Attacks (one buffered press, fires when cooldown is ready)
  for (const [id, f] of fighters) {
    const input = ctx.db.input.player.find(f.player);
    if (f.hp <= 0 || hasEffect(f, 'silenced', seconds) || hasEffect(f, 'frozen', seconds)) {
      if (input?.attackBuffered) ctx.db.input.player.update({ ...input, attackBuffered: false });
      continue;
    }
    if (!input?.attackBuffered || now.microsSinceUnixEpoch < f.cooldownReadyAt.microsSinceUnixEpoch) continue;
    const w = weapons.get(id)!;
    const target = autoAim(ctx, r, f, fighters, aimGeometry);
    if (target) f.facing = Math.atan2(target.y - f.y, target.x - f.x);
    resolveAttack(ctx, r, f, w, fighters, rand);
    f.cooldownReadyAt = addSeconds(now, w.stats.cooldown / (hasEffect(f, 'rage', seconds) ? ABILITY_TUNING.attackSpeedMultiplier : 1));
    f.lastAttackAt = now;
    ctx.db.input.player.update({ ...input, attackBuffered: false });
  }

  // 3. Projectiles — TODO(M2): move, collide, pierce/bounce/split/homing/arc, expire.
  stepAbilityObjects(ctx, r, fighters, weapons, dt);

  // 5. Storm: shrinks from stormStartS to suddenDeathS, then sudden death ramps damage.
  const stormR = stormRadius(r, elapsed);
  const sdDps = elapsed >= GAME.suddenDeathS
    ? GAME.suddenDeathDpsStart + (elapsed - GAME.suddenDeathS) * GAME.suddenDeathDpsPerS : 0;
  for (const f of fighters.values()) {
    if (Math.hypot(f.x - r.stormX, f.y - r.stormY) > stormR) damage(f, GAME.stormDps * dt, seconds);
    damage(f, sdDps * dt, seconds);
  }

  // 6. Deaths + write back
  let alive = 0;
  for (const f of fighters.values()) if (f.hp > 0) alive++;
  for (const f of fighters.values()) {
    if (f.hp <= 0) {
      f.hp = 0;
      const p = ctx.db.player.identity.find(f.player);
      if (p) ctx.db.player.identity.update({ ...p, alive: false, placement: alive + 1 });
      emitFx(ctx, r.code, 'death', f.x, f.y, f.player, 0);
    }
    ctx.db.fighter.player.update(f);
  }

  const roomUpdate: RoomRow = { ...r, stormR };
  // Last one standing → end now; tick() advances to Results next frame.
  if (alive <= 1) roomUpdate.phaseEndsAt = now;
  ctx.db.room.code.update(roomUpdate);
}

/** Starts at the circle through the arena corners (all safe), ends at a fraction of the half-width. */
export function stormRadius(r: RoomRow, elapsed: number): number {
  const t = Math.min(1, Math.max(0, (elapsed - GAME.stormStartS) / (GAME.suddenDeathS - GAME.stormStartS)));
  const start = stormStartRadius(r.arenaR), end = r.arenaR * GAME.stormEndRadiusFrac;
  return start + (end - start) * t;
}

/** Nearest enemy within ~90° of facing; else nearest overall. */
function autoAim(ctx: Ctx, r: RoomRow, f: FighterRow, all: Map<string, FighterRow>, geometry: BattleGeometry): FighterRow | null {
  let best: FighterRow | null = null, bestScore = Infinity;
  for (const o of all.values()) {
    if (o.player.isEqual(f.player) || o.hp <= 0 || untargetable(ctx, r, o, geometry)) continue;
    const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy);
    const off = Math.abs(normAngle(Math.atan2(dy, dx) - f.facing));
    const score = d * (off < Math.PI / 2 ? 1 : 2.5);
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best;
}

/** M1: every archetype resolves as a swing arc. TODO(M2): per-archetype hitboxes (see README). */
function resolveAttack(ctx: Ctx, r: RoomRow, f: FighterRow, w: StoredWeapon, all: Map<string, FighterRow>, rand: () => number) {
  emitFx(ctx, r.code, 'attack', f.x, f.y, f.player, f.facing);
  const seconds = timeSeconds(ctx);
  const range = w.stats.rangeUnits * (hasEffect(f, 'weapon_boost', seconds) ? ABILITY_TUNING.weaponScale : 1);
  const halfArc = (140 / 2) * (Math.PI / 180);
  for (const o of all.values()) {
    if (o.player.isEqual(f.player) || o.hp <= 0) continue;
    const dx = o.x - f.x, dy = o.y - f.y;
    if (Math.hypot(dx, dy) > range + hitRadius(o, seconds)) continue;
    if (Math.abs(normAngle(Math.atan2(dy, dx) - f.facing)) > halfArc) continue;
    const dmg = damage(o, rollDamage(w.stats.damagePerHit, rand, BALANCE) * (hasEffect(f, 'attack_boost', seconds) ? ABILITY_TUNING.attackDamageMultiplier : 1), seconds);
    emitFx(ctx, r.code, 'hit', o.x, o.y, f.player, dmg);
    // TODO(M2): on_hit effects (knockback, burn, slow, chain, lifesteal, pierce).
  }
}

export function emitFx(ctx: Ctx, roomCode: string, type: string, x: number, y: number, owner: FighterRow['player'], value: number) {
  ctx.db.fxEvent.insert({ id: 0n, roomCode, type, x, y, owner, value, createdAt: ctx.timestamp });
}

export function cleanupFx(ctx: Ctx, roomCode: string) {
  const cutoff = ctx.timestamp.microsSinceUnixEpoch - BigInt(GAME.fxEventTtlMs * 1000);
  for (const e of [...ctx.db.fxEvent.roomCode.filter(roomCode)]) {
    if (e.createdAt.microsSinceUnixEpoch < cutoff) ctx.db.fxEvent.id.delete(e.id);
  }
}

const normAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

