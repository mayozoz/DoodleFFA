// Arena shape + HP scale, shared by server (sim) and clients (render, drop picker).

/** Everyone starts with this much HP. Damage/storm numbers in server/src/balance.ts are scaled to it. */
export const MAX_HP = 5000;

/** The shared screen's camera tilt. The arena is sized so it exactly fills a 16:9 screen through it. */
export const CAMERA_ELEVATION_DEG = 55;
export const SCREEN_ASPECT = 16 / 9;

/**
 * The play area is the screen-shaped rectangle |x| ≤ hw, |y| ≤ hh (world units).
 * Ground y is foreshortened by sin(elevation) on screen, so hh = hw · (9/16) / sin(55°)
 * makes the rectangle fill a 16:9 display edge to edge.
 */
export const ARENA_HALF_H_RATIO = 1 / SCREEN_ASPECT / Math.sin((CAMERA_ELEVATION_DEG * Math.PI) / 180);

/** `room.arenaR` is the arena's half-width; this gives both half extents. */
export function arenaExtents(arenaR: number) {
  return { hw: arenaR, hh: arenaR * ARENA_HALF_H_RATIO };
}

/** The storm starts as the circle through the arena's corners: the whole screen is safe at first. */
export function stormStartRadius(arenaR: number) {
  const { hw, hh } = arenaExtents(arenaR);
  return Math.hypot(hw, hh);
}
