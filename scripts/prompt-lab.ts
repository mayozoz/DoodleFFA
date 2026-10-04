// Prompt lab: run doodles through the *exact* gen_spec request outside SpacetimeDB, then through
// the real validator + balance, and print what each one became. For tuning the prompt and
// checking providers without playing a round.
//
//   pnpm lab                      # every doodle through ASI:One
//   pnpm lab --only sword,bow --runs 3
//
// Keys come from .env. Results (PNG, raw response, validated spec) → .lab/<timestamp>/

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MYSTERY_STICK, balance, extractFeatures, fallbackSpecFromFeatures, validateWeaponSpec, type Drawing } from '../packages/spec/src';
import { BALANCE } from '../server/src/balance';
import { SPEC_PROVIDER, type SpecProvider } from '../server/src/config';
import { NAME_FLAVORS, SPEC_PROMPT_VERSION, SPEC_SYSTEM_PROMPT } from '../server/src/prompts/spec.v1';
import { asi1Request, asi1Text } from '../server/src/procedures/spec_requests';
import { rasterize } from './lab/png';
import { SYNTHETIC } from './lab/synthetic';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const provider = (arg('provider') ?? SPEC_PROVIDER) as SpecProvider;
const only = arg('only')?.split(',');
const runs = Number(arg('runs') ?? 1);

const env: Record<string, string> = {};
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
} catch { /* no .env */ }

const P = {
  asi1: { key: env.ASI_ONE_API_KEY, build: asi1Request, text: asi1Text },
}[provider];
if (!P?.key) { console.error(`no key for ${provider} in .env`); process.exit(1); }

// synthetic doodles + any real captures saved as fixtures
const doodles: Record<string, Drawing> = { ...SYNTHETIC };
const realDir = 'packages/spec/fixtures/doodles';
for (const f of readdirSync(realDir).filter((f) => f.endsWith('.json'))) {
  doodles[f.replace('.json', '')] = JSON.parse(readFileSync(join(realDir, f), 'utf8')) as Drawing;
}

const outDir = join('.lab', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(outDir, { recursive: true });

console.log(`provider=${provider} prompt=${SPEC_PROMPT_VERSION} → ${outDir}\n`);
const rows: string[][] = [];
for (const [name, drawing] of Object.entries(doodles)) {
  if (only && !only.includes(name)) continue;
  const png = rasterize(drawing);
  writeFileSync(join(outDir, `${name}.png`), png);
  const features = extractFeatures(drawing);
  const fallback = features.isEmpty ? MYSTERY_STICK : fallbackSpecFromFeatures(features, 1);

  for (let run = 0; run < runs; run++) {
    const flavor = NAME_FLAVORS[(name.length + run) % NAME_FLAVORS.length]!;
    const call = P.build(P.key!, {
      pngBase64: Buffer.from(png).toString('base64'),
      featuresJson: JSON.stringify(features),
      systemPrompt: SPEC_SYSTEM_PROMPT.replace('{{FLAVOR}}', flavor),
    });
    const t0 = performance.now();
    let status = 0, raw = '', err = '';
    try {
      const res = await fetch(call.url, { method: 'POST', headers: call.headers, body: call.body, signal: AbortSignal.timeout(30_000) });
      status = res.status;
      raw = await res.text();
      if (!res.ok) err = `HTTP ${status}: ${raw.slice(0, 200)}`;
    } catch (e) { err = String(e); }
    const secs = (performance.now() - t0) / 1000;

    let text: unknown = null;
    if (!err) { try { text = P.text(JSON.parse(raw)); } catch { err = 'unparseable response'; } }
    const { spec, issues } = validateWeaponSpec(typeof text === 'string' ? text : null, fallback);
    const stats = balance(spec, BALANCE);
    writeFileSync(join(outDir, `${name}.${run}.json`), JSON.stringify({ flavor, status, secs, err, text, issues, spec, stats }, null, 2));

    rows.push([
      name, `${secs.toFixed(1)}s`, err ? 'ERROR' : String(issues.length),
      err ? err.slice(0, 60) : spec.name, spec.archetype,
      spec.vfx.map((v) => v.type).join('+') || '-', spec.on_hit.join('+') || '-',
      `${stats.cooldown.toFixed(2)}s/${stats.damagePerHit.toFixed(1)}`,
    ]);
    console.log(rows[rows.length - 1]!.join(' │ '));
  }
}

const ok = rows.filter((r) => r[2] !== 'ERROR');
const times = ok.map((r) => parseFloat(r[1]!)).sort((a, b) => a - b);
console.log(`\n${ok.length}/${rows.length} succeeded` + (times.length
  ? ` · median ${times[Math.floor(times.length / 2)]!.toFixed(1)}s · max ${times[times.length - 1]!.toFixed(1)}s (budget: drop phase 15 s)`
  : ''));
