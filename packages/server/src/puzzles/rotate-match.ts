import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { type PuzzleDefinition } from '../types.js';
import { landscape } from './common.js';
import { checkRotation, ROTATE_SIZE, ROTATE_TRACK, type RotatePublic, type RotateSolution } from './rotate.js';

const INNER = 0.58;

/**
 * Rotate-to-align: a picture is split into a fixed outer ring and a turned inner disc. The person
 * turns the disc until the picture is continuous again.
 */
export const rotateMatch: PuzzleDefinition<RotateSolution, RotatePublic> = {
  type: 'rotate-match',
  view: 'rotate',
  minSolveMs: 500,
  maxAttempts: 2,
  generate({ lang, rng }) {
    const shown = rng.int(40, 321);
    const scene = landscape(rng, ROTATE_SIZE, ROTATE_SIZE, { kind: 'both' }).finish();
    const radius = (ROTATE_SIZE * INNER) / 2;
    const c = ROTATE_SIZE / 2;
    // Outer ring: the scene with the centre punched out (transparent) and a thin rim.
    const base = scene.crop(0, 0, ROTATE_SIZE, ROTATE_SIZE, (x, y) => Math.hypot(x - c, y - c) > radius + 1).noise(8, rng);
    const disc = scene.crop(0, 0, ROTATE_SIZE, ROTATE_SIZE, (x, y) => Math.hypot(x - c, y - c) <= radius).noise(8, rng).rotate(shown, radius);
    return {
      solution: { angle: (360 - shown) % 360 },
      prompt: prompt('rotateMatch', lang),
      publicData: { size: ROTATE_SIZE, image: pngDataUrl(disc), track: ROTATE_TRACK, base: pngDataUrl(base), inner: INNER },
    };
  },
  check(solution, answer, { level }) {
    return checkRotation(solution.angle, answer, level);
  },
};
