// Shared by the game procedure and the Python agent's TypeScript adapter.
import { validateWeaponSpec, balance, MYSTERY_STICK, type WeaponSpec } from '@doodle/spec';
import { BALANCE } from '../balance';
export function createWeapon(input: unknown, fallback: WeaponSpec = MYSTERY_STICK) {
  const safeFallback = validateWeaponSpec(fallback, MYSTERY_STICK).spec;
  const { spec, issues } = validateWeaponSpec(input, safeFallback);
  return { weapon: { spec, stats: balance(spec, BALANCE) }, issues };
}
