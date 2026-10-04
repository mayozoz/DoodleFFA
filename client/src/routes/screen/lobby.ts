import QRCode from 'qrcode';
import '../../ui/arena-menu.css';
import { menuBackdrop } from '../../ui/menu-art';
import { colorForSlot } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';
import { roomJoinUrl } from '../../net/room-link';
import { mountTutorial } from './tutorial';
import { drawMarkerSvg } from '../../ui/marker-svg';

export interface SoloLobbyState {
  botIds: Set<string>;
  ready: boolean;
  error?: string;
  refresh?: () => void;
}

/** Every human uses a phone. Solo and multiplayer share the QR + party-link lobby. */
export function lobbyOverlay(el: HTMLElement, conn: DbConnection, code: string, solo: SoloLobbyState | null = null, startRound = () => conn.reducers.startRound({})): () => void {
  let active = true, busy = false;
  el.innerHTML = `<div class="room-lobby arena-menu">${menuBackdrop()}<div class="lobby-shell">
    <header class="lobby-header"><a class="lobby-back" href="/">← Game modes</a><span class="lobby-brand">DOODLE FFA</span><span class="lobby-mode">${solo ? 'SOLO · YOU + 3 BOTS' : 'MULTIPLAYER PARTY'}</span></header>
    <div class="lobby-heading"><span class="lobby-eyebrow">THE ARENA IS WAITING</span><h1>${solo ? 'Your doodle. Three rivals.' : 'Grab your phone. Join the battle.'}</h1><p>${solo ? 'Join on your phone and your solo match starts automatically.' : 'Draw a weapon on your phone. Settle it on the big screen.'}</p></div>
    <div class="lobby">
      <section class="lobby-panel lobby-join" aria-labelledby="join-heading"><span class="lobby-eyebrow">01 · JOIN THE ROOM</span><h2 id="join-heading">Scan to join</h2><div class="lobby-qr"><canvas id="qr" aria-label="Scan this QR code on your phone to join"></canvas></div><div class="lobby-room-code"><span>ROOM CODE</span><strong class="lobby-code">${code}</strong></div><a id="party-link" class="party-link" target="_blank" rel="noopener">Preparing your room link…</a><button id="copy-link" class="party-copy" disabled>Copy room link</button><p id="copy-status" role="status">Open your camera and scan the code.</p></section>
      <section class="lobby-panel lobby-party" aria-labelledby="players-heading"><div class="lobby-roster-heading"><div><span class="lobby-eyebrow">02 · YOUR PARTY</span><h2 id="players-heading">Who's playing?</h2></div><span id="player-count" class="lobby-count" aria-live="polite">0 joined</span></div><ul id="players" aria-label="Players in the room"></ul><div class="lobby-start-area"><button id="start" disabled>${solo ? 'Start solo match →' : 'Start match →'}</button><p id="start-hint" role="status"></p></div></section>
      <section class="lobby-panel lobby-controls"><span class="lobby-eyebrow">03 · GET READY</span><div class="lobby-tutorial"></div><p class="lobby-tip">Draw anything. It becomes your weapon.</p></section>
    </div><footer class="lobby-footer">${solo ? 'One phone. One doodle. One champion.' : 'Everyone plays on their own phone. Keep this screen open.'}</footer>
  </div></div>`;
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
    await QRCode.toCanvas(el.querySelector<HTMLCanvasElement>('#qr')!, url, { width: 320, margin: 2 });
  }).catch(() => {
    if (active) el.querySelector('#copy-status')!.textContent = 'Could not prepare the QR code. Reload this screen to retry.';
  });
  const list = el.querySelector<HTMLUListElement>('#players')!;
  const start = el.querySelector<HTMLButtonElement>('#start')!;
  const hint = el.querySelector<HTMLElement>('#start-hint')!;
  let autoStartFailed = false;
  const begin = async () => {
    if (!active || busy || start.disabled) return;
    busy = true; start.disabled = true; hint.textContent = 'Starting your match…';
    try { await startRound(); }
    catch (error) { if (active) { busy = false; autoStartFailed = true; refresh(); hint.textContent = error instanceof Error ? error.message : 'Could not start. Please retry.'; } }
  };
  const refresh = () => {
    const ps = [...conn.db.player.iter()].filter(p => p.roomCode === code).sort((a, b) => a.colorSlot - b.colorSlot);
    const connected = ps.filter(p => p.connected);
    const humanCount = connected.filter(p => !solo?.botIds.has(p.identity.toHexString())).length;
    const botsConnected = solo ? connected.filter(p => solo.botIds.has(p.identity.toHexString())).length : 0;
    const ready = solo ? solo.ready && botsConnected === 3 && humanCount >= 1 : humanCount >= 2;
    start.disabled = busy || !ready;
    el.querySelector('#player-count')!.textContent = `${connected.length} joined`;
    hint.textContent = solo?.error ?? (busy ? 'Starting your match…' : ready ? (solo ? (autoStartFailed ? 'Ready to play. Tap Start solo match to retry.' : 'Everyone is ready. Starting your solo match…') : `${humanCount} phones connected. Ready to start!`) : solo && !solo.ready ? 'Connecting your three bot opponents…' : solo ? 'Scan the QR code to connect your phone.' : `${Math.max(0, 2 - humanCount)} ${humanCount === 1 ? 'more player' : 'players'} needed to start`);
    list.innerHTML = ps.length ? ps.map(p => {
      const c = colorForSlot(p.colorSlot);
      const bot = solo?.botIds.has(p.identity.toHexString());
      return `<li class="lobby-player${p.connected ? '' : ' is-offline'}" style="--c:${c.hex}"><span class="lobby-player-marker" aria-hidden="true">${drawMarkerSvg(p.marker, c.hex, 24)}</span><div><strong>${escapeHtml(p.name)}</strong><span>${bot ? 'BOT OPPONENT' : 'PHONE CONTROLLER'}</span></div><span class="lobby-player-status">${p.connected ? 'Ready' : 'Offline'}</span></li>`;
    }).join('') : '<li class="lobby-empty"><span aria-hidden="true">✦</span><strong>Your party starts here</strong><p>Scan the code. Your name will appear here.</p></li>';
    if (solo && ready && !busy && !autoStartFailed) void begin();
  };
  conn.db.player.onInsert(refresh); conn.db.player.onUpdate(refresh); conn.db.player.onDelete(refresh);
  if (solo) solo.refresh = refresh;
  refresh();
  start.onclick = () => void begin();
  return () => {
    active = false; stopTutorial();
    if (solo?.refresh === refresh) solo.refresh = undefined;
    conn.db.player.removeOnInsert(refresh); conn.db.player.removeOnUpdate(refresh); conn.db.player.removeOnDelete(refresh);
  };
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
