import { loadCutout } from '@doodle/engine';
import type { WeaponSpec } from '@doodle/spec';

/**
 * Weapon art for cards (reveal, controller): the sprite (or raw doodle) cut out of its white
 * background, rotated so grip→tip points right, inside an element that plays the archetype's
 * test-swing animation around the grip.
 */
export async function weaponArt(src: { spriteUrl?: string; png?: Uint8Array }, spec: WeaponSpec | null): Promise<HTMLElement> {
  const stage = document.createElement('div');
  stage.className = 'weapon-stage';
  const anim = document.createElement('div');
  stage.appendChild(anim);
  let canvas: HTMLCanvasElement | null = null;
  try {
    if (src.spriteUrl) canvas = await loadCutout(src.spriteUrl);
    else if (src.png?.length) canvas = await loadCutout(src.png);
  } catch { /* fall through to an empty stage */ }
  if (canvas) {
    const [gx, gy] = spec?.grip ?? [0.1, 0.5];
    const [tx, ty] = spec?.tip ?? [0.9, 0.5];
    const angle = Math.atan2((ty - gy) * canvas.height, (tx - gx) * canvas.width);
    const origin = `${gx * 100}% ${gy * 100}%`;
    canvas.style.transformOrigin = origin;
    canvas.style.transform = `rotate(${-angle}rad)`;
    anim.style.transformOrigin = origin;
    anim.appendChild(canvas);
  }
  return stage;
}

/** Restart the test swing (call when the card comes on stage). */
export function playTestSwing(stage: HTMLElement, archetype: string) {
  const anim = stage.firstElementChild as HTMLElement | null;
  if (!anim) return;
  anim.className = '';
  void anim.offsetWidth; // reflow so the animation restarts
  anim.className = `anim-${archetype}`;
}

/** Player-facing verb for the attack button. Style only, never numbers (pillar: no stats). */
export const ATTACK_VERB: Record<string, string> = {
  swing: 'swing', thrust: 'stab', slam: 'slam', shoot: 'fire', throw: 'throw', whip: 'crack', spin: 'spin', beam: 'blast',
};
