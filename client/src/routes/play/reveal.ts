import { REVEAL, type StoredWeapon } from '@doodle/spec';
import { secondsLeft } from '../../net/clock';
import { resumeAudio } from '../../audio/sfx';
import { ATTACK_VERB, playTestSwing, weaponArt } from '../../ui/weapon-art';
import { mountRotateHint } from '../../ui/rotate-hint';
import type { View } from './types';

/**
 * Controller during Reveal: your own weapon card (art + name + how to use it) while the big
 * screen shows everyone's, then the same 3‥2‥1. Each phone also speaks only its own weapon's
 * name (ControllerAudio announces automatically; "Hear weapon" replays it). Never shows stats.
 */
export const revealView: View = (ctx) => {
  ctx.el.innerHTML = `<div class="center"><div id="card" class="reveal-card"></div></div>`;
  const card = ctx.el.querySelector<HTMLDivElement>('#card')!;
  const unhint = mountRotateHint(ctx.el, true); // the moment to turn the phone before the fight
  const w = ctx.conn.db.weapon.player.find(ctx.identity);
  const d = ctx.conn.db.doodle.player.find(ctx.identity);
  const stored = w?.spec ? (JSON.parse(w.spec) as StoredWeapon) : null;
  const archetype = stored?.spec.archetype ?? 'swing';
  let active = true;

  let art: HTMLElement | null = null;
  void weaponArt({ spriteUrl: w?.spriteUrl, png: d?.png }, stored?.spec ?? null).then((a) => {
    if (!active || card.dataset.num) return; // countdown already took over
    art = a;
    a.style.width = 'min(78vmin, 420px)'; // phones: the weapon is the star of this screen
    card.innerHTML = '<div class="who" style="color:var(--player)">Your weapon</div>';
    card.appendChild(a);
    const name = document.createElement('div');
    name.className = 'what';
    name.textContent = stored?.spec.name ?? 'Mystery Stick';
    card.appendChild(name);
    const hint = document.createElement('div');
    hint.style.cssText = 'color:var(--muted);font-weight:700';
    hint.innerHTML = `Joystick to move · tap the button to <b style="color:var(--player)">${ATTACK_VERB[archetype] ?? 'attack'}</b>`;
    card.appendChild(hint);

    const hear = document.createElement('button');
    hear.className = 'battle-hear';
    hear.style.position = 'static';
    hear.textContent = 'Hear weapon';
    hear.onclick = async () => {
      // Resume audio inside the tap, before awaiting speech from the server.
      const audioReady = resumeAudio();
      hear.disabled = true;
      hear.textContent = 'Listening…';
      const played = (await audioReady) && (await ctx.audio?.announce(true));
      if (!active) return;
      hear.disabled = false;
      hear.textContent = played ? 'Hear again' : 'Tap to retry';
    };
    card.appendChild(hear);
    playTestSwing(a, archetype);
  });
  // Replay the test swing every couple of seconds so it reads as "alive".
  const swing = setInterval(() => { if (art?.isConnected) playTestSwing(art, archetype); }, 2400);

  // Same 3‥2‥1 as the big screen. The countdown is always the last 3 s of Reveal
  // (REVEAL.countdownS), so the controller doesn't need to know how many weapons there are.
  let showing = false, raf = 0;
  const frame = () => {
    const r = ctx.conn.db.room.code.find(ctx.roomCode);
    if (r) {
      const left = secondsLeft(r.phaseEndsAt);
      if (left <= REVEAL.countdownS && !showing) showing = true;
      if (showing) {
        const num = Math.max(1, Math.ceil(left));
        const html = `<div class="countdown-big" style="color:var(--player)">${num}</div>`;
        if (card.dataset.num !== String(num)) { card.dataset.num = String(num); card.innerHTML = html; }
      }
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => { active = false; clearInterval(swing); cancelAnimationFrame(raf); unhint(); };
};
