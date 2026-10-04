import { ABILITIES, type AbilityId } from '@doodle/spec';
import './ability-icons.css';

const FILES: Record<AbilityId, string> = {
  flash: 'flash', dash: 'dash_attack', smoke: 'smoke', invisible: 'invisible', flashbang: 'flashbang',
  fire_steps: 'fire_steps', nuke1: 'nuke1', nuke2: 'nuke2', attack_boost: 'attack_boost', mini_arena: 'mini_arena',
  boomerang: 'boomerang', rage: 'rage', weapon_boost: 'weapon_boost', fire_ring: 'fire_ring', mushrooms: 'poisonous_mushrooms',
  life_drain: 'life_drain', silence: 'silence', hook: 'hook', freeze: 'freeze', shrink: 'shrink',
};
export const ABILITY_ACCENTS: Record<AbilityId, string> = {
  flash: '#5cff89', dash: '#ff426b', smoke: '#b58cff', invisible: '#bbc3da', flashbang: '#ffe94a',
  fire_steps: '#ff6334', nuke1: '#ff308a', nuke2: '#39dff6', attack_boost: '#ff715e', mini_arena: '#19e8e8',
  boomerang: '#18e7cd', rage: '#ff426b', weapon_boost: '#ff9a2b', fire_ring: '#ff9a2b', mushrooms: '#69f682',
  life_drain: '#f52fc1', silence: '#ffe94a', hook: '#2abbf8', freeze: '#34e8ef', shrink: '#9bff61',
};
export const abilityIconUrl = (id: AbilityId) => `/ability-icons/${FILES[id]}.png`;

/** Display the circular illustration from the supplied poster; keep the original PNG intact. */
export function abilityIcon(id: AbilityId, animate = true): string {
  return `<span class="ability-icon${animate ? ' is-animated' : ''}" data-ability="${id}" style="--ability-accent:${ABILITY_ACCENTS[id]}"><img src="${abilityIconUrl(id)}" alt="${ABILITIES[id].name}" draggable="false" decoding="async"></span>`;
}
let preloaded = false;
export function preloadAbilityIcons() {
  if (preloaded) return;
  preloaded = true;
  for (const id of Object.keys(FILES) as AbilityId[]) {
    const icon = new Image(); icon.src = abilityIconUrl(id); icon.decoding = 'async';
  }
}
