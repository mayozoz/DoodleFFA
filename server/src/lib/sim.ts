import {
  arenaExtents, hashString, mulberry32, rollDamage, stormStartRadius, strikeDelayS,
  type ProjectileMeta, type StoredWeapon, type WeaponSpec,
} from '@doodle/spec';
import { Timestamp } from 'spacetimedb';
import { BALANCE, GAME, KNOCKBACK, PROJECTILE } from '../balance';
import { addSeconds, secondsBetween } from './time';
import { readWeapon } from './weapons';
import { contains, meleeShape } from './hitbox';
import type { Ctx, FighterRow, RoomRow } from './ctx';

// Battle simulation for one room, one tick. Server-authoritative; clients only render.
// Budget: O(n²) over ≤12 fighters + projectiles. No spatial index.

/** Per-fighter transient state, stored as JSON in `fighter.effects`. */
interface Effects {
  /** knockback velocity (units/s), decays every tick */
  kb?: [number, number];
  /** queued attack: resolves at `at` (ms since epoch) with the facing locked at press */
  pa?: { at: number; f: number };
}

/** Everything a hit needs, shared by melee, projectiles and splashes. */
interface World {
  ctx: Ctx;
  r: RoomRow;
  fighters: Map<string, FighterRow>;
  weapons: Map<string, StoredWeapon>;
  effects: Map<string, Effects>;
  rand: () => number;
}

const nowMs = (ctx: Ctx) => Number(ctx.timestamp.microsSinceUnixEpoch / 1000n);

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

  const world: World = { ctx, r, fighters, weapons, effects, rand };
  const tMs = nowMs(ctx);

  // Boomerangs: one in the air per owner — you can't throw again until you catch it.
  const throwing = new Set<string>();
  for (const p of ctx.db.projectile.roomCode.filter(r.code)) {
    if (p.hits.includes('"k":"throw"')) throwing.add(p.owner.toHexString());
  }

  // 2a. Start attacks (one buffered press, fires when cooldown is ready). The hit itself is
  //     queued to land on the animation's strike frame (strikeDelayS, shared with clients).
  for (const [id, f] of fighters) {
    const input = ctx.db.input.player.find(f.player);
    if (!input?.attackBuffered || now.microsSinceUnixEpoch < f.cooldownReadyAt.microsSinceUnixEpoch) continue;
    const w = weapons.get(id)!;
    // boomerang still out: keep the press buffered, it fires the moment the weapon is caught
    if (w.spec.archetype === 'throw' && (throwing.has(id) || effects.get(id)!.pa)) continue;
    const target = autoAim(f, fighters);
    if (target) f.facing = Math.atan2(target.y - f.y, target.x - f.x);
    effects.get(id)!.pa = { at: tMs + strikeDelayS(w.spec.archetype, w.spec.motion) * 1000, f: f.facing };
    emitFx(ctx, r.code, 'attack', f.x, f.y, f.player, f.facing);
    f.cooldownReadyAt = addSeconds(now, w.stats.cooldown);
    f.lastAttackAt = now;
    ctx.db.input.player.update({ ...input, attackBuffered: false });
  }

  // 2b. Resolve attacks whose strike frame has arrived.
  for (const [id, f] of fighters) {
    const pa = effects.get(id)!.pa;
    if (!pa || tMs < pa.at) continue;
    delete effects.get(id)!.pa;
    resolveAttack(world, f, pa.f);
  }

  // 3. Projectiles: move, steer, bounce, collide, split, land, expire.
  stepProjectiles(world, dt, mx, my);

  // 4. Other effects (burn/poison DoT, slow, thorns) — TODO: read/write f.effects JSON.

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

/** Apply one hit: damage (±jitter), hit fx, knockback away from `from`. */
function applyHit(wd: World, attackerId: string, o: FighterRow, from: { x: number; y: number }, fallbackDir: number, mul = 1) {
  const w = wd.weapons.get(attackerId);
  const attacker = wd.fighters.get(attackerId);
  if (!w || o.hp <= 0) return;
  const dmg = rollDamage(w.stats.damagePerHit, wd.rand, BALANCE) * mul;
  o.hp -= dmg;
  // fx owner = the ATTACKER (screen shake scales with their weapon; commentary needs who hit whom)
  emitFx(wd.ctx, wd.r.code, 'hit', o.x, o.y, attacker?.player ?? o.player, dmg);
  // Knockback: initial speed whose per-tick decaying steps sum to exactly the knockback
  // distance (Σ v·dt·decayⁿ = v·dt / (1 − decay)), so balance.ts distances are what players get.
  const dt = 1 / GAME.tickHz, decay = Math.exp(-dt / KNOCKBACK.decayS);
  const push = (knockbackDistance(w.spec) * (1 - decay)) / dt;
  const dx = o.x - from.x, dy = o.y - from.y, d = Math.hypot(dx, dy);
  const [ux, uy] = d > 1e-3 ? [dx / d, dy / d] : [Math.cos(fallbackDir), Math.sin(fallbackDir)];
  const ofx = wd.effects.get(o.player.toHexString());
  if (ofx) {
    let vx = (ofx.kb?.[0] ?? 0) + ux * push, vy = (ofx.kb?.[1] ?? 0) + uy * push;
    const sp = Math.hypot(vx, vy);
    if (sp > KNOCKBACK.maxSpeed) { vx *= KNOCKBACK.maxSpeed / sp; vy *= KNOCKBACK.maxSpeed / sp; }
    ofx.kb = [vx, vy];
  }
  // TODO: other on_hit effects (burn, slow, chain, lifesteal, pierce).
}

/** Strike frame: melee archetypes test their hit area; shoot/throw launch projectiles. */
function resolveAttack(wd: World, f: FighterRow, facing: number) {
  const id = f.player.toHexString();
  const w = wd.weapons.get(id)!;
  const a = w.spec.archetype;
  if (a === 'shoot') return fireShots(wd, f, w, facing);
  if (a === 'throw') return throwWeapon(wd, f, w, facing);
  const shape = meleeShape(a, f, facing, w.stats);
  if (!shape) return;
  if (a === 'slam' && shape.kind === 'circle') emitFx(wd.ctx, wd.r.code, 'shockwave', shape.center.x, shape.center.y, f.player, shape.radius);
  for (const o of wd.fighters.values()) {
    if (o.player.isEqual(f.player) || o.hp <= 0) continue;
    if (contains(shape, o, GAME.hitRadius)) applyHit(wd, id, o, a === 'slam' && shape.kind === 'circle' ? shape.center : f, facing);
  }
}

function insertProjectile(wd: World, owner: FighterRow, x: number, y: number, vx: number, vy: number, lifeS: number, meta: ProjectileMeta) {
  wd.ctx.db.projectile.insert({
    id: 0n, roomCode: wd.r.code, owner: owner.player, x, y, vx, vy,
    expiresAt: addSeconds(wd.ctx.timestamp, lifeS), hits: JSON.stringify(meta),
  });
}

function fireShots(wd: World, f: FighterRow, w: StoredWeapon, facing: number) {
  const p = w.spec.projectile ?? { count: 1, spread_deg: 0, speed: 0.6, behavior: 'pierce' as const };
  const speed = PROJECTILE.shotSpeedBase + PROJECTILE.shotSpeedPer * p.speed;
  const life = w.stats.rangeUnits / speed;
  const r = PROJECTILE.shotRadiusBase + PROJECTILE.shotRadiusPer * w.stats.areaUnits;
  const spread = (p.spread_deg * Math.PI) / 180;
  for (let i = 0; i < p.count; i++) {
    const a = facing + (p.count > 1 ? spread * (i / (p.count - 1) - 0.5) : 0);
    insertProjectile(wd, f, f.x, f.y, Math.cos(a) * speed, Math.sin(a) * speed, life, {
      k: 'shot', beh: p.behavior, r, hit: [], b: p.behavior === 'bounce' ? PROJECTILE.bounces : 0,
      t0: nowMs(wd.ctx), ox: f.x, oy: f.y, reach: w.stats.rangeUnits,
    });
  }
}

function throwWeapon(wd: World, f: FighterRow, w: StoredWeapon, facing: number) {
  const reach = w.stats.rangeUnits, speed = PROJECTILE.throwSpeed;
  insertProjectile(wd, f, f.x, f.y, Math.cos(facing) * speed, Math.sin(facing) * speed, (2 * reach) / speed + 1.5, {
    k: 'throw', r: PROJECTILE.throwRadiusBase + PROJECTILE.throwRadiusPer * w.stats.areaUnits,
    hit: [], leg: 0, t0: nowMs(wd.ctx), ox: f.x, oy: f.y, reach,
  });
}

function stepProjectiles(wd: World, dt: number, mx: number, my: number) {
  const { ctx } = wd;
  const tMs = nowMs(ctx);
  for (const p of [...ctx.db.projectile.roomCode.filter(wd.r.code)]) {
    let meta: ProjectileMeta;
    try { meta = JSON.parse(p.hits) as ProjectileMeta; } catch { ctx.db.projectile.id.delete(p.id); continue; }
    const ownerId = p.owner.toHexString();
    const owner = wd.fighters.get(ownerId);
    const expired = ctx.timestamp.microsSinceUnixEpoch >= p.expiresAt.microsSinceUnixEpoch;
    let { x, y, vx, vy } = p;
    let dead = false;
    const life = (Number(p.expiresAt.microsSinceUnixEpoch / 1000n) - meta.t0) / 1000;
    const age = (tMs - meta.t0) / 1000;

    if (meta.k === 'throw') {
      // out to its reach, then home back to the owner's hand
      if (meta.leg === 0 && Math.hypot(x - meta.ox, y - meta.oy) >= meta.reach) { meta.leg = 1; meta.hit = []; }
      if (meta.leg === 1) {
        if (!owner) dead = true;
        else {
          const dx = owner.x - x, dy = owner.y - y, d = Math.hypot(dx, dy);
          if (d < 0.6) dead = true;
          else { vx = (dx / d) * PROJECTILE.throwSpeed * 1.2; vy = (dy / d) * PROJECTILE.throwSpeed * 1.2; }
        }
      }
    } else if (meta.beh === 'homing') {
      let best: FighterRow | null = null, bd: number = PROJECTILE.homingRange;
      for (const o of wd.fighters.values()) {
        if (o.player.toHexString() === ownerId || meta.hit.includes(o.player.toHexString())) continue;
        const d = Math.hypot(o.x - x, o.y - y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        const cur = Math.atan2(vy, vx), want = Math.atan2(best.y - y, best.x - x);
        const turn = Math.max(-PROJECTILE.homingTurn * dt, Math.min(PROJECTILE.homingTurn * dt, normAngle(want - cur)));
        const sp = Math.hypot(vx, vy);
        vx = Math.cos(cur + turn) * sp; vy = Math.sin(cur + turn) * sp;
      }
    }

    x += vx * dt; y += vy * dt;

    // walls: bounce if it can, otherwise leave the arena and vanish
    if (Math.abs(x) > mx || Math.abs(y) > my) {
      if (meta.k === 'shot' && meta.beh === 'bounce' && (meta.b ?? 0) > 0) {
        if (Math.abs(x) > mx) { vx = -vx; x = Math.sign(x) * mx; }
        if (Math.abs(y) > my) { vy = -vy; y = Math.sign(y) * my; }
        meta.b = (meta.b ?? 0) - 1;
      } else if (meta.k === 'shot' && meta.beh !== 'arc') dead = true;
      else { x = Math.max(-mx, Math.min(mx, x)); y = Math.max(-my, Math.min(my, y)); }
    }

    // collisions (arc shots fly over everyone until they land)
    if (!dead && !(meta.k === 'shot' && meta.beh === 'arc')) {
      for (const o of wd.fighters.values()) {
        const oid = o.player.toHexString();
        if (oid === ownerId || o.hp <= 0 || meta.hit.includes(oid)) continue;
        if (Math.hypot(o.x - x, o.y - y) > meta.r + GAME.hitRadius) continue;
        const legMul = meta.k === 'throw' ? (meta.leg === 1 ? PROJECTILE.throwBackMul : PROJECTILE.throwOutMul) : 1;
        applyHit(wd, ownerId, o, { x: x - vx * dt, y: y - vy * dt }, Math.atan2(vy, vx), legMul);
        meta.hit.push(oid);
        if (meta.k === 'shot') {
          if (meta.beh === 'split' && !meta.sp) { split(wd, p.owner, x, y, vx, vy, meta, p.expiresAt); dead = true; }
          else if (meta.beh !== 'pierce') dead = true;
        }
        if (dead) break;
      }
    }

    // split mid-flight even without a hit
    if (!dead && meta.k === 'shot' && meta.beh === 'split' && !meta.sp && age >= life * PROJECTILE.splitAtLife) {
      split(wd, p.owner, x, y, vx, vy, meta, p.expiresAt);
      dead = true;
    }

    // arc shots land at the end of their flight and splash
    if (expired && meta.k === 'shot' && meta.beh === 'arc') {
      const w = wd.weapons.get(ownerId);
      const radius = PROJECTILE.arcSplashBase + PROJECTILE.arcSplashPer * (w?.stats.areaUnits ?? 0.8);
      emitFx(ctx, wd.r.code, 'shockwave', x, y, p.owner, radius);
      for (const o of wd.fighters.values()) {
        if (o.player.toHexString() === ownerId || o.hp <= 0) continue;
        if (Math.hypot(o.x - x, o.y - y) <= radius + GAME.hitRadius) applyHit(wd, ownerId, o, { x, y }, Math.atan2(vy, vx));
      }
    }

    if (dead || expired) ctx.db.projectile.id.delete(p.id);
    else ctx.db.projectile.id.update({ ...p, x, y, vx, vy, hits: JSON.stringify(meta) });
  }
}

/** Two children at ±splitAngle that don't split again; they keep the parent's remaining life. */
function split(wd: World, owner: FighterRow['player'], x: number, y: number, vx: number, vy: number, meta: ProjectileMeta, expiresAt: Timestamp) {
  const a = Math.atan2(vy, vx), sp = Math.hypot(vx, vy), da = (PROJECTILE.splitAngleDeg * Math.PI) / 180;
  for (const s of [-1, 1]) {
    wd.ctx.db.projectile.insert({
      id: 0n, roomCode: wd.r.code, owner, x, y,
      vx: Math.cos(a + s * da) * sp, vy: Math.sin(a + s * da) * sp,
      expiresAt, hits: JSON.stringify({ ...meta, sp: true, hit: [...meta.hit] } satisfies ProjectileMeta),
    });
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

