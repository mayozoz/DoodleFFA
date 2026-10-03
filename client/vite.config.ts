import { defineConfig } from 'vite';

// One app, three routes (/play, /screen, /dev/weapons). Vite serves index.html for all
// of them in dev; on S3/CloudFront/Amplify configure a rewrite of 404 → /index.html.
export default defineConfig({
  envDir: '..',
  server: { port: 5173 },
  build: { target: 'es2022' },
});
