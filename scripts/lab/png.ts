import { deflateSync } from 'node:zlib';
import type { Drawing } from '../../packages/spec/src';

// Node-side stand-in for the phone's <canvas>: rasterize strokes onto white, encode as PNG.
// Close enough to what the controller sends for prompt testing.

export function rasterize(d: Drawing): Uint8Array {
  const { width: w, height: h } = d;
  const px = new Uint8Array(w * h * 4).fill(255);
  for (const s of d.strokes) {
    const n = parseInt(s.color.slice(1), 16);
    const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const r = s.width / 2;
    const stamp = (cx: number, cy: number) => {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
          const i = (y * w + x) * 4;
          px[i] = rgb[0]!; px[i + 1] = rgb[1]!; px[i + 2] = rgb[2]!;
        }
      }
    };
    for (let i = 0; i < s.points.length; i++) {
      const [x1, y1] = s.points[i]!;
      const [x0, y0] = s.points[Math.max(0, i - 1)]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, r / 2)));
      for (let k = 0; k <= steps; k++) stamp(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps);
    }
  }
  return encodePng(px, w, h);
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}
