// Browsers with the Vibration API get a brief double pulse. iOS Safari has no
// automatic vibration API; its switch haptics require a user gesture, so damage
// gets a visual cue instead. Never queue damage for a later touch/attack.
const DAMAGE_PATTERN = [70, 35, 100];
const MIN_INTERVAL_MS = 220;

export function createDamageHaptics(container: HTMLElement) {
  const edge = document.createElement('div');
  edge.className = 'edge-flash';
  edge.setAttribute('aria-hidden', 'true');
  container.appendChild(edge);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastHit = -Infinity;
  let vibrating = false;
  let disposed = false;

  const stop = () => {
    clearTimeout(timer);
    edge.classList.remove('on');
    if (vibrating && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(0); } catch { /* unsupported/blocked */ }
    }
    vibrating = false;
  };
  const onVisibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', stop);
  window.addEventListener('blur', stop);

  return {
    hit() {
      if (disposed || document.hidden) return;
      const now = performance.now();
      // Multi-projectile hits in one burst should not restart a continuous buzz.
      if (now - lastHit < MIN_INTERVAL_MS) return;
      lastHit = now;
      edge.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => edge.classList.remove('on'), MIN_INTERVAL_MS);
      if (typeof navigator.vibrate === 'function') {
        try { vibrating = navigator.vibrate(DAMAGE_PATTERN); } catch { /* visual cue remains */ }
      }
    },
    dispose() {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('blur', stop);
      edge.remove();
    },
  };
}
