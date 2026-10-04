import type { Archetype, StoredWeapon, VfxType, DecorType } from '@doodle/spec';

const ELEMENTS: Record<string, string> = {
  Fire: 'Flames and glowing embers give your weapon its fire element.',
  Ice: 'Frost and icy trails give your weapon its ice element.',
  Thunder: 'Lightning sparks give your weapon its thunder element.',
  Poison: 'Green venom gives your weapon its poison element.',
  Shadow: 'Dark trails give your weapon its shadow element.',
  Nature: 'Thorns, vines, or petals give your weapon its nature element.',
  Slime: 'Goo trails give your weapon its slime element.',
  Magic: 'Sparkling trails give your weapon its magic element.',
};
const VFX_ELEMENT: Record<VfxType, string> = {
  fire: 'Fire', ice: 'Ice', electric: 'Thunder', poison: 'Poison', shadow: 'Shadow',
  thorns: 'Nature', petals: 'Nature', goo: 'Slime', sparkles: 'Magic',
};
const DECOR_ELEMENT: Partial<Record<DecorType, string>> = {
  flames: 'Fire', frost: 'Ice', sparks: 'Thunder', vines: 'Nature',
};

const TYPES: Record<Archetype, { name: string; how: string }> = {
  swing: { name: 'Swing', how: 'Sweep your weapon in an arc in front of you. Move close and face your opponent before tapping Attack.' },
  thrust: { name: 'Thrust', how: 'Stab straight ahead. Line up an opponent in front of you, then tap Attack.' },
  slam: { name: 'Slam', how: 'Bring your weapon down for an area hit ahead of you. Catch opponents inside its impact zone.' },
  shoot: { name: 'Projectile', how: 'Fire projectiles toward a nearby opponent. Aim with your movement direction when no target is nearby.' },
  throw: { name: 'Throw', how: 'Throw your weapon forward. It travels out and returns; enemies along its path can be hit.' },
  whip: { name: 'Whip', how: 'Snap a long, narrow attack ahead of you. Keep an opponent lined up within reach.' },
  spin: { name: 'Spin', how: 'Sweep around your body, hitting nearby enemies on every side. Move into a group before attacking.' },
  beam: { name: 'Beam', how: 'Fire a straight beam ahead of you. Line opponents up along its path.' },
};

export function weaponGuide(weapon: StoredWeapon) {
  const { spec, stats } = weapon;
  const type = TYPES[spec.archetype];
  const reach = spec.range < 0.33 ? 'Short' : spec.range < 0.67 ? 'Medium' : 'Long';
  const elements = [...new Set([
    ...spec.vfx.map(vfx => VFX_ELEMENT[vfx.type]),
    ...(spec.decor ?? []).map(decor => DECOR_ELEMENT[decor.type]).filter((element): element is string => !!element),
  ])];
  return {
    element: elements.length ? elements.join(' + ') : 'Physical',
    elementDescription: elements.length ? elements.map(element => ELEMENTS[element]).join(' ') : 'A physical weapon with no elemental trails or coating.',
    type: type.name,
    how: type.how,
    range: `${reach} reach · ${stats.rangeUnits.toFixed(1)} arena units`,
    cadence: `One attack every ${stats.cooldown.toFixed(1)} seconds`,
    effects: 'Hits push opponents back.',
  };
}
