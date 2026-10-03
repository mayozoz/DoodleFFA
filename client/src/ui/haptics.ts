// Android: navigator.vibrate. iOS Safari has no vibration API → flash the screen edge instead.

const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
let edge: HTMLDivElement | null = null;

export function haptic(ms = 15) {
  if (canVibrate) {
    navigator.vibrate(ms);
    return;
  }
  if (!edge) {
    edge = document.createElement('div');
    edge.className = 'edge-flash';
    document.body.appendChild(edge);
  }
  edge.classList.add('on');
  setTimeout(() => edge?.classList.remove('on'), Math.max(60, ms * 3));
}
