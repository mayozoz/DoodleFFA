import type { View } from './types';

const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export const resultsView: View = (ctx) => {
  const p = ctx.conn.db.player.identity.find(ctx.identity);
  const place = p?.placement ?? 0;
  ctx.el.innerHTML = `<div class="center"><div>
    <div class="countdown">${place === 1 ? '🏆' : place ? ordinal(place) : ''}</div>
    <h2>${place === 1 ? 'You won!' : 'Nice fight!'}</h2>
  </div></div>`;
  return () => {};
};
