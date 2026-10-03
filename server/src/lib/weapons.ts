import {
  DEFAULT_SWING, MYSTERY_STICK, balance, fallbackSpecFromFeatures, hashString,
  type DrawingFeatures, type StoredWeapon, type WeaponSpec,
} from '@doodle/spec';
import { BALANCE } from '../balance';
import type { Ctx, WeaponRow } from './ctx';

/** M1: every weapon is the hard-coded swing. Flip to false once gen_spec lands (M3). */
export const USE_HARDCODED_SWING = true;

export const storeWeapon = (spec: WeaponSpec): string =>
  JSON.stringify({ spec, stats: balance(spec, BALANCE) } satisfies StoredWeapon);

const cache = new Map<string, StoredWeapon>();
/** Parse weapon.spec JSON with a tiny memo — tick() reads it every frame. */
export function readWeapon(row: WeaponRow | null | undefined): StoredWeapon {
  const json = row?.spec || storeWeapon(MYSTERY_STICK);
  let w = cache.get(json);
  if (!w) {
    w = JSON.parse(json) as StoredWeapon;
    if (cache.size > 256) cache.clear();
    cache.set(json, w);
  }
  return w;
}

/**
 * Called when Reveal starts. Any player whose weapon isn't ready gets the deterministic
 * fallback (features-only spec; empty drawing → Mystery Stick). Sprite/SFX fallbacks are
 * client-side: empty spriteUrl → raw drawing PNG with outline+glow, empty sfxUrl → preset.
 */
export function applyFallbacks(ctx: Ctx, roomCode: string, seed: number) {
  for (const p of ctx.db.player.roomCode.filter(roomCode)) {
    const w = ctx.db.weapon.player.find(p.identity);
    if (w && w.spec && w.status !== 'pending') continue;

    let spec: WeaponSpec = MYSTERY_STICK;
    if (USE_HARDCODED_SWING) spec = DEFAULT_SWING;
    else {
      const d = ctx.db.drawing.player.find(p.identity);
      if (d) {
        try {
          spec = fallbackSpecFromFeatures(JSON.parse(d.features) as DrawingFeatures, seed ^ hashString(p.identity.toHexString()));
        } catch { /* keep Mystery Stick */ }
      }
    }
    const row = { player: p.identity, roomCode, spec: storeWeapon(spec), spriteUrl: w?.spriteUrl ?? '', sfxUrl: w?.sfxUrl ?? '', status: 'fallback' };
    if (w) ctx.db.weapon.player.update(row);
    else ctx.db.weapon.insert(row);
  }
}
