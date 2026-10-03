// Turns a doodle (dark/colored strokes on white) into strokes on transparency, so weapons show
// only the drawn lines — no white box, and outline/glow filters trace the strokes.
//
// Every near-white pixel becomes transparent (also inside closed shapes: "only the lines").
// Anti-aliased edges become partly transparent, and their color is un-blended from white
// so there's no pale fringe.

/** min(r,g,b) at or above this is treated as fully white (paper) */
const PAPER = 235;
/** min(r,g,b) at or below this is fully opaque ink */
const INK = 150;

export function cutoutWhite(source: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const w = source.width, h = source.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(source, 0, 0);
  const img = g.getImageData(0, 0, w, h);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!, gr = px[i + 1]!, b = px[i + 2]!, a0 = px[i + 3]! / 255;
    // How far from white this pixel is, by its lightest channel. A saturated yellow
    // (min channel ~10) still counts as ink; only near-white goes away.
    const m = Math.min(r, gr, b);
    const a = Math.max(0, Math.min(1, (PAPER - m) / (PAPER - INK)));
    if (a <= 0) {
      px[i + 3] = 0;
      continue;
    }
    if (a < 1) {
      // un-blend from white: observed = ink·a + 255·(1−a)
      px[i] = clamp255((r - 255 * (1 - a)) / a);
      px[i + 1] = clamp255((gr - 255 * (1 - a)) / a);
      px[i + 2] = clamp255((b - 255 * (1 - a)) / a);
    }
    px[i + 3] = Math.round(255 * a * a0);
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Fetch/decode any image (URL or PNG bytes) and cut out its white background. */
export async function loadCutout(src: string | Uint8Array): Promise<HTMLCanvasElement> {
  const blob = typeof src === 'string'
    ? await (await fetch(src)).blob()
    : new Blob([src.slice()], { type: 'image/png' });
  const bmp = await createImageBitmap(blob);
  try {
    return cutoutWhite(bmp);
  } finally {
    bmp.close();
  }
}
