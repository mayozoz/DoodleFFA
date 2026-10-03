import { colorForSlot, revealSeconds, revealSlot, type StoredWeapon } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';
import { secondsLeft } from '../../net/clock';
import { playTestSwing, weaponArt } from '../../ui/weapon-art';

/**
 * Reveal on the shared screen: "Behold…" → each weapon in turn (owner in their color, weapon art
 * with a test swing, weapon name) → 3‥2‥1. Timing comes from the shared revealSlot(), which the
 * server also used to set the phase length, so it lines up with the phones.
 */
export function mountReveal(el: HTMLElement, conn: DbConnection, code: string): () => void {
  const box = document.createElement('div');
  box.className = 'center';
  el.appendChild(box);

  const players = new Map([...conn.db.player.iter()].filter((p) => p.roomCode === code).map((p) => [p.identity.toHexString(), p]));
  const doodles = new Map([...conn.db.doodle.iter()].filter((d) => d.roomCode === code).map((d) => [d.player.toHexString(), d.png]));
  // Same order on every client: by color slot.
  const entries = [...conn.db.weapon.iter()]
    .filter((w) => w.roomCode === code && players.has(w.player.toHexString()))
    .map((w) => {
      const p = players.get(w.player.toHexString())!;
      const stored = w.spec ? (JSON.parse(w.spec) as StoredWeapon) : null;
      return { p, stored, art: weaponArt({ spriteUrl: w.spriteUrl, png: doodles.get(w.player.toHexString()) }, stored?.spec ?? null) };
    })
    .sort((a, b) => a.p.colorSlot - b.p.colorSlot);

  const n = entries.length;
  const total = revealSeconds(n);
  let shown = '';
  let raf = 0;
  const frame = () => {
    const r = conn.db.room.code.find(code);
    if (r) {
      const t = total - secondsLeft(r.phaseEndsAt);
      const slot = revealSlot(t, n);
      const key = slot.kind === 'weapon' ? `w${slot.index}` : slot.kind === 'countdown' ? `c${slot.number}` : 'intro';
      if (key !== shown) {
        shown = key;
        box.innerHTML = '';
        if (slot.kind === 'intro') box.innerHTML = '<div class="reveal-title">Behold…</div>';
        else if (slot.kind === 'countdown') box.innerHTML = `<div class="countdown-big">${slot.number}</div>`;
        else void showWeapon(slot.index, key);
      }
    }
    raf = requestAnimationFrame(frame);
  };

  const showWeapon = async (i: number, key: string) => {
    const e = entries[i];
    if (!e) return;
    const c = colorForSlot(e.p.colorSlot);
    const card = document.createElement('div');
    card.className = 'reveal-card';
    card.innerHTML = `<div class="who" style="color:${c.hex}">${esc(e.p.name)}</div>`;
    const art = await e.art;
    if (shown !== key) return; // moved on while the art loaded
    card.appendChild(art);
    const name = document.createElement('div');
    name.className = 'what';
    name.textContent = e.stored?.spec.name ?? '???';
    card.appendChild(name);
    box.appendChild(card);
    playTestSwing(art, e.stored?.spec.archetype ?? 'swing');
  };

  frame();
  return () => { cancelAnimationFrame(raf); box.remove(); };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
