import { colorForSlot } from '@doodle/spec';

/** Controller accents (background, joystick, button, canvas border) all follow the player color. */
export function applyPlayerTheme(slot: number) {
  document.documentElement.style.setProperty('--player', colorForSlot(slot).hex);
}

export const hexToNum = (hex: string) => parseInt(hex.replace('#', ''), 16);
