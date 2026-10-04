/** Decorative pen strokes shared by the mode picker and waiting room. */
export const menuBackdrop = () => `<div class="menu-scribbles" aria-hidden="true"><svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <g stroke="#dcff77" stroke-width="3" opacity=".2"><path d="m70 165 28-13 20 35-29 16z m29-3 79-110 19-4-2 21-78 109 m-19-24-18 26 m-6-3 17 12"/><path d="m1425 795 13-29 12 28 31 5-23 21 4 30-25-15-28 13 7-29-22-22z"/><path d="m132 773 9-22 10 22 23 8-23 9-10 23-9-23-24-9z"/></g>
  <g stroke="#b994ff" stroke-width="3" opacity=".22"><path d="m1380 170 56-33-21 46 37 3-71 62 23-54z"/><path d="M-30 390c130-75 208 6 150 58-67 56-13 128 57 89"/><path d="M1410 494c46-32 98-1 78 32-23 39 38 59 110 23"/></g>
  <g stroke="#5bdbf5" stroke-width="3" opacity=".18"><circle cx="170" cy="590" r="48" stroke-dasharray="5 10"/><path d="m1480 660 25 17-25 16-25-16z M1462 666l19 10 20-7"/><path d="M60 920q67-51 141-10 m-20-12 24 13-19 15"/></g>
</svg></div>`;

export function modeFighters(team = false) {
  const fighters = team ? [{ x: 18, color: '#b994ff', tilt: -8 }, { x: 96, color: '#5bdbf5', tilt: 4 }, { x: 172, color: '#dcff77', tilt: 9 }] : [{ x: 94, color: '#dcff77', tilt: -7 }];
  return `<svg viewBox="0 0 260 126" fill="none" aria-hidden="true"><path d="M16 111q109-8 228 0" stroke="#ffffff18" stroke-width="2" stroke-dasharray="5 8"/>${fighters.map(f => `<g transform="translate(${f.x} 16) rotate(${f.tilt} 35 48)"><path d="M8 90V35C8 1 66 0 66 35v54l-15-11-15 12-14-11z" fill="${f.color}" stroke="#0c101b" stroke-width="3"/><path d="M9 91V35C9 4 65 2 65 35" stroke="#ffffff65" stroke-width="2"/><ellipse cx="28" cy="34" rx="4" ry="7" fill="#151824"/><ellipse cx="48" cy="34" rx="4" ry="7" fill="#151824"/><path d="m62 65 25-42 14-5-1 15-27 40 m-19-10 22 14 m-13-6-9 14" stroke="#10111a" stroke-width="8"/><path d="m64 65 25-40 10-4-1 11-27 40" fill="#eeeafc" stroke="#eeeafc" stroke-width="2"/><path d="m56 64 18 11 m-11-5-7 12" stroke="#eeeafc" stroke-width="4"/></g>`).join('')}</svg>`;
}
