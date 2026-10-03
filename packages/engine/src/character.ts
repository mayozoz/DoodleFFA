import { Container, Graphics, Text } from 'pixi.js';
import type { Marker } from '@doodle/spec';

/**
 * The one base rig every player uses: body, head, hand — tinted by player color.
 * Ground ring + marker + name tag + HP bar also live here (all in player color).
 * The weapon goes on `hand` and is NEVER tinted.
 */
export class Character {
  readonly view = new Container();
  readonly body = new Graphics();
  readonly head = new Graphics();
  readonly hand = new Container();
  readonly ring = new Graphics();
  readonly hpBar = new Graphics();
  readonly nameTag: Text;
  private t = Math.random() * 10;

  constructor(readonly color: number, readonly marker: Marker, name: string, readonly unit: number) {
    const r = unit * 0.5;
    this.ring.ellipse(0, r * 0.9, r * 1.1, r * 0.4).stroke({ color, width: 3, alpha: 0.9 });
    drawMarker(this.ring, marker, 0, r * 0.9, r * 0.25, color);
    this.body.roundRect(-r * 0.7, -r * 0.6, r * 1.4, r * 1.4, r * 0.5).fill(color).stroke({ color: 0x111111, width: 3 });
    this.head.circle(0, -r * 0.9, r * 0.55).fill(0xffffff).stroke({ color: 0x111111, width: 3 });
    this.head.circle(r * 0.18, -r * 0.95, r * 0.08).fill(0x111111);
    this.hand.position.set(r * 0.8, 0);
    this.nameTag = new Text({ text: name, style: { fill: color, fontSize: 14, fontWeight: '700', stroke: { color: 0x000000, width: 3 } } });
    this.nameTag.anchor.set(0.5, 1);
    this.nameTag.position.set(0, -r * 1.7);
    this.hpBar.position.set(0, -r * 1.55);
    this.view.addChild(this.ring, this.body, this.head, this.hand, this.hpBar, this.nameTag);
    this.setHp(1);
  }

  setHp(frac: number) {
    const w = this.unit * 0.9;
    this.hpBar.clear().rect(-w / 2, 0, w, 5).fill(0x000000).rect(-w / 2, 0, w * Math.max(0, frac), 5).fill(this.color);
  }

  /** idle bob / walk waddle; `speed` 0–1. TODO(M1): dust puffs while walking. */
  animate(dt: number, speed: number, wobble = 0) {
    this.t += dt * (speed > 0.05 ? 12 : 3);
    const bob = Math.sin(this.t) * (speed > 0.05 ? 3 : 1.5);
    this.body.y = bob;
    this.head.y = bob * 1.2;
    this.body.rotation = speed > 0.05 ? Math.sin(this.t) * 0.08 : 0;
    this.hand.rotation = Math.sin(this.t * 0.7) * wobble * 0.15;
  }

  /** TODO(M1): proper white flash (ColorMatrixFilter brightness) + knockback offset. */
  flash() {
    this.view.alpha = 0.5;
    setTimeout(() => (this.view.alpha = 1), 60);
  }
}

export function drawMarker(g: Graphics, m: Marker, x: number, y: number, r: number, color: number) {
  switch (m) {
    case 'circle': g.circle(x, y, r); break;
    case 'triangle': g.poly([x, y - r, x + r, y + r, x - r, y + r]); break;
    case 'square': g.rect(x - r, y - r, r * 2, r * 2); break;
    case 'diamond': g.poly([x, y - r, x + r, y, x, y + r, x - r, y]); break;
    case 'star': g.star(x, y, 5, r, r / 2); break;
    case 'hexagon': g.regularPoly(x, y, r, 6); break;
    case 'pentagon': g.regularPoly(x, y, r, 5); break;
    case 'cross': g.poly([x - r / 3, y - r, x + r / 3, y - r, x + r / 3, y - r / 3, x + r, y - r / 3, x + r, y + r / 3, x + r / 3, y + r / 3, x + r / 3, y + r, x - r / 3, y + r, x - r / 3, y + r / 3, x - r, y + r / 3, x - r, y - r / 3, x - r / 3, y - r / 3]); break;
    case 'heart': g.circle(x - r / 2, y - r / 4, r / 2).circle(x + r / 2, y - r / 4, r / 2).poly([x - r, y - r / 6, x + r, y - r / 6, x, y + r]); break;
    case 'moon': g.circle(x, y, r); break; // TODO: crescent
    case 'bolt': g.poly([x + r / 3, y - r, x - r / 2, y + r / 6, x, y + r / 6, x - r / 3, y + r, x + r / 2, y - r / 6, x, y - r / 6]); break;
    case 'ring': g.circle(x, y, r).stroke({ color, width: 3 }); return;
  }
  g.fill(color);
}
