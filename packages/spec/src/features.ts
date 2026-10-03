// Drawing data + device-side feature extraction. Pure: no DOM, no network.
// Runs on the controller right after the 20 s draw; results go up with `submit_drawing`.

/** [x, y, tMs] — x/y in canvas pixels, t relative to stroke start. */
export type StrokePoint = [number, number, number];

export interface Stroke {
  color: string;
  width: number;
  points: StrokePoint[];
}

export interface Drawing {
  width: number;
  height: number;
  strokes: Stroke[];
}

export interface DrawingFeatures {
  strokeCount: number;
  /** total ink length / canvas diagonal */
  inkLength: number;
  /** px per ms, averaged over strokes */
  meanSpeed: number;
  /** direction changes > 45° per 100 px of ink, 0–1 normalized */
  jaggedness: number;
  /** strokes whose end is near their start */
  closedShapes: number;
  /** cumulative turning / (2π · strokes), 0–1 */
  spiralScore: number;
  /** left/right mirror similarity of the ink, 0–1 */
  symmetry: number;
  /** bbox width / height */
  aspect: number;
  /** approx fraction of canvas covered by ink, 0–1 */
  coverage: number;
  /** color → fraction of ink length */
  colors: Record<string, number>;
  isEmpty: boolean;
}

const GRID = 32;

export function extractFeatures(d: Drawing): DrawingFeatures {
  const diag = Math.hypot(d.width, d.height) || 1;
  let ink = 0;
  let speedSum = 0;
  let speedN = 0;
  let sharpTurns = 0;
  let turning = 0;
  let closed = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const colorInk: Record<string, number> = {};
  const cells = new Set<number>();
  const mirror = new Map<number, number>(); // cell → count, for symmetry

  for (const s of d.strokes) {
    const pts = s.points;
    if (pts.length === 0) continue;
    let strokeLen = 0;
    let prevAngle: number | null = null;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]!;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      const gx = Math.min(GRID - 1, Math.floor((x / d.width) * GRID));
      const gy = Math.min(GRID - 1, Math.floor((y / d.height) * GRID));
      const cell = gy * GRID + gx;
      cells.add(cell);
      mirror.set(cell, (mirror.get(cell) ?? 0) + 1);
      if (i === 0) continue;
      const [px, py] = pts[i - 1]!;
      const seg = Math.hypot(x - px, y - py);
      if (seg < 0.5) continue;
      strokeLen += seg;
      const angle = Math.atan2(y - py, x - px);
      if (prevAngle !== null) {
        let delta = angle - prevAngle;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        turning += delta;
        if (Math.abs(delta) > Math.PI / 4) sharpTurns++;
      }
      prevAngle = angle;
    }
    const dur = pts[pts.length - 1]![2] - pts[0]![2];
    if (dur > 0) { speedSum += strokeLen / dur; speedN++; }
    const [sx, sy] = pts[0]!;
    const [ex, ey] = pts[pts.length - 1]!;
    if (strokeLen > diag * 0.15 && Math.hypot(ex - sx, ey - sy) < diag * 0.05) closed++;
    ink += strokeLen;
    colorInk[s.color] = (colorInk[s.color] ?? 0) + strokeLen;
  }

  const strokeCount = d.strokes.filter((s) => s.points.length > 1).length;
  const isEmpty = ink < diag * 0.05;

  let symHits = 0;
  for (const cell of cells) {
    const gx = cell % GRID;
    const gy = Math.floor(cell / GRID);
    if (cells.has(gy * GRID + (GRID - 1 - gx))) symHits++;
  }

  const colors: Record<string, number> = {};
  for (const [c, len] of Object.entries(colorInk)) colors[c] = ink > 0 ? len / ink : 0;

  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  return {
    strokeCount,
    inkLength: ink / diag,
    meanSpeed: speedN ? speedSum / speedN : 0,
    jaggedness: Math.min(1, ink > 0 ? (sharpTurns / (ink / 100)) / 5 : 0),
    closedShapes: closed,
    spiralScore: Math.min(1, strokeCount ? Math.abs(turning) / (2 * Math.PI * strokeCount) / 3 : 0),
    symmetry: cells.size ? symHits / cells.size : 0,
    aspect: isEmpty ? 1 : bw / bh,
    coverage: cells.size / (GRID * GRID),
    colors,
    isEmpty,
  };
}
