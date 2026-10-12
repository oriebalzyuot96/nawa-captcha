import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { hsl, type Pt, type Raster } from '../render/raster.js';
import type { Rng } from '../rng.js';
import type { PuzzleDefinition } from '../types.js';
import { checkTaps, clutter, drawText, roundPt, scatter, softBackground } from './common.js';

export interface TapsSolution {
  /** Tap targets in the required order. */
  readonly targets: readonly Pt[];
}

/** View `taps`: tap points on one picture in a required order (`count` taps). */
export interface TapsPublic {
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly count: number;
}

export const TAP_RADIUS = 22;

/** A labelled bubble (shared by tap-order and spell). */
export function bubble(r: Raster, rng: Rng, label: string, cx: number, cy: number, radius: number): void {
  const fill = hsl(rng.int(0, 360), 0.55, 0.9);
  r.circle(cx, cy, radius + 2, hsl(rng.int(0, 360), 0.4, 0.45)).circle(cx, cy, radius, fill);
  drawText(r, rng, label, cx, cy, label.length > 1 ? radius * 0.85 : radius, hsl(rng.int(0, 360), 0.6, 0.28), { tilt: 12, halo: fill });
}

const W = 300;
const H = 190;

/** Tap the numbers in ascending order. Positions exist only in the PNG. */
export const tapOrder: PuzzleDefinition<TapsSolution, TapsPublic> = {
  type: 'tap-order',
  view: 'taps',
  minSolveMs: 1500,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const count = level >= 2 ? 5 : 4;
    const values = rng.sample(Array.from({ length: level >= 1 ? 49 : 19 }, (_, i) => i + 1), count).sort((a, b) => a - b);
    const r = softBackground(rng, W, H);
    clutter(r, rng, 0, 0, W, H, 8);
    const spots = scatter(rng, count, { x0: 30, y0: 30, x1: W - 30, y1: H - 30 }, 62);
    values.forEach((v, i) => bubble(r, rng, String(v), spots[i]![0], spots[i]![1], 22));
    return {
      solution: { targets: spots.map(roundPt) },
      prompt: prompt('tapOrder', lang),
      publicData: { image: pngDataUrl(r.finish().noise(8, rng)), width: W, height: H, count },
    };
  },
  check(solution, answer) {
    return checkTaps(solution.targets, answer, { w: W, h: H }, TAP_RADIUS + 4);
  },
};
