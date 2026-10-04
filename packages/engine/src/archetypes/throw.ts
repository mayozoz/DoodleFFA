import type { ArchetypeModule } from './types';
import { rest, restore } from './util';

/**
 * Cock back over the shoulder → whip forward and release. The flying weapon is the server's
 * projectile row; the arena hides the in-hand sprite until it comes back.
 */
export const throw_: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener } = ctx;
    const k = ctx.mini ? 0.3 : 1;
    const r0 = rest(sprite);
    const back = r0.r - 2.2 * k, release = r0.r + 0.6 * k;
    await tweener.to(feel.windUp, (t) => { sprite.rotation = r0.r + (back - r0.r) * t; });
    await tweener.to(feel.strike, (t) => { sprite.rotation = back + (release - back) * t; }, feel.strikeEase);
    ctx.onStrike?.();
    await tweener.to(feel.recover, (t) => { sprite.rotation = release + (r0.r - release) * t; }, feel.recoverEase);
    restore(sprite, r0);
  },
};
