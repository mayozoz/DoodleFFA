import type { VfxSpec } from '@doodle/spec';
import { ParticleSystem, type ParticleParams } from './particles';
import { VFX_PRESETS } from './presets';

export { ParticleSystem, VFX_PRESETS };
export type { ParticleParams };

const hexToNum = (hex: string) => parseInt(hex.replace('#', ''), 16);

/** Resolve a weapon's vfx entry into concrete particle params (palette color, intensity-scaled). */
export function vfxParams(v: VfxSpec, palette: string[], i = 0): ParticleParams {
  const preset = VFX_PRESETS[v.type];
  const hex = palette[i % Math.max(1, palette.length)];
  return {
    ...preset,
    color: hex ? hexToNum(hex) : preset.defaultColor,
    rate: preset.rate * (0.4 + v.intensity * 0.6),
    size: preset.size * (0.7 + v.intensity * 0.6),
  };
}
