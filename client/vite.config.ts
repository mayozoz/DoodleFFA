import { networkInterfaces } from 'node:os';
import { defineConfig, loadEnv } from 'vite';

// Phones use the same origin as the game; Vite forwards the database WebSocket locally.
// STDB_LOCAL_URL (repo .env) points that proxy at a local SpacetimeDB on a non-default port.
export default defineConfig(({ mode }) => ({
  envDir: '..',
  server: { port: 5173, proxy: { '/v1': {
    target: loadEnv(mode, '..', '').STDB_LOCAL_URL?.trim() || 'http://127.0.0.1:3000', ws: true,
  } } },
  plugins: [{
    name: 'local-party-address',
    configureServer(server) {
      server.middlewares.use('/__doodle/config', (req, res) => {
        const interfaces = networkInterfaces();
        const entries = Object.entries(interfaces).sort(([a], [b]) => Number(b === 'en0') - Number(a === 'en0'));
        const lan = entries.flatMap(([, addresses]) => addresses ?? []).find(a => a.family === 'IPv4' && !a.internal)?.address;
        const host = req.headers.host ?? 'localhost:5173';
        const origin = new URL(`http://${host}`);
        if (['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && lan) origin.hostname = lan;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ publicOrigin: origin.origin }));
      });
    },
  }],
  build: { target: 'es2022' },
}));
