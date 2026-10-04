import { afterEach, expect, it, vi } from 'vitest';
import { roomJoinUrl } from '../src/net/room-link';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('discovers the current LAN address when the shared screen uses localhost', async () => {
  vi.stubEnv('DEV', true); vi.stubGlobal('location', new URL('http://localhost:5173/screen'));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ publicOrigin: 'http://192.168.1.42:5173' }) })));
  expect(await roomJoinUrl('ABCD')).toBe('http://192.168.1.42:5173/play?room=ABCD');
});
it('preserves the address used by a phone or shared screen on the network', async () => {
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_PUBLIC_URL', 'http://old-address:5173');
  vi.stubGlobal('location', new URL('http://192.168.1.99:5173/solo'));
  expect(await roomJoinUrl('WXYZ')).toBe('http://192.168.1.99:5173/play?room=WXYZ');
});
it('uses the configured public address in production', async () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_PUBLIC_URL', 'https://game.example.com');
  vi.stubGlobal('location', new URL('https://internal.example.com/screen'));
  expect(await roomJoinUrl('TEST')).toBe('https://game.example.com/play?room=TEST');
});
