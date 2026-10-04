import './modes.css';
import '../ui/arena-menu.css';
import { menuBackdrop, modeFighters } from '../ui/menu-art';

export function mount(el: HTMLElement) {
  el.innerHTML = `<main class="mode-page arena-menu">${menuBackdrop()}<a class="mode-brand" href="/">DOODLE FFA</a><span class="mode-kicker">DRAW. ROLL. BRAWL.</span><h1>How do you want to play?</h1><p>Draw a weapon. Roll a special. Battle it out.</p><div class="mode-options"><a class="mode-card" href="/solo"><span class="mode-card-label">01 · YOU VS. THE BOTS</span><div class="mode-illustration">${modeFighters()}</div><h2>Single player</h2><p>Scan the QR code with your phone to draw and play against three bots.</p><span class="mode-action">Play solo <span aria-hidden="true">↗</span></span></a><a class="mode-card" href="/screen"><span class="mode-card-label">02 · EVERYONE FOR THEMSELVES</span><div class="mode-illustration">${modeFighters(true)}</div><h2>Multiplayer</h2><p>Open a party room. Friends join on their phones using your QR code or room link.</p><span class="mode-action">Host a party <span aria-hidden="true">↗</span></span></a></div><a class="mode-join" href="/play">Already have a room code? Join a party</a></main>`;
}
