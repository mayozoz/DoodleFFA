import type { Archetype, Marker, OnHit, ProjectileBehavior, VfxType, VfxWhere } from './enums';

export type Vec2 = [number, number];

export interface VfxSpec {
  type: VfxType;
  where: VfxWhere;
  /** 0–1 */
  intensity: number;
}

export interface ProjectileSpec {
  /** 1–5 */
  count: number;
  /** 0–90 */
  spread_deg: number;
  /** 0–1, engine scales */
  speed: number;
  behavior: ProjectileBehavior;
}

export interface MotionSpec {
  /** squash/stretch + overshoot, 0–1 */
  elasticity: number;
  /** wind-up, hit-pause, shake, cooldown, ±15% move speed, 0–1 */
  weight: number;
  /** idle/walk jiggle, 0–1 */
  wobble: number;
}

/** What the AI fills in (after validation). */
export interface WeaponSpec {
  name: string;
  /** normalized sprite coords 0–1 */
  grip: Vec2;
  tip: Vec2;
  archetype: Archetype;
  range: number;
  area: number;
  /** seconds — always overwritten by balance */
  cooldown: number;
  projectile: ProjectileSpec | null;
  /** max 2 */
  on_hit: OnHit[];
  vfx: VfxSpec[];
  motion: MotionSpec;
  palette: string[];
  sfx_prompt: string;
}

/** Numbers the engine/tick actually use. Produced by `balance()` on the server. */
export interface BalancedStats {
  cooldown: number;
  damagePerHit: number;
  /** DoT damage per second applied by burn/poison, already inside the 12 DPS budget */
  dotPerSecond: number;
  dotSeconds: number;
  /** world units */
  rangeUnits: number;
  areaUnits: number;
  moveSpeedMul: number;
}

/** Stored in `weapon.spec` as JSON. */
export interface StoredWeapon {
  spec: WeaponSpec;
  stats: BalancedStats;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: { slot: number; hex: string; name: string };
  marker: Marker;
}

export interface FullWeaponSpec {
  player: PlayerInfo;
  weapon: WeaponSpec;
}
