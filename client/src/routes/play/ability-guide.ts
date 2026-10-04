import { type AbilityId } from '@doodle/spec';

export const ABILITY_GUIDE: Record<AbilityId, { description: string; caption: string }> = {
  flash: { description: 'Blink forward in the direction you are moving. Use it to escape or get close.', caption: 'You blink forward instantly.' },
  dash: { description: 'Dash forward, hitting and pushing back opponents along your path.', caption: 'Dash through an opponent to hit and push them.' },
  smoke: { description: 'Create a smoke cloud for 4 seconds. Fighters inside cannot be targeted by auto-aim, but can still take damage.', caption: 'Smoke conceals fighters from auto-aim.' },
  invisible: { description: 'Become invisible and immune to all damage for 2 seconds.', caption: 'Disappear briefly to avoid damage.' },
  flashbang: { description: 'White out the shared arena screen for everyone for 2 seconds.', caption: 'The arena flashes white for everyone.' },
  fire_steps: { description: 'Leave burning footprints for 4 seconds. Each patch lasts 3 seconds and burns enemies who touch it.', caption: 'Your movement leaves a burning trail.' },
  nuke1: { description: 'After a brief warning, send a wave of explosions outward from your position. Each opponent can be hit once.', caption: 'Explosions spread outward from you.' },
  nuke2: { description: 'After a brief warning, sweep explosions from the top of the arena to the bottom. Each opponent can be hit once.', caption: 'Explosions sweep down the arena.' },
  attack_boost: { description: 'Spend 10% of your maximum health to deal 40% more attack damage for 5 seconds. It can kill you if your health is too low.', caption: 'Trade health for stronger hits.' },
  mini_arena: { description: 'Raise a small arena around you for 5 seconds. Its walls block movement, even dashes and knockback.', caption: 'Walls trap nearby fighters inside.' },
  boomerang: { description: 'Throw a projectile that returns to you. It can hit each opponent once on the way out and once on the way back.', caption: 'Hit on the outward and returning passes.' },
  rage: { description: 'Attack 40% faster for 5 seconds.', caption: 'Shorter attack cooldowns mean faster swings.' },
  weapon_boost: { description: 'Make your weapon 1.6 times larger and extend normal attack reach for 6 seconds.', caption: 'A larger weapon reaches farther.' },
  fire_ring: { description: 'Surround yourself with a moving ring of fire for 4 seconds. Enemies touching its edge burn.', caption: 'A burning ring follows you.' },
  mushrooms: { description: 'Plant three poisonous traps near you. They last up to 15 seconds; each triggers once and poisons an enemy for 5 seconds.', caption: 'An opponent touches a trap and becomes poisoned.' },
  life_drain: { description: 'Drain nearby opponents for 3 seconds, healing yourself for the damage you deal. Health cannot exceed its maximum.', caption: 'Nearby enemies lose health as you recover it.' },
  silence: { description: 'Fire a projectile that stops the first opponent it hits from attacking or using specials for 3 seconds.', caption: 'A hit blocks attacks and specials.' },
  hook: { description: 'Launch a hook that pulls the first opponent it hits toward you.', caption: 'Catch an opponent and pull them close.' },
  freeze: { description: 'Freeze opponents in a small area in front of you for 3 seconds. They cannot move, attack, or use specials.', caption: 'The area ahead of you freezes an opponent.' },
  shrink: { description: 'Shrink your body and hitbox to half size for 6 seconds. Your weapon keeps its normal size.', caption: 'A smaller body is harder to hit.' },
};

