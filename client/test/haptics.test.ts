import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDamageHaptics } from '../src/ui/haptics';
function setup(vibrate: unknown = vi.fn(() => true)) {
  const classes = new Set<string>();
  const edge = { className: '', setAttribute: vi.fn(), remove: vi.fn(), classList: {
    add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c),
  } };
  const doc = Object.assign(new EventTarget(), { hidden: false, createElement: () => edge });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { vibrate });
  let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now);
  const h = createDamageHaptics({ appendChild: vi.fn() } as unknown as HTMLElement);
  return { h, doc, classes, edge, now: (n: number) => { now = n; } };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('damage haptics', () => {
  it('only pulses on a hit, limits bursts, and cancels on hide and dispose', () => {
    vi.useFakeTimers(); const vibrate = vi.fn(() => true); const s = setup(vibrate);
    expect(vibrate).not.toHaveBeenCalled();
    s.h.hit(); s.h.hit(); expect(vibrate).toHaveBeenCalledTimes(1); expect(vibrate).toHaveBeenLastCalledWith([70, 35, 100]);
    s.now(221); s.h.hit(); expect(vibrate).toHaveBeenCalledTimes(2);
    s.doc.hidden = true; s.doc.dispatchEvent(new Event('visibilitychange'));
    expect(vibrate).toHaveBeenLastCalledWith(0); expect(s.classes.has('on')).toBe(false);
    s.now(500); s.h.hit(); expect(vibrate).toHaveBeenCalledTimes(3);
    s.doc.hidden = false; s.h.dispose(); s.h.hit();
    expect(s.edge.remove).toHaveBeenCalledOnce(); expect(vibrate).toHaveBeenCalledTimes(3);
  });
  it.each(['missing', 'rejected', 'throws'])('keeps a temporary visual cue when vibration is %s', (mode) => {
    vi.useFakeTimers();
    const vibrate = mode === 'missing' ? undefined : mode === 'rejected' ? () => false : () => { throw Error('blocked'); };
    const s = setup(vibrate); if (mode === 'missing') vi.stubGlobal('navigator', {});
    s.h.hit(); expect(s.classes.has('on')).toBe(true);
    vi.advanceTimersByTime(220); expect(s.classes.has('on')).toBe(false);
    s.h.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
});
