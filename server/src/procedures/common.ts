import type { Identity } from 'spacetimedb';
import type { ProcedureCtx } from 'spacetimedb/server';
import type { DrawingFeatures } from '@doodle/spec';
import { SECRET_KEYS, type SecretKey } from '../config';
import type spacetimedb from '../schema';
import type { InferSchema } from 'spacetimedb/server';

export type PCtx = ProcedureCtx<InferSchema<typeof spacetimedb>>;
type WeaponField = 'spec' | 'spriteUrl' | 'sfxUrl';

export interface GenJob {
  player: Identity;
  playerHex: string;
  roomCode: string;
  seed: number;
  png: Uint8Array;
  features: DrawingFeatures | null;
  /** current weapon.spec JSON ('' if not ready) */
  specJson: string;
  secrets: Partial<Record<SecretKey, string>>;
}

/**
 * Idempotency gate shared by all gen_* procedures: the caller must be in a room that is in
 * draw/drop, must have submitted a drawing, and the target field must still be empty.
 */
export function loadJob(ctx: PCtx, field: WeaponField): GenJob | null {
  return ctx.withTx((tx) => {
    const p = tx.db.player.identity.find(ctx.sender);
    if (!p) return null;
    const r = tx.db.room.code.find(p.roomCode);
    if (!r || (r.phase !== 'draw' && r.phase !== 'drop')) return null;
    const d = tx.db.drawing.player.find(ctx.sender);
    const w = tx.db.weapon.player.find(ctx.sender);
    if (!d || !w || w[field] !== '') return null;

    const secrets: Partial<Record<SecretKey, string>> = {};
    for (const k of SECRET_KEYS) {
      const s = tx.db.secrets.key.find(k);
      if (s) secrets[k] = s.value;
    }
    let features: DrawingFeatures | null = null;
    try { features = JSON.parse(d.features) as DrawingFeatures; } catch { /* null */ }

    return {
      player: ctx.sender, playerHex: ctx.sender.toHexString(), roomCode: p.roomCode, seed: r.seed,
      png: d.png, features, specJson: w.spec, secrets,
    };
  });
}

/**
 * Write one weapon field if it's still empty and the round hasn't moved past drop.
 * Anything arriving after Reveal starts is discarded — the fallback already won.
 */
export function writeIfStillPending(ctx: PCtx, field: WeaponField, value: string, markReady = false) {
  ctx.withTx((tx) => {
    const w = tx.db.weapon.player.find(ctx.sender);
    const p = tx.db.player.identity.find(ctx.sender);
    const r = p && tx.db.room.code.find(p.roomCode);
    if (!w || !r || (r.phase !== 'draw' && r.phase !== 'drop') || w[field] !== '') return;
    tx.db.weapon.player.update({ ...w, [field]: value, ...(markReady ? { status: 'ready' } : {}) });
  });
}

/**
 * Log a failed generation step: server log + a short debug_event for the ?debug overlay.
 * Never include prompts or raw model output in anything clients can read.
 */
export function logFail(ctx: PCtx, roomCode: string, what: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[gen] ${what} failed: ${msg}`);
  try {
    ctx.withTx((tx) => tx.db.debugEvent.insert({ id: 0n, roomCode, source: what, message: `failed: ${msg}`.slice(0, 300), createdAt: tx.timestamp }));
  } catch { /* never break the procedure over a debug row */ }
}
