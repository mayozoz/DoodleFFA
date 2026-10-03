import { SenderError, t } from 'spacetimedb/server';
import { MAX_PLAYERS, colorForSlot, nextFreeColorSlot } from '@doodle/spec';
import spacetimedb from '../schema';
import { makeRoomCode } from '../lib/room-code';
import { enterPhase } from '../lib/phases';

/**
 * Shared screen creates a room. (Not in the brief's reducer list, but someone has to
 * mint the code; the caller becomes the room host.) The screen finds its room by
 * subscribing to `room WHERE host = <its identity>`.
 */
export const createRoom = spacetimedb.reducer((ctx) => {
  // Close any previous room this screen hosted so codes don't pile up.
  for (const r of ctx.db.room.iter()) if (r.host.isEqual(ctx.sender)) ctx.db.room.code.delete(r.code);

  let code = makeRoomCode(ctx.random);
  while (ctx.db.room.code.find(code)) code = makeRoomCode(ctx.random);

  ctx.db.room.insert({
    code,
    host: ctx.sender,
    phase: 'lobby',
    phaseStartedAt: ctx.timestamp,
    phaseEndsAt: ctx.timestamp,
    round: 0,
    seed: 0,
    arenaR: 0,
    stormX: 0,
    stormY: 0,
    stormR: 0,
    winner: '',
  });
});

export const joinRoom = spacetimedb.reducer(
  { code: t.string(), name: t.string() },
  (ctx, { code, name }) => {
    code = code.trim().toUpperCase();
    const r = ctx.db.room.code.find(code);
    if (!r) throw new SenderError('room not found');
    const cleanName = name.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16) || 'Player';

    const existing = ctx.db.player.identity.find(ctx.sender);
    if (existing && existing.roomCode === code) {
      // Reconnect / rename: keep the color slot.
      ctx.db.player.identity.update({ ...existing, name: cleanName, connected: true });
      return;
    }
    if (r.phase !== 'lobby') throw new SenderError('round in progress');
    if (existing) ctx.db.player.identity.delete(ctx.sender); // switching rooms

    const players = [...ctx.db.player.roomCode.filter(code)];
    if (players.length >= MAX_PLAYERS) throw new SenderError('room full');
    const slot = nextFreeColorSlot(players.map((p) => p.colorSlot));
    const color = colorForSlot(slot);

    ctx.db.player.insert({
      identity: ctx.sender,
      roomCode: code,
      name: cleanName,
      colorSlot: slot,
      marker: color.marker,
      alive: true,
      connected: true,
      dropX: -1,
      dropY: -1,
      placement: 0,
    });
  },
);

/** Shared screen → draw phase. */
export const startRound = spacetimedb.reducer((ctx) => {
  const r = [...ctx.db.room.iter()].find((x) => x.host.isEqual(ctx.sender));
  if (!r) throw new SenderError('not a host');
  if (r.phase !== 'lobby' && r.phase !== 'results') throw new SenderError('round already running');
  const players = [...ctx.db.player.roomCode.filter(r.code)];
  if (players.length < 2) throw new SenderError('need at least 2 players');

  enterPhase(ctx, { ...r, round: r.round + 1, seed: ctx.random.uint32() }, 'draw');
});

export const onDisconnect = spacetimedb.clientDisconnected((ctx) => {
  const p = ctx.db.player.identity.find(ctx.sender);
  if (!p) return;
  const r = ctx.db.room.code.find(p.roomCode);
  // In the lobby, leaving frees the color slot. Mid-round, the fighter just stands there.
  if (!r || r.phase === 'lobby') ctx.db.player.identity.delete(ctx.sender);
  else ctx.db.player.identity.update({ ...p, connected: false });
});

