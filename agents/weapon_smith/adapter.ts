// stdin/stdout tool boundary; no network or database access. Canonical TS rules only.
import { MYSTERY_STICK, fallbackSpecFromFeatures, validateWeaponSpec } from '../../packages/spec/src/index';
import { weaponGuide } from '../../client/src/routes/play/weapon-guide';
import { createWeapon } from '../../server/src/lib/weapon-creation';
let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
let fallback = MYSTERY_STICK;
try {
  fallback = validateWeaponSpec(fallbackSpecFromFeatures(JSON.parse(request.features ?? '{}'), request.seed ?? 0), MYSTERY_STICK).spec;
} catch { /* text/unsafe features use Mystery Stick */ }
const result = createWeapon(request.input, fallback);
process.stdout.write(JSON.stringify({ ...result, guide: weaponGuide(result.weapon) }));
