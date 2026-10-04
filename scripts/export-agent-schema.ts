// Writes the Weapon Smith agent's contract from the TypeScript source of truth, so the Python
// agent can't drift from the engine's building blocks. Re-run after editing packages/spec
// enums or server/src/prompts/spec.v*.ts:
//
//   pnpm agents:schema

import { writeFileSync } from 'node:fs';
import { NAME_FLAVORS, SPEC_JSON_SCHEMA, SPEC_PROMPT_VERSION, SPEC_SYSTEM_PROMPT } from '../server/src/prompts/spec.v1';
import { MODELS } from '../server/src/config';

const out = {
  _generated: 'by scripts/export-agent-schema.ts — do not edit by hand',
  prompt_version: SPEC_PROMPT_VERSION,
  model: MODELS.specAsi1,
  system_prompt: SPEC_SYSTEM_PROMPT,
  name_flavors: NAME_FLAVORS,
  json_schema: SPEC_JSON_SCHEMA,
};

const path = 'agents/weapon_smith/schema.json';
writeFileSync(path, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${path} (${SPEC_PROMPT_VERSION})`);
