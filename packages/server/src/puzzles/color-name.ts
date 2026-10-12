import { COLOR_NAMES, prompt, type ColorName } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { hsl, type Raster, type RGB } from '../render/raster.js';
import type { Rng } from '../rng.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

const COLORS: Record<ColorName, readonly [number, number, number]> = {
  red: [2, 0.78, 0.5],
  blue: [214, 0.78, 0.5],
  green: [128, 0.6, 0.38],
  yellow: [47, 0.95, 0.55],
  purple: [276, 0.55, 0.52],
};

/**
 * Every colour also carries its own pattern (dots, stripes, cross, ring, zigzag), and the prompt
 * names both, so the puzzle does not depend on colour vision alone (WCAG 1.4.1).
 */
function drawSwatch(r: Raster, rng: Rng, name: ColorName, cx: number, cy: number, rad: number): void {
  const [h, s, l] = COLORS[name];
  const fill: RGB = hsl((h + rng.float(-5, 5) + 360) % 360, s, l + rng.float(-0.04, 0.04));
  const mark: RGB = [255, 255, 255];
  r.circle(cx, cy, rad + 2, [255, 255, 255], 200).circle(cx, cy, rad, fill);
  const k = rad * 0.62;
  switch (name) {
    case 'red':
      for (const [dx, dy] of [[0, 0], [-0.55, -0.35], [0.55, -0.35], [-0.55, 0.38], [0.55, 0.38]] as const) r.circle(cx + dx * k, cy + dy * k, rad * 0.12, mark);
      break;
    case 'blue':
      for (const dy of [-0.5, 0, 0.5]) {
        const half = Math.sqrt(1 - (dy * 0.8) ** 2) * rad * 0.72;
        r.stroke([[cx - half, cy + dy * k], [cx + half, cy + dy * k]], rad * 0.13, mark);
      }
      break;
    case 'green':
      r.stroke([[cx - k, cy], [cx + k, cy]], rad * 0.18, mark).stroke([[cx, cy - k], [cx, cy + k]], rad * 0.18, mark);
      break;
    case 'yellow':
      r.circle(cx, cy, rad * 0.5, mark).circle(cx, cy, rad * 0.34, fill);
      break;
    case 'purple':
      r.stroke([[cx - k, cy + k * 0.2], [cx - k * 0.5, cy - k * 0.3], [cx, cy + k * 0.2], [cx + k * 0.5, cy - k * 0.3], [cx + k, cy + k * 0.2]], rad * 0.14, mark);
      break;
  }
}

/** Select every swatch of the named colour (with its named pattern as a non-colour cue). */
export const colorName: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'color-name',
  view: 'grid',
  minSolveMs: 1000,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const rows = 3;
    const cols = level >= 2 ? 4 : 3;
    const n = rows * cols;
    const names = Object.keys(COLORS) as ColorName[];
    const target = rng.pick(names);
    const count = rng.int(2, Math.min(5, n - 2) + 1);
    const cells = rng.shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, count).sort((a, b) => a - b);
    const others = names.filter((c) => c !== target);
    const g = gridCanvas(rng, rows, cols, 78);
    for (let i = 0; i < n; i += 1) {
      const [x, y] = g.center(i);
      drawSwatch(g.r, rng, cells.includes(i) ? target : rng.pick(others), x + rng.float(-6, 6), y + rng.float(-6, 6), rng.float(22, 30));
    }
    const c = COLOR_NAMES[target];
    return {
      solution: { cells, n },
      prompt: prompt('colorName', lang, { color: c[lang], pattern: c.pattern[lang] }),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(8, rng)), width: g.width, height: g.height, rows, cols, gridTop: 0, select: 'many', target: c[lang] },
    };
  },
  check: checkGridSolution,
};
