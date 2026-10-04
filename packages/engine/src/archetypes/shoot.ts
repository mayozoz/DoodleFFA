import type { ArchetypeModule } from './types';
import { flash, paletteColor, rest, restore, tipIn } from './util';

/** Steady → recoil kick + muzzle flash at the tip → ease back. Projectiles are server rows. */
export const shoot: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener, unit } = ctx;
    const k = ctx.mini ? 0.3 : 1;
    const r0 = rest(sprite);
    await tweener.to(feel.windUp, (t) => { sprite.rotation = r0.r + 0.06 * t * k; });
    flash(ctx.fxLayer, tweener, tipIn(ctx.fxLayer, sprite, ctx.spec), paletteColor(ctx.spec, 0, 0xfff3a0), 0.35 * unit * k);
    ctx.onStrike?.();
    await tweener.to(feel.strike * 0.6, (t) => {
      sprite.x = r0.x - 0.25 * unit * t * k;
      sprite.rotation = r0.r + 0.06 * k - 0.3 * t * k;
    }, feel.strikeEase);
    await tweener.to(feel.recover, (t) => {
      sprite.x = r0.x - 0.25 * unit * (1 - t) * k;
      sprite.rotation = r0.r + (0.06 - 0.3) * (1 - t) * k;
    }, feel.recoverEase);
    restore(sprite, r0);
  },
};
