import '../play/battle-controls.css'; // same sword-button styles as the real phone controller
import { abilityIcon } from '../../ui/ability-icons';

/**
 * "How to play" for the shared-screen lobby: a clone of the phone battle controller (held
 * sideways) that walks through the controls left → right. Each step highlights its control,
 * plays a tiny demo, shows a caption long enough to read, then fades out before the next.
 * Loops while players join. Purely visual — no game state.
 */

interface Step { target: 'stick' | 'hp' | 'atk' | 'ring' | 'special'; title: string; text: string }

// Left → right across the phone: stick (left half), HP (top center), button (right), its ring.
const STEPS: Step[] = [
  { target: 'stick', title: 'Move', text: 'Drag anywhere on the left half of your phone.' },
  { target: 'hp', title: 'Health', text: 'Your bar. Stay inside the circle — the storm outside hurts!' },
  { target: 'atk', title: 'Attack', text: 'Tap the sword. Your weapon aims at the nearest enemy for you.' },
  { target: 'ring', title: 'Recharge', text: 'The ring refills between attacks. Tap early and it fires the moment it’s ready.' },
  { target: 'special', title: 'Special ability', text: 'Tap the smaller button below the sword to use your special. You get two uses per battle.' },
];

const HOLD_MS = 3600;  // caption fully visible — long enough to read from across the room
const FADE_MS = 450;
const GAP_MS = 250;    // beat between steps
const LOOP_PAUSE_MS = 1200;

export function mountTutorial(host: HTMLElement): () => void {
  const el = document.createElement('div');
  el.className = 'tutorial';
  el.innerHTML = `
    <div class="tutorial-title">How to play</div>
    <div class="phone" aria-hidden="true">
      <div class="phone-screen">
        <div class="t-hp" data-t="hp"><div></div></div>
        <div class="t-stick" data-t="stick">
          <div class="t-nipple"><div class="t-knob"></div></div>
          <div class="t-finger"></div>
        </div>
        <div class="t-attack">
          <div class="battle-attack-frame" data-t="atk">
            <div class="battle-sword-button t-sword">
              <svg class="battle-sword" viewBox="0 0 48 48">
                <path d="m19 28 5 5L39 18l2-11-11 2z" fill="currentColor"/>
                <path d="m23 29 11-11" fill="none" stroke="#14121f" stroke-width="2" opacity=".25" stroke-linecap="round"/>
                <path d="m15 25 13 13M12 36l8-8M9 39l3-3" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <svg class="battle-sword-cooldown" viewBox="0 0 100 100" data-t="ring">
              <circle class="t-ring" cx="50" cy="50" r="47" fill="none" stroke="#fff" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0"/>
            </svg>
          </div>
          <div class="battle-special t-special" data-t="special">
            <span class="battle-special-art">${abilityIcon('flash', false)}</span>
            <span class="battle-special-status">2/2</span>
          </div>
        </div>
      </div>
    </div>
    <div class="tutorial-caption"><b></b><span></span></div>
    <div class="tutorial-dots">${STEPS.map(() => '<i></i>').join('')}</div>`;
  host.appendChild(el);

  const caption = el.querySelector<HTMLDivElement>('.tutorial-caption')!;
  const dots = [...el.querySelectorAll<HTMLElement>('.tutorial-dots i')];
  const parts: Record<string, HTMLElement> = Object.fromEntries([...el.querySelectorAll<HTMLElement>('[data-t]')].map((p) => [p.dataset.t!, p]));

  let timers: number[] = [];
  const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)); };

  const show = (i: number) => {
    const s = STEPS[i]!;
    el.dataset.step = s.target; // CSS dims the rest + runs this step's demo
    dots.forEach((d, j) => d.classList.toggle('on', j === i));
    caption.querySelector('b')!.textContent = s.title;
    caption.querySelector('span')!.textContent = s.text;
    for (const [k, p] of Object.entries(parts)) p.classList.toggle('t-focus', k === s.target);
    caption.classList.add('in');
    later(HOLD_MS, () => caption.classList.remove('in'));
    later(HOLD_MS + FADE_MS, () => {
      el.dataset.step = '';
      for (const p of Object.values(parts)) p.classList.remove('t-focus');
    });
    const next = i + 1;
    later(HOLD_MS + FADE_MS + (next < STEPS.length ? GAP_MS : LOOP_PAUSE_MS), () => show(next % STEPS.length));
  };
  later(400, () => show(0));

  return () => { timers.forEach(clearTimeout); timers = []; el.remove(); };
}
