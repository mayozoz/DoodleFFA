import { ease } from '../tween';
import type { ArchetypeModule } from './types';
import { flash, paletteColor, rest, restore, tipIn } from './util';

/**
 * Draw back (bunching up) → crack forward with overshoot → the lash wobbles as it settles.
 * TODO: a true rope bend (PixiJS MeshRope + spring chain) per the brief; this fakes it with skew.
 */
export const whip: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener, unit } = ctx;
    const k = ctx.mini ? 0.3 : 1;
    const r0 = rest(sprite);
    const back = r0.r - 1.3 * k, crack = r0.r + 0.5 * k;
    await tweener.to(feel.windUp, (t) => {
      sprite.rotation = r0.r + (back - r0.r) * t;
      sprite.scale.x = r0.sx * (1 - 0.25 * t * k);
      sprite.skew.x = r0.kx - 0.35 * t * k;
    });
    await tweener.to(feel.strike, (t) => {
      sprite.rotation = back + (crack - back) * t;
      sprite.scale.x = r0.sx * (0.75 + 0.4 * t);
      sprite.skew.x = r0.kx + (-0.35 + 0.8 * t) * k;
    }, ease.outBack(feel.squash * 2));
    flash(ctx.fxLayer, tweener, tipIn(ctx.fxLayer, sprite, ctx.spec), paletteColor(ctx.spec, 0), 0.3 * unit * k, 0.14);
    ctx.onStrike?.();
    await tweener.to(feel.recover * 1.6, (t) => {
      sprite.rotation = crack + (r0.r - crack) * t;
      sprite.scale.x = r0.sx * (1.15 - 0.15 * t);
      sprite.skew.x = r0.kx + 0.45 * Math.sin(t * Math.PI * 3) * (1 - t) * k; // the lash ripples out
    });
    restore(sprite, r0);
  },
};
