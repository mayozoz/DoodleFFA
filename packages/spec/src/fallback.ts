import type { DrawingFeatures } from './features';
import type { Archetype, DecorType, VfxType } from './enums';
import { DECOR_DEFAULT_AT } from './enums';
import type { DecorSpec, VfxSpec, WeaponSpec } from './types';
import { mulberry32 } from './rng';

// Deterministic, offline weapon generation. Used when the AI spec is missing/late,
// and as the per-field fallback inside validateWeaponSpec.

/** Used for empty or unsafe drawings. */
export const MYSTERY_STICK: WeaponSpec = {
  name: 'Mystery Stick',
  grip: [0.1, 0.5],
  tip: [0.9, 0.5],
  archetype: 'swing',
  range: 0.4,
  area: 0.4,
  cooldown: 0.6,
  projectile: null,
  on_hit: ['knockback'],
  vfx: [{ type: 'sparkles', where: 'trail', intensity: 0.5 }],
  motion: { elasticity: 0.5, weight: 0.5, wobble: 0.3 },
  palette: ['#8B5A2B', '#D2A26B'],
  sfx_prompt: 'wooden stick whoosh',
  decor: [{ type: 'glow', at: 'edge', color: '#ffd27a', intensity: 0.5 }, { type: 'gem', at: 'grip', color: '#3fd0c9', intensity: 0.6 }],
};

/** M1 hard-coded spec: every weapon is this swing until the AI layer lands. */
export const DEFAULT_SWING: WeaponSpec = { ...MYSTERY_STICK, name: 'Doodle Blade', on_hit: [], vfx: [] };

/** Rough color-name bucketing for the 4 canvas colors (and anything else). */
function colorElement(hex: string): VfxType | null {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (r + g + b < 120) return 'shadow';
  if (r > 180 && g < 120 && b < 120) return 'fire';
  if (b > 160 && r < 120) return 'ice';
  if (g > 150 && r < 140 && b < 140) return 'poison';
  return null;
}

const NAME_PARTS = {
  adj: ['Wobbly', 'Grim', 'Sparkling', 'Furious', 'Sleepy', 'Ancient', 'Spicy', 'Humble', 'Jagged', 'Lucky'],
  noun: { swing: 'Blade', thrust: 'Spear', slam: 'Mallet', shoot: 'Blaster', throw: 'Boomerang', whip: 'Lash', spin: 'Whirl', beam: 'Ray' } as Record<Archetype, string>,
};

/** Ink-color → upgrade, so every weapon gets a Reveal "upgrade" even without AI. */
const DECOR_BY_ELEMENT: Partial<Record<VfxType, DecorType>> = { fire: 'flames', ice: 'frost', poison: 'vines', shadow: 'spikes', electric: 'sparks' };

function fallbackDecor(vfx: VfxSpec[], palette: string[], rand: () => number): DecorSpec[] {
  const out: DecorSpec[] = [{ type: 'glow', at: 'edge', color: palette[0] ?? '#ffffff', intensity: 0.55 }];
  for (const v of vfx) {
    const t = DECOR_BY_ELEMENT[v.type];
    if (t && !out.some((d) => d.type === t)) out.push({ type: t, at: DECOR_DEFAULT_AT[t], color: palette[out.length % Math.max(1, palette.length)] ?? '#ffffff', intensity: 0.6 });
  }
  if (out.length < 3) {
    const extra: DecorType = (['gem', 'halo', 'runes', 'wings'] as const)[Math.floor(rand() * 4)]!;
    if (!out.some((d) => d.type === extra)) out.push({ type: extra, at: DECOR_DEFAULT_AT[extra], color: palette[1] ?? palette[0] ?? '#ffd60a', intensity: 0.6 });
  }
  return out.slice(0, 3);
}

export function fallbackSpecFromFeatures(f: DrawingFeatures, seed: number): WeaponSpec {
  if (f.isEmpty) return MYSTERY_STICK;
  const rand = mulberry32(seed);

  let archetype: Archetype;
  if (f.spiralScore > 0.5) archetype = f.closedShapes > 0 ? 'spin' : 'throw';
  else if (f.aspect > 3 || f.aspect < 1 / 3) archetype = f.jaggedness > 0.5 ? 'whip' : 'thrust';
  else if (f.coverage > 0.25) archetype = 'slam';
  else if (f.strokeCount > 6) archetype = 'shoot';
  else archetype = 'swing';

  const dominant = Object.entries(f.colors).sort((a, b) => b[1] - a[1]);
  const vfx: VfxSpec[] = [];
  for (const [hex] of dominant.slice(0, 2)) {
    const t = colorElement(hex);
    if (t && !vfx.some((v) => v.type === t)) vfx.push({ type: t, where: 'trail', intensity: 0.6 });
  }
  if (f.jaggedness > 0.6) vfx.push({ type: 'electric', where: 'impact', intensity: 0.7 });
  if (vfx.length === 0) vfx.push({ type: 'sparkles', where: 'trail', intensity: 0.5 });

  const weight = Math.min(1, f.inkLength / 6);
  const adj = NAME_PARTS.adj[Math.floor(rand() * NAME_PARTS.adj.length)]!;

  return {
    name: `${adj} ${NAME_PARTS.noun[archetype]}`,
    grip: f.aspect >= 1 ? [0.1, 0.5] : [0.5, 0.9],
    tip: f.aspect >= 1 ? [0.9, 0.5] : [0.5, 0.1],
    archetype,
    range: Math.min(1, Math.max(f.aspect, 1 / f.aspect) / 5),
    area: Math.min(1, f.coverage * 2),
    cooldown: 0.6,
    projectile: archetype === 'shoot' ? { count: 1 + Math.floor(rand() * 3), spread_deg: 20, speed: 0.6, behavior: 'pierce' } : null,
    on_hit: vfx.some((v) => v.type === 'fire') ? ['burn'] : vfx.some((v) => v.type === 'ice') ? ['slow'] : ['knockback'],
    vfx: vfx.slice(0, 3),
    motion: { elasticity: 1 - f.symmetry, weight, wobble: f.jaggedness },
    palette: dominant.slice(0, 3).map(([hex]) => hex),
    sfx_prompt: `${archetype} weapon whoosh`,
    decor: fallbackDecor(vfx, dominant.slice(0, 3).map(([hex]) => hex), rand),
  };
}
