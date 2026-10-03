import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from '../schema';

const MAX_PNG_BYTES = 512 * 1024;
const MAX_STROKES_JSON = 256 * 1024;

/**
 * Controller submits its doodle at the end of the draw phase (or early).
 * Creates the `weapon` row as `pending`; the controller then calls the gen_* procedures.
 * Late submissions during drop are accepted so a slow phone still gets its own drawing.
 */
export const submitDrawing = spacetimedb.reducer(
  { strokes: t.string(), png: t.byteArray(), features: t.string() },
  (ctx, { strokes, png, features }) => {
    const p = ctx.db.player.identity.find(ctx.sender);
    if (!p) throw new SenderError('not in a room');
    const r = ctx.db.room.code.find(p.roomCode);
    if (!r || (r.phase !== 'draw' && r.phase !== 'drop')) throw new SenderError('not drawing now');
    if (png.length > MAX_PNG_BYTES || strokes.length > MAX_STROKES_JSON) throw new SenderError('drawing too large');

    const row = { player: ctx.sender, roomCode: p.roomCode, strokes, png, features };
    if (ctx.db.drawing.player.find(ctx.sender)) ctx.db.drawing.player.update(row);
    else ctx.db.drawing.insert(row);

    const pub = { player: ctx.sender, roomCode: p.roomCode, png };
    if (ctx.db.doodle.player.find(ctx.sender)) ctx.db.doodle.player.update(pub);
    else ctx.db.doodle.insert(pub);

    if (!ctx.db.weapon.player.find(ctx.sender)) {
      ctx.db.weapon.insert({ player: ctx.sender, roomCode: p.roomCode, spec: '', spriteUrl: '', sfxUrl: '', status: 'pending' });
    }
  },
);

/** Normalized 0–1 position on the mini-arena. Re-tap allowed; only during drop. */
export const setDrop = spacetimedb.reducer(
  { x: t.f32(), y: t.f32() },
  (ctx, { x, y }) => {
    const p = ctx.db.player.identity.find(ctx.sender);
    if (!p) throw new SenderError('not in a room');
    const r = ctx.db.room.code.find(p.roomCode);
    if (r?.phase !== 'drop') throw new SenderError('not dropping now');
    const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));
    ctx.db.player.identity.update({ ...p, dropX: clamp01(x), dropY: clamp01(y) });
  },
);
