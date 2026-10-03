import type { Drawing, Stroke, StrokePoint } from '../../packages/spec/src';

// Hand-built "doodles" so the lab works before we have real captures. Real ones saved from
// phones go in packages/spec/fixtures/doodles/*.json and are picked up automatically.

const S = 512;
const BLACK = '#111111', RED = '#ff3b3b', BLUE = '#2f6bff', GREEN = '#22c55e';

/** points along a polyline with jitter, timed at `msPerPx` */
function path(pts: [number, number][], color: string, opts: { jitter?: number; msPerPx?: number; width?: number } = {}): Stroke {
  const { jitter = 1.5, msPerPx = 2, width = 10 } = opts;
  const out: StrokePoint[] = [];
  let t = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!;
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      out.push([x0 + (x1 - x0) * f + (Math.random() - 0.5) * jitter, y0 + (y1 - y0) * f + (Math.random() - 0.5) * jitter, t]);
      t += Math.hypot(x1 - x0, y1 - y0) / n * msPerPx;
    }
  }
  out.push([...pts[pts.length - 1]!, t]);
  return { color, width, points: out };
}

const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 40): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

export const SYNTHETIC: Record<string, Drawing> = {
  sword: { width: S, height: S, strokes: [
    path([[120, 400], [420, 100]], BLACK, { width: 14 }),
    path([[170, 300], [220, 350]], BLACK),
    path([[140, 330], [250, 320]], RED, { width: 12 }),
  ] },
  bow: { width: S, height: S, strokes: [
    path(arc(180, 256, 200, -1.1, 1.1), BLACK, { width: 12 }),
    path([[270, 70], [270, 442]], BLACK, { width: 4 }),
    path([[270, 256], [470, 256]], RED, { width: 6 }),
  ] },
  hammer: { width: S, height: S, strokes: [
    path([[256, 470], [256, 200]], BLACK, { width: 16 }),
    path([[150, 90], [360, 90], [360, 200], [150, 200], [150, 90]], BLUE, { width: 18 }),
  ] },
  spiral: { width: S, height: S, strokes: [
    path(Array.from({ length: 120 }, (_, i) => {
      const a = i * 0.18, r = 10 + i * 1.7;
      return [256 + Math.cos(a) * r, 256 + Math.sin(a) * r] as [number, number];
    }), GREEN, { msPerPx: 1 }),
  ] },
  flower: { width: S, height: S, strokes: [
    path([[256, 480], [256, 260]], GREEN, { width: 10 }),
    ...[0, 1, 2, 3, 4].map((i) => path(arc(256 + Math.cos(i * 1.256) * 60, 200 + Math.sin(i * 1.256) * 60, 45, 0, Math.PI * 2, 24), RED)),
    path(arc(256, 200, 25, 0, Math.PI * 2, 20), '#ffd60a', { width: 14 }),
  ] },
  lightning: { width: S, height: S, strokes: [
    path([[300, 40], [180, 250], [290, 250], [160, 470]], BLUE, { jitter: 4, msPerPx: 0.6, width: 12 }),
  ] },
  squiggle: { width: S, height: S, strokes: [
    path(Array.from({ length: 60 }, (_, i) => [40 + i * 7.5, 256 + Math.sin(i * 0.9) * 60 * (i % 3 ? 1 : -1)] as [number, number]), BLACK, { jitter: 6, msPerPx: 0.5 }),
  ] },
  blob: { width: S, height: S, strokes: Array.from({ length: 14 }, (_, i) =>
    path(arc(256, 256, 40 + i * 8, 0, Math.PI * 2, 30), i % 2 ? BLACK : GREEN, { width: 16, jitter: 8 })) },
};
