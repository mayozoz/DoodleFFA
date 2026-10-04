import { BlurFilter, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { DecorSpec, WeaponSpec } from '@doodle/spec';
import { ease, type Tweener } from './tween';

// Weapon "upgrades": cosmetic decorations drawn ON TOP of the player's doodle. The doodle's pixels
// are never changed — this only adds layers in front of / behind it. Everything is procedural and
// anchored to the doodle's own outline (edge points from the cut-out), so flames lick the real
// edges, spikes point out of the real silhouette, and so on.
//
// Two containers (`back`, `front`) live next to the weapon sprite and copy its transform every
// frame (`sync`), so decorations follow every attack animation without the animations knowing.
// Coordinates inside them are the sprite's local pixels (origin = grip anchor), like the sprite.

/** Normalized (0–1) opaque pixels that touch transparency — the doodle's outline. */
export type EdgePoints = [number, number][];

/** Find outline points on a cut-out canvas (alpha), sampled on a grid. */
export function edgePoints(canvas: HTMLCanvasElement, max = 220): EdgePoints {
  const w = canvas.width, h = canvas.height;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g || !w || !h) return [];
  const a = g.getImageData(0, 0, w, h).data;
  const step = Math.max(2, Math.round(Math.sqrt((w * h) / 9000)));
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3]! > 90;
  const out: EdgePoints = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (!solid(x, y)) continue;
      if (solid(x - step, y) && solid(x + step, y) && solid(x, y - step) && solid(x, y + step)) continue;
      out.push([x / w, y / h]);
    }
  }
  // thin evenly to `max`
  if (out.length <= max) return out;
  const k = out.length / max;
  return Array.from({ length: max }, (_, i) => out[Math.floor(i * k)]!);
}

/** Global size knob for every decoration (on-screen px ≈ DECOR_SIZE × the base sizes below). */
export const DECOR_SIZE = 1.7;

const hex = (c: string, fb = 0xffffff) => (/^#[0-9a-f]{6}$/i.test(c) ? parseInt(c.slice(1), 16) : fb);
const lighten = (c: number, t: number) => {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const m = (v: number) => Math.round(v + (255 - v) * t);
  return (m(r) << 16) | (m(g) << 8) | m(b);
};

interface Particle { g: Graphics; vx: number; vy: number; age: number; life: number; size: number }
interface Piece { update(dt: number, t: number): void }

export class WeaponDecor {
  readonly back = new Container();
  readonly front = new Container();
  private pieces: Piece[] = [];
  private t = Math.random() * 10;
  /** 0 → hidden, 1 → fully shown (the Reveal "upgrade" pops this) */
  private pop = 1;
  private readonly W: number;
  private readonly H: number;
  /** texture px per screen px at build time — keeps strokes a sensible on-screen width */
  private readonly px: number;
  private readonly local: (n: [number, number]) => { x: number; y: number };
  private readonly grip: { x: number; y: number };
  private readonly tip: { x: number; y: number };
  private readonly edges: { x: number; y: number; t: number }[];

  constructor(
    private texture: Texture,
    edgesN: EdgePoints,
    private spec: WeaponSpec,
    spriteScale: number,
    decor: DecorSpec[] = spec.decor ?? [],
  ) {
    this.W = texture.width;
    this.H = texture.height;
    // ×DECOR_SIZE: decorations read from across a room, not just up close
    this.px = DECOR_SIZE / Math.max(1e-4, Math.abs(spriteScale));
    const [gx, gy] = spec.grip;
    this.local = ([nx, ny]) => ({ x: (nx - gx) * this.W, y: (ny - gy) * this.H });
    this.grip = this.local(spec.grip);
    this.tip = this.local(spec.tip);
    // project every outline point onto grip→tip: t = 0 at the grip, 1 at the tip
    const dx = this.tip.x - this.grip.x, dy = this.tip.y - this.grip.y, l2 = dx * dx + dy * dy || 1;
    this.edges = edgesN.map((n) => {
      const p = this.local(n);
      return { ...p, t: ((p.x - this.grip.x) * dx + (p.y - this.grip.y) * dy) / l2 };
    });
    for (const d of decor) this.add(d);
  }

  /** Follow the weapon sprite (call every frame, after animations). */
  sync(s: Sprite) {
    for (const c of [this.back, this.front]) {
      c.position.copyFrom(s.position);
      c.rotation = s.rotation;
      c.scale.set(s.scale.x * this.pop, s.scale.y * this.pop);
      c.skew.copyFrom(s.skew);
      c.visible = s.visible && this.pop > 0.001;
      c.alpha = s.alpha;
    }
  }

  update(dt: number) {
    this.t += dt;
    for (const p of this.pieces) p.update(dt, this.t);
  }

  /** Start hidden (for the Reveal). */
  hide() { this.pop = 0; }

  /** The Reveal "upgrade": a flash on the doodle, then the decorations pop on. */
  async reveal(tweener: Tweener) {
    const flash = new Graphics();
    this.front.addChild(flash);
    const c = { x: (this.grip.x + this.tip.x) / 2, y: (this.grip.y + this.tip.y) / 2 };
    const r = Math.hypot(this.tip.x - this.grip.x, this.tip.y - this.grip.y) * 0.75;
    this.pop = 0.001;
    const p = tweener.to(0.45, (t) => { this.pop = Math.max(0.001, t); }, ease.outBack(0.8));
    await tweener.to(0.4, (t) => {
      flash.clear()
        .circle(c.x, c.y, r * (0.3 + t)).fill({ color: 0xffffff, alpha: 0.55 * (1 - t) })
        .circle(c.x, c.y, r * (0.5 + 0.9 * t)).stroke({ color: 0xffffff, width: 10 * this.px * (1 - t), alpha: 1 - t });
    });
    flash.destroy();
    await p;
    this.pop = 1;
  }

  destroy() {
    this.back.destroy({ children: true });
    this.front.destroy({ children: true });
    this.pieces = [];
  }

  // ── decorations ────────────────────────────────────────────────────────────

  /** outline points in the decoration's region */
  private region(at: DecorSpec['at']) {
    const pts = at === 'tip' ? this.edges.filter((e) => e.t > 0.6)
      : at === 'grip' ? this.edges.filter((e) => e.t < 0.35)
      : this.edges;
    return pts.length ? pts : this.edges.length ? this.edges : [{ ...this.tip, t: 1 }];
  }

  /** a point on the grip→tip line */
  private along(t: number) {
    return { x: this.grip.x + (this.tip.x - this.grip.x) * t, y: this.grip.y + (this.tip.y - this.grip.y) * t };
  }

  private anchor(at: DecorSpec['at']) {
    return at === 'grip' ? this.grip : at === 'tip' ? this.tip : this.along(0.5);
  }

  private add(d: DecorSpec) {
    const color = hex(d.color, 0xffd27a);
    const k = 0.5 + d.intensity; // 0.5–1.5
    const px = this.px;
    const len = Math.hypot(this.tip.x - this.grip.x, this.tip.y - this.grip.y) || this.W;
    switch (d.type) {
      case 'glow': {
        // a tinted, blurred copy of the doodle behind it, breathing
        const s = new Sprite(this.texture);
        s.anchor.set(this.spec.grip[0], this.spec.grip[1]);
        s.tint = color;
        s.filters = [new BlurFilter({ strength: 6 + 6 * d.intensity, quality: 3 })];
        this.back.addChild(s);
        this.pieces.push({ update: (_dt, t) => { s.alpha = 0.55 + 0.35 * Math.sin(t * 3); s.scale.set(1.04 + 0.03 * Math.sin(t * 2)); } });
        break;
      }
      case 'gem': {
        const at = this.anchor(d.at), r = (8 + 6 * k) * px;
        const g = new Graphics()
          .poly([0, -r, r * 0.8, 0, 0, r, -r * 0.8, 0]).fill(color).stroke({ color: 0x111111, width: 2 * px })
          .poly([0, -r * 0.6, r * 0.35, 0, 0, r * 0.15, -r * 0.35, 0]).fill({ color: lighten(color, 0.6), alpha: 0.9 });
        g.position.set(at.x, at.y);
        const shine = new Graphics().star(0, 0, 4, r * 0.7, r * 0.12).fill(0xffffff);
        shine.position.set(at.x + r * 0.45, at.y - r * 0.55);
        this.front.addChild(g, shine);
        this.pieces.push({ update: (_dt, t) => { const s = Math.max(0, Math.sin(t * 2.2)) ** 6; shine.alpha = s; shine.scale.set(0.5 + s); shine.rotation = t; } });
        break;
      }
      case 'flames':
        this.particles(d, {
          color, core: lighten(color, 0.7), rate: 28 * k, life: 0.55, size: (5 + 4 * k) * px,
          spawn: (pts) => pts[Math.floor(Math.random() * pts.length)]!,
          vel: (p) => { const o = this.outward(p); return { vx: o.x * 30 * px, vy: o.y * 30 * px - 45 * px }; },
        });
        break;
      case 'frost': {
        const pts = this.region(d.at), n = Math.round(6 + 6 * d.intensity);
        for (let i = 0; i < n; i++) {
          const p = pts[Math.floor((i / n) * pts.length)]!;
          const r = (5 + 5 * Math.random() * k) * px;
          const g = new Graphics();
          for (let a = 0; a < 3; a++) {
            const ang = (a * Math.PI) / 3;
            g.moveTo(Math.cos(ang) * -r, Math.sin(ang) * -r).lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
          }
          g.stroke({ color: lighten(color, 0.4), width: 2 * px, cap: 'round' }).circle(0, 0, r * 0.25).fill(0xffffff);
          g.position.set(p.x, p.y);
          g.rotation = Math.random();
          this.front.addChild(g);
          const ph = Math.random() * 6;
          this.pieces.push({ update: (_dt, t) => { g.alpha = 0.6 + 0.4 * Math.sin(t * 2 + ph); } });
        }
        break;
      }
      case 'sparks': {
        // jagged arcs between outline points, regenerated a dozen times a second
        const g = new Graphics();
        this.front.addChild(g);
        const pts = this.region(d.at);
        let acc = 0;
        this.pieces.push({
          update: (dt) => {
            acc -= dt;
            if (acc > 0) return;
            acc = 0.08;
            g.clear();
            const arcs = Math.round(1 + 2 * d.intensity);
            for (let a = 0; a < arcs; a++) {
              const p = pts[Math.floor(Math.random() * pts.length)]!, q = pts[Math.floor(Math.random() * pts.length)]!;
              const segs = 6;
              g.moveTo(p.x, p.y);
              for (let i = 1; i <= segs; i++) {
                const f = i / segs, j = (i < segs ? 1 : 0) * (Math.random() - 0.5) * 14 * px * k;
                g.lineTo(p.x + (q.x - p.x) * f + j, p.y + (q.y - p.y) * f + j);
              }
            }
            g.stroke({ color, width: 6 * px, alpha: 0.55 }).stroke({ color: 0xffffff, width: 2 * px });
          },
        });
        break;
      }
      case 'runes': {
        const n = 3 + Math.round(2 * d.intensity);
        const nx = -(this.tip.y - this.grip.y) / len, ny = (this.tip.x - this.grip.x) / len;
        for (let i = 0; i < n; i++) {
          const p = this.along(0.2 + (0.65 * i) / Math.max(1, n - 1));
          const r = (6 + 3 * k) * px;
          const g = new Graphics()
            .circle(0, 0, r).stroke({ color, width: 1.5 * px })
            .moveTo(-r * 0.5, -r * 0.6).lineTo(r * 0.5, r * 0.6).moveTo(r * 0.5, -r * 0.6).lineTo(-r * 0.2, 0)
            .stroke({ color: lighten(color, 0.5), width: 2 * px, cap: 'round' });
          g.position.set(p.x + nx * r * 0.2, p.y + ny * r * 0.2);
          this.front.addChild(g);
          this.pieces.push({ update: (_dt, t) => { const s = Math.max(0, Math.sin(t * 3 - i * 0.9)); g.alpha = 0.35 + 0.65 * s; g.scale.set(0.9 + 0.2 * s); } });
        }
        break;
      }
      case 'spikes': {
        const pts = this.region(d.at), n = Math.round(7 + 8 * d.intensity);
        const g = new Graphics();
        for (let i = 0; i < n; i++) {
          const p = pts[Math.floor(((i + 0.5) / n) * pts.length)]!, o = this.outward(p), r = (6 + 6 * k) * px;
          const sx = -o.y, sy = o.x;
          g.poly([p.x + sx * r * 0.45, p.y + sy * r * 0.45, p.x + o.x * r * 1.6, p.y + o.y * r * 1.6, p.x - sx * r * 0.45, p.y - sy * r * 0.45]);
        }
        g.fill(color).stroke({ color: 0x111111, width: 1.5 * px });
        this.front.addChild(g); // in front: thick doodle strokes would hide them otherwise
        break;
      }
      case 'vines': {
        const g = new Graphics();
        this.front.addChild(g);
        const nx = -(this.tip.y - this.grip.y) / len, ny = (this.tip.x - this.grip.x) / len;
        const amp = (7 + 6 * k) * px, leaves: { x: number; y: number; a: number }[] = [];
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 40; i++) {
          const f = i / 40, p = this.along(0.05 + 0.9 * f), w = Math.sin(f * Math.PI * 5) * amp;
          pts.push({ x: p.x + nx * w, y: p.y + ny * w });
          if (i % 6 === 3) leaves.push({ x: p.x + nx * w, y: p.y + ny * w, a: Math.atan2(ny, nx) * (i % 12 === 3 ? 1 : -1) });
        }
        g.moveTo(pts[0]!.x, pts[0]!.y);
        for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
        g.stroke({ color, width: 3 * px, cap: 'round', join: 'round' });
        for (const l of leaves) {
          const leaf = new Graphics().ellipse(amp * 0.55, 0, amp * 0.6, amp * 0.28).fill(lighten(color, 0.25)).stroke({ color: 0x113311, width: px });
          leaf.position.set(l.x, l.y);
          leaf.rotation = l.a;
          this.front.addChild(leaf);
          const ph = Math.random() * 6;
          this.pieces.push({ update: (_dt, t) => { leaf.rotation = l.a + 0.2 * Math.sin(t * 2 + ph); } });
        }
        break;
      }
      case 'wings': {
        const at = this.anchor(d.at), r = (22 + 14 * k) * px;
        const ang = Math.atan2(this.tip.y - this.grip.y, this.tip.x - this.grip.x);
        const wing = (side: 1 | -1) => {
          const g = new Graphics();
          for (let f = 0; f < 3; f++) {
            const rr = r * (1 - f * 0.22);
            g.ellipse(0, -rr * 0.5, rr * 0.28, rr * 0.55);
          }
          g.fill({ color: lighten(color, 0.55), alpha: 0.95 }).stroke({ color, width: 2 * px });
          g.position.set(at.x, at.y);
          g.rotation = ang + (side === 1 ? -Math.PI / 2 : Math.PI / 2) + side * 0.6;
          this.back.addChild(g);
          this.pieces.push({ update: (_dt, t) => { g.scale.set(1, 0.75 + 0.25 * Math.sin(t * 7)); } });
        };
        wing(1); wing(-1);
        break;
      }
      case 'halo': {
        const at = this.anchor(d.at), r = (14 + 10 * k) * px;
        const ring = new Graphics().ellipse(0, 0, r, r * 0.35).stroke({ color, width: 4 * px }).ellipse(0, 0, r, r * 0.35).stroke({ color: 0xffffff, width: 1.5 * px });
        ring.position.set(at.x, at.y - r * 0.6);
        const dots = new Graphics();
        dots.position.copyFrom(ring.position);
        this.front.addChild(ring, dots);
        this.pieces.push({
          update: (_dt, t) => {
            dots.clear();
            for (let i = 0; i < 4; i++) {
              const a = t * 2 + (i * Math.PI) / 2;
              dots.star(Math.cos(a) * r, Math.sin(a) * r * 0.35, 4, 4 * px, 1.5 * px).fill(0xffffff);
            }
            ring.alpha = 0.75 + 0.25 * Math.sin(t * 4);
          },
        });
        break;
      }
    }
  }

  /** unit vector from the weapon's center line out through an outline point */
  private outward(p: { x: number; y: number; t?: number }) {
    const c = this.along(Math.max(0, Math.min(1, p.t ?? 0.5)));
    const dx = p.x - c.x, dy = p.y - c.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }

  private particles(d: DecorSpec, o: {
    color: number; core: number; rate: number; life: number; size: number;
    spawn: (pts: { x: number; y: number; t: number }[]) => { x: number; y: number; t: number };
    vel: (p: { x: number; y: number; t: number }) => { vx: number; vy: number };
  }) {
    const layer = new Container();
    this.front.addChild(layer);
    const pts = this.region(d.at);
    const live: Particle[] = [];
    let acc = 0;
    this.pieces.push({
      update: (dt) => {
        acc += dt * o.rate;
        while (acc >= 1 && live.length < 60) {
          acc -= 1;
          const p = o.spawn(pts), v = o.vel(p);
          const g = new Graphics().circle(0, 0, o.size).fill({ color: o.color, alpha: 0.85 }).circle(0, 0, o.size * 0.45).fill(o.core);
          g.position.set(p.x, p.y);
          layer.addChild(g);
          live.push({ g, vx: v.vx, vy: v.vy, age: 0, life: o.life * (0.7 + Math.random() * 0.6), size: o.size });
        }
        if (acc > 1) acc = 1;
        for (let i = live.length - 1; i >= 0; i--) {
          const q = live[i]!;
          q.age += dt;
          const f = q.age / q.life;
          q.g.x += q.vx * dt; q.g.y += q.vy * dt;
          q.g.alpha = 1 - f;
          q.g.scale.set(1 - 0.7 * f);
          if (f >= 1) { q.g.destroy(); live.splice(i, 1); }
        }
      },
    });
  }
}
