import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ attempts: [] as any[] }));
vi.mock('../src/module_bindings', () => ({ DbConnection: { builder: () => {
  const attempt: any = {};
  const builder = {
    withUri: (uri: string) => { attempt.uri = uri; return builder; },
    withDatabaseName: () => builder,
    withToken: (token: string | undefined) => { attempt.token = token; return builder; },
    onConnect: (callback: unknown) => { attempt.connected = callback; return builder; },
    onConnectError: (callback: unknown) => { attempt.failed = callback; return builder; },
    onDisconnect: () => builder,
    build: () => { mocks.attempts.push(attempt); },
  };
  return builder;
} } }));
vi.mock('../src/debug', () => ({ DEBUG: false, debug: { error: vi.fn() } }));
import { connect } from '../src/net/connection';
const data = new Map<string, string>();
beforeEach(() => {
  mocks.attempts.length = 0;
  data.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});

it('ignores a legacy token that may belong to another server', async () => {
  data.set('doodle.token.play', 'old-local-token');
  const pending = connect('play');
  expect(mocks.attempts[0].token).toBeUndefined();
  const identity = {};
  mocks.attempts[0].connected({}, identity, 'new-token');
  expect((await pending).identity).toBe(identity);
  const key = [...data.keys()].find((k) => k.startsWith('doodle.token.play:'))!;
  expect(key).toContain(mocks.attempts[0].uri);
  expect(data.get(key)).toBe('new-token');
});

it('retries a rejected saved token once with a fresh identity', async () => {
  const initial = connect('screen');
  mocks.attempts[0].connected({}, {}, 'saved-token');
  await initial;
  const pending = connect('screen');
  expect(mocks.attempts[1].token).toBe('saved-token');
  mocks.attempts[1].failed({}, new Error('Failed to verify token'));
  expect(mocks.attempts).toHaveLength(3);
  expect(mocks.attempts[2].token).toBeUndefined();
  mocks.attempts[2].connected({}, {}, 'valid-token');
  await pending;
});

it('does not retry unrelated connection failures', async () => {
  const pending = connect('play');
  const error = new Error('network unavailable');
  const rejection = expect(pending).rejects.toThrow('network unavailable');
  mocks.attempts[0].failed({}, error);
  await rejection;
  expect(mocks.attempts).toHaveLength(1);
});

it('isolates solo host, controller and bots from multiplayer identities', async () => {
  const roles = ['screen', 'play', 'solo-screen', 'solo-play', 'solo-bot-0', 'solo-bot-1', 'solo-bot-2'] as const;
  for (const [index, role] of roles.entries()) {
    const pending = connect(role);
    expect(mocks.attempts[index].token).toBeUndefined();
    mocks.attempts[index].connected({}, {}, `token-${role}`);
    await pending;
  }
  expect(new Set(data.values()).size).toBe(roles.length);
});

it('rejects a stalled connection so the page can show a retry state', async () => {
  vi.useFakeTimers();
  try {
    const pending = connect('screen');
    const rejection = expect(pending).rejects.toThrow('Could not reach the game server');
    await vi.advanceTimersByTimeAsync(10000);
    await rejection;
  } finally { vi.useRealTimers(); }
});
