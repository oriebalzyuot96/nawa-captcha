import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { checkDrag, finiteIn, isRecord, landscape } from './common.js';

export interface RotateSolution {
  /** The clockwise rotation the user must apply to make the picture upright. */
  readonly angle: number;
}

/**
 * View `rotate`: a round picture turned with a slider track. When `base` is present the picture is
 * an inner disc (`inner` = its diameter relative to `size`) drawn over a static `base` image.
 */
export interface RotatePublic {
  readonly size: number;
  readonly image: string;
  /** Virtual length of the rotation track in trail coordinates; full track = 360°. */
  readonly track: number;
  readonly base?: string;
  readonly inner?: number;
}

export const ROTATE_SIZE = 160;
export const ROTATE_TRACK = 300;

/** Shared check for every rotate-view puzzle. */
export function checkRotation(solutionAngle: number, answer: unknown, level: number): ReturnType<PuzzleDefinition['check']> {
  if (!isRecord(answer) || !finiteIn(answer['angle'], 0, 360)) return invalid('angle');
  const angle = answer['angle'];
  const drag = checkDrag(answer['interaction'], { w: ROTATE_TRACK, h: 60 }, (angle / 360) * ROTATE_TRACK, 10);
  if (!drag.ok) return drag;
  let diff = Math.abs(angle - solutionAngle) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff <= (level >= 2 ? 9 : 12) ? ok : wrong();
}

/** Rotate an outdoor scene (sky, ground, house and/or tree) until it is upright. */
export const rotate: PuzzleDefinition<RotateSolution, RotatePublic> = {
  type: 'rotate',
  view: 'rotate',
  minSolveMs: 500,
  maxAttempts: 2,
  generate({ lang, rng }) {
    // Never close to upright, so a no-op submission cannot pass.
    const shown = rng.int(35, 326);
    const image = landscape(rng, ROTATE_SIZE, ROTATE_SIZE).finish().noise(8, rng).rotate(shown, ROTATE_SIZE / 2);
    return {
      solution: { angle: (360 - shown) % 360 },
      prompt: prompt('rotate', lang),
      publicData: { size: ROTATE_SIZE, image: pngDataUrl(image), track: ROTATE_TRACK },
    };
  },
  check(solution, answer, { level }) {
    return checkRotation(solution.angle, answer, level);
  },
};
