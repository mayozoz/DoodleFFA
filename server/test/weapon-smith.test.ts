import { describe, expect, it, vi } from 'vitest';
import { MYSTERY_STICK, balance } from '@doodle/spec';
import { BALANCE } from '../src/balance';
import { createWeapon } from '../src/lib/weapon-creation';
import { agentRequest, agentText } from '../src/procedures/spec_requests';
import { loadJob, writeIfStillPending, resetSpecJob, type PCtx } from '../src/procedures/common';
import { requestSpec } from '../src/procedures/spec_providers';

function setup() {
  const sender = { toHexString: () => 'abc' };
  let w: any = { player: sender, spec: '', spriteUrl: '', sfxUrl: '', status: 'pending' };
  let claim: any;
  const room = { code: 'TEST', phase: 'drop', seed: 42, round: 1, phaseStartedAt: { microsSinceUnixEpoch: 5n } };
  const drawing = { png: new Uint8Array([1, 2]), features: '{}' };
  const update = vi.fn((row: any) => { w = row; });
  let inTx = false;
  const fetch = vi.fn(() => { expect(inTx).toBe(false); return { ok: true, json: () => ({ weapon_json: JSON.stringify(MYSTERY_STICK) }) }; });
  const tx = { db: {
    player: { identity: { find: () => ({ roomCode: 'TEST' }) } },
    room: { code: { find: () => room } },
    drawing: { player: { find: () => drawing } },
    weapon: { player: { find: () => w, update } },
    generation: { player: { find: () => claim, update: (row: any) => { claim = row; } }, insert: (row: any) => { claim = row; } },
    secrets: { key: { find: () => null } },
  } };
  const ctx = { sender, http: { fetch }, withTx: (fn: any) => { inTx = true; try { return fn(tx); } finally { inTx = false; } } } as unknown as PCtx;
  return { ctx, room, drawing, update, fetch, get w() { return w; }, next: () => { claim = undefined; w = { ...w, spec: '', status: 'pending' }; } };
}

describe('Weapon Smith provider and authoritative workflow (mocked)', () => {
  it('uses the authenticated doodle/features contract', () => {
    const call = agentRequest('secret', { pngBase64: 'AQI=', featuresJson: '{"isEmpty":false}', systemPrompt: '', flavor: 'epic' }, 'https://smith.example/');
    expect(call.url).toBe('https://smith.example/spec');
    expect(JSON.parse(call.body)).toEqual({ token: 'secret', png_base64: 'AQI=', features_json: '{"isEmpty":false}', flavor: 'epic', seed: 0 });
    expect(agentText({ weapon_json: '{}' })).toBe('{}');
    expect(() => agentText({ error: 'unauthorized' })).toThrow();
  });
  it('balances valid and malformed responses with canonical defaults', () => {
    expect(createWeapon(MYSTERY_STICK).weapon.stats).toEqual(balance(MYSTERY_STICK, BALANCE));
    for (const raw of ['broken', { weapon: null }, { weapon: 4 }, []]) {
      const result = createWeapon(raw);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.weapon.spec).toEqual(MYSTERY_STICK);
      expect(result.weapon.stats).toEqual(balance(MYSTERY_STICK, BALANCE));
    }
  });
  it('calls HTTP outside transactions and bounds timeout', () => {
    const s = setup(); loadJob(s.ctx, 'spec');
    requestSpec(s.ctx, 'agent', 'secret', { png: s.drawing.png, featuresJson: '{}', systemPrompt: '' }, 'http://localhost:8001');
    expect(s.fetch).toHaveBeenCalledOnce();
    expect((s.fetch.mock.calls as any)[0][1].timeout).toBeDefined();
  });
  it.each(['spec', 'spriteUrl', 'sfxUrl'] as const)('claims %s only once, even after failure', field => {
    const s = setup(); const job = loadJob(s.ctx, field)!;
    expect(job).toBeTruthy(); expect(loadJob(s.ctx, field)).toBeNull();
    if (field === 'spec') resetSpecJob(s.ctx, job);
    expect(loadJob(s.ctx, field)).toBeNull();
  });
  it('stores a current response', () => {
    const s = setup(), job = loadJob(s.ctx, 'spec')!;
    writeIfStillPending(s.ctx, 'spec', 'balanced', true, job);
    expect(s.w.spec).toBe('balanced'); expect(s.w.status).toBe('ready');
  });
  it.each(['finalized', 'round', 'room', 'drawing', 'reveal', 'claim'])('discards stale response after %s', change => {
    const s = setup(), job = loadJob(s.ctx, 'spec')!;
    if (change === 'finalized') s.update({ ...s.w, status: 'fallback', spec: 'frozen' });
    if (change === 'round') s.room.round++;
    if (change === 'room') s.room.code = 'NEXT';
    if (change === 'drawing') s.drawing.png = new Uint8Array([3, 4]);
    if (change === 'reveal') s.room.phase = 'reveal';
    if (change === 'claim') { s.next(); s.room.phaseStartedAt.microsSinceUnixEpoch = 10n; loadJob(s.ctx, 'spec'); }
    s.update.mockClear();
    writeIfStillPending(s.ctx, 'spec', 'late', true, job);
    expect(s.update).not.toHaveBeenCalled();
  });
  it('old failures do not clear a later round marker', () => {
    const s = setup(), old = loadJob(s.ctx, 'spec')!;
    s.room.round++; s.next(); loadJob(s.ctx, 'spec'); s.update.mockClear();
    resetSpecJob(s.ctx, old); expect(s.update).not.toHaveBeenCalled();
  });
  it.each(['timeout', 'unavailable'])('preserves fallback when %s', message => {
    const s = setup(), job = loadJob(s.ctx, 'spec')!;
    s.fetch.mockImplementation(() => { throw new Error(message); });
    expect(() => requestSpec(s.ctx, 'agent', 'key', { png: job.png, featuresJson: '{}', systemPrompt: '' }, 'http://localhost:8001')).toThrow(message);
    resetSpecJob(s.ctx, job); expect(s.w.status).toBe('pending'); expect(s.w.spec).toBe('');
  });
});
