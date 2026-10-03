import { MAX_HP, colorForSlot } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';

/**
 * Top-right scoreboard for battle/results: players by HP, most → least. Eliminated players are
 * grayed and listed after the living, best finish first.
 */
export function mountScoreboard(host: HTMLElement, conn: DbConnection, code: string): () => void {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', top: '12px', right: '12px', minWidth: '210px', padding: '10px 12px',
    borderRadius: '12px', background: 'rgba(10,10,14,0.72)', pointerEvents: 'none',
    font: '700 15px/1.25 ui-rounded, system-ui, sans-serif', fontVariantNumeric: 'tabular-nums',
  } satisfies Partial<CSSStyleDeclaration>);
  host.appendChild(el);

  const render = () => {
    const hp = new Map([...conn.db.fighter.iter()].filter((f) => f.roomCode === code).map((f) => [f.player.toHexString(), f.hp]));
    const rows = [...conn.db.player.iter()]
      .filter((p) => p.roomCode === code && hp.has(p.identity.toHexString()))
      .map((p) => {
        const h = Math.max(0, hp.get(p.identity.toHexString()) ?? 0);
        return { p, h, out: h <= 0 || !p.alive };
      })
      .sort((a, b) =>
        a.out !== b.out ? (a.out ? 1 : -1)
        : !a.out ? b.h - a.h
        : (a.p.placement || 99) - (b.p.placement || 99));

    el.innerHTML = rows.map(({ p, h, out }) => {
      const c = out ? '#6b6b6b' : colorForSlot(p.colorSlot).hex;
      const pct = (h / MAX_HP) * 100;
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin:4px 0;opacity:${out ? 0.6 : 1}">
        <span style="color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${esc(p.name)}</span>
        <span style="color:${out ? '#6b6b6b' : '#f5f3ff'}">${out ? 'OUT' : Math.ceil(h).toLocaleString()}</span>
        <span style="grid-column:1/3;height:5px;border-radius:3px;background:#0008;overflow:hidden">
          <span style="display:block;height:100%;width:${pct}%;background:${c}"></span></span>
      </div>`;
    }).join('');
  };
  render();
  const timer = setInterval(render, 150);
  return () => { clearInterval(timer); el.remove(); };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
