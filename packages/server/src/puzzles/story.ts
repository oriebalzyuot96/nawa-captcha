import { prompt, STORIES, type StoryKind } from '../i18n.js';
import { hsl, type Raster } from '../render/raster.js';
import type { Rng } from '../rng.js';
import type { PuzzleDefinition } from '../types.js';
import { checkOrder } from './common.js';
import { orderChallenge, tileCanvas, TILE, type OrderPublic, type OrderSolution } from './order.js';

const T = TILE;
const GROUND = T - 12;

type Stage = (r: Raster, rng: Rng, t: number) => void;

/** Stage drawers; `t` runs 0..1 from the first picture of the story to the last. */
const STAGES: Record<StoryKind, Stage> = {
  plant(r, rng, t) {
    const soil = hsl(28, 0.45, 0.32);
    r.rect(6, GROUND, T - 12, 8, soil);
    const stem = hsl(115, 0.5, 0.35);
    if (t < 0.2) {
      r.circle(T / 2, GROUND - 3, 5, hsl(30, 0.5, 0.45));
      return;
    }
    const h = 10 + t * 40;
    r.stroke([[T / 2, GROUND], [T / 2 + rng.float(-1, 1), GROUND - h]], 3.2, stem);
    const leaves = t < 0.5 ? 1 : 2;
    for (let i = 0; i < leaves; i += 1) {
      const y = GROUND - h * (0.35 + i * 0.3);
      r.polygon([[T / 2, y], [T / 2 - 13, y - 7], [T / 2 - 4, y + 3]], stem).polygon([[T / 2, y], [T / 2 + 13, y - 7], [T / 2 + 4, y + 3]], stem);
    }
    if (t > 0.9) {
      const top = GROUND - h;
      const petal = hsl(rng.int(0, 360), 0.75, 0.6);
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        r.circle(T / 2 + Math.cos(a) * 7, top + Math.sin(a) * 7, 5.5, petal);
      }
      r.circle(T / 2, top, 4.5, hsl(48, 0.95, 0.55));
    }
  },
  candle(r, rng, t) {
    const h = 48 - t * 36;
    const wax = hsl(rng.int(0, 360), 0.45, 0.78);
    r.rect(T / 2 - 9, GROUND - h, 18, h, wax).rect(T / 2 - 15, GROUND, 30, 4, hsl(40, 0.2, 0.5));
    r.stroke([[T / 2, GROUND - h], [T / 2, GROUND - h - 5]], 1.6, [40, 40, 40]);
    r.circle(T / 2, GROUND - h - 10, 5, hsl(35, 0.95, 0.55)).polygon([[T / 2 - 4, GROUND - h - 10], [T / 2, GROUND - h - 21], [T / 2 + 4, GROUND - h - 10]], hsl(35, 0.95, 0.55));
    r.circle(T / 2, GROUND - h - 9, 2.2, hsl(55, 1, 0.8));
  },
  glass(r, _rng, t) {
    const top = 14;
    const glass = hsl(200, 0.2, 0.55);
    const water = hsl(205, 0.8, 0.55);
    const level = (GROUND - top - 4) * t;
    if (level > 0) r.polygon([[T / 2 - 15, GROUND - level], [T / 2 + 15, GROUND - level], [T / 2 + 13, GROUND], [T / 2 - 13, GROUND]], water);
    r.stroke([[T / 2 - 17, top], [T / 2 - 13, GROUND], [T / 2 + 13, GROUND], [T / 2 + 17, top]], 2.6, glass);
  },
  egg(r, rng, t) {
    const shell = hsl(40, 0.4, 0.88);
    const chick = hsl(50, 0.95, 0.58);
    const stage = Math.round(t * 3);
    const ring = (cx: number, cy: number, rx: number, ry: number): Array<readonly [number, number]> =>
      Array.from({ length: 36 }, (_, i) => [cx + Math.cos((i / 36) * Math.PI * 2) * rx, cy + Math.sin((i / 36) * Math.PI * 2) * ry] as const);
    if (stage <= 1) {
      r.polygon(ring(T / 2, GROUND - 22, 16, 21), shell);
      if (stage === 1) r.stroke([[T / 2 - 14, GROUND - 26], [T / 2 - 7, GROUND - 20], [T / 2 - 1, GROUND - 28], [T / 2 + 6, GROUND - 20], [T / 2 + 14, GROUND - 26]], 2, [90, 80, 70]);
      return;
    }
    if (stage === 2) {
      r.circle(T / 2, GROUND - 30, 12, chick).circle(T / 2 + 4, GROUND - 33, 1.8, [30, 30, 30]).polygon([[T / 2 + 11, GROUND - 31], [T / 2 + 17, GROUND - 29], [T / 2 + 11, GROUND - 27]], hsl(25, 0.9, 0.5));
      r.polygon([...ring(T / 2, GROUND - 14, 17, 14).filter(([, y]) => y >= GROUND - 16), [T / 2 - 17, GROUND - 16], [T / 2 - 9, GROUND - 22], [T / 2, GROUND - 16], [T / 2 + 9, GROUND - 22], [T / 2 + 17, GROUND - 16]], shell);
      return;
    }
    r.circle(T / 2 - 2, GROUND - 13, 13, chick).circle(T / 2 + 6, GROUND - 31, 10, chick);
    r.circle(T / 2 + 9, GROUND - 33, 1.8, [30, 30, 30]).polygon([[T / 2 + 15, GROUND - 32], [T / 2 + 21, GROUND - 30], [T / 2 + 15, GROUND - 28]], hsl(25, 0.9, 0.5));
    r.polygon([[T / 2 - 22, GROUND], [T / 2 - 16, GROUND - 7], [T / 2 - 10, GROUND]], shell).polygon([[T / 2 + 12, GROUND], [T / 2 + 18, GROUND - 6], [T / 2 + 24, GROUND]], shell);
  },
  battery(r, _rng, t) {
    const body = hsl(220, 0.12, 0.3);
    r.rect(T / 2 - 22, 22, 44, 30, body).rect(T / 2 - 19, 25, 38, 24, [250, 250, 250]).rect(T / 2 + 22, 31, 5, 12, body);
    const bars = Math.round(t * 4);
    const fill = bars <= 1 ? hsl(5, 0.75, 0.5) : bars <= 2 ? hsl(40, 0.9, 0.5) : hsl(130, 0.6, 0.4);
    for (let i = 0; i < bars; i += 1) r.rect(T / 2 - 17 + i * 9.2, 27, 7.4, 20, fill);
  },
};

/** Pictogram story ordering: put 3-4 pictures of a short process in the order they happen. */
export const story: PuzzleDefinition<OrderSolution, OrderPublic> = {
  type: 'story',
  view: 'order',
  minSolveMs: 1800,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const kind = rng.pick(Object.keys(STAGES) as StoryKind[]);
    const n = kind === 'egg' || level >= 1 ? 4 : 3;
    const tiles = Array.from({ length: n }, (_, i) => {
      const r = tileCanvas(rng);
      STAGES[kind](r, rng, i / (n - 1));
      return r;
    });
    const { solution, publicData } = orderChallenge(rng, tiles);
    return { solution, publicData, prompt: prompt('story', lang, { story: STORIES[kind][lang] }) };
  },
  check(solution, answer) {
    return checkOrder(solution.order, answer);
  },
};
