import type { Archetype } from './enums';
import type { ProjectileBehavior } from './enums';
import type { MotionSpec } from './types';

// Attack timing + projectile meta shared by server (when the hit lands) and clients (when the
// animation strikes), so damage numbers pop on the frame the weapon connects.

/** wind-up seconds (beam charges longer) */
export function windUpS(archetype: Archetype, m: MotionSpec): number {
  const base = 0.06 + m.weight * 0.2;
  return archetype === 'beam' ? base * 2 + 0.15 : archetype === 'slam' ? base + 0.08 : base;
}

/** strike (fast part) seconds */
export function strikeS(m: MotionSpec): number {
  return 0.08 + m.weight * 0.08;
}

/** Seconds from button press to the moment the hit resolves on the server. */
export function strikeDelayS(archetype: Archetype, m: MotionSpec): number {
  return windUpS(archetype, m) + strikeS(m) * 0.5;
}

/**
 * Projectile meta, stored as JSON in `projectile.hits` (the column predates it).
 * k: 'shot' (shoot archetype) | 'throw' (boomerang weapon).
 */
export interface ProjectileMeta {
  k: 'shot' | 'throw';
  /** shoot behavior */
  beh?: ProjectileBehavior;
  /** hit radius, world units */
  r: number;
  /** identities (hex) already hit — per leg for throws */
  hit: string[];
  /** bounces left */
  b?: number;
  /** already split (children don't split again) */
  sp?: boolean;
  /** throw: 0 = going out, 1 = coming back */
  leg?: 0 | 1;
  /** spawn time + origin (arc height, throw turnaround) */
  t0: number;
  ox: number;
  oy: number;
  /** throw/arc: distance at which to turn back / land */
  reach: number;
}
