import type { Container, Sprite } from 'pixi.js';
import type { BalancedStats, WeaponSpec } from '@doodle/spec';
import type { MotionFeel } from '../motion';
import type { Tweener } from '../tween';

export interface ArchetypeCtx {
  spec: WeaponSpec;
  stats: BalancedStats;
  feel: MotionFeel;
  tweener: Tweener;
  /** world → pixels */
  unit: number;
  /** effects layer in world space (projectiles, shockwaves, beams) */
  fxLayer: Container;
  /** aim direction in radians */
  facing: number;
  /** true for the faint buffered-press mini-swing */
  mini?: boolean;
  /** emitted at the frame the hit should land (VFX "impact" hooks) */
  onStrike?: () => void;
  /** attacker's position in world units (for world-space fx like the beam) */
  from?: { x: number; y: number };
  /** world (x, y, height) → fxLayer coords. Without it, world-space fx are skipped. */
  project?: (x: number, y: number, h?: number) => { x: number; y: number };
}

/**
 * One module per archetype. `play` animates the weapon sprite (whose pivot is the grip)
 * and resolves when the motion is done. Purely visual — hits are decided by the server.
 */
export interface ArchetypeModule {
  play(sprite: Sprite, ctx: ArchetypeCtx): Promise<void>;
  /** optional per-frame idle (spin orbits, beam charge glow…) */
  idle?(sprite: Sprite, ctx: ArchetypeCtx, timeS: number): void;
}
