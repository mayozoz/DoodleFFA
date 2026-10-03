// Use real device vibration where available; preserve visual feedback elsewhere.
let edge: HTMLDivElement | null = null;
let edgeTimer: ReturnType<typeof setTimeout> | undefined;

export function haptic(ms = 15) {
  // Keep the call synchronous with the user's press, as required by browsers.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (navigator.vibrate(ms)) return;
    } catch {
      // A denied/unsupported vibration must never prevent an attack.
    }
  }
  if (!edge) {
    edge = document.createElement('div');
    edge.className = 'edge-flash';
    document.body.appendChild(edge);
  }
  if (edgeTimer !== undefined) clearTimeout(edgeTimer);
  edge.classList.add('on');
  edgeTimer = setTimeout(() => edge?.classList.remove('on'), Math.max(60, ms * 3));
}
