// "Turn your phone sideways" — battle controls are laid out for landscape, and iOS doesn't let a
// web page lock orientation. A hint, never a blocker: a phone with rotation lock on can still play
// (the portrait layout works, just cramped). Hidden automatically once the phone is landscape.

const portrait = window.matchMedia('(orientation: portrait)');

/**
 * `prominent`: a card (Reveal — the moment to rotate before the fight).
 * Otherwise: a small pill at the bottom (during battle).
 */
export function mountRotateHint(host: HTMLElement, prominent: boolean): () => void {
  const el = document.createElement('div');
  el.className = prominent ? 'rotate-hint card' : 'rotate-hint pill';
  el.innerHTML = `<span class="rotate-phone" aria-hidden="true"></span><span>Turn your phone sideways</span>`;
  host.appendChild(el);
  const update = () => { el.style.display = portrait.matches ? '' : 'none'; };
  portrait.addEventListener('change', update);
  update();
  return () => { portrait.removeEventListener('change', update); el.remove(); };
}
