import { prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, referenceBox, type GridPublic, type GridSolution } from './grid.js';

const HEADER = 74;

/**
 * Find the shape inside a grid: a reference pictogram is shown in a box above the grid (no name,
 * so it works for people who do not read the prompt language well); select every cell showing it.
 */
export const findShape: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'find-shape',
  view: 'grid',
  minSolveMs: 1200,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const rows = 3;
    const cols = 4;
    const n = rows * cols;
    const pool = [...FAMILIES.shapes, ...FAMILIES.objects] as PictoKind[];
    const target = rng.pick(pool);
    const others = rng.sample(pool.filter((k) => k !== target), level >= 1 ? 5 : 4);
    const count = rng.int(2, 4);
    const cells = rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, count).sort((a, b) => a - b);
    const g = gridCanvas(rng, rows, cols, 66, 66, HEADER);
    referenceBox(g.r, rng, 44, HEADER / 2, 54);
    drawPicto(g.r, target, 44, HEADER / 2, 44, rng.float(-15, 15), { color: hsl(rng.int(0, 360), 0.65, 0.42) });
    // Decorative arrow from the box into the grid.
    const arrow = hsl(rng.int(0, 360), 0.25, 0.55);
    g.r.stroke([[84, HEADER / 2], [g.width - 30, HEADER / 2]], 2.5, arrow, 140).polygon([[g.width - 20, HEADER / 2], [g.width - 32, HEADER / 2 - 7], [g.width - 32, HEADER / 2 + 7]], arrow, 140);
    for (let i = 0; i < n; i += 1) {
      const [x, y] = g.center(i);
      drawPicto(g.r, cells.includes(i) ? target : rng.pick(others), x + rng.float(-5, 5), y + rng.float(-5, 5), rng.float(36, 46), rng.float(-40, 40), {
        color: hsl(rng.int(0, 360), rng.float(0.55, 0.8), rng.float(0.36, 0.48)),
      });
    }
    return {
      solution: { cells, n },
      prompt: prompt('findShape', lang),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(10, rng)), width: g.width, height: g.height, rows, cols, gridTop: HEADER, select: 'many' },
    };
  },
  check: checkGridSolution,
};
