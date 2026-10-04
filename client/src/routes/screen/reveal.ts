import { colorForSlot, revealSeconds, revealSlot, REVEAL, type StoredWeapon } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';
import { secondsLeft } from '../../net/clock';
import { loadDoodle, weaponStage, type WeaponStage } from '../../ui/weapon-stage';

/**
 * Reveal on the shared screen: "Behold…" → each weapon in turn → 3‥2‥1.
 * Each weapon's moment: the plain doodle appears, a flash, its upgrades pop on (the AI's
 * decorations — the sketch itself is never changed), then a real test swing. Timing comes from
 * the shared revealSlot(), which the server used to set the phase length.
 */
export function mountReveal(el: HTMLElement, conn: DbConnection, code: string): () => void {
  const box = document.createElement('div');
  box.className = 'center';
  el.appendChild(box);

  const players = new Map([...conn.db.player.iter()].filter((p) => p.roomCode === code).map((p) => [p.identity.toHexString(), p]));
  const doodles = new Map([...conn.db.doodle.iter()].filter((d) => d.roomCode === code).map((d) => [d.player.toHexString(), d.png]));
  // Same order on every client: by color slot. Decode the cut-outs now; stages are made per slot.
  const entries = [...conn.db.weapon.iter()]
    .filter((w) => w.roomCode === code && players.has(w.player.toHexString()))
    .map((w) => {
      const p = players.get(w.player.toHexString())!;
      const stored = w.spec ? (JSON.parse(w.spec) as StoredWeapon) : null;
      return { p, stored, doodle: loadDoodle({ spriteUrl: w.spriteUrl, png: doodles.get(w.player.toHexString()) }).catch(() => null) };
    })
    .sort((a, b) => a.p.colorSlot - b.p.colorSlot);

  const n = entries.length;
  const total = revealSeconds(n);
  const per = (total - REVEAL.introS - REVEAL.countdownS) / Math.max(1, n);
  let shown = '';
  let stage: WeaponStage | null = null;
  const timers: number[] = [];
  const clearStage = () => { stage?.destroy(); stage = null; timers.splice(0).forEach(clearTimeout); };

  let active = true, artRevision = 0;
  let raf = 0;
  const frame = () => {
    const r = conn.db.room.code.find(code);
    if (r) {
      const t = total - secondsLeft(r.phaseEndsAt);
      const slot = revealSlot(t, n);
      const key = slot.kind === 'weapon' ? `w${slot.index}` : slot.kind === 'countdown' ? `c${slot.number}` : 'intro';
      if (key !== shown) {
        shown = key;
        clearStage();
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
    const version = ++artRevision;
    const c = colorForSlot(e.p.colorSlot);
    const card = document.createElement('div');
    card.className = 'reveal-card';
    card.innerHTML = `<div class="who" style="color:${c.hex}">${esc(e.p.name)}</div>`;
    const s = await weaponStage(await e.doodle, e.stored?.spec ?? null, { size: Math.min(innerHeight * 0.46, 420), upgradeLater: true });
    if (!active || shown !== key || version !== artRevision) { s.destroy(); return; } // moved on while it loaded
    clearStage();
    stage = s;
    card.appendChild(s.el);
    const name = document.createElement('div');
    name.className = 'what';
    name.textContent = e.stored?.spec.name ?? '???';
    card.appendChild(name);
    box.replaceChildren(card);
    // the moment: plain doodle → flash + upgrades → test swing, scaled to the slot length
    timers.push(window.setTimeout(() => void s.upgrade(), per * 220));
    timers.push(window.setTimeout(() => s.swing(), per * 560));
  };

  const onWeaponUpdate: Parameters<typeof conn.db.weapon.onUpdate>[0] = (_ctx, old, next) => {
    if (next.roomCode !== code || next.spriteUrl === old.spriteUrl) return;
    const index = entries.findIndex(e => e.p.identity.isEqual(next.player));
    const entry = entries[index];
    if (!entry) return;
    entry.doodle = loadDoodle({ spriteUrl: next.spriteUrl, png: doodles.get(next.player.toHexString()) }).catch(() => null);
    if (shown === `w${index}`) void showWeapon(index, shown);
  };
  conn.db.weapon.onUpdate(onWeaponUpdate);
  frame();
  return () => { active = false; conn.db.weapon.removeOnUpdate(onWeaponUpdate); cancelAnimationFrame(raf); clearStage(); box.remove(); };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
