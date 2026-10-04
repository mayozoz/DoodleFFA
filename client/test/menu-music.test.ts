import { beforeEach, expect, it, vi } from 'vitest';
import { mountMenuMusic } from '../src/audio/menu-music';

let latest: FakeAudio;
class FakeAudio extends EventTarget {
  paused = true; error = null; loop = false; volume = 1; preload = '';
  play = vi.fn(async () => { this.paused = false; this.dispatchEvent(new Event('play')); });
  pause = vi.fn(() => { this.paused = true; this.dispatchEvent(new Event('pause')); });
  load = vi.fn(); removeAttribute = vi.fn();
  constructor(public src: string) { super(); latest = this; }
}
class Button extends EventTarget {
  title = ''; innerHTML = ''; attributes = new Map<string, string>();
  setAttribute(k: string, v: string) { this.attributes.set(k, v); }
}
let documentMock: EventTarget & { hidden: boolean };
let preferences: Map<string, string>;
function setup() { const button = new Button(); return { button, music: mountMenuMusic(button as unknown as HTMLButtonElement) }; }
beforeEach(() => {
  preferences = new Map();
  documentMock = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('Audio', FakeAudio); vi.stubGlobal('document', documentMock);
  vi.stubGlobal('localStorage', { getItem: (key: string) => preferences.get(key) ?? null, setItem: (key: string, value: string) => preferences.set(key, value) });
});
it('waits for a gesture before playing a quiet looping track', async () => {
  const { music } = setup();
  expect(latest.play).not.toHaveBeenCalled(); expect(latest.loop).toBe(true); expect(latest.volume).toBeLessThan(.4);
  music.start(); await Promise.resolve(); expect(latest.paused).toBe(false); music.destroy();
});
it('remembers mute across page mounts and allows a deliberate unmute', async () => {
  preferences.set('doodle.menu-music', 'off');
  const { music, button } = setup(); music.start(); expect(latest.play).not.toHaveBeenCalled();
  button.dispatchEvent(new Event('click')); await Promise.resolve();
  expect(latest.paused).toBe(false); expect(preferences.get('doodle.menu-music')).toBe('on');
  button.dispatchEvent(new Event('click')); expect(latest.paused).toBe(true); expect(preferences.get('doodle.menu-music')).toBe('off'); music.destroy();
});
it('pauses hidden tabs and resumes only previously playing music', async () => {
  const { music } = setup(); music.start(); await Promise.resolve();
  documentMock.hidden = true; documentMock.dispatchEvent(new Event('visibilitychange')); expect(latest.paused).toBe(true);
  documentMock.hidden = false; documentMock.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); expect(latest.paused).toBe(false); music.destroy();
});
it('handles blocked playback and stops playback when leaving the menu', async () => {
  const { music, button } = setup(); latest.play.mockRejectedValueOnce(new Error('blocked'));
  music.start(); await Promise.resolve(); await Promise.resolve(); expect(button.title).toContain('retry');
  music.destroy(); const attempts = latest.play.mock.calls.length;
  button.dispatchEvent(new Event('click')); music.start(); expect(latest.play.mock.calls.length).toBe(attempts); expect(latest.paused).toBe(true);
});
