// Reads API keys from .env and stores them in the private `secrets` table via `set_secret`.
// Must run as the identity that published the module (the CLI's identity), so we shell out to
// `spacetime call` rather than connecting as a fresh anonymous client.
//
//   pnpm tsx scripts/set-secrets.ts            # local
//   pnpm tsx scripts/set-secrets.ts maincloud  # -s maincloud

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SECRET_KEYS } from '../server/src/config';

const DB = process.env.VITE_STDB_DB ?? 'doodle-arena';
const server = process.argv[2];

const env: Record<string, string> = {};
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
}

for (const k of SECRET_KEYS) {
  const v = env[k];
  if (!v) { console.log(`skip ${k} (empty)`); continue; }
  const args = ['call', ...(server ? ['-s', server] : []), DB, 'set_secret', JSON.stringify(k), JSON.stringify(v)];
  execFileSync('spacetime', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`set ${k}`); // never print the value
}
