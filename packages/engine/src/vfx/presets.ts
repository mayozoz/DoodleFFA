import type { VfxType } from '@doodle/spec';
import type { ParticleParams } from './particles';

/**
 * One preset per vfx.type. `color` is replaced at runtime by a weapon palette color
 * (never the player color). TODO(M2/M4): bespoke renderers for electric arcs, poison
 * clouds, shadow afterimages — these presets are the particle baseline.
 */
export const VFX_PRESETS: Record<VfxType, Omit<ParticleParams, 'color'> & { defaultColor: number }> = {
  fire:     { defaultColor: 0xff6a1f, rate: 60, size: 4, lifetime: 0.6, speed: 40, gravity: -120, spread: 1.2, shape: 'dot' },
  sparkles: { defaultColor: 0xfff3a0, rate: 25, size: 5, lifetime: 0.8, speed: 20, gravity: 0, spread: 6.28, shape: 'star' },
  thorns:   { defaultColor: 0x3a7d2c, rate: 0, size: 7, lifetime: 0.35, speed: 160, gravity: 0, spread: 6.28, shape: 'spike' },
  electric: { defaultColor: 0x9fe8ff, rate: 40, size: 3, lifetime: 0.15, speed: 220, gravity: 0, spread: 6.28, shape: 'shard' },
  ice:      { defaultColor: 0xa8e4ff, rate: 30, size: 5, lifetime: 0.5, speed: 60, gravity: 60, spread: 2, shape: 'shard' },
  poison:   { defaultColor: 0x7ad13a, rate: 20, size: 9, lifetime: 1.2, speed: 15, gravity: -10, spread: 6.28, shape: 'dot' },
  shadow:   { defaultColor: 0x2a1f3d, rate: 30, size: 8, lifetime: 0.7, speed: 20, gravity: -30, spread: 6.28, shape: 'dot' },
  goo:      { defaultColor: 0x3fd0c9, rate: 20, size: 6, lifetime: 0.7, speed: 90, gravity: 300, spread: 2.5, shape: 'dot' },
  petals:   { defaultColor: 0xff8fc7, rate: 15, size: 6, lifetime: 1.4, speed: 30, gravity: 25, spread: 6.28, shape: 'petal' },
};
