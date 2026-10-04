import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loadJob: vi.fn(), write: vi.fn(), log: vi.fn() }));
vi.mock('spacetimedb/server', () => ({ t: { unit: () => ({}) } }));
vi.mock('../src/schema', () => ({ default: { procedure: (_type: unknown, fn: unknown) => fn } }));
vi.mock('../src/procedures/common', () => ({
  loadJob: mocks.loadJob, writeIfStillPending: mocks.write, logFail: mocks.log,
}));
import { genSprite, spriteDataUrl } from '../src/procedures/gen_sprite';

const run = genSprite as unknown as (ctx: unknown) => unknown;
const fetch = vi.fn();
const job = { secrets: { GEMINI_API_KEY: 'test-key\t ' }, roomCode: 'TEST', round: 1, png: new Uint8Array([1, 2, 3]) };
const image = { inlineData: { mimeType: 'image/png', data: 'AQID' } };
beforeEach(() => { vi.clearAllMocks(); mocks.loadJob.mockReturnValue(job); });

describe('doodle to 2D weapon art', () => {
  it('sends the doodle and stores inline art with its original job guard', () => {
    fetch.mockReturnValue({ ok: true, json: () => ({ candidates: [{ content: { parts: [{ text: 'Here is the art' }, image] } }] }) });
    run({ http: { fetch } });
    const [url, request] = fetch.mock.calls[0]!;
    expect(url).toContain('gemini-2.5-flash-image:generateContent');
    expect(request.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(request.body);
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'AQID' } });
    expect(body.generationConfig.responseModalities).toContain('IMAGE');
    expect(mocks.write).toHaveBeenCalledWith(expect.anything(), 'spriteUrl', 'data:image/png;base64,AQID', false, job);
  });

  it('does not call the provider without a key', () => {
    mocks.loadJob.mockReturnValue({ ...job, secrets: {} });
    run({ http: { fetch } });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalled();
  });

  it.each([null, { ...job, png: new Uint8Array() }, { ...job, features: { isEmpty: true } }])('skips missing or empty drawings', (emptyJob) => {
    mocks.loadJob.mockReturnValue(emptyJob);
    run({ http: { fetch } });
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.write).not.toHaveBeenCalled();
  });

  it('keeps the doodle on a provider failure', () => {
    fetch.mockReturnValue({ ok: false, status: 429 });
    run({ http: { fetch } });
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalled();
  });

  it.each([null, {}, { candidates: [{ content: { parts: [{ text: 'blocked' }] } }] },
    { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'text/html', data: 'AQID' } }] } }] },
    { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: '$$$$' } }] } }] },
    { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'A'.repeat(3 * 1024 * 1024) } }] } }] },
  ])('rejects missing, invalid, or oversized image output', (response) => {
    expect(() => spriteDataUrl(response)).toThrow();
  });
});
