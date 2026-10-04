import type { Archetype, BalancedStats } from '@doodle/spec';

// Melee hit areas per archetype — pure geometry, unit-tested. Shoot/throw use projectiles.
// All sizes in world units; the target's body radius (hitRadius) is added by the caller via `pad`.

export interface Vec { x: number; y: number }

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Vec) => Math.hypot(v.x, v.y);
const normAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Distance from p to segment ab. */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a), ap = sub(p, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  const t = l2 ? Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / l2)) : 0;
  return Math.hypot(ap.x - ab.x * t, ap.y - ab.y * t);
}

export type Shape =
  | { kind: 'arc'; center: Vec; radius: number; facing: number; halfAngle: number }
  | { kind: 'circle'; center: Vec; radius: number }
  | { kind: 'polyline'; points: Vec[]; halfWidth: number };

export function contains(shape: Shape, p: Vec, pad: number): boolean {
  switch (shape.kind) {
    case 'arc': {
      const d = sub(p, shape.center);
      if (len(d) > shape.radius + pad) return false;
      // a target overlapping the attacker is always "in front"
      if (len(d) < pad) return true;
      return Math.abs(normAngle(Math.atan2(d.y, d.x) - shape.facing)) <= shape.halfAngle;
    }
    case 'circle':
      return len(sub(p, shape.center)) <= shape.radius + pad;
    case 'polyline':
      for (let i = 0; i < shape.points.length - 1; i++) {
        if (distToSegment(p, shape.points[i]!, shape.points[i + 1]!) <= shape.halfWidth + pad) return true;
      }
      return false;
  }
}

/** Points along a gently curving whip (bends toward the attacker's off-hand side). */
function whipPoints(from: Vec, facing: number, length: number, n = 7): Vec[] {
  const bend = 0.7; // total radians of curl along the lash
  const pts: Vec[] = [];
  let x = from.x, y = from.y;
  for (let i = 0; i <= n; i++) {
    pts.push({ x, y });
    const a = facing + bend * (i / n - 0.5);
    x += Math.cos(a) * (length / n);
    y += Math.sin(a) * (length / n);
  }
  return pts;
}

/** Hit area for a melee archetype; null for projectile archetypes (shoot, throw). */
export function meleeShape(archetype: Archetype, from: Vec, facing: number, stats: BalancedStats): Shape | null {
  const reach = stats.rangeUnits, area = stats.areaUnits; // area 0.4–1.6
  const dir = { x: Math.cos(facing), y: Math.sin(facing) };
  const ahead = (d: number): Vec => ({ x: from.x + dir.x * d, y: from.y + dir.y * d });
  switch (archetype) {
    case 'swing':
      return { kind: 'arc', center: from, radius: reach, facing, halfAngle: (70 * Math.PI) / 180 };
    case 'thrust':
      return { kind: 'polyline', points: [from, ahead(reach)], halfWidth: 0.15 + area * 0.2 };
    case 'slam':
      return { kind: 'circle', center: ahead(reach * 0.6), radius: area };
    case 'whip':
      return { kind: 'polyline', points: whipPoints(from, facing, reach), halfWidth: 0.1 + area * 0.15 };
    case 'spin':
      return { kind: 'circle', center: from, radius: reach };
    case 'beam':
      return { kind: 'polyline', points: [from, ahead(reach)], halfWidth: 0.08 + area * 0.15 };
    case 'shoot':
    case 'throw':
      return null;
  }
}
