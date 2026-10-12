import { prompt } from '../i18n.js';
import { drawText } from './common.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl, type RGB } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

const HEADER = 70;

interface Item {
  readonly kind: PictoKind;
  readonly rot: number;
}

const same = (a: Item, b: Item): boolean => a.kind === b.kind && ((a.rot - b.rot) % 360 + 360) % 360 === 0;

/**
 * Pattern / sequence completion: a row shows a repeating pattern (AB, ABC, AAB) or a picture
 * turning a quarter each step; pick the picture that comes next.
 */
export const pattern: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'pattern',
  view: 'grid',
  minSolveMs: 1200,
  maxAttempts: 1,
  generate({ lang, rng }) {
    const rows = 2;
    const cols = 3;
    const n = rows * cols;
    const kinds = rng.sample([...FAMILIES.shapes, ...FAMILIES.objects] as PictoKind[], 5);
    const colors = new Map<PictoKind, RGB>(kinds.map((k) => [k, hsl(rng.int(0, 360), 0.65, 0.42)]));
    const style = rng.pick(['ab', 'abc', 'aab', 'turn'] as const);
    const [a, b, c] = kinds as [PictoKind, PictoKind, PictoKind];
    let seq: Item[];
    let next: Item;
    if (style === 'turn') {
      const kind = rng.pick(['flag', 'key', 'bell', 'umbrella', 'house'] as PictoKind[]);
      colors.set(kind, hsl(rng.int(0, 360), 0.65, 0.42));
      const start = rng.pick([0, 90, 180, 270]);
      seq = [0, 1, 2, 3, 4].map((i) => ({ kind, rot: start + i * 90 }));
      next = { kind, rot: start + 5 * 90 };
    } else {
      const unit = style === 'ab' ? [a, b] : style === 'abc' ? [a, b, c] : [a, a, b];
      const all = Array.from({ length: 6 }, (_, i) => ({ kind: unit[i % unit.length]!, rot: 0 }));
      seq = all.slice(0, 5);
      next = all[5]!;
    }
    // Options: the answer plus plausible distractors (other members of the pattern, other angles).
    const candidates: Item[] =
      style === 'turn'
        ? [0, 90, 180, 270].map((rot) => ({ kind: next.kind, rot })).concat(kinds.slice(0, 3).map((kind) => ({ kind, rot: 0 })))
        : kinds.map((kind) => ({ kind, rot: 0 })).concat([{ kind: next.kind, rot: 90 }]);
    const unique = candidates.filter((x, i) => !same(x, next) && candidates.findIndex((y) => same(x, y)) === i);
    const distractors = rng.shuffle(unique).slice(0, n - 1);
    const answer = rng.int(0, n);
    const options = [...distractors];
    options.splice(answer, 0, next);

    const g = gridCanvas(rng, rows, cols, 88, 80, HEADER);
    const step = g.width / 6;
    seq.forEach((item, i) => drawPicto(g.r, item.kind, step * i + step / 2, HEADER / 2, 34, item.rot, { color: colors.get(item.kind)! }));
    const qx = step * 5 + step / 2;
    g.r.rect(qx - 19, HEADER / 2 - 19, 38, 38, hsl(rng.int(0, 360), 0.4, 0.5)).rect(qx - 16, HEADER / 2 - 16, 32, 32, [255, 255, 255]);
    drawText(g.r, rng, '?', qx, HEADER / 2, 22, [60, 60, 80], { tilt: 4 });
    options.forEach((item, i) => {
      const [x, y] = g.center(i);
      drawPicto(g.r, item.kind, x, y, 48, item.rot, { color: colors.get(item.kind) ?? hsl(rng.int(0, 360), 0.6, 0.45) });
    });
    return {
      solution: { cells: [answer], n },
      prompt: prompt('pattern', lang),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(8, rng)), width: g.width, height: g.height, rows, cols, gridTop: HEADER, select: 'one' },
    };
  },
  check: checkGridSolution,
};
