import { prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { invalid, ok, wrong } from '../types.js';
import { isRecord } from './common.js';
import { finishGrid, gridCanvas, type GridPublic } from './grid.js';

export interface PairsSolution {
  /** Cell index pairs, each sorted ascending. */
  readonly pairs: readonly (readonly [number, number])[];
  readonly n: number;
}

/** View `pairs`: the grid view's picture, but cells are linked two at a time. */
export type PairsPublic = Omit<GridPublic, 'select' | 'locked' | 'target'>;

/**
 * Match pairs: every pictogram appears exactly twice (at level ≥ 1 in different colours, so the
 * match is by shape). Answer: the list of pairs. A blind guess of 4 pairs succeeds 1 time in 105.
 */
export const pairs: PuzzleDefinition<PairsSolution, PairsPublic> = {
  type: 'pairs',
  view: 'pairs',
  minSolveMs: 2000,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const rows = level >= 2 ? 3 : 2;
    const cols = 4;
    const n = rows * cols;
    const kinds = rng.sample([...FAMILIES.shapes, ...FAMILIES.objects, ...FAMILIES.weather.slice(0, 6)] as PictoKind[], n / 2);
    const layout = rng.shuffle([...kinds, ...kinds]);
    const colorOf = new Map(kinds.map((k) => [k, hsl(rng.int(0, 360), 0.65, 0.42)]));
    const g = gridCanvas(rng, rows, cols, 72);
    layout.forEach((kind, i) => {
      const [x, y] = g.center(i);
      const color = level >= 1 ? hsl(rng.int(0, 360), 0.65, 0.42) : colorOf.get(kind)!;
      drawPicto(g.r, kind, x + rng.float(-5, 5), y + rng.float(-5, 5), rng.float(40, 50), rng.float(-25, 25), { color });
    });
    const solution: Array<[number, number]> = kinds.map((k) => {
      const a = layout.indexOf(k);
      const b = layout.indexOf(k, a + 1);
      return [a, b];
    });
    return {
      solution: { pairs: solution, n },
      prompt: prompt('pairs', lang),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(10, rng)), width: g.width, height: g.height, rows, cols, gridTop: 0 },
    };
  },
  check(solution, answer) {
    if (!isRecord(answer) || !Array.isArray(answer['pairs'])) return invalid('pairs');
    const given = answer['pairs'] as unknown[];
    if (given.length !== solution.pairs.length) return given.length > solution.n / 2 ? invalid('pairs') : wrong('count');
    const seen = new Set<number>();
    const keys = new Set<string>();
    for (const p of given) {
      if (!Array.isArray(p) || p.length !== 2) return invalid('pair');
      const [a, b] = p as unknown[];
      if (!Number.isInteger(a) || !Number.isInteger(b) || (a as number) < 0 || (b as number) < 0 || (a as number) >= solution.n || (b as number) >= solution.n || a === b) return invalid('pair');
      if (seen.has(a as number) || seen.has(b as number)) return invalid('reused');
      seen.add(a as number).add(b as number);
      keys.add(`${Math.min(a as number, b as number)}-${Math.max(a as number, b as number)}`);
    }
    return solution.pairs.every(([a, b]) => keys.has(`${a}-${b}`)) ? ok : wrong();
  },
};
