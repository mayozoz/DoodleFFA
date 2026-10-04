import QRCode from 'qrcode';
import { colorForSlot } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';
import { roomJoinUrl } from '../../net/room-link';
import { mountTutorial } from './tutorial';

export interface SoloLobbyState {
  botIds: Set<string>;
  ready: boolean;
  error?: string;
  refresh?: () => void;
}

/** Every human uses a phone. Solo and multiplayer share the QR + party-link lobby. */
export function lobbyOverlay(el: HTMLElement, conn: DbConnection, code: string, solo: SoloLobbyState | null = null, startRound = () => conn.reducers.startRound({})): () => void {
  let active = true, busy = false;
  el.innerHTML = `<div class="center room-lobby"><div class="lobby"><div class="lobby-join">
    <a class="lobby-back" href="/">← Game modes</a><h1>${solo ? 'Solo party room' : 'Multiplayer party room'}</h1>
    <p>${solo ? 'You vs. three bots. Your phone is your controller.' : 'Everyone joins with their own phone.'}</p>
    <p>Scan to draw your weapon and play</p><canvas id="qr" aria-label="Scan this QR code on your phone to join"></canvas>
    <h2 class="lobby-code">${code}</h2><a id="party-link" class="party-link" target="_blank" rel="noopener">Preparing your room link…</a>
    <button id="copy-link" class="party-copy" disabled>Copy room link</button><p id="copy-status" role="status">Use the same Wi-Fi as this screen.</p>
    <ul id="players" style="list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:12px;justify-content:center"></ul>
    <button id="start" disabled>${solo ? 'Start solo match' : 'Start match'}</button><p id="start-hint" role="status"></p>
    </div><div class="lobby-tutorial"></div></div></div>`;
  const stopTutorial = mountTutorial(el.querySelector<HTMLDivElement>('.lobby-tutorial')!);
  const copy = el.querySelector<HTMLButtonElement>('#copy-link')!;
  void roomJoinUrl(code).then(async url => {
    if (!active) return;
    const link = el.querySelector<HTMLAnchorElement>('#party-link')!;
    link.href = url; link.textContent = url; copy.disabled = false;
    copy.onclick = async () => {
      const status = el.querySelector<HTMLElement>('#copy-status')!;
      try { await navigator.clipboard.writeText(url); if (active) status.textContent = 'Room link copied! Open it on your phone.'; }
      catch { if (active) status.textContent = 'Press and hold the room link above to copy it.'; }
    };
    await QRCode.toCanvas(el.querySelector<HTMLCanvasElement>('#qr')!, url, { width: 220, margin: 1 });
  }).catch(() => {
    if (active) el.querySelector('#copy-status')!.textContent = 'Could not prepare the QR code. Reload this screen to retry.';
  });
  const list = el.querySelector<HTMLUListElement>('#players')!;
  const start = el.querySelector<HTMLButtonElement>('#start')!;
  const hint = el.querySelector<HTMLElement>('#start-hint')!;
  const refresh = () => {
    const ps = [...conn.db.player.iter()].filter(p => p.roomCode === code).sort((a, b) => a.colorSlot - b.colorSlot);
    const connected = ps.filter(p => p.connected);
    const humanCount = connected.filter(p => !solo?.botIds.has(p.identity.toHexString())).length;
    const botsConnected = solo ? connected.filter(p => solo.botIds.has(p.identity.toHexString())).length : 0;
    const ready = solo ? solo.ready && botsConnected === 3 && humanCount >= 1 : humanCount >= 2;
    start.disabled = busy || !ready;
    hint.textContent = solo?.error ?? (ready ? (solo ? 'Your phone and three bots are ready!' : `${humanCount} phones connected. Ready to start!`) : solo && !solo.ready ? 'Connecting your three bot opponents…' : solo ? 'Scan the QR code to connect your phone.' : `Waiting for phones (${humanCount}/2 minimum)…`);
    list.innerHTML = ps.map(p => {
      const c = colorForSlot(p.colorSlot);
      return `<li style="padding:8px 14px;border-radius:12px;border:3px solid ${c.hex};color:${c.hex};font-weight:800;opacity:${p.connected ? 1 : .35}">${p.marker} ${escapeHtml(p.name)}</li>`;
    }).join('');
  };
  conn.db.player.onInsert(refresh); conn.db.player.onUpdate(refresh); conn.db.player.onDelete(refresh);
  if (solo) solo.refresh = refresh;
  refresh();
  start.onclick = async () => {
    if (busy || start.disabled) return;
    busy = true; start.disabled = true; hint.textContent = 'Starting your match…';
    try { await startRound(); }
    catch (error) { if (active) { busy = false; refresh(); hint.textContent = error instanceof Error ? error.message : 'Could not start. Please retry.'; } }
  };
  return () => {
    active = false; stopTutorial();
    if (solo?.refresh === refresh) solo.refresh = undefined;
    conn.db.player.removeOnInsert(refresh); conn.db.player.removeOnUpdate(refresh); conn.db.player.removeOnDelete(refresh);
  };
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
