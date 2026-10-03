// Keep controllers from zooming. iOS Safari ignores `user-scalable=no` (since iOS 10), so a fast
// double-tap on the attack button zooms the page and the button slides off-screen. Android
// Chrome honors the viewport tag, so these guards are mostly for iPhone/iPad.

let installed = false;

export function preventControllerZoom() {
  if (installed) return;
  installed = true;
  const opts = { passive: false } as const;

  // 1. Double-tap zoom: swallow a second touchend that lands within 350 ms of the previous one.
  //    The attack button fires on pointerdown, so mashing still registers every press.
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = e.timeStamp;
    if (now - lastEnd < 350) e.preventDefault();
    lastEnd = now;
  }, opts);
  document.addEventListener('dblclick', (e) => e.preventDefault(), opts);

  // 2. Pinch zoom: iOS gesture events + any multi-finger move.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), opts);
  }
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, opts);

  // 3. If the page still ends up zoomed (e.g. zoomed before joining), say how to fix it, since
  //    a page can't reset Safari's zoom by itself.
  const vv = window.visualViewport;
  if (vv) {
    const hint = document.createElement('div');
    hint.textContent = 'Pinch out to zoom back';
    Object.assign(hint.style, {
      position: 'fixed', left: '50%', top: '12px', translate: '-50%', zIndex: '9998', display: 'none',
      padding: '8px 14px', borderRadius: '999px', background: '#000c', color: '#fff', font: '700 14px system-ui',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(hint);
    const check = () => { hint.style.display = vv.scale > 1.05 ? 'block' : 'none'; };
    vv.addEventListener('resize', check);
    check();
  }
}
