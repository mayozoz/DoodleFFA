import type { Archetype, OnHit, WeaponSpec } from '@doodle/spec';

const ATTACK_DESCRIPTION: Record<Archetype, string> = {
  swing: 'Sweep your weapon in an arc to catch opponents nearby.',
  thrust: 'Stab straight ahead. Line up your opponent before striking.',
  slam: 'Bring your weapon down with a heavy smash in front of you.',
  shoot: 'Fire projectiles ahead of you. Aim with your movement direction.',
  throw: 'Throw your weapon forward and catch enemies as it returns.',
  whip: 'Crack your weapon forward to strike enemies at a distance.',
  spin: 'Spin your weapon around you to hit opponents on every side.',
  beam: 'Charge up and unleash a beam ahead of you.',
};
const EFFECT_DESCRIPTION: Record<OnHit, string> = {
  burn: 'Hits set enemies on fire.', slow: 'Hits slow enemies down.',
  knockback: 'Hits push enemies back.', chain: 'Hits can chain to nearby enemies.',
  lifesteal: 'Hits restore some of your health.', pierce: 'Attacks pierce through enemies.',
};
export function weaponDescription(spec: WeaponSpec | null): string {
  return [ATTACK_DESCRIPTION[spec?.archetype ?? 'swing'], ...(spec?.on_hit ?? []).map(effect => EFFECT_DESCRIPTION[effect])].join(' ');
}
