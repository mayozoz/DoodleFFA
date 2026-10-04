import { Graphics } from 'pixi.js';
import type { ArchetypeModule } from './types';
import { flash, paletteColor, rest, restore, tipIn } from './util';

/** Shake while charging (glow builds at the tip) → fire a glowing line along the aim → fade. */
export const beam: ArchetypeModule = {
  async play(sprite, ctx) {
    const { feel, tweener, unit, spec, stats } = ctx;
    const k = ctx.mini ? 0.3 : 1;
    const r0 = rest(sprite);
    const color = paletteColor(spec, 0, 0x9fe8ff);
    const glow = new Graphics();
    ctx.fxLayer.addChild(glow);
    await tweener.to(feel.windUp, (t) => {
      const j = 2.5 * t * k;
      sprite.position.set(r0.x + (Math.random() - 0.5) * j, r0.y + (Math.random() - 0.5) * j);
      const tip = tipIn(ctx.fxLayer, sprite, spec);
      glow.clear().circle(tip.x, tip.y, (0.1 + 0.35 * t) * unit * k).fill({ color, alpha: 0.35 + 0.5 * t });
    });
    glow.destroy();
    restore(sprite, r0);
    ctx.onStrike?.();
    if (ctx.mini) return;

    // the beam itself, in world space when we can project, else along the sprite
    const start = tipIn(ctx.fxLayer, sprite, spec);
    let end: { x: number; y: number };
    if (ctx.project && ctx.from) {
      end = ctx.project(ctx.from.x + Math.cos(ctx.facing) * stats.rangeUnits, ctx.from.y + Math.sin(ctx.facing) * stats.rangeUnits, 1.1);
    } else {
      const a = sprite.parent ? sprite.parent.rotation : 0;
      end = { x: start.x + Math.cos(a) * stats.rangeUnits * unit, y: start.y + Math.sin(a) * stats.rangeUnits * unit };
    }
    const width = (0.15 + stats.areaUnits * 0.3) * unit;
    const line = new Graphics();
    ctx.fxLayer.addChild(line);
    flash(ctx.fxLayer, tweener, start, color, width * 1.4);
    await tweener.to(0.28, (t) => {
      const w = width * (1 - t * 0.7);
      line.clear()
        .moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color, width: w * 2.2, alpha: 0.35 * (1 - t), cap: 'round' })
        .moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color, width: w, alpha: 0.9 * (1 - t), cap: 'round' })
        .moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: 0xffffff, width: w * 0.35, alpha: 1 - t, cap: 'round' });
    });
    line.destroy();
    await tweener.to(feel.recover, (t) => { sprite.x = r0.x - 0.1 * unit * (1 - t); }, feel.recoverEase);
    restore(sprite, r0);
  },
};
