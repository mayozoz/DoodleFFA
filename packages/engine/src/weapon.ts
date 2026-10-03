import { Sprite, type Texture } from 'pixi.js';
import { GlowFilter, OutlineFilter } from 'pixi-filters';
import type { StoredWeapon } from '@doodle/spec';

/** Standard on-screen length of grip→tip, in world units. */
// Playtest feedback (2026-10-03): big and goofy — 4× the original 1.2, then halved → 2.4.
// Visual only: server hit reach is BALANCE.rangeUnits (server/src/balance.ts).
export const WEAPON_LENGTH_UNITS = 2.4;

/**
 * Builds the weapon sprite: pivot at `grip`, rotated so grip→tip points along +x, scaled to a
 * standard length. `rawDrawing` = the sprite fallback (outline + glow on the raw PNG).
 */
export function createWeaponSprite(tex: Texture, w: StoredWeapon, unit: number, rawDrawing = false): Sprite {
  const s = new Sprite(tex);
  const [gx, gy] = w.spec.grip;
  const [tx, ty] = w.spec.tip;
  s.anchor.set(gx, gy);
  const dx = (tx - gx) * tex.width;
  const dy = (ty - gy) * tex.height;
  const len = Math.hypot(dx, dy) || tex.width;
  s.scale.set((WEAPON_LENGTH_UNITS * unit) / len);
  s.rotation = -Math.atan2(dy, dx);
  if (rawDrawing) {
    s.filters = [new OutlineFilter({ thickness: 3, color: 0x111111 }), new GlowFilter({ distance: 12, outerStrength: 2, color: 0xffffff })];
  }
  return s;
}

/** Tip position in the sprite's local space (projectile origin). */
export function tipLocal(tex: Texture, w: StoredWeapon) {
  const [gx, gy] = w.spec.grip;
  const [tx, ty] = w.spec.tip;
  return { x: (tx - gx) * tex.width, y: (ty - gy) * tex.height };
}
