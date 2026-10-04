import { describe, expect, it, vi } from 'vitest';
import { lobbyOverlay } from '../src/routes/screen/lobby';
import type { DbConnection } from '../src/module_bindings';

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(async () => {}) } }));
vi.mock('../src/net/room-link', () => ({ roomJoinUrl: vi.fn(async () => 'https://game.example/play?room=TEST') }));
vi.mock('../src/routes/screen/tutorial', () => ({ mountTutorial: () => () => {} }));

function setup(start = vi.fn(async () => {})) {
  const nodes = new Map<string, any>();
  const el = { innerHTML: '', querySelector: (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', disabled: false });
    return nodes.get(selector);
  } } as unknown as HTMLElement;
  const players: any[] = [];
  const listeners = new Set<() => void>();
  const table = { iter: () => players, onInsert: (fn: () => void) => listeners.add(fn), onUpdate: (fn: () => void) => listeners.add(fn), onDelete: (fn: () => void) => listeners.add(fn), removeOnInsert: (fn: () => void) => listeners.delete(fn), removeOnUpdate: (fn: () => void) => listeners.delete(fn), removeOnDelete: (fn: () => void) => listeners.delete(fn) };
  const conn = { db: { player: table } } as unknown as DbConnection;
  const stop = lobbyOverlay(el, conn, 'TEST', start);
  const join = (id: string, name = id) => {
    players.push({ identity: { toHexString: () => id }, roomCode: 'TEST', colorSlot: players.length, name, marker: '●', connected: true });
    listeners.forEach(fn => fn());
  };
  return { nodes, players, join, stop, start, refresh: () => listeners.forEach(fn => fn()) };
}

describe('lobby joining and start flow', () => {
  it('requires two players and a host click for multiplayer', () => {
    const s = setup();
    expect(s.nodes.get('#start').disabled).toBe(true);
    expect(s.nodes.get('#start-hint').textContent).toBe('2 players needed to start');
    s.join('human1', '<Ada>');
    expect(s.nodes.get('#players').innerHTML).toContain('&lt;Ada&gt;');
    expect(s.nodes.get('#start-hint').textContent).toBe('1 more player needed to start');
    s.join('human2');
    expect(s.nodes.get('#start').disabled).toBe(false);
    expect(s.start).not.toHaveBeenCalled();
    s.nodes.get('#start').onclick();
    expect(s.start).toHaveBeenCalledTimes(1);
    s.stop();
  });
});
