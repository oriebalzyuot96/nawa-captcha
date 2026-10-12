import { pictoName, prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

/** Compare sizes: select the largest (or, at random, the smallest) of nine copies of a pictogram. */
export const biggest: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'biggest',
  view: 'grid',
  minSolveMs: 900,
  maxAttempts: 1,
  generate({ lang, rng }) {
    const side = 3;
    const n = side * side;
    const cell = 80;
    const kind = rng.pick([...FAMILIES.shapes, ...FAMILIES.objects] as PictoKind[]);
    const smallest = rng.next() < 0.5;
    const answer = rng.int(0, n);
    // The answer differs from every other size by at least ~25%, so it is clear to people.
    const sizes = Array.from({ length: n }, (_, i) => {
      if (i === answer) return smallest ? rng.float(0.26, 0.32) : rng.float(0.86, 0.94);
      return smallest ? rng.float(0.42, 0.8) : rng.float(0.36, 0.68);
    });
    const g = gridCanvas(rng, side, side, cell);
    const color = hsl(rng.int(0, 360), 0.65, 0.42);
    for (let i = 0; i < n; i += 1) {
      const [x, y] = g.center(i);
      drawPicto(g.r, kind, x, y, cell * sizes[i]!, rng.float(-25, 25), { color: rng.next() < 0.5 ? color : hsl(rng.int(0, 360), 0.6, 0.42) });
    }
    const name = pictoName(kind, lang);
    return {
      solution: { cells: [answer], n },
      prompt: prompt(smallest ? 'smallest' : 'biggest', lang, { icon: name }),
      publicData: { image: pngDataUrl(finishGrid(g, side, side).finish().noise(10, rng)), width: g.width, height: g.height, rows: side, cols: side, gridTop: 0, select: 'one', target: name },
    };
  },
  check: checkGridSolution,
};
