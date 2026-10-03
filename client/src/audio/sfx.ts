import type { Archetype } from '@doodle/spec';

// Preset per-archetype sounds ship in client/public/sfx/<archetype>.mp3 (see README there).
// A generated sfxUrl, when present, wins over the preset.

const cache = new Map<string, HTMLAudioElement>();

export function weaponSound(archetype: Archetype, sfxUrl?: string): HTMLAudioElement {
  const src = sfxUrl || `/sfx/${archetype}.mp3`;
  let a = cache.get(src);
  if (!a) {
    a = new Audio(src);
    a.preload = 'auto';
    cache.set(src, a);
  }
  return a;
}

export function play(a: HTMLAudioElement, volume = 0.8) {
  const n = a.cloneNode(true) as HTMLAudioElement;
  n.volume = volume;
  void n.play().catch(() => { /* autoplay blocked until first tap */ });
}

/** Local click for every button press (even during cooldown). */
export const click = () => play(weaponSound('swing', '/sfx/click.mp3'), 0.4);
