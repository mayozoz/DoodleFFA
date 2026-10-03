import { TimeDuration } from 'spacetimedb';
import { t } from 'spacetimedb/server';
import spacetimedb from '../schema';
import { ENDPOINTS, MODELS, TIMEOUT_MS } from '../config';
import { SPRITE_PROMPT } from '../prompts/sprite.v1';
import { fromBase64, toBase64 } from '../lib/base64';
import { s3CredsFrom, s3Put } from '../lib/s3';
import { loadJob, logFail, writeIfStillPending } from './common';

/**
 * Doodle → Nano Banana 2 (image-to-image) → background removal + orientation → S3 → weapon.spriteUrl.
 * Target 8–15 s. Missing at Reveal → client draws the raw PNG with outline + glow.
 */
export const genSprite = spacetimedb.procedure(t.unit(), (ctx) => {
  const job = loadJob(ctx, 'spriteUrl');
  if (!job) return {};
  const key = job.secrets.GEMINI_API_KEY;
  const s3 = s3CredsFrom(job.secrets);
  if (!key || !s3) return {};

  try {
    const res = ctx.http.fetch(`${ENDPOINTS.gemini(MODELS.sprite)}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: TimeDuration.fromMillis(TIMEOUT_MS.sprite),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType: 'image/png', data: toBase64(job.png) } },
          { text: SPRITE_PROMPT },
        ] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parts: Array<{ inlineData?: { data?: string } }> = res.json()?.candidates?.[0]?.content?.parts ?? [];
    const b64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
    if (!b64) throw new Error('no image in response');

    // TODO(M3): remove white background + rotate/scale so grip→tip points right at a standard
    // length. Needs a pure-JS PNG codec in the module (e.g. `fast-png`), or do it on the
    // shared screen at load time instead (see README "Implementation notes").
    const png = fromBase64(b64);

    const url = s3Put(ctx, s3, `sprites/${job.roomCode}/${job.playerHex}-${Number(ctx.timestamp.microsSinceUnixEpoch % 1_000_000n)}.png`, png, 'image/png');
    writeIfStillPending(ctx, 'spriteUrl', url);
  } catch (e) {
    logFail('gen_sprite', e);
  }
  return {};
});
