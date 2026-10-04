import { REVEAL } from '@doodle/spec';
import { secondsLeft } from '../../net/clock';
import { mountRotateHint } from '../../ui/rotate-hint';
import type { View } from './types';

/** After deployment, keep the phone clear until the synchronized battle countdown. */
export const revealView: View = (ctx) => {
  ctx.el.innerHTML = '<div class="center"><div id="ready"><h1>Deployed.</h1><p>Get ready for battle.</p></div></div>';
  const ready = ctx.el.querySelector<HTMLElement>('#ready')!;
  const unhint = mountRotateHint(ctx.el, true);
  let raf = 0, shown = 0;
  const frame = () => {
    const r = ctx.conn.db.room.code.find(ctx.roomCode);
    if (r) {
      const left = secondsLeft(r.phaseEndsAt);
      if (left <= REVEAL.countdownS) {
        const num = Math.max(1, Math.ceil(left));
        if (shown !== num) {
          shown = num;
          ready.innerHTML = `<div class="countdown-big" style="color:var(--player)">${num}</div>`;
        }
      }
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => { cancelAnimationFrame(raf); unhint(); };
};
