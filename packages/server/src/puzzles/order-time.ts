import { prompt } from '../i18n.js';
import { drawClock } from '../render/clock.js';
import type { PuzzleDefinition } from '../types.js';
import { checkOrder } from './common.js';
import { orderChallenge, tileCanvas, TILE, type OrderPublic, type OrderSolution } from './order.js';

/** Order analogue clocks from the earliest time to the latest (all within one 12-hour cycle). */
export const orderTime: PuzzleDefinition<OrderSolution, OrderPublic> = {
  type: 'order-time',
  view: 'order',
  minSolveMs: 2000,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const n = level >= 2 ? 5 : 4;
    // Hours 1..11 (12 o'clock would be ambiguous as "earliest") at least an hour apart.
    const hours = rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], n).sort((a, b) => a - b);
    const tiles = hours.map((h) => {
      const r = tileCanvas(rng);
      drawClock(r, rng, TILE / 2, TILE / 2, TILE * 0.42, h, rng.int(0, level >= 1 ? 12 : 4) * (level >= 1 ? 5 : 15));
      return r;
    });
    const { solution, publicData } = orderChallenge(rng, tiles);
    return { solution, publicData, prompt: prompt('orderTime', lang) };
  },
  check(solution, answer) {
    return checkOrder(solution.order, answer);
  },
};
