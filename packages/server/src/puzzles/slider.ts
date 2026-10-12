import { randInt } from '../crypto.js';
import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { jigsawMask, onRim } from '../render/shapes.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { checkDrag, darken, finiteIn, isRecord, lighten, scenicBackground } from './common.js';

export interface SliderSolution {
  readonly x: number;
}

export interface SliderPublic {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly piece: string;
  readonly pieceWidth: number;
  readonly pieceHeight: number;
  /** Vertical position of the piece (public). The horizontal position is the secret. */
  readonly pieceY: number;
  /** Where the piece starts. */
  readonly startX: number;
}

const W = 300;
const H = 150;
const BODY = 42;
const KNOB = BODY * 0.2;
const START_X = 2;

export const slider: PuzzleDefinition<SliderSolution, SliderPublic> = {
  type: 'slider',
  minSolveMs: 450,
  maxAttempts: 2,
  generate({ level, lang }) {
    const gapX = randInt(BODY + 40, Math.floor(W - BODY - KNOB - 8));
    const gapY = randInt(Math.ceil(KNOB + 6), H - BODY - 6);
    const variant = randInt(0, 2);
    const gap = jigsawMask(gapX, gapY, BODY, variant);

    const scene = scenicBackground(W, H).finish().noise(10);
    const [bx, by, bx2, by2] = gap.bbox;
    const pieceW = Math.ceil(bx2 - bx);
    const pieceH = Math.ceil(by2 - by);
    const left = Math.floor(bx);
    const top = Math.floor(by);

    // The piece is cut from the clean scene, then both images get independent noise so pixel
    // ratios between "piece" and "gap" are not an exact template match.
    const piece = scene.crop(left, top, pieceW, pieceH, gap.inside);
    piece.shade((px, py) => onRim((x, y) => gap.inside(x + left, y + top), px, py), lighten(0.65)).noise(6);

    scene.shade(gap.inside, darken(0.42), gap.bbox).shade((px, py) => onRim(gap.inside, px, py), lighten(0.5), gap.bbox);
    if (level >= 1) {
      // A decoy hole of a different outline: easy for a person to dismiss, noise for a naive edge detector.
      let dx = randInt(BODY + 20, W - BODY - KNOB - 8);
      if (Math.abs(dx - gapX) < BODY + 16) dx = gapX > W / 2 ? BODY + 22 : W - BODY - KNOB - 10;
      const decoy = jigsawMask(dx, randInt(Math.ceil(KNOB + 6), H - BODY - 6), BODY * 0.9, variant + 1);
      scene.shade(decoy.inside, darken(0.7), decoy.bbox);
    }
    scene.noise(6);

    return {
      solution: { x: left },
      prompt: prompt('slider', lang),
      publicData: {
        width: W,
        height: H,
        background: pngDataUrl(scene),
        piece: pngDataUrl(piece),
        pieceWidth: pieceW,
        pieceHeight: pieceH,
        pieceY: top,
        startX: START_X,
      },
    };
  },
  check(solution, answer, { level }) {
    if (!isRecord(answer) || !finiteIn(answer['x'], 0, W)) return invalid('x');
    const x = answer['x'];
    const drag = checkDrag(answer['interaction'], { w: W, h: H }, x - START_X, 8);
    if (!drag.ok) return drag;
    const tolerance = level >= 2 ? 5 : 6;
    return Math.abs(x - solution.x) <= tolerance ? ok : wrong();
  },
};
