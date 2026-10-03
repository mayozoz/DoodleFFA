// Minimal tween runner driven by the Pixi ticker. Archetype motions are 0.15–0.5 s tweens.

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  /** overshoot grows with elasticity 0–1 */
  outBack: (elasticity = 0.5): Ease => {
    const c = 1 + elasticity * 2;
    return (t) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  /** damped spring, good for settle-back */
  spring: (elasticity = 0.5): Ease => {
    const damping = 6 - elasticity * 3;
    const freq = 8 + elasticity * 8;
    return (t) => 1 - Math.exp(-damping * t) * Math.cos(freq * t);
  },
};

interface Active {
  elapsed: number;
  duration: number;
  ease: Ease;
  update: (v: number) => void;
  resolve: () => void;
}

export class Tweener {
  private active: Active[] = [];
  /** time scale; set to 0 for hit-stop freeze frames */
  timeScale = 1;

  /** Animate 0→1 over `duration` seconds, calling `update(eased)`. */
  to(duration: number, update: (v: number) => void, e: Ease = ease.outQuad): Promise<void> {
    return new Promise((resolve) => this.active.push({ elapsed: 0, duration: Math.max(0.001, duration), ease: e, update, resolve }));
  }

  /** call every frame with seconds since last frame */
  step(dtSeconds: number) {
    const dt = dtSeconds * this.timeScale;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i]!;
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / a.duration);
      a.update(a.ease(t));
      if (t >= 1) {
        this.active.splice(i, 1);
        a.resolve();
      }
    }
  }
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
