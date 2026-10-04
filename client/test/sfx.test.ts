import { beforeEach, afterEach, expect, it, vi } from 'vitest';

let state = 'running';
const start = vi.fn();
const resume = vi.fn(async () => { state = 'running'; });
const decode = vi.fn(async () => ({ duration: 1 }));
const fetchAudio = vi.fn(async (_src: string) => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
const addEventListener = vi.fn();
const createSource = vi.fn(() => ({ connect: () => ({ connect: vi.fn() }), start, disconnect: vi.fn(), buffer: null, onended: null }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state = 'running';
  fetchAudio.mockImplementation(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  vi.stubGlobal('fetch', fetchAudio);
  vi.stubGlobal('document', { addEventListener });
  vi.stubGlobal('AudioContext', class {
    get state() { return state; }
    resume = resume;
    decodeAudioData = decode;
    createBufferSource = createSource;
    createGain = () => ({ gain: { value: 0 }, disconnect: vi.fn() });
    destination = {};
  });
});
afterEach(() => vi.unstubAllGlobals());

it('plays custom audio and reuses its decoded buffer across overlapping attacks', async () => {
  const { playWeaponSound } = await import('../src/audio/sfx');
  await Promise.all([playWeaponSound('slam', 'data:audio/mpeg;base64,SUQz'), playWeaponSound('slam', 'data:audio/mpeg;base64,SUQz')]);
  expect(fetchAudio).toHaveBeenCalledTimes(1);
  expect(decode).toHaveBeenCalledTimes(1);
  expect(createSource).toHaveBeenCalledTimes(2);
  expect(start).toHaveBeenCalledTimes(2);
});

it('plays the archetype fallback when custom audio fails', async () => {
  fetchAudio.mockRejectedValueOnce(new Error('unavailable'));
  const { playWeaponSound } = await import('../src/audio/sfx');
  await playWeaponSound('whip', 'https://example.test/broken.mp3');
  expect(fetchAudio).toHaveBeenLastCalledWith('/sfx/whip.wav');
  expect(start).toHaveBeenCalledTimes(1);
});

it('preloads audio without playing it', async () => {
  const { preloadWeaponSound } = await import('../src/audio/sfx');
  preloadWeaponSound('beam', 'data:audio/mpeg;base64,SUQz');
  expect(fetchAudio).toHaveBeenCalledWith('/sfx/beam.wav');
  expect(fetchAudio).toHaveBeenCalledWith('data:audio/mpeg;base64,SUQz');
  expect(start).not.toHaveBeenCalled();
});

it('drops attacks while audio is locked instead of replaying them later', async () => {
  state = 'suspended';
  const { playWeaponSound } = await import('../src/audio/sfx');
  await playWeaponSound('swing');
  expect(fetchAudio).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

it('unlocks on controller gestures and installs listeners once', async () => {
  const { enableAudio } = await import('../src/audio/sfx');
  enableAudio();
  enableAudio();
  expect(addEventListener).toHaveBeenCalledTimes(4);
  expect(addEventListener.mock.calls[0]![0]).toBe('pointerdown');
  addEventListener.mock.calls[0]![1]();
  expect(resume).toHaveBeenCalledTimes(1);
});
