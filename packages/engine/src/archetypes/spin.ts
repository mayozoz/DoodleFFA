import { ease } from '../tween';
import type { ArchetypeModule } from './types';
import { rest, restore } from './util';

/** Wind back a little → whirl a full turn around the character (the hit is a ring) → settle. */
export const spin: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener } = ctx;
    const k = ctx.mini ? 0.3 : 1;
    const r0 = rest(sprite);
    const turns = (ctx.mini ? 0.25 : 1) * Math.PI * 2;
    await tweener.to(feel.windUp, (t) => { sprite.rotation = r0.r - 0.4 * t * k; });
    let struck = false;
    await tweener.to(feel.strike + feel.recover, (t) => {
      sprite.rotation = r0.r - 0.4 * k + (turns + 0.4 * k) * t;
      sprite.scale.set(r0.sx * (1 + 0.15 * Math.sin(t * Math.PI) * k), r0.sy);
      if (!struck && t > 0.25) { struck = true; ctx.onStrike?.(); }
    }, ease.outCubic);
    restore(sprite, r0);
  },
};
