import { schema, table, t } from 'spacetimedb/server';

// Table definitions. Column names are camelCase here; SpacetimeDB's default case
// policy exposes them as snake_case in SQL (e.g. `room_code`) and camelCase in the
// generated client bindings.
//
// JSON-in-a-string columns (spec, effects, strokes, features) are deliberate: their
// shapes are owned by packages/spec and evolve faster than the table schema.

export const room = table(
  { name: 'room', public: true },
  {
    code: t.string().primaryKey(),
    /** creator — the shared screen. Only it may start rounds. */
    host: t.identity(),
    phase: t.string(), // Phase from @doodle/spec
    phaseStartedAt: t.timestamp(),
    phaseEndsAt: t.timestamp(),
    round: t.u32(),
    seed: t.u32(),
    arenaR: t.f32(),
    stormX: t.f32(),
    stormY: t.f32(),
    stormR: t.f32(),
    /** hex identity of the winner, '' until Results */
    winner: t.string(),
  },
);

export const player = table(
  { name: 'player', public: true },
  {
    identity: t.identity().primaryKey(),
    roomCode: t.string().index('btree'),
    name: t.string(),
    colorSlot: t.u8(),
    marker: t.string(),
    alive: t.bool(),
    connected: t.bool(),
    /** normalized 0–1 drop position on the mini-arena; -1 = not chosen */
    dropX: t.f32(),
    dropY: t.f32(),
    /** 1 = winner, 0 = not placed yet */
    placement: t.u8(),
  },
);

/** Private: raw strokes + PNG never leave the server except via procedures. */
export const drawing = table(
  { name: 'drawing' },
  {
    player: t.identity().primaryKey(),
    roomCode: t.string().index('btree'),
    strokes: t.string(), // JSON Drawing
    png: t.byteArray(),
    features: t.string(), // JSON DrawingFeatures
  },
);

/**
 * Public copy of just the doodle PNG. The shared screen needs it for the Reveal and as the
 * sprite fallback (raw drawing + outline/glow); strokes + features stay private in `drawing`.
 */
export const doodle = table(
  { name: 'doodle', public: true },
  {
    player: t.identity().primaryKey(),
    roomCode: t.string().index('btree'),
    png: t.byteArray(),
  },
);

export const weapon = table(
  { name: 'weapon', public: true },
  {
    player: t.identity().primaryKey(),
    roomCode: t.string().index('btree'),
    /** JSON StoredWeapon ({ spec, stats }) — '' while pending */
    spec: t.string(),
    spriteUrl: t.string(),
    sfxUrl: t.string(),
    status: t.string(), // WeaponStatus
  },
);

export const fighter = table(
  { name: 'fighter', public: true },
  {
    player: t.identity().primaryKey(),
    roomCode: t.string().index('btree'),
    x: t.f32(),
    y: t.f32(),
    facing: t.f32(), // radians
    hp: t.f32(),
    cooldownReadyAt: t.timestamp(),
    /** last attack start, drives the screen's attack animation */
    lastAttackAt: t.timestamp(),
    /** JSON { burn?: {dps, until}, slow?: {...}, ... } */
    effects: t.string(),
  },
);

/** Private: latest intent per controller. */
export const input = table(
  { name: 'input' },
  {
    player: t.identity().primaryKey(),
    dx: t.f32(),
    dy: t.f32(),
    attackBuffered: t.bool(),
  },
);

export const projectile = table(
  { name: 'projectile', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomCode: t.string().index('btree'),
    owner: t.identity(),
    x: t.f32(),
    y: t.f32(),
    vx: t.f32(),
    vy: t.f32(),
    expiresAt: t.timestamp(),
    /** JSON list of hex identities already hit (for pierce) */
    hits: t.string(),
  },
);

/** One-shot visual cues (hits, deaths, slams). tick() deletes rows older than ~1 s. */
export const fxEvent = table(
  { name: 'fx_event', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomCode: t.string().index('btree'),
    type: t.string(), // 'hit' | 'death' | 'attack' | 'shockwave' | ...
    x: t.f32(),
    y: t.f32(),
    owner: t.identity(),
    /** damage number etc. */
    value: t.f32(),
    createdAt: t.timestamp(),
  },
);

/**
 * Server-side errors and stalls, for the client debug overlay (?debug). Messages are short and
 * generic — never prompts or raw model output. tick() keeps ~10 minutes of history.
 */
export const debugEvent = table(
  { name: 'debug_event', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomCode: t.string().index('btree'),
    source: t.string(), // 'tick' | 'gen_spec' | 'gen_sprite' | 'gen_sfx' | ...
    message: t.string(),
    createdAt: t.timestamp(),
  },
);

/** Private: per-room commentator throttle (cost guard). */
export const commentary = table(
  { name: 'commentary' },
  {
    roomCode: t.string().primaryKey(),
    round: t.u32(),
    lines: t.u32(),
    lastAt: t.timestamp(),
  },
);

/** Private schedule table driving tick(). One global row; tick() loops over active rooms. */
export const tickSchedule = table(
  { name: 'tick_schedule' },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
  },
);

/** Private key/value store for API keys. Never subscribed, never logged. */
export const secrets = table(
  { name: 'secrets' },
  {
    key: t.string().primaryKey(),
    value: t.string(),
  },
);

/** Private: identities allowed to call admin reducers (the publisher, set in init). */
export const admin = table(
  { name: 'admin' },
  {
    identity: t.identity().primaryKey(),
  },
);

const spacetimedb = schema({
  room, player, drawing, doodle, weapon, fighter, input, projectile, fxEvent, debugEvent, commentary, tickSchedule, secrets, admin,
});
export default spacetimedb;
