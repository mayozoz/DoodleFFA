import { ABILITIES, ABILITY_DESCRIPTIONS, ABILITY_STYLES, ABILITY_TUNING, abilityStyle, isAbilityId, REVEAL, type StoredWeapon } from '@doodle/spec';
import { secondsLeft } from '../../net/clock';
import { resumeAudio } from '../../audio/sfx';
import { ATTACK_VERB, playTestSwing, weaponArt } from '../../ui/weapon-art';
import { mountRotateHint } from '../../ui/rotate-hint';
import type { View } from './types';
import { weaponDescription } from '../../ui/weapon-description';
import './loadout.css';
import './reveal.css';

/**
 * Controller during Reveal: your own weapon card (art + name + how to use it) while the big
 * screen shows everyone's, then the same 3‥2‥1. Each phone also speaks only its own weapon's
 * name (ControllerAudio announces automatically; "Hear weapon" replays it). Never shows stats.
 */
export const revealView: View = (ctx) => {
  ctx.el.innerHTML = `<div class="weapon-reveal-page"><div id="card" class="reveal-card controller-weapon-card"></div></div>`;
  const card = ctx.el.querySelector<HTMLDivElement>('#card')!;
  const unhint = mountRotateHint(ctx.el, true); // the moment to turn the phone before the fight
  const w = ctx.conn.db.weapon.player.find(ctx.identity);
  const d = ctx.conn.db.doodle.player.find(ctx.identity);
  const stored = w?.spec ? (JSON.parse(w.spec) as StoredWeapon) : null;
  const archetype = stored?.spec.archetype ?? 'swing';
  let active = true;

  let art: HTMLElement | null = null;
  let revision = 0;
  const renderArt = () => {
    const current = ctx.conn.db.weapon.player.find(ctx.identity);
    const version = ++revision;
    void weaponArt({ spriteUrl: current?.spriteUrl, png: d?.png }, stored?.spec ?? null).then((a) => {
      if (!active || version !== revision || card.dataset.num) return; // countdown already took over
      art = a;
      a.setAttribute('role', 'img');
      a.setAttribute('aria-label', stored?.spec.name ?? 'Your drawn weapon'); // phones: the weapon is the star of this screen
      card.innerHTML = '<div class="who" style="color:var(--player)">Your weapon</div>';
      card.appendChild(a);
      const name = document.createElement('div');
      name.className = 'what';
      name.textContent = stored?.spec.name ?? 'Mystery Stick';
      card.appendChild(name);
      const description = document.createElement('p');
      description.className = 'weapon-description';
      description.textContent = weaponDescription(stored?.spec ?? null);
      card.appendChild(description);
      const player = ctx.conn.db.player.identity.find(ctx.identity);
      const id = player && isAbilityId(player.abilityId) ? player.abilityId : 'flash';
      const ability = document.createElement('div');
      ability.className = 'revealed-ability';
      ability.innerHTML = `<span class="style-icon" aria-hidden="true">${ABILITY_STYLES[abilityStyle(id)].icon}</span><div><small>YOUR SPECIAL · ${ABILITY_TUNING.charges} USES PER ROUND</small><strong>${ABILITIES[id].name}</strong><p>${ABILITY_DESCRIPTIONS[id]}</p></div>`;
      card.appendChild(ability);
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
  };
  const onWeaponUpdate: Parameters<typeof ctx.conn.db.weapon.onUpdate>[0] = (_e, old, next) => {
    if (next.player.isEqual(ctx.identity) && old.spriteUrl !== next.spriteUrl) renderArt();
  };
  ctx.conn.db.weapon.onUpdate(onWeaponUpdate);
  const onPlayerUpdate: Parameters<typeof ctx.conn.db.player.onUpdate>[0] = (_e, old, next) => {
    if (next.identity.isEqual(ctx.identity) && old.abilityId !== next.abilityId) renderArt();
  };
  ctx.conn.db.player.onUpdate(onPlayerUpdate);
  renderArt();
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
  return () => { ctx.conn.db.player.removeOnUpdate(onPlayerUpdate); ctx.conn.db.weapon.removeOnUpdate(onWeaponUpdate); active = false; clearInterval(swing); cancelAnimationFrame(raf); unhint(); };
};
