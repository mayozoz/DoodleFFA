import { TimeDuration } from 'spacetimedb';
import { t } from 'spacetimedb/server';
import { MYSTERY_STICK, fallbackSpecFromFeatures, hashString, validateWeaponSpec } from '@doodle/spec';
import spacetimedb from '../schema';
import { ENDPOINTS, MODELS, TIMEOUT_MS } from '../config';
import { NAME_FLAVORS, SPEC_RESPONSE_SCHEMA, SPEC_SYSTEM_PROMPT } from '../prompts/spec.v1';
import { toBase64 } from '../lib/base64';
import { storeWeapon } from '../lib/weapons';
import { loadJob, logFail, writeIfStillPending } from './common';

/** Doodle PNG + features → Gemini Flash → validate → balance → weapon.spec. Target 3–6 s. */
export const genSpec = spacetimedb.procedure(t.unit(), (ctx) => {
  const job = loadJob(ctx, 'spec');
  if (!job) return {};
  const key = job.secrets.GEMINI_API_KEY;
  if (!key) return {}; // no key → Reveal fallback

  const seed = job.seed ^ hashString(job.playerHex);
  const fallback = job.features ? fallbackSpecFromFeatures(job.features, seed) : MYSTERY_STICK;
  const flavor = NAME_FLAVORS[seed % NAME_FLAVORS.length]!;

  try {
    const res = ctx.http.fetch(`${ENDPOINTS.gemini(MODELS.spec)}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: TimeDuration.fromMillis(TIMEOUT_MS.spec),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SPEC_SYSTEM_PROMPT.replace('{{FLAVOR}}', flavor) }] },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: toBase64(job.png) } },
            { text: `Drawing features: ${JSON.stringify(job.features ?? {})}` },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SPEC_RESPONSE_SCHEMA, temperature: 1.0 },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text: unknown = res.json()?.candidates?.[0]?.content?.parts?.[0]?.text;
    const { spec, issues } = validateWeaponSpec(typeof text === 'string' ? text : null, fallback);
    if (issues.length) console.info(`[gen] spec ${job.playerHex.slice(0, 8)}: ${issues.length} field(s) fixed`);
    writeIfStillPending(ctx, 'spec', storeWeapon(spec), true);
  } catch (e) {
    logFail('gen_spec', e);
  }
  return {};
});
