import { prompt } from '../i18n.js';
import { glyphStrokes } from '../render/glyphs.js';
import { pngDataUrl } from '../render/png.js';
import { hsl, type Pt } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

/** Letters whose mirror image is clearly "backwards" and never equals a rotation of the letter. */
const CHIRAL = ['F', 'G', 'J', 'L', 'P', 'R', 'N', 'K'] as const;

/**
 * "Which one is different?" by handedness: the same letter is shown turned to different angles,
 * and exactly one copy is mirrored. Colour, size and angle never give it away.
 */
export const oddRotation: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'odd-rotation',
  view: 'grid',
  minSolveMs: 1200,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const rows = level >= 2 ? 3 : 2;
    const cols = 3;
    const n = rows * cols;
    const cell = 84;
    const letter = rng.pick(CHIRAL);
    const odd = rng.int(0, n);
    const g = gridCanvas(rng, rows, cols, cell);
    const color = hsl(rng.int(0, 360), 0.65, 0.38);
    const spread = level >= 1 ? 80 : 50;
    for (let i = 0; i < n; i += 1) {
      const [cx, cy] = g.center(i);
      const size = cell * rng.float(0.5, 0.6);
      const rot = (rng.float(-spread, spread) * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const mirror = i === odd ? -1 : 1;
      const strokes = glyphStrokes(letter, { x: 0, y: 0, size }, () => rng.next()).map((s) =>
        s.map(([x, y]): Pt => [cx + x * mirror * cos - y * sin, cy + x * mirror * sin + y * cos]),
      );
      for (const s of strokes) g.r.stroke(s, size * 0.16 + 3, [255, 255, 255]);
      for (const s of strokes) g.r.stroke(s, size * 0.16, color);
    }
    return {
      solution: { cells: [odd], n },
      prompt: prompt('oddRotation', lang),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(10, rng)), width: g.width, height: g.height, rows, cols, gridTop: 0, select: 'one' },
    };
  },
  check: checkGridSolution,
};
