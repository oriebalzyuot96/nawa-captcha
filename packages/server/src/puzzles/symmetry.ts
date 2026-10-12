import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

const COLS = 6;
const HALF = COLS / 2;
const CELL = 44;

/**
 * Symmetry completion: the left half of a pixel picture is given (locked cells); select the cells
 * of the right half so the picture mirrors across the dashed axis.
 */
export const symmetry: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'symmetry',
  view: 'grid',
  minSolveMs: 2000,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const rows = level >= 1 ? 5 : 4;
    const n = rows * COLS;
    let filled: number[] = [];
    while (filled.length < 3 || filled.length > rows * 2) {
      filled = [];
      for (let r = 0; r < rows; r += 1) for (let c = 0; c < HALF; c += 1) if (rng.next() < 0.42) filled.push(r * COLS + c);
    }
    const cells = filled.map((i) => Math.floor(i / COLS) * COLS + (COLS - 1 - (i % COLS))).sort((a, b) => a - b);
    const locked = Array.from({ length: n }, (_, i) => i).filter((i) => i % COLS < HALF);
    const g = gridCanvas(rng, rows, COLS, CELL);
    const color = hsl(rng.int(0, 360), 0.6, 0.45);
    g.r.rect(0, 0, HALF * CELL, rows * CELL, [255, 255, 255], 70);
    for (const i of filled) {
      const [x, y] = g.center(i);
      g.r.rect(x - CELL / 2 + 4, y - CELL / 2 + 4, CELL - 8, CELL - 8, color);
    }
    finishGrid(g, rows, COLS);
    const axis = hsl(rng.int(0, 360), 0.5, 0.35);
    for (let y = 2; y < rows * CELL; y += 12) g.r.rect(HALF * CELL - 1.5, y, 3, 7, axis);
    return {
      solution: { cells, n },
      prompt: prompt('symmetry', lang),
      publicData: { image: pngDataUrl(g.r.finish().noise(6, rng)), width: g.width, height: g.height, rows, cols: COLS, gridTop: 0, select: 'many', locked },
    };
  },
  check: checkGridSolution,
};
