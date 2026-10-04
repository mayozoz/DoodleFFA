import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'spacetimedb';
import { MYSTERY_STICK, balance } from '@doodle/spec';
import { BALANCE } from '../src/balance';
vi.mock('spacetimedb/server', () => ({ t: { unit: () => ({}) } }));
vi.mock('../src/schema', () => ({ default: { procedure: (_type: unknown, fn: unknown) => fn } }));
import { genSpec } from '../src/procedures/gen_spec';
const run = genSpec as unknown as (ctx: unknown) => void;

function setup(config: Record<string, string> = { SPEC_PROVIDER: 'agent', AGENT_SHARED_SECRET: 'test-secret', AGENT_URL: 'https://smith.example' }) {
  const sender = { toHexString: () => 'abc' };
  let weapon: any = { player: sender, spec: '', spriteUrl: '', sfxUrl: '', status: 'pending' }, claim: any;
  const room = { code: 'TEST', phase: 'drop', seed: 123, round: 1, phaseStartedAt: new Timestamp(1n) };
  const tx = { timestamp: new Timestamp(4_000_000n), db: {
    weapon: { player: { find: () => weapon, update: (w: any) => { weapon = w; } } },
    player: { identity: { find: () => ({ roomCode: 'TEST' }) } },
    drawing: { player: { find: () => ({ features: '{}', png: new Uint8Array([1]) }) } },
    room: { code: { find: () => room } },
    secrets: { key: { find: (key: string) => config[key] ? { value: config[key] } : undefined } },
    generation: { player: { find: () => claim, update: (c: any) => { claim = c; } }, insert: (c: any) => { claim = c; } },
    debugEvent: { insert: vi.fn() },
  } };
  let inTx = false;
  const fetch = vi.fn(() => { expect(inTx).toBe(false); return { ok: true, json: () => ({ weapon_json: JSON.stringify(MYSTERY_STICK) }) }; });
  const ctx = { sender, timestamp: new Timestamp(0n), withTx: (fn: any) => { inTx = true; try { return fn(tx); } finally { inTx = false; } }, http: { fetch } };
  return { ctx, fetch, room, get weapon() { return weapon; }, finalize: () => { weapon = { ...weapon, spec: 'frozen', status: 'fallback' }; } };
}

beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); });
describe('complete genSpec procedure (mocked HTTP/database)', () => {
  it('balances the agent response and processes repeated calls once', () => {
    const s = setup(); run(s.ctx); run(s.ctx);
    expect(s.fetch).toHaveBeenCalledOnce(); expect(s.weapon.status).toBe('ready');
    expect(JSON.parse(s.weapon.spec).stats).toEqual(balance(MYSTERY_STICK, BALANCE));
  });
  it.each([{}, { SPEC_PROVIDER: 'agent' }, { SPEC_PROVIDER: 'unknown' }])('missing configuration stays playable: %j', config => {
    const s = setup(config); run(s.ctx); expect(s.fetch).not.toHaveBeenCalled();
    expect(s.weapon.status).toBe('pending'); expect(s.weapon.spec).toBe('');
  });
  it.each(['invalid JSON', '{"weapon":null}'])('repairs malformed specs deterministically: %s', raw => {
    const s = setup(); s.fetch.mockReturnValue({ ok: true, json: () => ({ weapon_json: raw }) }); run(s.ctx);
    expect(JSON.parse(s.weapon.spec).spec).toEqual(MYSTERY_STICK);
  });
  it.each(['timeout', 'unavailability'])('leaves fallback available on %s without repeated spending', message => {
    const s = setup(); s.fetch.mockImplementation(() => { throw new Error(message); }); run(s.ctx); run(s.ctx);
    expect(s.weapon.status).toBe('pending'); expect(s.weapon.spec).toBe(''); expect(s.fetch).toHaveBeenCalledOnce();
  });
  it.each(['finalized', 'next round', 'reveal'])('discards a response after %s', change => {
    const s = setup(); s.fetch.mockImplementation(() => {
      if (change === 'finalized') s.finalize();
      if (change === 'next round') s.room.round++;
      if (change === 'reveal') s.room.phase = 'reveal';
      return { ok: true, json: () => ({ weapon_json: JSON.stringify(MYSTERY_STICK) }) };
    }); run(s.ctx);
    expect(s.weapon.spec).toBe(change === 'finalized' ? 'frozen' : '');
  });
});

describe('gen_spec error reasons', () => {
  it('keeps the reason but scrubs the key, agent URL and host', async () => {
    const { scrub } = await import('../src/procedures/common');
    const msg = scrub(new Error('refusing to connect to https://smith.example/spec (smith.example) with test-secret'), ['test-secret', 'https://smith.example']);
    expect(msg).toBe('refusing to connect to <private>/spec (<private>) with <private>');
  });
});
