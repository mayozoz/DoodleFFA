import { arenaExtents, hashString, mulberry32, rollDamage, stormStartRadius, type StoredWeapon, type WeaponSpec } from '@doodle/spec';
import { BALANCE, GAME, KNOCKBACK } from '../balance';
import { addSeconds, secondsBetween } from './time';
import { readWeapon } from './weapons';
import type { Ctx, FighterRow, RoomRow } from './ctx';

// Battle simulation for one room, one tick. Server-authoritative; clients only render.
// Budget: O(n²) over ≤12 fighters + projectiles. No spatial index.

/** Per-fighter transient state, stored as JSON in `fighter.effects`. */
interface Effects {
  /** knockback velocity (units/s), decays every tick */
  kb?: [number, number];
}

function readEffects(f: FighterRow): Effects {
  try { return f.effects ? (JSON.parse(f.effects) as Effects) : {}; } catch { return {}; }
}

/** How far this weapon shoves a victim (world units). */
export function knockbackDistance(spec: WeaponSpec): number {
  let d = KNOCKBACK.base[spec.archetype] * (0.7 + 0.6 * spec.motion.weight);
  if (spec.on_hit.includes('knockback')) d *= KNOCKBACK.onHitBonus;
  if (spec.vfx.some((v) => v.type === 'goo')) d *= KNOCKBACK.gooBonus;
  return d;
}

export function stepBattle(ctx: Ctx, r: RoomRow, dt: number) {
  const now = ctx.timestamp;
  const elapsed = secondsBetween(r.phaseStartedAt, now);
  const rand = mulberry32(r.seed ^ hashString(`${Math.floor(elapsed * GAME.tickHz)}`));

  const fighters = new Map<string, FighterRow>();
  const weapons = new Map<string, StoredWeapon>();
  const effects = new Map<string, Effects>();
  for (const f of ctx.db.fighter.roomCode.filter(r.code)) {
    if (f.hp <= 0) continue;
    const id = f.player.toHexString();
    fighters.set(id, { ...f });
    weapons.set(id, readWeapon(ctx.db.weapon.player.find(f.player)));
    effects.set(id, readEffects(f));
  }

  // 1. Movement (clamped to the screen-shaped arena rectangle)
  const { hw, hh } = arenaExtents(r.arenaR);
  const mx = hw - GAME.hitRadius, my = hh - GAME.hitRadius;
  const decay = Math.exp(-dt / KNOCKBACK.decayS);
  for (const [id, f] of fighters) {
    // knockback push (applied even if the player isn't touching the stick)
    const fx = effects.get(id)!;
    if (fx.kb) {
      f.x += fx.kb[0] * dt;
      f.y += fx.kb[1] * dt;
      fx.kb = [fx.kb[0] * decay, fx.kb[1] * decay];
      if (Math.hypot(fx.kb[0], fx.kb[1]) < 0.2) delete fx.kb;
      f.x = Math.max(-mx, Math.min(mx, f.x));
      f.y = Math.max(-my, Math.min(my, f.y));
    }
    const input = ctx.db.input.player.find(f.player);
    if (!input) continue;
    const speed = GAME.moveSpeed * weapons.get(id)!.stats.moveSpeedMul; // TODO(M2): × slow effect
    f.x += input.dx * speed * dt;
    f.y += input.dy * speed * dt;
    if (input.dx !== 0 || input.dy !== 0) f.facing = Math.atan2(input.dy, input.dx);
    f.x = Math.max(-mx, Math.min(mx, f.x));
    f.y = Math.max(-my, Math.min(my, f.y));
  }

  // 2. Attacks (one buffered press, fires when cooldown is ready)
  for (const [id, f] of fighters) {
    const input = ctx.db.input.player.find(f.player);
    if (!input?.attackBuffered || now.microsSinceUnixEpoch < f.cooldownReadyAt.microsSinceUnixEpoch) continue;
    const w = weapons.get(id)!;
    const target = autoAim(f, fighters);
    if (target) f.facing = Math.atan2(target.y - f.y, target.x - f.x);
    resolveAttack(ctx, r, f, w, fighters, effects, rand);
    f.cooldownReadyAt = addSeconds(now, w.stats.cooldown);
    f.lastAttackAt = now;
    ctx.db.input.player.update({ ...input, attackBuffered: false });
  }

  // 3. Projectiles — TODO(M2): move, collide, pierce/bounce/split/homing/arc, expire.
  // 4. Effects (burn/poison DoT, slow, thorns) — TODO(M2): read/write f.effects JSON.

  // 5. Storm: shrinks from stormStartS to suddenDeathS, then sudden death ramps damage.
  const stormR = stormRadius(r, elapsed);
  const sdDps = elapsed >= GAME.suddenDeathS
    ? GAME.suddenDeathDpsStart + (elapsed - GAME.suddenDeathS) * GAME.suddenDeathDpsPerS : 0;
  for (const f of fighters.values()) {
    if (Math.hypot(f.x - r.stormX, f.y - r.stormY) > stormR) f.hp -= GAME.stormDps * dt;
    f.hp -= sdDps * dt;
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
    const fx = effects.get(f.player.toHexString());
    f.effects = fx && Object.keys(fx).length ? JSON.stringify(fx) : '{}';
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
function autoAim(f: FighterRow, all: Map<string, FighterRow>): FighterRow | null {
  let best: FighterRow | null = null, bestScore = Infinity;
  for (const o of all.values()) {
    if (o.player.isEqual(f.player)) continue;
    const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy);
    const off = Math.abs(normAngle(Math.atan2(dy, dx) - f.facing));
    const score = d * (off < Math.PI / 2 ? 1 : 2.5);
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best;
}

/** M1: every archetype resolves as a swing arc. TODO(M2): per-archetype hitboxes (see README). */
function resolveAttack(
  ctx: Ctx, r: RoomRow, f: FighterRow, w: StoredWeapon,
  all: Map<string, FighterRow>, effects: Map<string, Effects>, rand: () => number,
) {
  // Initial speed whose per-tick decaying steps sum to exactly the knockback distance
  // (Σ v·dt·decayⁿ = v·dt / (1 − decay)), so balance.ts distances are what players get.
  const dt = 1 / GAME.tickHz, decay = Math.exp(-dt / KNOCKBACK.decayS);
  const push = (knockbackDistance(w.spec) * (1 - decay)) / dt;
  emitFx(ctx, r.code, 'attack', f.x, f.y, f.player, f.facing);
  const reach = w.stats.rangeUnits + GAME.hitRadius;
  const halfArc = (140 / 2) * (Math.PI / 180);
  for (const o of all.values()) {
    if (o.player.isEqual(f.player) || o.hp <= 0) continue;
    const dx = o.x - f.x, dy = o.y - f.y;
    if (Math.hypot(dx, dy) > reach) continue;
    if (Math.abs(normAngle(Math.atan2(dy, dx) - f.facing)) > halfArc) continue;
    const dmg = rollDamage(w.stats.damagePerHit, rand, BALANCE);
    o.hp -= dmg;
    emitFx(ctx, r.code, 'hit', o.x, o.y, f.player, dmg);
    // Knockback, away from the attacker (along the attack direction if they overlap).
    const d = Math.hypot(dx, dy);
    const [ux, uy] = d > 1e-3 ? [dx / d, dy / d] : [Math.cos(f.facing), Math.sin(f.facing)];
    const ofx = effects.get(o.player.toHexString());
    if (ofx) {
      let vx = (ofx.kb?.[0] ?? 0) + ux * push, vy = (ofx.kb?.[1] ?? 0) + uy * push;
      const sp = Math.hypot(vx, vy);
      if (sp > KNOCKBACK.maxSpeed) { vx *= KNOCKBACK.maxSpeed / sp; vy *= KNOCKBACK.maxSpeed / sp; }
      ofx.kb = [vx, vy];
    }
    // TODO(M2): other on_hit effects (burn, slow, chain, lifesteal, pierce).
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

