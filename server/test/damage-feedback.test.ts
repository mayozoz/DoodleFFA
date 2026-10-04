import { describe, expect, it } from 'vitest';
import { Identity, Timestamp } from 'spacetimedb';
import { DEFAULT_SWING, MAX_HP, type WeaponSpec } from '@doodle/spec';
import { stepBattle } from '../src/lib/sim';
import { storeWeapon } from '../src/lib/weapons';
import { GAME } from '../src/balance';
import type { Ctx, FighterRow, RoomRow } from '../src/lib/ctx';

function world(archetype: WeaponSpec['archetype'] = 'swing', elapsed = 1, attack = true) {
  const attacker = Identity.fromString('1'.padStart(64, '0'));
  const victim = Identity.fromString('2'.padStart(64, '0'));
  const timestamp = new Timestamp(BigInt(elapsed * 1e6));
  const room = { code: 'TEST', phase: 'battle', seed: 42, arenaR: 20, stormX: 0, stormY: 0,
    phaseStartedAt: new Timestamp(0n), phaseEndsAt: new Timestamp(100000000n) } as RoomRow;
  const fighters = [attacker, victim].map((player, i) => ({ player, roomCode: 'TEST', x: i * 0.8,
    y: 0, facing: 0, hp: MAX_HP, cooldownReadyAt: timestamp, lastAttackAt: timestamp,
    effects: i === 0 && attack ? JSON.stringify({ pa: { at: 0, f: 0 } }) : '{}',
  }));
  const events: any[] = [], projectiles: any[] = [];
  const players = [attacker, victim].map(identity => ({ identity, roomCode: 'TEST', totalDamage: 0 }));
  const spec: WeaponSpec = { ...DEFAULT_SWING, archetype,
    projectile: { count: 1, speed: 0.5, spread_deg: 0, behavior: 'pierce' } };
  const ctx = { timestamp, db: {
    fighter: { roomCode: { filter: () => fighters }, player: { update: (f: FighterRow) => {
      Object.assign(fighters.find(o => o.player.isEqual(f.player))!, f);
    } } },
    weapon: { player: { find: () => ({ spec: storeWeapon(spec) }) } },
    input: { player: { find: () => undefined } },
    projectile: { roomCode: { filter: () => projectiles }, insert: (p: any) => projectiles.push(p),
      id: { delete: () => {}, update: () => {} } },
    fxEvent: { insert: (e: any) => events.push(e) },
    abilityObject: { roomCode: { filter: () => [] }, insert: () => {}, id: { delete: () => {}, update: () => {} } },
    player: { roomCode: { filter: () => players }, identity: { find: () => undefined, update: (p: any) => Object.assign(players.find(o => o.identity.isEqual(p.identity))!, p) } }, room: { code: { update: () => {} } },
  } } as unknown as Ctx;
  return { ctx, room, events, fighters, victim, attacker, players };
}
describe('server damage cues', () => {
  it.each(['swing', 'thrust', 'slam', 'shoot', 'throw', 'whip', 'spin', 'beam'] as const)(
    '%s targets the victim while preserving the hit event attacker', (archetype) => {
      const s = world(archetype); stepBattle(s.ctx, s.room, 1 / GAME.tickHz);
      const cue = s.events.find(e => e.type === 'damage');
      expect(cue).toBeDefined(); expect(cue.owner.isEqual(s.victim)).toBe(true);
      expect(cue.value).toBeGreaterThan(0);
      expect(s.events.find(e => e.type === 'hit').owner.isEqual(s.attacker)).toBe(true);
      expect(s.fighters[1]!.hp).toBeLessThan(MAX_HP);
      expect(s.players[0]!.totalDamage).toBeCloseTo(MAX_HP - s.fighters[1]!.hp);
      expect(s.players[1]!.totalDamage).toBe(0);
    });
  it('does not emit damage cues for storm or sudden death', () => {
    const s = world('swing', GAME.suddenDeathS + 1, false);
    s.fighters[1]!.x = 19;
    stepBattle(s.ctx, s.room, 1 / GAME.tickHz);
    expect(s.fighters[0]!.hp).toBeLessThan(MAX_HP);
    expect(s.fighters[1]!.hp).toBeLessThan(s.fighters[0]!.hp);
    expect(s.events.filter(e => e.type === 'damage')).toHaveLength(0);
    expect(s.players.every(p => p.totalDamage === 0)).toBe(true);
  });
  it('includes lethal hits but never emits a self-hit cue', () => {
    const s = world(); s.fighters[1]!.hp = 1;
    stepBattle(s.ctx, s.room, 1 / GAME.tickHz);
    expect(s.fighters[1]!.hp).toBe(0);
    expect(s.players[0]!.totalDamage).toBe(1);
    expect(s.events.filter(e => e.type === 'damage')).toHaveLength(1);
    expect(s.events.find(e => e.type === 'damage').owner.isEqual(s.attacker)).toBe(false);
  });
});
