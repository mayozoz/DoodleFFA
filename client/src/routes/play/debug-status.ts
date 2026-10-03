import { DEBUG, debug, type Item } from '../../debug';
import { secondsLeft, secondsOverdue } from '../../net/clock';
import type { PlayCtx } from './types';
import { RUN_GENERATION } from './draw';

/** Controller debug status (only with ?debug): phase timer, my drawing + weapon status. */
export function mountPlayDebug(ctx: PlayCtx) {
  if (!DEBUG) return;
  debug.addProvider((): Item[] => {
    if (!ctx.roomCode) return [{ level: 'wait', text: 'not joined yet' }];
    const r = ctx.conn.db.room.code.find(ctx.roomCode);
    if (!r) return [{ level: 'error', text: `room ${ctx.roomCode} not found (screen reset? rejoin with the code on screen)` }];
    const items: Item[] = [];
    const late = secondsOverdue(r.phaseEndsAt);
    if (r.phase === 'lobby') items.push({ level: 'ok', text: `room ${r.code} · lobby` });
    else if (late > 1.5) items.push({ level: 'error', text: `${r.phase} ended ${late.toFixed(0)}s ago — server is NOT advancing` });
    else items.push({ level: 'wait', text: `${r.phase} · ${secondsLeft(r.phaseEndsAt).toFixed(1)}s left` });
    const me = ctx.conn.db.player.identity.find(ctx.identity);
    items.push(me ? { level: 'ok', text: `me: ${me.name} · color slot ${me.colorSlot} · ${me.alive ? 'alive' : 'out'}` } : { level: 'warn', text: 'my player row is missing' });
    const w = ctx.conn.db.weapon.player.find(ctx.identity);
    if (r.phase !== 'lobby') {
      items.push(w
        ? { level: w.status === 'pending' ? 'wait' : w.status === 'fallback' ? 'warn' : 'ok', text: `my weapon: ${w.status}${w.spec ? '' : ' (no spec yet)'}` }
        : { level: r.phase === 'draw' ? 'wait' : 'warn', text: 'my weapon: no drawing submitted yet' });
    }
    if (!RUN_GENERATION) items.push({ level: 'warn', text: 'AI generation off (RUN_GENERATION = false) → every weapon uses the fallback' });
    return items;
  });
}
