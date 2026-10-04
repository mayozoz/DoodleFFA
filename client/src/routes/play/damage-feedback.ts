import type { EventContext } from '../../module_bindings';
import type { FxEvent } from '../../module_bindings/types';
import { createDamageHaptics } from '../../ui/haptics';
import type { PlayCtx } from './types';

/** Live server-confirmed opponent hits only; never infer damage from HP changes. */
export function mountDamageFeedback(ctx: PlayCtx) {
  const feedback = createDamageHaptics(ctx.el);
  let lastId = -1n;
  // Existing rows are a snapshot, not new damage (e.g. rejoining mid-battle).
  for (const event of ctx.conn.db.fxEvent.iter()) {
    if (event.id > lastId) lastId = event.id;
  }
  const onDamage = (eventCtx: EventContext, event: FxEvent) => {
    if (event.type !== 'damage' || event.roomCode !== ctx.roomCode ||
        !event.owner.isEqual(ctx.identity) || !(event.value > 0)) return;
    if (event.id <= lastId) return;
    lastId = event.id;
    if (eventCtx.event.tag === 'SubscribeApplied' ||
        ctx.conn.db.room.code.find(ctx.roomCode)?.phase !== 'battle') return;
    feedback.hit();
  };
  ctx.conn.db.fxEvent.onInsert(onDamage);
  return () => {
    ctx.conn.db.fxEvent.removeOnInsert(onDamage);
    feedback.dispose();
  };
}
