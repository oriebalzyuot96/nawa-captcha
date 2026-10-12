import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { Raster, hsl } from '../render/raster.js';
import type { Rng } from '../rng.js';
import type { PuzzleDefinition } from '../types.js';
import { checkOrder } from './common.js';

export interface OrderSolution {
  readonly order: readonly string[];
}

export interface OrderTile {
  /** Random per-challenge id; carries no information about the tile's rank. */
  readonly id: string;
  readonly image: string;
}

/** View `order`: tiles (separate PNGs with random ids) the person drags into order. */
export interface OrderPublic {
  readonly tiles: readonly OrderTile[];
  readonly tileSize: number;
}

export const TILE = 72;

/** A blank tile with a soft gradient. */
export function tileCanvas(rng: Rng): Raster {
  return new Raster(TILE, TILE, 2).gradient(hsl(rng.int(0, 360), 0.3, 0.93), hsl(rng.int(0, 360), 0.3, 0.84), rng.int(0, 360));
}

/**
 * Turns tiles given in the correct order into a sealed id order plus a shuffled public list that is
 * never already in the correct order.
 */
export function orderChallenge(rng: Rng, ranked: readonly Raster[]): { solution: OrderSolution; publicData: OrderPublic } {
  const tiles = ranked.map((r) => ({ id: rng.id(6), image: pngDataUrl(r.finish().noise(10, rng)) }));
  let shuffled = rng.shuffle([...tiles]);
  if (shuffled.every((t, i) => t.id === tiles[i]!.id)) shuffled = [...shuffled.slice(1), shuffled[0]!];
  return { solution: { order: tiles.map((t) => t.id) }, publicData: { tiles: shuffled, tileSize: TILE } };
}

function dotsTile(rng: Rng, count: number): Raster {
  const r = tileCanvas(rng);
  const placed: Array<[number, number, number]> = [];
  const color = hsl(rng.int(0, 360), 0.6, 0.4);
  for (let tries = 0; placed.length < count && tries < 500; tries += 1) {
    const rad = rng.float(4, 7.5);
    const x = rng.float(rad + 4, TILE - rad - 4);
    const y = rng.float(rad + 4, TILE - rad - 4);
    if (placed.every(([px, py, pr]) => Math.hypot(px - x, py - y) > pr + rad + 3)) placed.push([x, y, rad]);
  }
  for (const [x, y, rad] of placed) r.circle(x, y, rad, color);
  return r;
}

function barTile(rng: Rng, height: number): Raster {
  const r = tileCanvas(rng);
  const w = rng.float(16, 26);
  const x = rng.float(8, TILE - w - 8);
  r.rect(x, TILE - 6 - height, w, height, hsl(rng.int(0, 360), 0.6, 0.42));
  r.rect(4, TILE - 6, TILE - 8, 1.5, [90, 90, 90]);
  return r;
}

/** Order tiles by dot count or by bar height. */
export const order: PuzzleDefinition<OrderSolution, OrderPublic> = {
  type: 'order',
  view: 'order',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const n = level >= 2 ? 5 : 4;
    const variant = rng.pick(['dots', 'bars'] as const);
    const ranks = variant === 'dots' ? rng.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], n).sort((a, b) => a - b) : rng.sample([10, 19, 28, 37, 46, 55, 62], n).sort((a, b) => a - b);
    const { solution, publicData } = orderChallenge(rng, ranks.map((v) => (variant === 'dots' ? dotsTile(rng, v) : barTile(rng, v))));
    return { solution, publicData, prompt: prompt(variant === 'dots' ? 'orderDots' : 'orderBars', lang) };
  },
  check(solution, answer) {
    return checkOrder(solution.order, answer);
  },
};
