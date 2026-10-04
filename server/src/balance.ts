import { MAX_HP, type Archetype, type BalanceConfig } from '@doodle/spec';

// ──────────────────────────────────────────────────────────────────────────
//  THE tuning file. Every gameplay number that playtesting might change lives
//  here. The formula itself is in packages/spec/src/balance.ts.
// ──────────────────────────────────────────────────────────────────────────

// HP scale: 5000 HP (MAX_HP in packages/spec/src/arena.ts). Damage was first scaled ×50 from the
// 100-HP tuning (600 DPS), then ×1.5 → 900 after playtesting: the default swing landed ~454 real
// DPS ≈ 11 s per kill at perfect uptime; 900 brings that to ~7 s, inside the brief's 6–10 s duel.
export const BALANCE: BalanceConfig = {
  targetDps: 900,
  cooldownMin: 0.25,
  cooldownMax: 1.5,
  baseCooldown: {
    swing: 0.5, thrust: 0.45, slam: 0.9, shoot: 0.5,
    throw: 0.8, whip: 0.6, spin: 0.35, beam: 1.0,
  },
  weightCooldown: 0.5,
  penaltyFloor: 0.6,
  rangePenalty: 0.35,
  areaPenalty: 0.3,
  onHitCost: { burn: 0.9, slow: 0.9, knockback: 0.95, chain: 0.8, lifesteal: 0.85, pierce: 0.9 },
  vfxCost: { thorns: 0.9, electric: 0.9, ice: 0.95, poison: 0.9, shadow: 0.95, goo: 0.95, fire: 1 },
  dotShare: 0.3,
  dotSeconds: 2,
  rangeUnits: {
    swing: [1.2, 2.2], thrust: [1.6, 3.0], slam: [1.0, 2.0], shoot: [6, 12],
    throw: [4, 8], whip: [2.0, 3.5], spin: [1.2, 2.0], beam: [6, 14],
  },
  areaUnits: [0.4, 1.6],
  moveSpeedSpread: 0.15,
  hitJitter: 0.1,
};

/** Character + arena constants (world units; 1 unit ≈ one character diameter). */
export const GAME = {
  tickHz: 20,
  maxHp: MAX_HP,
  hitRadius: 0.5,
  moveSpeed: 5, // units / s
  /**
   * Arena size grows with the player count: half-width = base + perPlayer × n
   * (2 players → 11 units, 4 → 14, 8 → 20, 12 → 26); half-height follows the screen aspect
   * (arenaExtents). The shared screen zooms to fit, so bigger games show smaller fighters.
   */
  arenaBaseRadius: 8,
  arenaPerPlayer: 1.5,
  stormStartS: 10,
  stormEndRadiusFrac: 0.15,
  stormDps: 250,
  suddenDeathS: 50,
  suddenDeathDpsStart: 250,
  suddenDeathDpsPerS: 200,
  fxEventTtlMs: 1000,
} as const;

/**
 * Knockback: total distance (world units) a hit shoves the victim away from the attacker.
 * It's a fast-decaying push, not a teleport, so it reads smoothly on screen.
 * Distance = base[archetype] × (0.7 + 0.6 × motion.weight) × bonuses.
 */
export const KNOCKBACK = {
  base: {
    swing: 1.2,  // solid sideways clout
    thrust: 1.6, // focused poke, pushes straight back
    slam: 2.4,   // biggest: radial shockwave
    shoot: 0.5,  // small per projectile (several can land)
    throw: 0.9,
    whip: 1.0,   // snappy crack
    spin: 0.7,   // hits often, so each push is small
    beam: 0.4,   // sustained, barely pushes
  } satisfies Record<Archetype, number>,
  /** weapon has `knockback` in on_hit */
  onHitBonus: 1.6,
  /** weapon has `goo` vfx (brief: goo → knockback) */
  gooBonus: 1.3,
  /** push decays with this time constant (s); total distance = speed × decay */
  decayS: 0.12,
  /** cap so stacked hits can't fling someone across the map */
  maxSpeed: 40,
} as const;

/** Projectiles (shoot) and thrown weapons (throw). World units / seconds. */
export const PROJECTILE = {
  /** shot speed = base + perSpeed × spec.projectile.speed */
  shotSpeedBase: 8,
  shotSpeedPer: 14,
  /** shot radius = base + per × areaUnits */
  shotRadiusBase: 0.2,
  shotRadiusPer: 0.15,
  /** thrown weapon flies at this speed, out to its reach and back */
  throwSpeed: 12,
  throwRadiusBase: 0.3,
  throwRadiusPer: 0.12,
  /**
   * A boomerang can hit the same target going out AND coming back, so the per-attack budget is
   * split across the legs. It also hits from 4–8 units — outside melee reach — so the two legs
   * together are worth 0.7 of a hit, not 1 (safety from range is part of its power).
   * Playtest 2026-10-03: at 1 + 1 it was the strongest weapon by far; at 0.6 + 0.4 it still
   * landed a full hit every throw from range (~520 DPS in a 1v1).
   */
  throwOutMul: 0.45,
  throwBackMul: 0.25,
  /** homing turn rate (rad/s) and how far it looks for a target */
  homingTurn: 4,
  homingRange: 6,
  bounces: 2,
  /** split: two children at ±angle, when the parent hits or at this fraction of its life */
  splitAngleDeg: 30,
  splitAtLife: 0.6,
  /** arc (lob): lands at the end of its range and splashes */
  arcSplashBase: 1.0,
  arcSplashPer: 0.5,
  arcPeakHeight: 2.2,
} as const;

/** Phase lengths in seconds. Server-authoritative. */
export const PHASE_SECONDS = {
  draw: 20,
  /** Wheel → ability tutorial → weapon tutorial → deployment; ends early when everyone drops. */
  drop: 60,
  /** placeholder — actual length is revealSeconds(weapon count), set when Reveal starts */
  reveal: 15,
  battle: 60,
  results: 20,
} as const;
