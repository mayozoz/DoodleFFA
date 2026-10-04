// Debug overlay — OFF unless turned on, so players never see it (design pillar: the middle is
// invisible). Turn on with any of:
//   ?debug         for this visit only
//   ?debug=0       explicitly disabled
//
// Shows: errors (client exceptions, failed reducer calls, connection drops, server-side
// debug_event rows), and what we're waiting on (phase timers, overdue phases, generation steps
// in flight, per-player weapon status, stalled ticks).

function resolveFlag(): boolean {
  const q = new URLSearchParams(location.search).get('debug');
  return q !== null && q !== '0' && q !== 'false';
}

export const DEBUG = resolveFlag();

export type Level = 'ok' | 'wait' | 'warn' | 'error';
export interface Item { level: Level; text: string }

interface LoggedError { at: number; source: string; message: string }

const COLORS: Record<Level, string> = { ok: '#7ee787', wait: '#f2cc60', warn: '#ffa657', error: '#ff7b72' };

class DebugOverlay {
  private errors: LoggedError[] = [];
  private inflight = new Map<number, { name: string; start: number }>();
  private providers: (() => Item[])[] = [];
  private nextId = 1;
  private el: HTMLDivElement | null = null;
  private collapsed = false;

  /** Record an error. Cheap no-op when debug is off. */
  error(source: string, message: unknown) {
    if (!DEBUG) return;
    const msg = message instanceof Error ? message.message : typeof message === 'string' ? message : JSON.stringify(message);
    console.warn(`[debug] ${source}: ${msg}`);
    this.errors.unshift({ at: Date.now(), source, message: msg });
    this.errors.length = Math.min(this.errors.length, 30);
  }

  /** Show `name` as "waiting" until the promise settles; record it if it fails. Returns the promise. */
  track<T>(name: string, p: Promise<T>): Promise<T> {
    if (!DEBUG) return p;
    const id = this.nextId++;
    this.inflight.set(id, { name, start: Date.now() });
    p.then(
      () => this.inflight.delete(id),
      (e: unknown) => { this.inflight.delete(id); this.error(name, e); },
    );
    return p;
  }

  /** Add a function that describes current state each refresh (phase, waits, statuses). */
  addProvider(fn: () => Item[]): () => void {
    this.providers.push(fn);
    return () => { this.providers = this.providers.filter((f) => f !== fn); };
  }

  mount() {
    if (!DEBUG || this.el) return;
    addEventListener('error', (e) => this.error('window', e.error ?? e.message));
    addEventListener('unhandledrejection', (e) => this.error('promise', e.reason));
    const el = (this.el = document.createElement('div'));
    Object.assign(el.style, {
      position: 'fixed', left: '8px', bottom: '8px', zIndex: '9999', maxWidth: 'min(460px, 92vw)',
      maxHeight: '45vh', overflow: 'auto', padding: '8px 10px', borderRadius: '10px',
      background: 'rgba(10,10,14,0.88)', color: '#e6edf3', font: '11px/1.45 ui-monospace, Menlo, monospace',
      pointerEvents: 'auto', userSelect: 'text', touchAction: 'auto', whiteSpace: 'pre-wrap',
    } satisfies Partial<CSSStyleDeclaration>);
    el.onclick = () => { this.collapsed = !this.collapsed; this.render(); };
    document.body.appendChild(el);
    setInterval(() => this.render(), 250);
    this.render();
  }

  private render() {
    if (!this.el) return;
    const now = Date.now();
    if (this.collapsed) {
      this.el.innerHTML = `<b style="color:${COLORS.warn}">DEBUG</b> ${this.errors.length} err · ${this.inflight.size} running (tap)`;
      return;
    }
    const lines: string[] = [`<b style="color:${COLORS.warn}">DEBUG</b> <span style="opacity:.6">tap to collapse · ?debug=0 to turn off</span>`];
    for (const fn of this.providers) {
      try {
        for (const it of fn()) lines.push(`<span style="color:${COLORS[it.level]}">●</span> ${esc(it.text)}`);
      } catch (e) {
        lines.push(`<span style="color:${COLORS.error}">● provider failed: ${esc(String(e))}</span>`);
      }
    }
    for (const f of this.inflight.values()) {
      const s = (now - f.start) / 1000;
      lines.push(`<span style="color:${s > 10 ? COLORS.warn : COLORS.wait}">◌</span> running ${esc(f.name)} · ${s.toFixed(1)}s`);
    }
    if (this.errors.length) {
      lines.push('<b>errors</b> (newest first)');
      for (const e of this.errors.slice(0, 12)) {
        const ago = Math.round((now - e.at) / 1000);
        lines.push(`<span style="color:${COLORS.error}">✖</span> ${ago}s ago · ${esc(e.source)}: ${esc(e.message)}`);
      }
    }
    this.el.innerHTML = lines.join('\n');
  }
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export const debug = new DebugOverlay();
