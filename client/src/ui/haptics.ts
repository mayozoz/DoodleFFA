// Use real device vibration where available; preserve visual feedback elsewhere.
let edge: HTMLDivElement | null = null;
let edgeTimer: ReturnType<typeof setTimeout> | undefined;

export function haptic(ms = 15) {
  // Browsers require a prior user interaction before vibration is allowed.
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      if (navigator.vibrate(ms)) return;
    } catch {
      // A denied/unsupported vibration must never interrupt the controller.
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
