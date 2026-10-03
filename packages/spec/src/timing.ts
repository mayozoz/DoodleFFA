// Phase timing shared by server (phase length) and clients (reveal sequence), so both agree
// on which weapon is on stage at any moment without extra messages.

/** Drop ends early once every player has dropped and every weapon is settled, but not before this. */
export const DROP_MIN_S = 5;

export const REVEAL = {
  /** "Behold…" title before the first weapon */
  introS: 1.2,
  /** each weapon's showcase: appears, test swing, name */
  perWeaponS: 1.6,
  /** 3‥2‥1 before battle */
  countdownS: 3,
  /** cap for big rooms: per-weapon time shrinks to fit */
  maxS: 24,
} as const;

/** Reveal length for `n` weapons. */
export function revealSeconds(n: number): number {
  const raw = REVEAL.introS + Math.max(1, n) * REVEAL.perWeaponS + REVEAL.countdownS;
  return Math.min(REVEAL.maxS, raw);
}

/**
 * Where we are in the reveal at `t` seconds after it started:
 * intro → weapon i (0-based) with local progress 0–1 → countdown with the number to show.
 */
export function revealSlot(t: number, n: number):
  | { kind: 'intro' }
  | { kind: 'weapon'; index: number; progress: number }
  | { kind: 'countdown'; number: number } {
  const total = revealSeconds(n);
  const per = (total - REVEAL.introS - REVEAL.countdownS) / Math.max(1, n);
  if (t < REVEAL.introS) return { kind: 'intro' };
  const w = t - REVEAL.introS;
  if (n > 0 && w < per * n) {
    const index = Math.floor(w / per);
    return { kind: 'weapon', index, progress: (w - index * per) / per };
  }
  const left = total - t;
  return { kind: 'countdown', number: Math.max(1, Math.ceil(left)) };
}
