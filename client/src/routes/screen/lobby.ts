import QRCode from 'qrcode';
import { colorForSlot } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';

const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL ?? location.origin;

/** QR + room code + live player list (color + marker) + Start. */
export function lobbyOverlay(el: HTMLElement, conn: DbConnection, code: string): () => void {
  const url = `${PUBLIC_URL}/play?room=${code}`;
  el.innerHTML = `
    <div class="center" style="pointer-events:auto">
      <div>
        <canvas id="qr"></canvas>
        <h1 style="font-size:72px;margin:8px 0;letter-spacing:8px">${code}</h1>
        <p style="color:var(--muted)">${url}</p>
        <ul id="players" style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:12px;justify-content:center"></ul>
        <button id="start">Start</button>
      </div>
    </div>`;
  void QRCode.toCanvas(el.querySelector<HTMLCanvasElement>('#qr')!, url, { width: 240, margin: 1 });

  const list = el.querySelector<HTMLUListElement>('#players')!;
  const refresh = () => {
    const ps = [...conn.db.player.iter()].filter((p) => p.roomCode === code).sort((a, b) => a.colorSlot - b.colorSlot);
    list.innerHTML = ps.map((p) => {
      const c = colorForSlot(p.colorSlot);
      // Disconnected players keep their color slot until the round starts; show them faded.
      return `<li style="padding:8px 14px;border-radius:12px;border:3px solid ${c.hex};color:${c.hex};font-weight:800;opacity:${p.connected ? 1 : 0.35}">${p.marker} ${p.name}</li>`;
    }).join('');
  };
  const onIns = () => refresh();
  conn.db.player.onInsert(onIns);
  conn.db.player.onUpdate(onIns);
  conn.db.player.onDelete(onIns);
  refresh();

  el.querySelector<HTMLButtonElement>('#start')!.onclick = () => void conn.reducers.startRound({}).catch((e: unknown) => alert(String(e)));
  return () => {
    conn.db.player.removeOnInsert(onIns);
    conn.db.player.removeOnUpdate(onIns);
    conn.db.player.removeOnDelete(onIns);
  };
}
