import type { Marker } from './enums';

export interface PlayerColor {
  slot: number;
  hex: string;
  name: string;
  marker: Marker;
}

/** 12 fixed slots, assigned in join order. Server-only source of truth — never from AI. */
export const PLAYER_COLORS: readonly PlayerColor[] = [
  { slot: 0, name: 'Red', hex: '#FF3B3B', marker: 'circle' },
  { slot: 1, name: 'Orange', hex: '#FF8A1F', marker: 'triangle' },
  { slot: 2, name: 'Yellow', hex: '#FFD60A', marker: 'square' },
  { slot: 3, name: 'Lime', hex: '#A6E22E', marker: 'diamond' },
  { slot: 4, name: 'Green', hex: '#22C55E', marker: 'star' },
  { slot: 5, name: 'Teal', hex: '#14B8A6', marker: 'hexagon' },
  { slot: 6, name: 'Azure', hex: '#2F9BFF', marker: 'pentagon' },
  { slot: 7, name: 'Blue', hex: '#3B5BFF', marker: 'cross' },
  { slot: 8, name: 'Purple', hex: '#9B5CFF', marker: 'heart' },
  { slot: 9, name: 'Magenta', hex: '#E040FB', marker: 'moon' },
  { slot: 10, name: 'Pink', hex: '#FF6FB5', marker: 'bolt' },
  { slot: 11, name: 'White', hex: '#F5F5F5', marker: 'ring' },
];

export const MAX_PLAYERS = PLAYER_COLORS.length;

/** Lowest free slot, or -1 when the room is full. Freed slots are reused. */
export function nextFreeColorSlot(usedSlots: Iterable<number>): number {
  const used = new Set(usedSlots);
  for (const c of PLAYER_COLORS) if (!used.has(c.slot)) return c.slot;
  return -1;
}

export function colorForSlot(slot: number): PlayerColor {
  return PLAYER_COLORS[slot] ?? PLAYER_COLORS[0]!;
}
