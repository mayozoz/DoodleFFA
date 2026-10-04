import './draw.css';
import { extractFeatures, type Drawing, type Stroke } from '@doodle/spec';
import { mountCountdown } from '../../ui/countdown';
import { debug } from '../../debug';
import type { View } from './types';

const COLORS = ['#111111', '#ff3b3b', '#2f6bff', '#22c55e'];
const SIZE = 512; // canvas resolution sent to the server
/** M3: flip on to kick off the hidden generation procedures after submit. */
export const RUN_GENERATION = false;

/** 20 s doodle canvas: 4 colors + undo, border in player color. Submits when the phase ends. */
export const drawView: View = (ctx) => {
  ctx.el.innerHTML = `
    <div class="center" style="gap:8px">
      <div id="cd"></div>
      <canvas id="c" width="${SIZE}" height="${SIZE}"
        style="width:min(92vw,70dvh);aspect-ratio:1;background:#fff;border:6px solid var(--player);border-radius:16px;touch-action:none"></canvas>
      <div style="display:flex;gap:8px">
        ${COLORS.map((c, i) => `<button class="drawing-color" data-c="${c}" aria-label="${['Black', 'Red', 'Blue', 'Green'][i]} drawing color" aria-pressed="${i === 0}" style="background:${c};width:44px;height:44px;padding:0"></button>`).join('')}
        <button id="undo">↶</button>
      </div>
    </div>`;
  const room = () => ctx.conn.db.room.code.find(ctx.roomCode);
  const stopCd = mountCountdown(ctx.el.querySelector('#cd')!, () => room()?.phaseEndsAt);
  const canvas = ctx.el.querySelector<HTMLCanvasElement>('#c')!;
  const g = canvas.getContext('2d')!;
  const drawing: Drawing = { width: SIZE, height: SIZE, strokes: [] };
  let color = COLORS[0]!;
  let cur: Stroke | null = null;
  let t0 = 0;

  const redraw = () => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, SIZE, SIZE);
    g.lineCap = g.lineJoin = 'round';
    for (const s of drawing.strokes) {
      g.strokeStyle = s.color;
      g.lineWidth = s.width;
      g.beginPath();
      s.points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }
  };
  const pos = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
  };
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    t0 = performance.now();
    cur = { color, width: 10, points: [[...pos(e), 0]] };
    drawing.strokes.push(cur);
  };
  canvas.onpointermove = (e) => {
    if (!cur) return;
    cur.points.push([...pos(e), performance.now() - t0]);
    redraw();
  };
  canvas.onpointerup = () => { cur = null; };
  const colorButtons = ctx.el.querySelectorAll<HTMLButtonElement>('[data-c]');
  colorButtons.forEach((button) => {
    button.onclick = () => {
      color = button.dataset.c!;
      colorButtons.forEach((swatch) => swatch.setAttribute('aria-pressed', String(swatch === button)));
    };
  });
  ctx.el.querySelector<HTMLButtonElement>('#undo')!.onclick = () => { drawing.strokes.pop(); redraw(); };
  redraw();

  let submitted = false;
  const submit = async () => {
    if (submitted) return;
    submitted = true;
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    const png = new Uint8Array(await (blob ?? new Blob()).arrayBuffer());
    await debug.track('submit_drawing', ctx.conn.reducers.submitDrawing({
      strokes: JSON.stringify(drawing),
      png,
      features: JSON.stringify(extractFeatures(drawing)),
    }));
    if (RUN_GENERATION) {
      // Fire-and-forget, in parallel. Results land in the weapon row; nothing is shown to players
      // (only the ?debug overlay lists them while they run).
      void debug.track('gen_spec', ctx.conn.procedures.genSpec({})).catch(() => {});
      void debug.track('gen_sprite', ctx.conn.procedures.genSprite({})).catch(() => {});
      void debug.track('gen_sfx', ctx.conn.procedures.genSfx({})).catch(() => {});
    }
  };

  // Phase changing away from draw unmounts this view → submit on the way out.
  return () => { stopCd(); void submit(); };
};
