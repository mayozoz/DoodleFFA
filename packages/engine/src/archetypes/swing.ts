import type { ArchetypeModule } from './types';
import { lerp } from '../tween';

const ARC = (140 * Math.PI) / 180;

/** wind-up → fast ~140° arc → ease back. TODO(M2): smear trail. */
export const swing: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener } = ctx;
    const scale = ctx.mini ? 0.3 : 1;
    const rest = sprite.rotation;
    const start = rest - (ARC / 2) * scale;
    const end = rest + (ARC / 2) * scale;
    const baseX = sprite.scale.x;

    await tweener.to(feel.windUp, (t) => { sprite.rotation = lerp(rest, start, t); });
    await tweener.to(feel.strike, (t) => {
      sprite.rotation = lerp(start, end, t);
      sprite.scale.x = baseX * (1 + feel.squash * Math.sin(t * Math.PI) * scale);
    }, feel.strikeEase);
    ctx.onStrike?.();
    await tweener.to(feel.recover, (t) => { sprite.rotation = lerp(end, rest, t); }, feel.recoverEase);
    sprite.scale.x = baseX;
  },
};
