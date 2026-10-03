import type { StoredWeapon } from '@doodle/spec';
import type { View } from './types';
import { resumeAudio } from '../../audio/sfx';

/** Each phone displays and speaks only its player's weapon. */
export const revealView: View = (ctx) => {
  ctx.el.innerHTML = `<div class="center"><p>Your weapon</p><h1 id="weapon-name"></h1><button id="hear">Hear weapon</button><p>Get ready!</p></div>`;
  const title = ctx.el.querySelector<HTMLElement>('#weapon-name')!;
  const button = ctx.el.querySelector<HTMLButtonElement>('#hear')!;
  let active = true;
  let raf = 0;
  const update = () => {
    const w = ctx.conn.db.weapon.player.find(ctx.identity);
    title.textContent = w?.spec ? (JSON.parse(w.spec) as StoredWeapon).spec.name : 'Your weapon is arriving…';
    raf = requestAnimationFrame(update);
  };
  update();
  button.onclick = async () => {
    // Preserve the tap's activation before awaiting speech from the server.
    const audioReady = resumeAudio();
    button.disabled = true;
    button.textContent = 'Listening…';
    const played = await audioReady && await ctx.audio?.announce(true);
    if (!active) return;
    button.disabled = false;
    button.textContent = played ? 'Hear again' : 'Tap to retry';
  };
  return () => { active = false; cancelAnimationFrame(raf); };
};
