import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { Rng } from '../rng.js';
import type { PuzzleDefinition } from '../types.js';
import { drawText } from './common.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

/** An expression with result `v`, using + or − with small operands. */
function expressionFor(rng: Rng, v: number): string {
  if (rng.next() < 0.5 && v >= 2) {
    const a = rng.int(Math.max(1, v - 12), Math.min(12, v - 1) + 1);
    return `${a}+${v - a}`;
  }
  const b = rng.int(1, 10);
  return `${v + b}-${b}`;
}

/**
 * Math image, compare: six cards each show a small sum or difference (drawn as strokes); select
 * every card whose result is greater than N. No card equals N.
 */
export const mathCompare: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'math-compare',
  view: 'grid',
  minSolveMs: 2000,
  maxAttempts: 1,
  generate({ lang, rng }) {
    const rows = 2;
    const cols = 3;
    const n = rows * cols;
    const threshold = rng.int(8, 15);
    const count = rng.int(1, 5);
    const cells = rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, count).sort((a, b) => a - b);
    const g = gridCanvas(rng, rows, cols, 92, 72);
    for (let i = 0; i < n; i += 1) {
      const above = cells.includes(i);
      const v = above ? rng.int(threshold + 1, threshold + 8) : rng.int(Math.max(1, threshold - 7), threshold);
      const [x, y] = g.center(i);
      g.r.rect(x - 40, y - 26, 80, 52, [255, 255, 255], 170);
      drawText(g.r, rng, expressionFor(rng, v), x, y, 22, hsl(rng.int(0, 360), 0.6, 0.32), { tilt: 10 });
    }
    return {
      solution: { cells, n },
      prompt: prompt('mathCompare', lang, { n: threshold }),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(10, rng)), width: g.width, height: g.height, rows, cols, gridTop: 0, select: 'many' },
    };
  },
  check: checkGridSolution,
};
