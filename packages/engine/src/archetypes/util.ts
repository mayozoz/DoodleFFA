import { Graphics, type Container, type Sprite } from 'pixi.js';
import type { WeaponSpec } from '@doodle/spec';
import type { Tweener } from '../tween';

export interface Rest { r: number; x: number; y: number; sx: number; sy: number; kx: number; alpha: number }

export const rest = (s: Sprite): Rest => ({ r: s.rotation, x: s.x, y: s.y, sx: s.scale.x, sy: s.scale.y, kx: s.skew.x, alpha: s.alpha });

export function restore(s: Sprite, r: Rest) {
  s.rotation = r.r; s.position.set(r.x, r.y); s.scale.set(r.sx, r.sy); s.skew.x = r.kx; s.alpha = r.alpha;
}

/** The weapon tip (spec.tip) in fxLayer coordinates. */
export function tipIn(layer: Container, s: Sprite, spec: WeaponSpec) {
  const [gx, gy] = spec.grip, [tx, ty] = spec.tip;
  const g = s.toGlobal({ x: (tx - gx) * s.texture.width, y: (ty - gy) * s.texture.height });
  return layer.toLocal(g);
}

const hex = (h: string | undefined, fb: number) => (h ? parseInt(h.slice(1), 16) : fb);
export const paletteColor = (spec: WeaponSpec, i = 0, fb = 0xffffff) => hex(spec.palette[i % Math.max(1, spec.palette.length)], fb);

/** A quick expanding/fading flash (muzzle flash, whip crack, beam charge). */
export function flash(layer: Container, tweener: Tweener, at: { x: number; y: number }, color: number, radius: number, seconds = 0.18) {
  const g = new Graphics();
  g.position.set(at.x, at.y);
  layer.addChild(g);
  void tweener.to(seconds, (t) => {
    g.clear().circle(0, 0, radius * (0.4 + t)).fill({ color, alpha: 0.9 * (1 - t) })
      .circle(0, 0, radius * 0.45 * (1 - t)).fill({ color: 0xffffff, alpha: 1 - t });
  }).then(() => g.destroy());
}

export const wait = (tweener: Tweener, s: number) => tweener.to(s, () => {});
