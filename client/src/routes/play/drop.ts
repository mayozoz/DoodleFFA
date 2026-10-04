import { ABILITIES, isAbilityId } from '@doodle/spec';
import { mountCountdown } from '../../ui/countdown';
import type { View } from './types';

/** Tap the mini-arena (same 16:9 shape as the shared screen) to choose a spawn. Re-tap allowed. */
export const dropView: View = (ctx) => {
  ctx.el.innerHTML = `
    <div class="center">
      <div id="cd"></div>
      <h2>Tap where to drop in</h2>
      <label>Special ability (2 uses per battle)
        <select id="ability" style="max-width:90vw;padding:8px;font-size:16px">
          ${Object.entries(ABILITIES).map(([id, a]) => `<option value="${id}">${a.name} · ${a.cooldown}s cooldown</option>`).join('')}
        </select>
      </label>
      <div id="arena" style="position:relative;width:min(90vw,95dvh);aspect-ratio:16/9;border-radius:10px;background:#262626;border:4px solid var(--player)">
        <div id="pin" style="position:absolute;width:28px;height:28px;margin:-14px;border-radius:50%;background:var(--player);display:none"></div>
      </div>
    </div>`;
  const stopCd = mountCountdown(ctx.el.querySelector('#cd')!, () => ctx.conn.db.room.code.find(ctx.roomCode)?.phaseEndsAt);
  const choice = ctx.el.querySelector<HTMLSelectElement>('#ability')!;
  choice.value = ctx.conn.db.player.identity.find(ctx.identity)?.abilityId ?? 'flash';
  choice.onchange = () => { if (isAbilityId(choice.value)) void ctx.conn.reducers.selectAbility({ abilityId: choice.value }); };
  const arena = ctx.el.querySelector<HTMLDivElement>('#arena')!;
  const pin = ctx.el.querySelector<HTMLDivElement>('#pin')!;
  arena.onpointerdown = (e) => {
    const r = arena.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    pin.style.display = 'block';
    pin.style.left = `${x * 100}%`;
    pin.style.top = `${y * 100}%`;
    void ctx.conn.reducers.setDrop({ x, y });
  };
  return stopCd;
};
