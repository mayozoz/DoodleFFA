// The shared screen renders ~100 ms behind the server and interpolates between snapshots.
// It never simulates.

export const RENDER_DELAY_MS = 100;

interface Sample { t: number; x: number; y: number; facing: number }

export class Interpolator {
  private buf: Sample[] = [];

  push(x: number, y: number, facing: number, t = performance.now()) {
    this.buf.push({ t, x, y, facing });
    if (this.buf.length > 20) this.buf.shift();
  }

  sample(now = performance.now()): Sample | null {
    const target = now - RENDER_DELAY_MS;
    const b = this.buf;
    if (b.length === 0) return null;
    if (target <= b[0]!.t) return b[0]!;
    for (let i = b.length - 1; i > 0; i--) {
      const a = b[i - 1]!, c = b[i]!;
      if (a.t <= target && target <= c.t) {
        const k = (target - a.t) / Math.max(1, c.t - a.t);
        const df = Math.atan2(Math.sin(c.facing - a.facing), Math.cos(c.facing - a.facing));
        return { t: target, x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, facing: a.facing + df * k };
      }
    }
    return b[b.length - 1]!;
  }
}
