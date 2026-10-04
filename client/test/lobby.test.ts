import { describe, expect, it, vi } from 'vitest';
import { lobbyOverlay, type SoloLobbyState } from '../src/routes/screen/lobby';
import type { DbConnection } from '../src/module_bindings';

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(async () => {}) } }));
vi.mock('../src/net/room-link', () => ({ roomJoinUrl: vi.fn(async () => 'https://game.example/play?room=TEST') }));
vi.mock('../src/routes/screen/tutorial', () => ({ mountTutorial: () => () => {} }));

function setup(solo: SoloLobbyState | null = null, start = vi.fn(async () => {})) {
  const nodes = new Map<string, any>();
  const el = { innerHTML: '', querySelector: (selector: string) => {
    if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', disabled: false });
    return nodes.get(selector);
  } } as unknown as HTMLElement;
  const players: any[] = [];
  const listeners = new Set<() => void>();
  const table = { iter: () => players, onInsert: (fn: () => void) => listeners.add(fn), onUpdate: (fn: () => void) => listeners.add(fn), onDelete: (fn: () => void) => listeners.add(fn), removeOnInsert: (fn: () => void) => listeners.delete(fn), removeOnUpdate: (fn: () => void) => listeners.delete(fn), removeOnDelete: (fn: () => void) => listeners.delete(fn) };
  const conn = { db: { player: table } } as unknown as DbConnection;
  const stop = lobbyOverlay(el, conn, 'TEST', solo, start);
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
  it.each([true, false])('starts solo once both phone and bots are ready (bots ready first: %s)', (botsReadyFirst) => {
    const solo: SoloLobbyState = { botIds: new Set(['b1', 'b2', 'b3']), ready: botsReadyFirst };
    const s = setup(solo);
    s.join('b1'); s.join('b2'); s.join('b3');
    expect(s.start).not.toHaveBeenCalled();
    s.join('human');
    if (!botsReadyFirst) {
      expect(s.start).not.toHaveBeenCalled();
      solo.ready = true; solo.refresh?.();
    }
    expect(s.start).toHaveBeenCalledTimes(1);
    s.refresh();
    expect(s.start).toHaveBeenCalledTimes(1);
    s.stop(); expect(solo.refresh).toBeUndefined();
  });
  it('lets the host retry a failed solo start without an automatic retry loop', async () => {
    const start = vi.fn(async () => {});
    start.mockRejectedValueOnce(new Error('Connection lost. Retry.'));
    const s = setup({ botIds: new Set(['b1', 'b2', 'b3']), ready: true }, start);
    s.join('b1'); s.join('b2'); s.join('b3'); s.join('human');
    await Promise.resolve();
    expect(s.nodes.get('#start-hint').textContent).toBe('Connection lost. Retry.');
    s.refresh(); expect(start).toHaveBeenCalledTimes(1);
    s.nodes.get('#start').onclick(); expect(start).toHaveBeenCalledTimes(2);
    s.stop();
  });
});
