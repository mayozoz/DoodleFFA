import './style.css';

// Tiny path router — one app, two player-facing views plus the dev playground.
const routes: Record<string, () => Promise<{ mount(el: HTMLElement): void }>> = {
  '/play': () => import('./routes/play'),
  '/screen': () => import('./routes/screen'),
  '/dev/weapons': () => import('./routes/dev-weapons'),
};

const el = document.getElementById('app')!;
const load = routes[location.pathname.replace(/\/$/, '')];
if (load) {
  void load().then((m) => m.mount(el));
} else {
  el.innerHTML = `<div class="center"><div>
    <h1>Doodle Arena</h1>
    <p><a href="/screen">Shared screen</a> · <a href="/play">Controller</a> · <a href="/dev/weapons">Weapon playground</a></p>
  </div></div>`;
}
