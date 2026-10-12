import { pictoName, prompt } from '../i18n.js';
import { drawPicto, UPRIGHT_KINDS } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import { type PuzzleDefinition } from '../types.js';
import { clutter, ink, softBackground } from './common.js';
import { checkRotation, ROTATE_SIZE, ROTATE_TRACK, type RotatePublic, type RotateSolution } from './rotate.js';

/** Rotate a single everyday object (house, tree, bell, cup, umbrella, flag, apple, car) upright. */
export const rotateObject: PuzzleDefinition<RotateSolution, RotatePublic> = {
  type: 'rotate-object',
  view: 'rotate',
  minSolveMs: 500,
  maxAttempts: 2,
  generate({ lang, rng }) {
    const kind = rng.pick(UPRIGHT_KINDS);
    const shown = rng.int(35, 326);
    const r = softBackground(rng, ROTATE_SIZE, ROTATE_SIZE);
    clutter(r, rng, 0, 0, ROTATE_SIZE, ROTATE_SIZE, 5);
    // A ground line makes "up" unambiguous even for symmetric objects.
    r.rect(18, ROTATE_SIZE * 0.78, ROTATE_SIZE - 36, 5, hsl(rng.int(80, 140), 0.45, 0.38));
    drawPicto(r, kind, ROTATE_SIZE / 2, ROTATE_SIZE * 0.5, ROTATE_SIZE * 0.56, 0, { color: ink(rng) });
    const image = r.finish().noise(8, rng).rotate(shown, ROTATE_SIZE / 2);
    return {
      solution: { angle: (360 - shown) % 360 },
      prompt: prompt('rotateObject', lang, { thing: pictoName(kind, lang) }),
      publicData: { size: ROTATE_SIZE, image: pngDataUrl(image), track: ROTATE_TRACK },
    };
  },
  check(solution, answer, { level }) {
    return checkRotation(solution.angle, answer, level);
  },
};
