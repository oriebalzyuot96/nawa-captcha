import { base64, deflate } from '../primitives.js';
import type { Raster } from './raster.js';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = (CRC_TABLE[(c ^ (buf[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * Encodes a 1x raster as PNG (RGB when fully opaque, RGBA otherwise). Deflate comes from the
 * platform layer (node:zlib on servers); no third-party code. Per-row filter picked by the usual
 * minimum-sum heuristic.
 */
export function encodePng(img: Raster): Uint8Array {
  if (img.ss !== 1) throw new Error('encodePng expects a finished (1x) raster');
  const { pw: w, ph: h, data } = img;
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 255) {
      opaque = false;
      break;
    }
  }
  const bpp = opaque ? 3 : 4;
  const stride = w * bpp;
  const raw = new Uint8Array((stride + 1) * h);
  let prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  const candidates = [new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride)];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const s = (y * w + x) * 4;
      const d = x * bpp;
      cur[d] = data[s] ?? 0;
      cur[d + 1] = data[s + 1] ?? 0;
      cur[d + 2] = data[s + 2] ?? 0;
      if (bpp === 4) cur[d + 3] = data[s + 3] ?? 0;
    }
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < 4; f += 1) {
      const out = candidates[f] as Uint8Array;
      let sum = 0;
      for (let i = 0; i < stride; i += 1) {
        const a = i >= bpp ? (cur[i - bpp] ?? 0) : 0;
        const b = prev[i] ?? 0;
        const v = cur[i] ?? 0;
        const filtered = f === 0 ? v : f === 1 ? v - a : f === 2 ? v - b : v - ((a + b) >> 1);
        out[i] = filtered & 0xff;
        const signed = out[i] ?? 0;
        sum += signed < 128 ? signed : 256 - signed;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    raw[y * (stride + 1)] = best;
    raw.set(candidates[best] as Uint8Array, y * (stride + 1) + 1);
    prev = Uint8Array.from(cur);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return concat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflate(raw)), chunk('IEND', new Uint8Array(0))]);
}

export function pngDataUrl(img: Raster): string {
  return `data:image/png;base64,${base64(encodePng(img))}`;
}

/** SVG markup as a data: URL (displayed via <img>, so it cannot run script). */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${base64(new TextEncoder().encode(svg))}`;
}
