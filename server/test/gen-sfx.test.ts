import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadJob: vi.fn(), write: vi.fn(), log: vi.fn() }));
vi.mock('spacetimedb/server', () => ({ t: { unit: () => ({}) } }));
vi.mock('../src/schema', () => ({ default: { procedure: (_type: unknown, fn: unknown) => fn } }));
vi.mock('../src/procedures/common', () => ({
  loadJob: mocks.loadJob, writeIfStillPending: mocks.write, logFail: mocks.log,
}));
import { genSfx } from '../src/procedures/gen_sfx';

const run = genSfx as unknown as (ctx: unknown) => unknown;
const fetch = vi.fn();
const job = { secrets: { ELEVENLABS_API_KEY: 'test-key' }, roomCode: 'TEST', specJson: '' };
beforeEach(() => { vi.clearAllMocks(); mocks.loadJob.mockReturnValue(job); });

describe('ElevenLabs sound pipeline', () => {
  it('stores returned MP3 inline without AWS credentials', () => {
    fetch.mockReturnValue({ ok: true, bytes: () => new Uint8Array([73, 68, 51]) });
    run({ http: { fetch } });
    const [url, request] = fetch.mock.calls[0]!;
    expect(url).toContain('sound-generation?output_format=mp3_44100_128');
    expect(request.headers['xi-api-key']).toBe('test-key');
    expect(JSON.parse(request.body)).toMatchObject({ duration_seconds: 1, model_id: 'eleven_text_to_sound_v2' });
    expect(mocks.write).toHaveBeenCalledWith(expect.anything(), 'sfxUrl', 'data:audio/mpeg;base64,SUQz', false, job);
  });

  it('uses a custom prompt from the weapon spec', () => {
    mocks.loadJob.mockReturnValue({ ...job, specJson: JSON.stringify({ spec: { archetype: 'slam', sfx_prompt: 'thunder mallet' } }) });
    fetch.mockReturnValue({ ok: true, bytes: () => new Uint8Array([1]) });
    run({ http: { fetch } });
    expect(JSON.parse(fetch.mock.calls[0]![1].body).text).toBe('thunder mallet');
  });

  it('strips whitespace from an uploaded API key', () => {
    mocks.loadJob.mockReturnValue({ ...job, secrets: { ELEVENLABS_API_KEY: 'test-key\t ' } });
    fetch.mockReturnValue({ ok: true, bytes: () => new Uint8Array([1]) });
    run({ http: { fetch } });
    expect(fetch.mock.calls[0]![1].headers['xi-api-key']).toBe('test-key');
  });

  it('reports a missing key without requesting audio', () => {
    mocks.loadJob.mockReturnValue({ ...job, secrets: {} });
    run({ http: { fetch } });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it.each([0, 64001])('leaves fallback available for an invalid %i-byte response', (size) => {
    fetch.mockReturnValue({ ok: true, bytes: () => new Uint8Array(size) });
    run({ http: { fetch } });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalled();
  });

  it('leaves fallback available on a provider error', () => {
    fetch.mockReturnValue({ ok: false, status: 401 });
    run({ http: { fetch } });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalled();
  });
});
