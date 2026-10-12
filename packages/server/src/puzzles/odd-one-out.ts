import { prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

/** Every cell shows the same pictogram (in varied colours, sizes and angles) except one. */
export const oddOneOut: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'odd-one-out',
  view: 'grid',
  minSolveMs: 900,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const side = level >= 2 ? 4 : 3;
    const n = side * side;
    const cell = side === 4 ? 64 : 80;
    const family = rng.pick([FAMILIES.shapes, FAMILIES.objects, FAMILIES.weather]) as readonly PictoKind[];
    const [common, odd] = rng.sample(family, 2) as [PictoKind, PictoKind];
    const oddCell = rng.int(0, n);
    const g = gridCanvas(rng, side, side, cell);
    // Colours are shared across the grid so colour alone never singles out the odd one.
    const palette = Array.from({ length: 3 }, () => hsl(rng.int(0, 360), rng.float(0.55, 0.8), rng.float(0.35, 0.48)));
    for (let i = 0; i < n; i += 1) {
      const [x, y] = g.center(i);
      drawPicto(g.r, i === oddCell ? odd : common, x + rng.float(-6, 6), y + rng.float(-6, 6), cell * rng.float(0.5, 0.68), rng.float(-35, 35), { color: rng.pick(palette) });
    }
    return {
      solution: { cells: [oddCell], n },
      prompt: prompt('oddOneOut', lang),
      publicData: { image: pngDataUrl(finishGrid(g, side, side).finish().noise(10, rng)), width: g.width, height: g.height, rows: side, cols: side, gridTop: 0, select: 'one' },
    };
  },
  check(solution, answer) {
    return checkGridSolution(solution, answer);
  },
};
