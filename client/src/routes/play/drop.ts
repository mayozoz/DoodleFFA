import { mountCountdown } from '../../ui/countdown';
import type { View } from './types';

/** Tap the mini-arena to choose a spawn. Re-tap allowed until the phase ends. */
export const dropView: View = (ctx) => {
  ctx.el.innerHTML = `
    <div class="center">
      <div id="cd"></div>
      <h2>Tap where to drop in</h2>
      <div id="arena" style="position:relative;width:min(80vw,60dvh);aspect-ratio:1;border-radius:50%;background:#2a2640;border:4px solid var(--player)">
        <div id="pin" style="position:absolute;width:28px;height:28px;margin:-14px;border-radius:50%;background:var(--player);display:none"></div>
      </div>
    </div>`;
  const stopCd = mountCountdown(ctx.el.querySelector('#cd')!, () => ctx.conn.db.room.code.find(ctx.roomCode)?.phaseEndsAt);
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
