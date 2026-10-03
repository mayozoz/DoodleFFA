import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('device haptics', () => {
  const classes = new Set<string>();
  const append = vi.fn();
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); classes.clear(); append.mockClear();
    vi.stubGlobal('document', {
      createElement: () => ({ className: '', classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } }),
      body: { appendChild: append },
    });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('requests physical vibration with the requested duration', async () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    const { haptic } = await import('../src/ui/haptics');
    haptic(50);
    expect(vibrate).toHaveBeenCalledWith(50);
    expect(append).not.toHaveBeenCalled();
  });
  it.each(['missing', 'denied', 'throws'])('uses visual feedback when vibration is %s', async (mode) => {
    vi.stubGlobal('navigator', mode === 'missing' ? {} : { vibrate: () => { if (mode === 'throws') throw new Error('unavailable'); return false; } });
    const { haptic } = await import('../src/ui/haptics');
    expect(() => haptic(50)).not.toThrow();
    expect(classes.has('on')).toBe(true);
    vi.advanceTimersByTime(150);
    expect(classes.has('on')).toBe(false);
  });
  it('keeps fallback feedback active after repeated presses', async () => {
    vi.stubGlobal('navigator', {});
    const { haptic } = await import('../src/ui/haptics');
    haptic(50); vi.advanceTimersByTime(100); haptic(50); vi.advanceTimersByTime(50);
    expect(classes.has('on')).toBe(true);
    vi.advanceTimersByTime(100);
    expect(classes.has('on')).toBe(false);
    expect(append).toHaveBeenCalledTimes(1);
  });
});
