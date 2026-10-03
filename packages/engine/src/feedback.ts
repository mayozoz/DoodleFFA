import { Container, Text } from 'pixi.js';
import type { Tweener } from './tween';

/** Hit feedback: ~40 ms freeze, screen shake ∝ weight, floating damage number. */
export class Feedback {
  private shakeAmp = 0;
  private shakeT = 0;
  private freezeUntil = 0;

  constructor(private stage: Container, private tweener: Tweener, private numbersLayer: Container) {}

  hitStop(ms: number) {
    this.freezeUntil = Math.max(this.freezeUntil, performance.now() + ms);
  }

  shake(px: number) {
    this.shakeAmp = Math.max(this.shakeAmp, px);
  }

  damageNumber(x: number, y: number, value: number, color = 0xffffff) {
    const t = new Text({ text: String(Math.round(value)), style: { fill: color, fontSize: 22, fontWeight: '900', stroke: { color: 0x000000, width: 4 } } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.numbersLayer.addChild(t);
    void this.tweener.to(0.6, (v) => { t.y = y - v * 40; t.alpha = 1 - v; }).then(() => t.destroy());
  }

  /** call once per frame; returns the dt to feed into simulation/tweens (0 while frozen) */
  step(dt: number): number {
    const frozen = performance.now() < this.freezeUntil;
    this.tweener.timeScale = frozen ? 0 : 1;
    this.shakeT += dt;
    // Shake via pivot, not position, so callers can keep positioning/centering the container.
    this.stage.pivot.set(
      (Math.random() - 0.5) * this.shakeAmp,
      (Math.random() - 0.5) * this.shakeAmp,
    );
    this.shakeAmp *= Math.pow(0.001, dt); // fast decay
    if (this.shakeAmp < 0.3) this.shakeAmp = 0;
    return frozen ? 0 : dt;
  }
}
