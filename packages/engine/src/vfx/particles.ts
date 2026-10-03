import { Container, Graphics } from 'pixi.js';

// Tiny Graphics-based particle system. Deliberately dependency-free: @pixi/particle-emitter
// targets Pixi v7; swap this out if a v8-compatible emitter proves nicer (see README).

export interface ParticleParams {
  color: number;
  /** particles / s at intensity 1 */
  rate: number;
  size: number;
  lifetime: number; // s
  speed: number;    // px / s
  gravity: number;  // px / s², negative = rises
  spread: number;   // radians
  shape: 'dot' | 'star' | 'shard' | 'petal' | 'spike';
}

interface P { g: Graphics; vx: number; vy: number; age: number; life: number }

export class ParticleSystem {
  readonly view = new Container();
  private ps: P[] = [];

  emit(x: number, y: number, dir: number, p: ParticleParams, n = 1) {
    for (let i = 0; i < n; i++) {
      const g = new Graphics();
      drawShape(g, p.shape, p.size * (0.6 + Math.random() * 0.8), p.color);
      g.position.set(x, y);
      const a = dir + (Math.random() - 0.5) * p.spread;
      const s = p.speed * (0.5 + Math.random());
      this.view.addChild(g);
      this.ps.push({ g, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 0, age: 0, life: p.lifetime });
      (g as Graphics & { _grav?: number })._grav = p.gravity;
    }
  }

  step(dt: number) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const q = this.ps[i]!;
      q.age += dt;
      q.vy += ((q.g as Graphics & { _grav?: number })._grav ?? 0) * dt;
      q.g.x += q.vx * dt;
      q.g.y += q.vy * dt;
      q.g.alpha = 1 - q.age / q.life;
      if (q.age >= q.life) {
        q.g.destroy();
        this.ps.splice(i, 1);
      }
    }
  }
}

function drawShape(g: Graphics, shape: ParticleParams['shape'], r: number, color: number) {
  switch (shape) {
    case 'star': g.star(0, 0, 5, r, r / 2).fill(color); break;
    case 'shard': g.poly([0, -r, r / 3, 0, 0, r, -r / 3, 0]).fill(color); break;
    case 'petal': g.ellipse(0, 0, r, r / 2).fill(color); break;
    case 'spike': g.poly([-r / 3, r / 2, 0, -r, r / 3, r / 2]).fill(color); break;
    default: g.circle(0, 0, r).fill(color);
  }
}
