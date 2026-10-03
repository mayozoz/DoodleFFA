import { colorForSlot, type StoredWeapon } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';

/** Winner + their weapon card. TODO(M4): animated card, kill feed recap. */
export function resultsOverlay(el: HTMLElement, conn: DbConnection, code: string): () => void {
  const r = conn.db.room.code.find(code);
  const winner = [...conn.db.player.iter()].find((p) => p.identity.toHexString() === r?.winner);
  const w = winner && conn.db.weapon.player.find(winner.identity);
  const spec = w?.spec ? (JSON.parse(w.spec) as StoredWeapon).spec : null;
  const color = winner ? colorForSlot(winner.colorSlot).hex : '#fff';
  el.innerHTML = `
    <div class="center" style="pointer-events:auto"><div>
      <h1 style="font-size:64px;color:${color}">${winner ? `${winner.name} wins!` : 'Draw!'}</h1>
      ${spec ? `<h2>${spec.name}</h2>` : ''}
      <button id="again">Play again</button>
    </div></div>`;
  el.querySelector<HTMLButtonElement>('#again')!.onclick = () => void conn.reducers.startRound({});
  return () => {};
}
