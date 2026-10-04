import type { Phase } from '@doodle/spec';
import type { DbConnection } from '../../module_bindings';
import { debug } from '../../debug';

// Shared-screen announcer. Asks the server (gen_commentary) for one voiced line at a time and
// plays it. Big moments (KO, final two, winner) jump the queue; routine play-by-play only fills
// silence. Muting stops requests entirely, so a muted screen costs nothing.

type Kind = 'intro' | 'color' | 'ko' | 'final' | 'winner';
const PRIORITY: Record<Kind, number> = { color: 0, intro: 1, final: 2, ko: 2, winner: 3 };
const COLOR_EVERY_MS = 7000;
/** a KO line that took longer than this to arrive is old news */
const STALE_MS = 4500;
const MUTE_KEY = 'doodle.mute';

interface Want { kind: Kind; a: string; b: string; at: number }

export function mountCommentator(conn: DbConnection, code: string): { setPhase(p: Phase): void; dispose(): void } {
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* default on */ }
  let busy = false;          // request in flight or audio playing
  let pending: Want | null = null;
  let phase: Phase = 'lobby';
  let lastLineAt = 0;
  let finalCalled = false;
  let audio: HTMLAudioElement | null = null;

  // ── mute / enable-sound toggle (top-left) ──
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    position: 'fixed', left: '12px', top: '12px', zIndex: '60', padding: '6px 12px', borderRadius: '999px',
    background: '#000a', color: '#fff', font: '700 13px system-ui', border: '1px solid #ffffff40', pointerEvents: 'auto',
  } satisfies Partial<CSSStyleDeclaration>);
  const label = () => { btn.textContent = muted ? '🔇 Commentary off' : '🔊 Commentary on'; };
  btn.onclick = () => {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
    if (muted) audio?.pause();
    label();
  };
  label();
  document.body.appendChild(btn);

  const want = (kind: Kind, a = '', b = '') => {
    if (muted) return;
    const w: Want = { kind, a, b, at: Date.now() };
    if (!busy) return void say(w);
    // keep only the most important waiting line
    if (!pending || PRIORITY[kind] >= PRIORITY[pending.kind]) pending = w;
  };

  const say = async (w: Want) => {
    busy = true;
    try {
      const bytes = await debug.track(`commentary ${w.kind}`, conn.procedures.genCommentary({ kind: w.kind, a: w.a, b: w.b }));
      const late = Date.now() - w.at;
      if (muted || !bytes.length || (w.kind === 'ko' && late > STALE_MS)) return;
      const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'audio/mpeg' }));
      audio = new Audio(url);
      audio.volume = 0.95;
      lastLineAt = Date.now();
      await new Promise<void>((resolve) => {
        audio!.onended = audio!.onerror = () => resolve();
        audio!.play().catch((e: unknown) => {
          // autoplay blocked (screen reloaded, no click yet): the toggle doubles as "enable sound"
          debug.error('commentary', `audio blocked: ${String(e)} — click the commentary button`);
          resolve();
        });
      });
      URL.revokeObjectURL(url);
    } catch (e) {
      debug.error('commentary', e);
    } finally {
      busy = false;
      const next = pending;
      pending = null;
      if (next && !(next.kind === 'ko' && Date.now() - next.at > STALE_MS)) void say(next);
    }
  };

  // ── triggers ──
  // KO: the death event's owner is the victim; the killer is whoever hit near them just before.
  const recentHits: { x: number; y: number; owner: string; at: number }[] = [];
  const onFx = (_c: unknown, ev: { roomCode: string; type: string; x: number; y: number; owner: { toHexString(): string } }) => {
    if (ev.roomCode !== code || phase !== 'battle') return;
    const now = Date.now();
    if (ev.type === 'hit') {
      recentHits.push({ x: ev.x, y: ev.y, owner: ev.owner.toHexString(), at: now });
      while (recentHits.length > 40) recentHits.shift();
    } else if (ev.type === 'death') {
      const victim = ev.owner.toHexString();
      const killer = [...recentHits].reverse().find((h) => now - h.at < 1500 && h.owner !== victim && Math.hypot(h.x - ev.x, h.y - ev.y) < 2.5);
      const alive = [...conn.db.fighter.iter()].filter((f) => f.roomCode === code && f.hp > 0).length;
      if (alive === 2 && !finalCalled) { finalCalled = true; want('final'); }
      else if (alive > 2) want('ko', killer?.owner ?? '', victim);
    }
  };
  conn.db.fxEvent.onInsert(onFx);

  const color = setInterval(() => {
    if (phase === 'battle' && !busy && Date.now() - lastLineAt > COLOR_EVERY_MS) want('color');
  }, 1000);

  return {
    setPhase(p) {
      phase = p;
      if (p === 'reveal') { finalCalled = false; want('intro'); }
      if (p === 'results') {
        const winner = conn.db.room.code.find(code)?.winner ?? '';
        want('winner', winner);
      }
      if (p === 'draw' || p === 'lobby') { pending = null; audio?.pause(); }
    },
    dispose() {
      clearInterval(color);
      conn.db.fxEvent.removeOnInsert(onFx);
      audio?.pause();
      btn.remove();
    },
  };
}
