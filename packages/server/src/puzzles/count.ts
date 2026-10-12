import { pictoName, prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { scatter, softBackground } from './common.js';
import { checkInteger, type MathPublic } from './math.js';

export interface CountSolution {
  readonly value: number;
}

const W = 300;
const H = 170;

/** Count the objects: how many of one pictogram are in a picture that also holds other ones. */
export const count: PuzzleDefinition<CountSolution, MathPublic> = {
  type: 'count',
  view: 'text',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const pool = [...FAMILIES.shapes, ...FAMILIES.objects] as PictoKind[];
    const target = rng.pick(pool);
    const others = rng.sample(pool.filter((k) => k !== target), 3);
    const value = rng.int(3, level >= 1 ? 10 : 8);
    const distractors = rng.int(3, level >= 1 ? 8 : 6);
    const total = value + distractors;
    const spots = scatter(rng, total, { x0: 22, y0: 22, x1: W - 22, y1: H - 22 }, 40);
    const r = softBackground(rng, W, H);
    spots.forEach(([x, y], i) => {
      drawPicto(r, i < value ? target : rng.pick(others), x, y, rng.float(32, 40), rng.float(-35, 35), { color: hsl(rng.int(0, 360), rng.float(0.55, 0.8), rng.float(0.36, 0.48)) });
    });
    const name = pictoName(target, lang);
    return {
      solution: { value },
      prompt: prompt('count', lang, { icon: name }),
      publicData: { image: pngDataUrl(r.finish().noise(10, rng)), width: W, height: H },
    };
  },
  check(solution, answer) {
    return checkInteger(solution.value, answer);
  },
};
