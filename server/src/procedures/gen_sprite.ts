import { TimeDuration } from 'spacetimedb';
import { t } from 'spacetimedb/server';
import spacetimedb from '../schema';
import { ENDPOINTS, TIMEOUT_MS } from '../config';
import { toBase64 } from '../lib/base64';
import { SPRITE_PROMPT } from '../prompts/sprite.v1';
import { loadJob, logFail, writeIfStillPending } from './common';

/** Bound the inline art sent to every subscriber; no public bucket is required. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function spriteDataUrl(json: unknown): string {
  const response = json as { candidates?: { content?: { parts?: {
    inlineData?: { mimeType?: string; data?: string }; thought?: boolean;
  }[] } }[] } | null;
  for (const candidate of response?.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.thought || !part.inlineData) continue;
      const { mimeType, data } = part.inlineData;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType ?? '')) continue;
      if (!data || data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 ||
          data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
        throw new Error('Invalid sprite image response');
      }
      return `data:${mimeType};base64,${data}`;
    }
  }
  throw new Error('Image provider returned no sprite');
}

/** Doodle PNG → Gemini image editing → weapon art. Missing/failed art keeps the doodle. */
export const genSprite = spacetimedb.procedure(t.unit(), (ctx) => {
  const job = loadJob(ctx, 'spriteUrl');
  if (!job || !job.png.length || job.features?.isEmpty) return {};
  const key = job.secrets.GEMINI_API_KEY?.trim();
  if (!key) {
    logFail(ctx, job.roomCode, 'gen_sprite', new Error('GEMINI_API_KEY is not configured'));
    return {};
  }
  try {
    const res = ctx.http.fetch(ENDPOINTS.geminiImage, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      timeout: TimeDuration.fromMillis(TIMEOUT_MS.sprite),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { text: SPRITE_PROMPT },
          { inlineData: { mimeType: 'image/png', data: toBase64(job.png) } },
        ] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
    if (!res.ok) throw new Error(`Image provider HTTP ${res.status}`);
    writeIfStillPending(ctx, 'spriteUrl', spriteDataUrl(res.json()), false, job);
  } catch (e) {
    logFail(ctx, job.roomCode, 'gen_sprite', e);
  }
  return {};
});
