import { prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkOrder } from './common.js';
import { orderChallenge, tileCanvas, TILE, type OrderPublic, type OrderSolution } from './order.js';

/** Stack / order by size: the same pictogram at clearly different sizes, smallest to largest. */
export const orderSize: PuzzleDefinition<OrderSolution, OrderPublic> = {
  type: 'order-size',
  view: 'order',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const n = level >= 2 ? 5 : 4;
    const kind = rng.pick([...FAMILIES.shapes, ...FAMILIES.objects] as PictoKind[]);
    // Sizes at least 14% of the tile apart so the order is obvious to people.
    const sizes = rng.sample([0.24, 0.38, 0.52, 0.66, 0.8, 0.92], n).sort((a, b) => a - b);
    const color = hsl(rng.int(0, 360), 0.62, 0.42);
    const tiles = sizes.map((s) => {
      const r = tileCanvas(rng);
      drawPicto(r, kind, TILE / 2 + rng.float(-3, 3), TILE / 2 + rng.float(-3, 3), TILE * s * rng.float(0.95, 1.03), rng.float(-30, 30), { color });
      return r;
    });
    const { solution, publicData } = orderChallenge(rng, tiles);
    return { solution, publicData, prompt: prompt('orderSize', lang) };
  },
  check(solution, answer) {
    return checkOrder(solution.order, answer);
  },
};
