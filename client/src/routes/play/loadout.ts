import { ABILITIES, ABILITY_STYLES, abilityStyle, type AbilityStyle } from '@doodle/spec';
import type { View } from './types';
import './loadout.css';

export const loadoutView: View = (ctx) => {
  ctx.el.innerHTML = `<div class="loadout-page"><div class="loadout-heading"><span class="loadout-eyebrow">ROOM ${ctx.roomCode} · YOU’RE IN</span><h1>Pick your edge.</h1><p>Choose a play style. We’ll roll one matching special move when your weapon is revealed.</p></div><div class="style-grid">${Object.entries(ABILITY_STYLES).map(([id, style]) => `<button class="style-card" data-style="${id}" aria-pressed="false"><span class="style-icon" aria-hidden="true">${style.icon}</span><strong>${style.name}</strong><span>${style.description}</span><small>${style.abilities.map(a => ABILITIES[a].name).join(' · ')}</small></button>`).join('')}</div><p class="loadout-status" role="status"></p><p class="loadout-footer">Draw your weapon when the host starts the round.</p></div>`;
  let active = true;
  const buttons = [...ctx.el.querySelectorAll<HTMLButtonElement>('[data-style]')];
  const status = ctx.el.querySelector<HTMLElement>('.loadout-status')!;
  const sync = () => {
    const selected = abilityStyle(ctx.conn.db.player.identity.find(ctx.identity)?.abilityId ?? 'flash');
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === selected)));
    status.textContent = `${ABILITY_STYLES[selected].name} selected · a new roll each round`;
  };
  buttons.forEach(b => b.onclick = async () => {
    buttons.forEach(button => button.disabled = true);
    try {
      await ctx.conn.reducers.selectAbility({ abilityId: ABILITY_STYLES[b.dataset.style as AbilityStyle].abilities[0] });
      if (active) sync();
    } catch { if (active) status.textContent = 'Could not save your choice. Tap to try again.'; }
    finally { if (active) buttons.forEach(button => button.disabled = false); }
  });
  const onUpdate: Parameters<typeof ctx.conn.db.player.onUpdate>[0] = (_e, _old, p) => { if (p.identity.isEqual(ctx.identity)) sync(); };
  ctx.conn.db.player.onUpdate(onUpdate);
  sync();
  return () => { active = false; ctx.conn.db.player.removeOnUpdate(onUpdate); };
};
