import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ joined: undefined as any, conn: undefined as any, views: [] as string[], cleanupJoin: vi.fn() }));
vi.mock('../src/net/connection', () => ({ connect: async () => ({ conn: state.conn, identity: { toHexString: () => '1'.padStart(64, '0') } }) }));
vi.mock('../src/ui/no-zoom', () => ({ preventControllerZoom: () => {} }));
vi.mock('../src/ui/theme', () => ({ applyPlayerTheme: () => {} }));
vi.mock('../src/net/clock', () => ({ syncFromPhaseStart: () => {} }));
vi.mock('../src/audio/sfx', () => ({ enableAudio: () => {} }));
vi.mock('../src/routes/play/audio', () => ({ ControllerAudio: class { sync() {} } }));
vi.mock('../src/routes/play/debug-status', () => ({ mountPlayDebug: () => {} }));
vi.mock('../src/routes/play/join', () => ({ joinView: (_ctx: unknown, joined: any) => { state.joined = joined; return state.cleanupJoin; } }));
vi.mock('../src/routes/play/waiting', () => ({ waitingView: () => () => { state.views.push('lobby'); return () => {}; } }));
vi.mock('../src/routes/play/draw', () => ({ drawView: () => { state.views.push('draw'); return () => {}; } }));
vi.mock('../src/routes/play/drop', () => ({ dropView: () => () => {} }));
vi.mock('../src/routes/play/battle', () => ({ battleView: () => () => {} }));
vi.mock('../src/routes/play/results', () => ({ resultsView: () => () => {} }));
vi.mock('../src/routes/play/reveal', () => ({ revealView: () => () => {} }));
import { mount } from '../src/routes/play';

let applied: () => void, failed: () => void, updated: (c: unknown, old: unknown, r: any) => void;
let room: any;
const unsubscribe = vi.fn();
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('window', globalThis);
  state.views.length = 0; state.cleanupJoin.mockClear(); unsubscribe.mockClear();
  room = { code: 'TEST', phase: 'lobby', phaseStartedAt: {} };
  const builder = { onApplied: (fn: any) => { applied = fn; return builder; }, onError: (fn: any) => { failed = fn; return builder; }, subscribe: () => ({ unsubscribe }) };
  state.conn = { subscriptionBuilder: () => builder, db: {
    room: { code: { find: () => room }, onUpdate: (fn: any) => { updated = fn; } }, player: { onInsert: () => {} },
  } };
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('controller joining', () => {
  it('opens drawing after a joined multiplayer room advances from lobby', async () => {
    await mount({ innerHTML: '' } as HTMLElement);
    const joining = state.joined('TEST');
    expect(state.views).toEqual([]);
    applied(); await joining;
    expect(state.views).toEqual(['lobby']);
    room.phase = 'draw'; updated({}, {}, room);
    expect(state.views).toEqual(['lobby', 'draw']);
  });
  it('opens drawing if solo auto-starts before the subscription finishes', async () => {
    await mount({ innerHTML: '' } as HTMLElement);
    const joining = state.joined('TEST');
    room.phase = 'draw'; updated({}, {}, room);
    expect(state.views).toEqual([]);
    applied(); await joining;
    expect(state.views).toEqual(['draw']);
  });
  it('keeps the join form usable when subscriptions fail, and allows retry', async () => {
    await mount({ innerHTML: '' } as HTMLElement);
    const joining = state.joined('TEST');
    failed(); await expect(joining).rejects.toThrow('Could not load the room');
    expect(state.cleanupJoin).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    const retry = state.joined('TEST'); applied(); await retry;
    expect(state.cleanupJoin).toHaveBeenCalledTimes(1);
  });
  it('times out a stuck subscription and ignores its late response', async () => {
    await mount({ innerHTML: '' } as HTMLElement);
    const joining = state.joined('TEST');
    const check = expect(joining).rejects.toThrow('The room did not load');
    await vi.advanceTimersByTimeAsync(10000); await check;
    applied(); expect(state.views).toEqual([]);
    expect(state.cleanupJoin).not.toHaveBeenCalled();
  });
});
