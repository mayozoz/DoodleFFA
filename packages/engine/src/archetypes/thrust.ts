import type { ArchetypeModule } from './types';
import { rest, restore } from './util';

/** Pull back → lunge with a lengthwise stretch → settle. Hits a narrow strip straight ahead. */
export const thrust: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener, unit } = ctx;
    const k = ctx.mini ? 0.3 : 1;
    const r0 = rest(sprite);
    const back = -0.35 * unit * k, lunge = 0.75 * unit * k;
    await tweener.to(feel.windUp, (t) => { sprite.x = r0.x + back * t; });
    await tweener.to(feel.strike, (t) => {
      sprite.x = r0.x + back + (lunge - back) * t;
      sprite.scale.x = r0.sx * (1 + feel.squash * 0.8 * Math.sin(t * Math.PI) * k);
      sprite.scale.y = r0.sy * (1 - feel.squash * 0.3 * Math.sin(t * Math.PI) * k);
    }, feel.strikeEase);
    ctx.onStrike?.();
    await tweener.to(feel.recover, (t) => { sprite.x = r0.x + lunge * (1 - t); }, feel.recoverEase);
    restore(sprite, r0);
  },
};
