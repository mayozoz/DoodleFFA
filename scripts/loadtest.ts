// Headless load test: N fake controllers join a room and send joystick + attack at
// realistic rates. Watch `pnpm stdb:logs` and the shared screen to confirm 20 Hz holds.
// If it doesn't on Maincloud with 12 clients, lower GAME.tickHz to 15 in server/src/balance.ts.
//
//   pnpm loadtest <ROOM> [clients=12] [uri] [db]
//
// Requires generated bindings (pnpm stdb:generate) and Node ≥ 22 (or `undici` installed).

import { readFileSync, readdirSync } from 'node:fs';
import { extractFeatures } from '../packages/spec/src';
import { DbConnection } from '../client/src/module_bindings';
import { rasterize } from './lab/png';
import { SYNTHETIC } from './lab/synthetic';

const [code = '', nArg = '12', uri = 'ws://localhost:3000', db = 'doodle-arena'] = process.argv.slice(2);
if (!code) { console.error('usage: pnpm loadtest <ROOM> [clients] [uri] [db]'); process.exit(1); }
const N = Number(nArg);

// Real sample doodles (white background, like a phone canvas) so reveal cards and weapon art have
// something to show. Falls back to a 1×1 PNG if the folder is empty.
const SAMPLES = (() => {
  try {
    const dir = 'client/public/dev-sprites';
    return readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => new Uint8Array(readFileSync(`${dir}/${f}`)));
  } catch { return []; }
})();

const PNG_1x1 = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
  0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 15, 4, 0, 9, 251, 3, 253, 167, 81, 230, 157, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

function bot(i: number) {
  DbConnection.builder().withUri(uri).withDatabaseName(db)
    .onConnect(async (conn) => {
      conn.subscriptionBuilder().subscribe([`SELECT * FROM room WHERE code = '${code}'`]);
      await conn.reducers.joinRoom({ code, name: `bot${i}` });
      let angle = Math.random() * Math.PI * 2;
      let submitted = false;
      setInterval(() => {
        const r = conn.db.room.code.find(code);
        if (!r) return;
        if ((r.phase === 'draw' || r.phase === 'drop') && !submitted) {
          submitted = true;
          // Synthetic doodles with real strokes → real features → varied fallback archetypes.
          const names = Object.keys(SYNTHETIC);
          const d = SYNTHETIC[names[i % names.length]!]!;
          const png = names.length ? rasterize(d) : SAMPLES.length ? SAMPLES[i % SAMPLES.length]! : PNG_1x1;
          void conn.reducers.submitDrawing({ strokes: JSON.stringify(d), png, features: JSON.stringify(extractFeatures(d)) });
        }
        if (r.phase === 'drop') void conn.reducers.setDrop({ x: Math.random(), y: Math.random() });
        if (r.phase === 'battle') {
          angle += (Math.random() - 0.5) * 0.6;
          void conn.reducers.setInput({ dx: Math.cos(angle), dy: Math.sin(angle) });
          if (Math.random() < 0.4) void conn.reducers.pressAttack({});
        }
        if (r.phase === 'lobby') submitted = false;
      }, 1000 / 10); // ~10 input msgs/s per client — joystick changes aren't continuous
    })
    .onConnectError((_c, e) => console.error(`bot${i} connect error`, e))
    .build();
}

for (let i = 0; i < N; i++) setTimeout(() => bot(i), i * 100);
console.log(`spawning ${N} bots into ${code} on ${uri}/${db}`);
