import { pictoName, prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { ChallengeType, PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

/** @deprecated alias kept for compatibility; icon puzzles now use the generic grid view. */
export type IconsPublic = GridPublic;
export type IconsSolution = GridSolution;

const ROWS = 3;
const COLS = 3;
const CELL = 80;

/**
 * "Select every X" over a 3×3 picture grid, for one pictogram family. Each cell gets a faint ghost
 * of another pictogram, random colour, size, rotation and position jitter.
 */
export function createIconsPuzzle(type: ChallengeType, family: readonly PictoKind[]): PuzzleDefinition<GridSolution, GridPublic> {
  return {
    type,
    view: 'grid',
    minSolveMs: 1200,
    maxAttempts: 1,
    generate({ level, lang, rng }) {
      const n = ROWS * COLS;
      const target = rng.pick(family);
      const others = family.filter((k) => k !== target);
      const count = rng.int(2, level >= 2 ? 6 : 5);
      const cells = rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, count).sort((a, b) => a - b);
      const distractors = rng.sample(others, 4);
      const g = gridCanvas(rng, ROWS, COLS, CELL);
      for (let i = 0; i < n; i += 1) {
        const [x, y] = g.center(i);
        const cx = x + rng.float(-8, 8);
        const cy = y + rng.float(-8, 8);
        drawPicto(g.r, rng.pick(others), cx + rng.float(-14, 14), cy + rng.float(-14, 14), rng.float(30, 46), rng.float(0, 360), { color: hsl(rng.int(0, 360), 0.4, 0.75), silhouette: true, alpha: 90 });
        const kind = cells.includes(i) ? target : rng.pick(distractors);
        drawPicto(g.r, kind, cx, cy, rng.float(44, 58), rng.float(-28, 28), { color: hsl(rng.int(0, 360), rng.float(0.55, 0.85), rng.float(0.35, 0.5)) });
      }
      const name = pictoName(target, lang);
      return {
        solution: { cells, n },
        prompt: prompt('icons', lang, { icon: name }),
        publicData: { image: pngDataUrl(finishGrid(g, ROWS, COLS).finish().noise(10, rng)), width: g.width, height: g.height, rows: ROWS, cols: COLS, gridTop: 0, select: 'many', target: name },
      };
    },
    check(solution, answer) {
      return checkGridSolution(solution, answer);
    },
  };
}

/** Geometric shapes: star, heart, triangle, circle, square, diamond, plus, crescent, hexagon. */
export const icons = createIconsPuzzle('icons', FAMILIES.shapes);
