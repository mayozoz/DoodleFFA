import { MAX_HP, type BalanceConfig } from '@doodle/spec';

// ──────────────────────────────────────────────────────────────────────────
//  THE tuning file. Every gameplay number that playtesting might change lives
//  here. The formula itself is in packages/spec/src/balance.ts.
// ──────────────────────────────────────────────────────────────────────────

// HP scale: 5000 HP (MAX_HP in packages/spec/src/arena.ts). Everything that deals damage is
// scaled ×50 from the original 100-HP tuning, so fights last as long but numbers hit harder.
export const BALANCE: BalanceConfig = {
  targetDps: 600,
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
  /** arena half-width = base + perPlayer × n; half-height follows the screen aspect (arenaExtents) */
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

/** Phase lengths in seconds. Server-authoritative. */
export const PHASE_SECONDS = {
  draw: 20,
  drop: 15,
  reveal: 15,
  battle: 60,
  results: 20,
} as const;
