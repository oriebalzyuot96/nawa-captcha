import { prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, referenceBox, type GridPublic, type GridSolution } from './grid.js';

const HEADER = 80;

/** Shadow matching: pick the silhouette that has the same outline as the coloured picture. */
export const shadowPick: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'shadow-pick',
  view: 'grid',
  minSolveMs: 900,
  maxAttempts: 1,
  generate({ lang, rng }) {
    const rows = 2;
    const cols = 3;
    const n = rows * cols;
    const pool = [...FAMILIES.objects, 'sun', 'cloud', 'umbrella', 'bolt', 'heart', 'star'] as PictoKind[];
    const kinds = rng.sample(pool, n);
    const answer = rng.int(0, n);
    const target = kinds[answer]!;
    const rot = rng.float(-15, 15);
    const g = gridCanvas(rng, rows, cols, 84, 84, HEADER);
    referenceBox(g.r, rng, g.width / 2, HEADER / 2, 62);
    drawPicto(g.r, target, g.width / 2, HEADER / 2, 52, rot, { color: hsl(rng.int(0, 360), 0.65, 0.45) });
    const shade = hsl(rng.int(200, 260), 0.18, 0.2);
    for (let i = 0; i < n; i += 1) {
      const [x, y] = g.center(i);
      drawPicto(g.r, kinds[i]!, x + rng.float(-5, 5), y + rng.float(-5, 5), rng.float(54, 62), i === answer ? rot + rng.float(-8, 8) : rng.float(-15, 15), { color: shade, silhouette: true });
    }
    return {
      solution: { cells: [answer], n },
      prompt: prompt('shadowPick', lang),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(10, rng)), width: g.width, height: g.height, rows, cols, gridTop: HEADER, select: 'one' },
    };
  },
  check: checkGridSolution,
};
