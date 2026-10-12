import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { hsl, type Pt, type Raster } from '../render/raster.js';
import type { Rng } from '../rng.js';
import type { PuzzleDefinition } from '../types.js';
import { clutter, softBackground } from './common.js';
import { checkInteger, type MathPublic } from './math.js';

export interface DiceSolution {
  readonly value: number;
}

const W = 300;
const H = 150;

const PIPS: Record<number, readonly Pt[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function die(r: Raster, rng: Rng, cx: number, cy: number, size: number, value: number): void {
  const rot = (rng.float(-28, 28) * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const tx = (x: number, y: number): Pt => [cx + x * cos - y * sin, cy + x * sin + y * cos];
  const h = size / 2;
  const corner = size * 0.18;
  const outline: Pt[] = [];
  for (const [ox, oy, a0] of [[h - corner, h - corner, 0], [-h + corner, h - corner, 90], [-h + corner, -h + corner, 180], [h - corner, -h + corner, 270]] as const) {
    for (let k = 0; k <= 6; k += 1) {
      const a = ((a0 + k * 15) * Math.PI) / 180;
      outline.push(tx(ox + Math.cos(a) * corner, oy + Math.sin(a) * corner));
    }
  }
  r.polygon(outline.map(([x, y]) => [x + 2, y + 3] as const), [0, 0, 0], 50);
  r.polygon(outline, hsl(rng.int(0, 360), 0.25, 0.97));
  const pip = hsl(rng.int(0, 360), 0.5, 0.22);
  for (const [px, py] of PIPS[value]!) {
    const [x, y] = tx(px * size * 0.26, py * size * 0.26);
    r.circle(x, y, size * 0.085, pip);
  }
}

/** Dice total: two (or three at level ≥ 1) rotated dice; type the sum of their pips. */
export const dice: PuzzleDefinition<DiceSolution, MathPublic> = {
  type: 'dice',
  view: 'text',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const n = level >= 1 ? 3 : 2;
    const values = Array.from({ length: n }, () => rng.int(1, 7));
    const r = softBackground(rng, W, H);
    clutter(r, rng, 0, 0, W, H, 6);
    const slot = W / n;
    values.forEach((v, i) => die(r, rng, slot * i + slot / 2 + rng.float(-10, 10), H / 2 + rng.float(-14, 14), rng.float(64, 76), v));
    return {
      solution: { value: values.reduce((a, b) => a + b, 0) },
      prompt: prompt('dice', lang),
      publicData: { image: pngDataUrl(r.finish().noise(8, rng)), width: W, height: H },
    };
  },
  check(solution, answer) {
    return checkInteger(solution.value, answer);
  },
};
