import { t } from 'spacetimedb/server';
import { MYSTERY_STICK, fallbackSpecFromFeatures, hashString } from '@doodle/spec';
import spacetimedb from '../schema';
import { NAME_FLAVORS, SPEC_PROMPT_VERSION, SPEC_SYSTEM_PROMPT } from '../prompts/spec.v1';
import { createWeapon } from '../lib/weapon-creation';
import { secondsBetween } from '../lib/time';
import { loadJob, logFail, writeIfStillPending, resetSpecJob, scrub } from './common';
import { SPEC_PROVIDERS, requestSpec } from './spec_providers';

/**
 * Doodle PNG + features → configured provider → validate → balance → weapon.spec.
 * The provider is only a supplier: whatever it returns goes through the same checks.
 */
export const genSpec = spacetimedb.procedure(t.unit(), (ctx) => {
  const job = loadJob(ctx, 'spec');
  if (!job) return {};
  const selected = job.secrets.SPEC_PROVIDER;
  // No implicit opt-in: absent/unknown selection leaves deterministic fallback playable.
  if (selected !== 'asi1' && selected !== 'agent') { console.info('[gen] spec duration=0s status=disabled'); resetSpecJob(ctx, job); return {}; }
  const provider = SPEC_PROVIDERS[selected];
  const key = job.secrets[provider.secret];
  if (!key || (selected === 'agent' && !job.secrets.AGENT_URL)) { console.info('[gen] spec duration=0s status=unconfigured-fallback'); resetSpecJob(ctx, job); return {}; } // no key → Reveal fallback

  const seed = (job.seed ^ hashString(job.playerHex)) >>> 0;
  let fallback = MYSTERY_STICK;
  try { if (job.features) fallback = fallbackSpecFromFeatures(job.features, seed); } catch { /* malformed features */ }
  const flavor = NAME_FLAVORS[seed % NAME_FLAVORS.length]!;

  try {
    const text = requestSpec(ctx, selected, key, {
      flavor, seed, png: job.png,
      featuresJson: JSON.stringify(job.features ?? {}),
      systemPrompt: SPEC_SYSTEM_PROMPT.replace('{{FLAVOR}}', flavor),
    }, job.secrets.AGENT_URL);
    const { weapon, issues } = createWeapon(text, fallback);
    // Latency + fix-up count go to `spacetime logs` only — this is the Phase 0 baseline.
    const elapsed = ctx.withTx((tx) => secondsBetween(ctx.timestamp, tx.timestamp));
    const written = writeIfStillPending(ctx, 'spec', JSON.stringify(weapon), true, job);
    console.info(`[gen] spec ${selected}/${SPEC_PROMPT_VERSION} duration=${elapsed.toFixed(3)}s status=${!written ? 'stale-discarded' : issues.length ? 'validated-fallback' : 'success'} repairs=${issues.length}`);
  } catch (e) {
    const elapsed = ctx.withTx(tx => secondsBetween(ctx.timestamp, tx.timestamp));
    console.warn(`[gen] spec ${selected} duration=${elapsed.toFixed(3)}s status=fallback`);
    // debug_event is public, so the reason is kept but private config is scrubbed out of it.
    logFail(ctx, job.roomCode, `gen_spec (${selected})`, new Error(scrub(e, [key, job.secrets.AGENT_URL])));
    // Failed: stop Drop waiting on it; the Reveal fallback takes over.
    resetSpecJob(ctx, job);
  }
  return {};
});

