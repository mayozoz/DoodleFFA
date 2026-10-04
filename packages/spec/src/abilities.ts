/** Shared ability catalogue; durations and cooldowns are in seconds. */
export const ABILITIES = {
  flash: { name: 'Flash', cooldown: 8, duration: 0 },
  dash: { name: 'Dash attack', cooldown: 10, duration: 0 },
  smoke: { name: 'Smoke', cooldown: 12, duration: 4 },
  invisible: { name: 'Invisible', cooldown: 14, duration: 2 },
  flashbang: { name: 'Flashbang', cooldown: 15, duration: 2 },
  fire_steps: { name: 'Fire steps', cooldown: 12, duration: 4 },
  nuke1: { name: 'Nuke1', cooldown: 25, duration: 0 },
  nuke2: { name: 'Nuke2', cooldown: 25, duration: 0 },
  attack_boost: { name: 'Attack boost', cooldown: 15, duration: 5 },
  mini_arena: { name: 'Mini arena', cooldown: 18, duration: 5 },
  boomerang: { name: 'Boomerang', cooldown: 10, duration: 2 },
  rage: { name: 'Rage', cooldown: 14, duration: 5 },
  weapon_boost: { name: 'Weapon boost', cooldown: 14, duration: 6 },
  fire_ring: { name: 'Fire ring', cooldown: 14, duration: 4 },
  mushrooms: { name: 'Poisonous Mushrooms', cooldown: 14, duration: 15 },
  life_drain: { name: 'Life drain', cooldown: 18, duration: 3 },
  silence: { name: 'Silence', cooldown: 12, duration: 3 },
  hook: { name: 'Hook', cooldown: 12, duration: 2 },
  freeze: { name: 'Freeze', cooldown: 16, duration: 3 },
  shrink: { name: 'Shrink', cooldown: 14, duration: 6 },
} as const;
export type AbilityId = keyof typeof ABILITIES;
export const isAbilityId = (id: string): id is AbilityId => Object.hasOwn(ABILITIES, id);
export interface StatusEffect { until: number; dps?: number }
/** Unix seconds, always authored using the server clock. */
export type FighterEffects = Partial<Record<AbilityId | 'poison' | 'burn' | 'silenced' | 'frozen', StatusEffect>>;
export interface AbilityObjectData {
  kind: 'blind' | 'freeze' | 'smoke' | 'wall' | 'fire' | 'ring' | 'mushroom' | 'drain' | 'bomb' | 'boomerang' | 'hook' | 'silence';
  radius: number;
  start: number;
  until: number;
  vx?: number; vy?: number;
  originX?: number; originY?: number;
  hits?: string[];
  returning?: boolean;
}

/** Gameplay tuning shared by simulation and presentation. Fractions use maximum HP. */
export const ABILITY_TUNING = {
  charges: 2,
  travelDistance: 3,
  dashDamageFraction: 0.12,
  knockbackDistance: 2,
  smokeRadius: 2,
  wallHalfSize: 3,
  mushroomRadius: 0.55,
  poisonDps: 125,
  poisonSeconds: 5,
  ringRadius: 2,
  ringHalfWidth: 0.45,
  drainRadius: 3,
  drainDps: 200,
  freezeHalfSize: 1,
  freezeDistance: 2,
  projectileRadius: 0.3,
  projectileSpeed: 8,
  projectileSeconds: 2,
  boomerangReturnAfter: 0.5,
  blastRadius: 1.6,
  blastGridSpacing: 2,
  blastDamageFraction: 0.2,
  blastWindup: 0.6,
  blastSweepSeconds: 3,
  blastVisibleSeconds: 0.5,
  attackDamageMultiplier: 1.4,
  attackHealthCostFraction: 0.1,
  attackSpeedMultiplier: 1.4,
  weaponScale: 1.6,
  shrinkScale: 0.5,
  firePatchRadius: 0.65,
  firePatchSeconds: 3,
  firePatchSpacing: 0.55,
  burnSeconds: 2,
} as const;
