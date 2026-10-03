import type { View } from './types';

export const waitingView = (text: string): View => (ctx) => {
  ctx.el.innerHTML = `<div class="center"><h2>${text}</h2></div>`;
  return () => {};
};
