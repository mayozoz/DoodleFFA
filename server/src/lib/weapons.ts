import {
  DEFAULT_SWING, MYSTERY_STICK, balance, fallbackSpecFromFeatures, hashString,
  type DrawingFeatures, type StoredWeapon, type WeaponSpec,
} from '@doodle/spec';
import { BALANCE } from '../balance';
import { SPEC_PROVIDER } from '../config';
import { SPEC_PROVIDERS } from '../procedures/spec_providers';
import type { Ctx, RoomRow, WeaponRow } from './ctx';

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

/**
 * Which generation steps can actually finish this round. A step without its keys (or with M1's
 * hard-coded swing) will never write anything, so Drop shouldn't wait for it.
 */
function expectedSteps(ctx: Ctx) {
  const has = (k: string) => !!ctx.db.secrets.key.find(k)?.value;
  const s3 = has('AWS_ACCESS_KEY_ID') && has('AWS_SECRET_ACCESS_KEY') && has('S3_BUCKET');
  return {
    spec: !USE_HARDCODED_SWING && has(SPEC_PROVIDERS[SPEC_PROVIDER].secret),
    sprite: has('GEMINI_API_KEY') && s3,
    sfx: has('ELEVENLABS_API_KEY') && s3,
  };
}

/**
 * Drop may end early: past the minimum, every connected player has dropped, and every weapon
 * has everything it's still expecting. The phase timer stays the hard cap, so a slow or failed
 * call can only make Drop as long as it is today — never stall the round.
 */
export function dropCanEndEarly(ctx: Ctx, r: RoomRow, elapsedS: number, minS: number): boolean {
  if (elapsedS < minS) return false;
  const players = [...ctx.db.player.roomCode.filter(r.code)].filter((p) => p.connected);
  if (players.length === 0 || players.some((p) => p.dropX < 0)) return false;
  const want = expectedSteps(ctx);
  for (const p of players) {
    const w = ctx.db.weapon.player.find(p.identity);
    if (!w || w.roomCode !== r.code) return false; // drawing not in yet
    if (want.spec && !w.spec) return false;
    if (want.sprite && !w.spriteUrl) return false;
    if (want.sfx && !w.sfxUrl) return false;
  }
  return true;
}
