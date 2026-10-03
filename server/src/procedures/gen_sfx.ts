import { TimeDuration } from 'spacetimedb';
import { t } from 'spacetimedb/server';
import type { StoredWeapon } from '@doodle/spec';
import spacetimedb from '../schema';
import { ENDPOINTS, TIMEOUT_MS } from '../config';
import { GENERIC_SFX_BY_ARCHETYPE } from '../prompts/sfx.v1';
import { s3CredsFrom, s3Put } from '../lib/s3';
import { loadJob, logFail, writeIfStillPending } from './common';

/** sfx_prompt (or a generic per-archetype prompt) → ElevenLabs Sound Effects → S3 → weapon.sfxUrl. */
export const genSfx = spacetimedb.procedure(t.unit(), (ctx) => {
  const job = loadJob(ctx, 'sfxUrl');
  if (!job) return {};
  const key = job.secrets.ELEVENLABS_API_KEY;
  const s3 = s3CredsFrom(job.secrets);
  if (!key || !s3) return {};

  // Use the spec's prompt if gen_spec already finished; otherwise a generic one.
  let prompt = GENERIC_SFX_BY_ARCHETYPE.swing;
  if (job.specJson) {
    try { prompt = (JSON.parse(job.specJson) as StoredWeapon).spec.sfx_prompt; } catch { /* generic */ }
  }

  try {
    const res = ctx.http.fetch(ENDPOINTS.elevenSfx, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': key, Accept: 'audio/mpeg' },
      timeout: TimeDuration.fromMillis(TIMEOUT_MS.sfx),
      body: JSON.stringify({ text: prompt, duration_seconds: 1.0, prompt_influence: 0.6 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = s3Put(ctx, s3, `sfx/${job.roomCode}/${job.playerHex}.mp3`, res.bytes(), 'audio/mpeg');
    writeIfStillPending(ctx, 'sfxUrl', url);
  } catch (e) {
    logFail(ctx, job.roomCode, 'gen_sfx', e);
  }
  return {};
});
