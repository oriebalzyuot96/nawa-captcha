import { pick, randFloat, randInt, randomId, sample, shuffle } from '../crypto.js';
import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { Raster, hsl } from '../render/raster.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { isRecord } from './common.js';

export interface OrderSolution {
  readonly order: readonly string[];
}

export interface OrderTile {
  /** Random per-challenge id; carries no information about the tile's rank. */
  readonly id: string;
  readonly image: string;
}

export interface OrderPublic {
  readonly tiles: readonly OrderTile[];
  readonly tileSize: number;
}

const T = 72;

function dotsTile(count: number): Raster {
  const r = new Raster(T, T, 2);
  r.gradient(hsl(randInt(0, 360), 0.3, 0.92), hsl(randInt(0, 360), 0.3, 0.84), randInt(0, 360));
  const placed: Array<[number, number, number]> = [];
  const color = hsl(randInt(0, 360), 0.6, 0.4);
  for (let tries = 0; placed.length < count && tries < 500; tries += 1) {
    const rad = randFloat(4, 7.5);
    const x = randFloat(rad + 4, T - rad - 4);
    const y = randFloat(rad + 4, T - rad - 4);
    if (placed.every(([px, py, pr]) => Math.hypot(px - x, py - y) > pr + rad + 3)) placed.push([x, y, rad]);
  }
  for (const [x, y, rad] of placed) r.circle(x, y, rad, color);
  return r;
}

function barTile(height: number): Raster {
  const r = new Raster(T, T, 2);
  r.gradient(hsl(randInt(0, 360), 0.3, 0.92), hsl(randInt(0, 360), 0.3, 0.84), 90);
  const w = randFloat(16, 26);
  const x = randFloat(8, T - w - 8);
  r.rect(x, T - 6 - height, w, height, hsl(randInt(0, 360), 0.6, 0.42));
  r.rect(4, T - 6, T - 8, 1.5, [90, 90, 90]);
  return r;
}

export const order: PuzzleDefinition<OrderSolution, OrderPublic> = {
  type: 'order',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang }) {
    const n = level >= 2 ? 5 : 4;
    const variant = pick(['dots', 'bars'] as const);
    const ranks =
      variant === 'dots'
        ? sample([1, 2, 3, 4, 5, 6, 7, 8, 9], n).sort((a, b) => a - b)
        : sample([10, 19, 28, 37, 46, 55, 62], n).sort((a, b) => a - b);
    const ranked = ranks.map((v) => ({
      id: randomId(6),
      image: pngDataUrl((variant === 'dots' ? dotsTile(v) : barTile(v)).finish().noise(10)),
    }));
    return {
      solution: { order: ranked.map((t) => t.id) },
      prompt: prompt(variant === 'dots' ? 'orderDots' : 'orderBars', lang),
      publicData: { tiles: shuffle([...ranked]), tileSize: T },
    };
  },
  check(solution, answer) {
    if (!isRecord(answer) || !Array.isArray(answer['order'])) return invalid('order');
    const given = answer['order'] as unknown[];
    if (given.length !== solution.order.length || !given.every((v) => typeof v === 'string' && v.length <= 16)) return invalid('order');
    return given.every((v, i) => v === solution.order[i]) ? ok : wrong();
  },
};
