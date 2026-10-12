import { prompt } from '../i18n.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkOrder, drawText } from './common.js';
import { orderChallenge, tileCanvas, TILE, type OrderPublic, type OrderSolution } from './order.js';

/** Order numbers (drawn as strokes, never as text) ascending or descending. */
export const orderNumbers: PuzzleDefinition<OrderSolution, OrderPublic> = {
  type: 'order-numbers',
  view: 'order',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const n = level >= 2 ? 5 : 4;
    const max = level >= 1 ? 999 : 99;
    const values = new Set<number>();
    while (values.size < n) values.add(rng.int(1, max + 1));
    const descending = rng.next() < 0.5;
    const sorted = [...values].sort((a, b) => (descending ? b - a : a - b));
    const tiles = sorted.map((v) => {
      const r = tileCanvas(rng);
      const text = String(v);
      drawText(r, rng, text, TILE / 2, TILE / 2, text.length >= 3 ? 20 : 26, hsl(rng.int(0, 360), 0.6, 0.32), { tilt: 10 });
      return r;
    });
    const { solution, publicData } = orderChallenge(rng, tiles);
    return { solution, publicData, prompt: prompt(descending ? 'orderNumbersDown' : 'orderNumbersUp', lang) };
  },
  check(solution, answer) {
    return checkOrder(solution.order, answer);
  },
};
