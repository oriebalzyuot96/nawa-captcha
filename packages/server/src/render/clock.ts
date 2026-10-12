import type { Rng } from '../rng.js';
import { hsl, type Pt, type Raster } from './raster.js';

/** Draws an analogue clock face showing h:m (12-hour) centred at (cx, cy). */
export function drawClock(r: Raster, rng: Rng, cx: number, cy: number, radius: number, h: number, m: number): void {
  const rim = hsl(rng.int(0, 360), 0.45, 0.38);
  r.circle(cx, cy, radius + 2, [255, 255, 255], 220).circle(cx, cy, radius, rim).circle(cx, cy, radius - radius * 0.09, [252, 252, 250]);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const major = i % 3 === 0;
    const r0 = radius * (major ? 0.68 : 0.76);
    const r1 = radius * 0.86;
    r.stroke([[cx + Math.sin(a) * r0, cy - Math.cos(a) * r0], [cx + Math.sin(a) * r1, cy - Math.cos(a) * r1]], major ? radius * 0.075 : radius * 0.04, [60, 64, 74]);
  }
  const hand = (frac: number, len: number, width: number, color: readonly [number, number, number]): void => {
    const a = frac * Math.PI * 2;
    const tail: Pt = [cx - Math.sin(a) * radius * 0.1, cy + Math.cos(a) * radius * 0.1];
    r.stroke([tail, [cx + Math.sin(a) * len, cy - Math.cos(a) * len]], width, color);
  };
  hand(((h % 12) + m / 60) / 12, radius * 0.48, radius * 0.12, [30, 32, 40]);
  hand(m / 60, radius * 0.74, radius * 0.07, hsl(rng.int(0, 360), 0.6, 0.38));
  r.circle(cx, cy, radius * 0.08, [30, 32, 40]);
}

export const formatTime = (h: number, m: number): string => `${h}:${String(m).padStart(2, '0')}`;
