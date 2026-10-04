// Closed vocabularies shared by the AI prompt, the validator and the engine.
// Adding a value here means the engine MUST implement it before it ships.

export const ARCHETYPES = ['swing', 'thrust', 'slam', 'shoot', 'throw', 'whip', 'spin', 'beam'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const VFX_TYPES = ['fire', 'sparkles', 'thorns', 'electric', 'ice', 'poison', 'shadow', 'goo', 'petals'] as const;
export type VfxType = (typeof VFX_TYPES)[number];

export const VFX_WHERE = ['trail', 'tip', 'impact', 'always'] as const;
export type VfxWhere = (typeof VFX_WHERE)[number];

export const ON_HIT = ['burn', 'slow', 'knockback', 'chain', 'lifesteal', 'pierce'] as const;
export type OnHit = (typeof ON_HIT)[number];

export const PROJECTILE_BEHAVIORS = ['pierce', 'bounce', 'split', 'homing', 'arc'] as const;
export type ProjectileBehavior = (typeof PROJECTILE_BEHAVIORS)[number];

export const MARKERS = [
  'circle', 'triangle', 'square', 'diamond', 'star', 'hexagon',
  'pentagon', 'cross', 'heart', 'moon', 'bolt', 'ring',
] as const;
export type Marker = (typeof MARKERS)[number];

export const PHASES = ['lobby', 'draw', 'drop', 'reveal', 'battle', 'results'] as const;
export type Phase = (typeof PHASES)[number];

export const WEAPON_STATUS = ['pending', 'generating', 'ready', 'fallback'] as const;
export type WeaponStatus = (typeof WEAPON_STATUS)[number];

/** Effects with no gameplay cost in the balance formula. */
export const COSMETIC_VFX: readonly VfxType[] = ['sparkles', 'petals'];

export function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}
