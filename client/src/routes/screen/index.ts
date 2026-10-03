import type { Phase } from '@doodle/spec';
import { connect } from '../../net/connection';
import { syncFromPhaseStart } from '../../net/clock';
import { mountCountdown } from '../../ui/countdown';
import { Arena } from './arena';
import { lobbyOverlay } from './lobby';
import { resultsOverlay } from './results';

// Shared screen (/screen). Creates a room, subscribes to everything public for it, and
// renders. It never simulates — positions come from `fighter` rows, ~100 ms behind.

const LABEL: Partial<Record<Phase, string>> = {
  draw: 'Draw your weapon!',
  drop: 'Pick your drop spot!',
  reveal: 'Behold…',
};

export async function mount(el: HTMLElement) {
  const { conn, identity } = await connect('screen');
  el.innerHTML = `<div id="stage" style="position:fixed;inset:0"></div><div id="overlay" style="position:fixed;inset:0;pointer-events:none"></div>`;
  const overlay = el.querySelector<HTMLDivElement>('#overlay')!;
  const arena = await Arena.create(el.querySelector<HTMLDivElement>('#stage')!, conn);

  let code = '';
  let phase: Phase | null = null;
  let cleanup = () => {};

  const render = () => {
    const r = conn.db.room.code.find(code);
    if (!r || r.phase === phase) return;
    phase = r.phase as Phase;
    syncFromPhaseStart(r.phaseStartedAt);
    cleanup();
    overlay.innerHTML = '';
    arena.setPhase(phase);
    if (phase === 'lobby') cleanup = lobbyOverlay(overlay, conn, code);
    else if (phase === 'results') cleanup = resultsOverlay(overlay, conn, code);
    else {
      const box = document.createElement('div');
      box.className = 'center';
      box.innerHTML = `<h1>${LABEL[phase] ?? ''}</h1>`;
      overlay.appendChild(box);
      cleanup = mountCountdown(box, () => conn.db.room.code.find(code)?.phaseEndsAt);
    }
  };

  // Find (or wait for) the room this screen hosts.
  conn.db.room.onInsert((_c, r) => {
    if (!r.host.isEqual(identity) || code) return;
    code = r.code;
    arena.setRoom(code);
    conn.subscriptionBuilder().onApplied(render).subscribe([
      `SELECT * FROM player WHERE room_code = '${code}'`,
      `SELECT * FROM doodle WHERE room_code = '${code}'`,
      `SELECT * FROM weapon WHERE room_code = '${code}'`,
      `SELECT * FROM fighter WHERE room_code = '${code}'`,
      `SELECT * FROM projectile WHERE room_code = '${code}'`,
      `SELECT * FROM fx_event WHERE room_code = '${code}'`,
    ]);
    render();
  });
  conn.db.room.onUpdate(() => render());

  conn.subscriptionBuilder()
    .onApplied(() => void conn.reducers.createRoom({}))
    .subscribe(`SELECT * FROM room WHERE host = 0x${identity.toHexString()}`);
}
