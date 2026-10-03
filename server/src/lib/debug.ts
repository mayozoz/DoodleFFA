import type { Ctx } from './ctx';

const DEDUPE_MICROS = 5_000_000n; // same message in the same room within 5 s → skip
const KEEP_MICROS = 600_000_000n; // keep 10 minutes

/** Record a server-side problem for the debug overlay. Never throws. */
export function debugEvent(ctx: Ctx, roomCode: string, source: string, message: string) {
  try {
    const msg = message.slice(0, 300);
    const now = ctx.timestamp.microsSinceUnixEpoch;
    for (const e of ctx.db.debugEvent.roomCode.filter(roomCode)) {
      if (e.source === source && e.message === msg && now - e.createdAt.microsSinceUnixEpoch < DEDUPE_MICROS) return;
    }
    ctx.db.debugEvent.insert({ id: 0n, roomCode, source, message: msg, createdAt: ctx.timestamp });
  } catch { /* debugging must never break the game */ }
}

export function cleanupDebug(ctx: Ctx, roomCode: string) {
  const cutoff = ctx.timestamp.microsSinceUnixEpoch - KEEP_MICROS;
  for (const e of [...ctx.db.debugEvent.roomCode.filter(roomCode)]) {
    if (e.createdAt.microsSinceUnixEpoch < cutoff) ctx.db.debugEvent.id.delete(e.id);
  }
}

export const errMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
