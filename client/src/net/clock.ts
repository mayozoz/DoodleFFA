import type { Timestamp } from 'spacetimedb';

// Phase timers are server-authoritative. We estimate the server→local clock offset from
// the moment a phase change arrives (phaseStartedAt ≈ now, minus one-way latency) and use
// it only to *display* countdowns. Never to decide game outcomes.

let offsetMs = 0;

export function syncFromPhaseStart(phaseStartedAt: Timestamp) {
  offsetMs = Date.now() - Number(phaseStartedAt.toMillis());
}

/** How long ago the phase should have ended (0 if it hasn't). Debug: detects a stalled server. */
export function secondsOverdue(phaseEndsAt: Timestamp): number {
  return Math.max(0, (Date.now() - (Number(phaseEndsAt.toMillis()) + offsetMs)) / 1000);
}

export function secondsLeft(phaseEndsAt: Timestamp): number {
  const endLocal = Number(phaseEndsAt.toMillis()) + offsetMs;
  return Math.max(0, (endLocal - Date.now()) / 1000);
}
