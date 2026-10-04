import type { ArchetypeModule } from './types';
import { rest, restore, wait } from './util';

/** Raise high → brief hold → crash down past level → settle. Shockwave comes from the server's fx event. */
export const slam: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener } = ctx;
    const k = ctx.mini ? 0.3 : 1;
    const r0 = rest(sprite);
    const up = r0.r - 1.7 * k, down = r0.r + 0.4 * k;
    await tweener.to(feel.windUp * 0.75, (t) => {
      sprite.rotation = r0.r + (up - r0.r) * t;
      sprite.scale.y = r0.sy * (1 + 0.1 * t * k);
    });
    await wait(tweener, feel.windUp * 0.25); // the hold that sells the weight
    await tweener.to(feel.strike, (t) => {
      sprite.rotation = up + (down - up) * t;
      sprite.scale.y = r0.sy * (1 + 0.1 * (1 - t) * k);
    }, feel.strikeEase);
    ctx.onStrike?.();
    // squash on impact
    await tweener.to(0.08, (t) => { sprite.scale.x = r0.sx * (1 + feel.squash * Math.sin(t * Math.PI) * k); });
    await tweener.to(feel.recover, (t) => { sprite.rotation = down + (r0.r - down) * t; }, feel.recoverEase);
    restore(sprite, r0);
  },
};
