import { Timestamp } from 'spacetimedb';

// All timing uses ctx.timestamp (the database clock). Never trust device clocks.

export const addSeconds = (ts: Timestamp, s: number): Timestamp =>
  new Timestamp(ts.microsSinceUnixEpoch + BigInt(Math.round(s * 1_000_000)));

/** seconds from a → b (negative if b is earlier) */
export const secondsBetween = (a: Timestamp, b: Timestamp): number =>
  Number(b.microsSinceUnixEpoch - a.microsSinceUnixEpoch) / 1_000_000;

export const isAfterOrEqual = (a: Timestamp, b: Timestamp): boolean =>
  a.microsSinceUnixEpoch >= b.microsSinceUnixEpoch;
