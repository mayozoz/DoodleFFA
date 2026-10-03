import { Graphics } from 'pixi.js';

/** Blank dark-gray stage with a world-space grid. Shared by /screen and /dev/weapons. */
export const STAGE = {
  background: 0x262626,
  minorLine: 0x303030,
  majorLine: 0x3a3a3a,
  /** every Nth line is a major line */
  majorEvery: 5,
} as const;

/**
 * Grid centered on the world origin, one cell per world unit. Covers `halfW`×`halfH` pixels
 * around the origin. Redraws only when the size or scale changes.
 */
export class StageGrid {
  readonly view = new Graphics();
  private key = '';

  draw(halfW: number, halfH: number, unitPx: number) {
    const key = `${Math.round(halfW)}x${Math.round(halfH)}@${unitPx.toFixed(2)}`;
    if (key === this.key) return;
    this.key = key;
    const g = this.view.clear();
    // pad past the edges so screen shake never reveals a gap
    const w = halfW + unitPx * 2, h = halfH + unitPx * 2;
    const nx = Math.ceil(w / unitPx), ny = Math.ceil(h / unitPx);
    for (const major of [false, true]) {
      for (let i = -nx; i <= nx; i++) {
        if ((i % STAGE.majorEvery === 0) !== major) continue;
        g.moveTo(i * unitPx, -h).lineTo(i * unitPx, h);
      }
      for (let j = -ny; j <= ny; j++) {
        if ((j % STAGE.majorEvery === 0) !== major) continue;
        g.moveTo(-w, j * unitPx).lineTo(w, j * unitPx);
      }
      g.stroke({ color: major ? STAGE.majorLine : STAGE.minorLine, width: major ? 2 : 1 });
    }
  }
}
