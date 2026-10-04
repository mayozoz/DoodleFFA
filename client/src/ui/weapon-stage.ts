import { Application, Container, Texture } from 'pixi.js';
import {
  ARCHETYPE_MODULES, Tweener, WEAPON_LENGTH_UNITS, WeaponDecor, createWeaponSprite, edgePoints, loadCutout, motionFeel,
} from '@doodle/engine';
import { MYSTERY_STICK, type BalancedStats, type WeaponSpec } from '@doodle/spec';

/**
 * A small PixiJS stage showing one weapon with its upgrades, using the same renderer as the
 * battle (cut-out doodle + WeaponDecor + archetype motions). Used by the Reveal showcase, the
 * phone's weapon card and the podium. Destroy it when the card goes away (one WebGL context each).
 */
export interface WeaponStage {
  el: HTMLElement;
  /** play the archetype's real attack motion */
  swing(): void;
  /** the Reveal moment: flash, then the upgrades pop on */
  upgrade(): Promise<void>;
  destroy(): void;
}

const DISPLAY_STATS: BalancedStats = { cooldown: 0.6, damagePerHit: 0, dotPerSecond: 0, dotSeconds: 0, rangeUnits: 2, areaUnits: 1, moveSpeedMul: 1 };

/** Decode + cut out a doodle once (canvas reused for texture and outline points). */
export const loadDoodle = (src: { spriteUrl?: string; png?: Uint8Array }) =>
  src.spriteUrl ? loadCutout(src.spriteUrl) : src.png?.length ? loadCutout(src.png) : Promise.resolve(null);

export async function weaponStage(
  doodle: HTMLCanvasElement | null,
  spec: WeaponSpec | null,
  opts: { size: number; orient?: boolean; upgradeLater?: boolean },
): Promise<WeaponStage> {
  const el = document.createElement('div');
  el.className = 'weapon-stage';
  el.style.width = el.style.height = `${opts.size}px`;
  const s = spec ? { ...spec, decor: spec.decor ?? [] } : MYSTERY_STICK;
  const app = new Application();
  await app.init({ width: opts.size, height: opts.size, backgroundAlpha: 0, antialias: true, resolution: Math.min(2, devicePixelRatio || 1), autoDensity: true });
  el.appendChild(app.canvas);
  if (!doodle) return { el, swing() {}, upgrade: async () => {}, destroy: () => app.destroy(true) };

  const tex = Texture.from(doodle);
  const tweener = new Tweener();
  const world = new Container();
  const hand = new Container();
  const fx = new Container();
  world.addChild(hand, fx);
  app.stage.addChild(world);

  const L = opts.size * 0.66; // weapon length on this card
  const unit = L / WEAPON_LENGTH_UNITS;
  const sprite = createWeaponSprite(tex, { spec: s, stats: DISPLAY_STATS }, unit, true);
  const [gx, gy] = s.grip;
  if (opts.orient === false) {
    // exactly as drawn (podium): no rotation, image centered
    sprite.rotation = 0;
    sprite.scale.set((opts.size * 0.78) / Math.max(tex.width, tex.height));
    hand.position.set(opts.size / 2 - (0.5 - gx) * tex.width * sprite.scale.x, opts.size / 2 - (0.5 - gy) * tex.height * sprite.scale.y);
  } else {
    // grip → tip pointing right, centered
    hand.position.set((opts.size - L) / 2, opts.size / 2);
  }
  const decor = new WeaponDecor(tex, edgePoints(doodle), s, sprite.scale.x);
  hand.addChild(decor.back, sprite, decor.front);
  if (opts.upgradeLater) decor.hide();

  app.ticker.add((t) => {
    const dt = t.deltaMS / 1000;
    tweener.step(dt);
    decor.sync(sprite);
    decor.update(dt);
  });

  return {
    el,
    swing() {
      void ARCHETYPE_MODULES[s.archetype].play(sprite, {
        spec: s, stats: DISPLAY_STATS, feel: motionFeel(s.motion, s.archetype), tweener, unit, fxLayer: fx, facing: 0,
      });
    },
    upgrade: () => decor.reveal(tweener),
    destroy() {
      decor.destroy();
      app.destroy(true, { children: true });
      tex.destroy(true);
    },
  };
}
