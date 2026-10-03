import type { Timestamp } from 'spacetimedb';
import { secondsLeft } from '../net/clock';

/** Themed countdown. Never shows anything about generation — just the time. */
export function mountCountdown(el: HTMLElement, getEnd: () => Timestamp | undefined): () => void {
  const node = document.createElement('div');
  node.className = 'countdown';
  el.appendChild(node);
  let raf = 0;
  const loop = () => {
    const end = getEnd();
    node.textContent = end ? String(Math.ceil(secondsLeft(end))) : '';
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => { cancelAnimationFrame(raf); node.remove(); };
}
