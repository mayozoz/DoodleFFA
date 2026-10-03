import { t } from 'spacetimedb/server';
import { MYSTERY_STICK, fallbackSpecFromFeatures, hashString, validateWeaponSpec } from '@doodle/spec';
import spacetimedb from '../schema';
import { SPEC_PROVIDER } from '../config';
import { NAME_FLAVORS, SPEC_PROMPT_VERSION, SPEC_SYSTEM_PROMPT } from '../prompts/spec.v1';
import { storeWeapon } from '../lib/weapons';
import { secondsBetween } from '../lib/time';
import { loadJob, logFail, writeIfStillPending } from './common';
import { SPEC_PROVIDERS, requestSpec } from './spec_providers';

/**
 * Doodle PNG + features → SPEC_PROVIDER → validate → balance → weapon.spec. Target 3–6 s.
 * The provider is only a supplier: whatever it returns goes through the same checks.
 */
export const genSpec = spacetimedb.procedure(t.unit(), (ctx) => {
  const job = loadJob(ctx, 'spec');
  if (!job) return {};
  const provider = SPEC_PROVIDERS[SPEC_PROVIDER];
  const key = job.secrets[provider.secret];
  if (!key) return {}; // no key → Reveal fallback

  const seed = job.seed ^ hashString(job.playerHex);
  const fallback = job.features ? fallbackSpecFromFeatures(job.features, seed) : MYSTERY_STICK;
  const flavor = NAME_FLAVORS[seed % NAME_FLAVORS.length]!;

  try {
    const text = requestSpec(ctx, SPEC_PROVIDER, key, {
      png: job.png,
      featuresJson: JSON.stringify(job.features ?? {}),
      systemPrompt: SPEC_SYSTEM_PROMPT.replace('{{FLAVOR}}', flavor),
    });
    const { spec, issues } = validateWeaponSpec(text, fallback);
    // Latency + fix-up count go to `spacetime logs` only — this is the Phase 0 baseline.
    const elapsed = ctx.withTx((tx) => secondsBetween(ctx.timestamp, tx.timestamp));
    console.info(`[gen] spec ${SPEC_PROVIDER}/${SPEC_PROMPT_VERSION} ${job.playerHex.slice(0, 8)}: ${elapsed.toFixed(1)}s, ${issues.length} field(s) fixed`);
    writeIfStillPending(ctx, 'spec', storeWeapon(spec), true);
  } catch (e) {
    logFail(ctx, job.roomCode, `gen_spec (${SPEC_PROVIDER})`, e);
  }
  return {};
});
