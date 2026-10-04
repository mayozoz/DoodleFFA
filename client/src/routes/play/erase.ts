import type { Stroke, StrokePoint } from '@doodle/spec';

/** Cut ink out of strokes so erased marks also disappear from weapon features. */
export function eraseAt(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  const result: Stroke[] = [];
  for (const stroke of strokes) {
    const r = radius + stroke.width / 2;
    const outside = (p: StrokePoint) => Math.hypot(p[0] - x, p[1] - y) >= r;
    if (stroke.points.length === 1) {
      if (outside(stroke.points[0]!)) result.push(stroke);
      continue;
    }
    let points: StrokePoint[] = [];
    const flush = () => {
      if (points.length) result.push({ ...stroke, points });
      points = [];
    };
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1]!, b = stroke.points[i]!;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const length2 = dx * dx + dy * dy;
      const along = (t: number): StrokePoint => [a[0] + dx * t, a[1] + dy * t, a[2] + (b[2] - a[2]) * t];
      const projection = length2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / length2 : 0;
      const closest = along(projection);
      const distance2 = (closest[0] - x) ** 2 + (closest[1] - y) ** 2;
      if (!length2 || distance2 >= r * r) {
        if (outside(a)) {
          if (!points.length) points.push(a);
          points.push(b);
        } else flush();
        continue;
      }
      const half = Math.sqrt((r * r - distance2) / length2);
      const start = Math.max(0, projection - half), end = Math.min(1, projection + half);
      if (start >= end) {
        if (!points.length) points.push(a);
        points.push(b);
        continue;
      }
      if (start > 0) {
        if (!points.length) points.push(a);
        points.push(along(start));
      }
      flush();
      if (end < 1) points.push(along(end), b);
    }
    flush();
  }
  return result;
}
