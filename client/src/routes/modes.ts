import './modes.css';

export function mount(el: HTMLElement) {
  el.innerHTML = `<main class="mode-page"><a class="mode-brand" href="/">DOODLE FFA</a><h1>How do you want to play?</h1><p>Draw a weapon. Roll a special. Battle it out.</p><div class="mode-options"><a class="mode-card" href="/solo"><span class="mode-symbol" aria-hidden="true">✦</span><h2>Single player</h2><p>Scan the QR code with your phone to draw and play against three bots.</p><span class="mode-action">Play solo →</span></a><a class="mode-card" href="/screen"><span class="mode-symbol" aria-hidden="true">✺</span><h2>Multiplayer</h2><p>Open a party room. Friends join on their phones using your QR code or room link.</p><span class="mode-action">Host a party →</span></a></div><a class="mode-join" href="/play">Already have a room code? Join a party</a></main>`;
}
