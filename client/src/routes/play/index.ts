import type { Phase } from '@doodle/spec';
import { connect } from '../../net/connection';
import { syncFromPhaseStart } from '../../net/clock';
import { applyPlayerTheme } from '../../ui/theme';
import type { PlayCtx, View } from './types';
import { joinView } from './join';
import { drawView } from './draw';
import { dropView } from './drop';
import { battleView } from './battle';
import { waitingView } from './waiting';
import { resultsView } from './results';
import { mountPlayDebug } from './debug-status';
import { enableAudio } from '../../audio/sfx';
import { ControllerAudio } from './audio';
import { revealView } from './reveal';

// Controller (/play). Subscribes to its room, the room's players, and its own
// fighter + weapon rows only, and
// swaps one full-screen view per phase.

const VIEWS: Record<Phase, View> = {
  lobby: waitingView('You\'re in! Watch the big screen.'),
  draw: drawView,
  drop: dropView,
  reveal: revealView,
  battle: battleView,
  results: resultsView,
};

export async function mount(el: HTMLElement) {
  enableAudio();
  const { conn, identity } = await connect('play');
  const me = identity.toHexString();
  const ctx: PlayCtx = { conn, identity, el, roomCode: '' };
  ctx.audio = new ControllerAudio(ctx);
  mountPlayDebug(ctx);

  let current: { phase: Phase; cleanup: () => void } | null = null;
  const show = (phase: Phase) => {
    if (current?.phase === phase) return;
    current?.cleanup();
    el.innerHTML = '';
    current = { phase, cleanup: VIEWS[phase](ctx) };
  };

  const onJoined = (code: string) => {
    ctx.roomCode = code;
    conn.subscriptionBuilder()
      .onApplied(() => {
        const r = conn.db.room.code.find(code);
        if (r) { syncFromPhaseStart(r.phaseStartedAt); show(r.phase as Phase); }
        ctx.audio?.sync();
      })
      .subscribe([
        `SELECT * FROM room WHERE code = '${code}'`,
        `SELECT * FROM player WHERE room_code = '${code}'`,
        `SELECT * FROM fighter WHERE player = 0x${me}`,
        // own weapon only — needed for the cooldown ring (stats.cooldown)
        `SELECT * FROM weapon WHERE player = 0x${me}`,
      ]);
  };

  conn.db.room.onUpdate((_c, _old, r) => {
    if (r.code !== ctx.roomCode) return;
    syncFromPhaseStart(r.phaseStartedAt);
    show(r.phase as Phase);
  });
  conn.db.player.onInsert((_c, p) => { if (p.identity.toHexString() === me) applyPlayerTheme(p.colorSlot); });

  const cleanupJoin = joinView(ctx, (code) => { cleanupJoin(); onJoined(code); });
}
