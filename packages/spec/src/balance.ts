import type { Archetype, OnHit, VfxType } from './enums';
import { COSMETIC_VFX } from './enums';
import { clamp } from './validate';
import type { BalancedStats, WeaponSpec } from './types';

// The formula lives here (pure, unit-tested, shared). The *constants* live in
// server/src/balance.ts so playtest tuning happens in exactly one file.
//
//   damage_per_hit = targetDps × cooldown × P_range × P_area × P_effects
//
// Every weapon spends the same DPS budget; the drawing only decides how it's spent.

export interface BalanceConfig {
  targetDps: number;
  cooldownMin: number;
  cooldownMax: number;
  /** base cooldown per archetype, before weight */
  baseCooldown: Record<Archetype, number>;
  /** seconds added at weight = 1 */
  weightCooldown: number;
  /** each P_* ∈ [penaltyFloor, 1] */
  penaltyFloor: number;
  /** penalty slope at range = 1 / area = 1 */
  rangePenalty: number;
  areaPenalty: number;
  /** multiplicative cost per on-hit effect */
  onHitCost: Record<OnHit, number>;
  /** multiplicative cost per gameplay vfx (cosmetic ones are free) */
  vfxCost: Partial<Record<VfxType, number>>;
  /** fraction of the budget moved into DoT for burn/poison */
  dotShare: number;
  dotSeconds: number;
  /** world-unit ranges per archetype at range = 0 and 1 */
  rangeUnits: Record<Archetype, [number, number]>;
  areaUnits: [number, number];
  /** ±fraction of move speed driven by weight */
  moveSpeedSpread: number;
  /** ±fraction per-hit seeded jitter */
  hitJitter: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function computeCooldown(spec: WeaponSpec, cfg: BalanceConfig): number {
  return clamp(cfg.baseCooldown[spec.archetype] + spec.motion.weight * cfg.weightCooldown, cfg.cooldownMin, cfg.cooldownMax);
}

export function penalties(spec: WeaponSpec, cfg: BalanceConfig) {
  const floor = cfg.penaltyFloor;
  const pRange = clamp(1 - spec.range * cfg.rangePenalty, floor, 1);
  const pArea = clamp(1 - spec.area * cfg.areaPenalty, floor, 1);
  let pEffects = 1;
  for (const h of spec.on_hit) pEffects *= cfg.onHitCost[h];
  for (const v of spec.vfx) if (!COSMETIC_VFX.includes(v.type)) pEffects *= cfg.vfxCost[v.type] ?? 1;
  pEffects = clamp(pEffects, floor, 1);
  return { pRange, pArea, pEffects };
}

/** Overwrites every AI-provided number that affects strength. */
export function balance(spec: WeaponSpec, cfg: BalanceConfig): BalancedStats {
  const cooldown = computeCooldown(spec, cfg);
  const { pRange, pArea, pEffects } = penalties(spec, cfg);
  const total = cfg.targetDps * cooldown * pRange * pArea * pEffects;

  const hasDot = spec.on_hit.includes('burn') || spec.vfx.some((v) => v.type === 'poison' || v.type === 'fire');
  const dotTotal = hasDot ? total * cfg.dotShare : 0;
  // Multi-projectile weapons split the per-attack budget across projectiles.
  const projectiles = spec.projectile?.count ?? 1;

  const [rMin, rMax] = cfg.rangeUnits[spec.archetype];
  return {
    cooldown,
    damagePerHit: (total - dotTotal) / projectiles,
    dotPerSecond: dotTotal / cfg.dotSeconds,
    dotSeconds: hasDot ? cfg.dotSeconds : 0,
    rangeUnits: lerp(rMin, rMax, spec.range),
    areaUnits: lerp(cfg.areaUnits[0], cfg.areaUnits[1], spec.area),
    moveSpeedMul: 1 + (0.5 - spec.motion.weight) * 2 * cfg.moveSpeedSpread,
  };
}

/** Apply the ±jitter per hit. `rand` is a seeded 0–1 generator. */
export function rollDamage(base: number, rand: () => number, cfg: BalanceConfig): number {
  return base * (1 + (rand() * 2 - 1) * cfg.hitJitter);
}
