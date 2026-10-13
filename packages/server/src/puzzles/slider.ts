import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { PIECE_SHAPES, onRim, pieceMask } from '../render/shapes.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { checkDrag, darken, finiteIn, isRecord, lighten, scenicBackground } from './common.js';

export interface SliderSolution {
  readonly x: number;
}

/** View `slide`: a piece image dragged horizontally over a background image. */
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
const MARGIN = Math.ceil(BODY * 0.25) + 6;
const START_X = 2;

/**
 * Slider jigsaw. The piece outline varies (jigsaw tab, jigsaw notch, circle, star, shield, heart,
 * hexagon); level ≥ 1 adds a decoy hole with a different outline.
 */
export const slider: PuzzleDefinition<SliderSolution, SliderPublic> = {
  type: 'slider',
  view: 'slide',
  minSolveMs: 450,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const shape = rng.pick(PIECE_SHAPES);
    const gapX = rng.int(BODY + 40, W - BODY - MARGIN);
    const gapY = rng.int(MARGIN, H - BODY - MARGIN + 4);
    const gap = pieceMask(shape, gapX, gapY, BODY);

    const scene = scenicBackground(rng, W, H).finish().noise(10, rng);
    const [bx, by, bx2, by2] = gap.bbox;
    const pieceW = Math.ceil(bx2 - bx);
    const pieceH = Math.ceil(by2 - by);
    const left = Math.floor(bx);
    const top = Math.floor(by);

    // The piece is cut from the clean scene, then both images get independent noise so pixel
    // ratios between "piece" and "gap" are not an exact template match.
    const piece = scene.crop(left, top, pieceW, pieceH, gap.inside);
    const pieceInside = (x: number, y: number): boolean => gap.inside(x + left, y + top);
    // The piece is a raised tile lit from the top-left; the hole is a recess with an inner shadow.
    piece.bevel(pieceInside, [0, 0, pieceW, pieceH], { depth: 3, raised: true, light: 0.6, shade: 0.45 });
    piece.shade((px, py) => onRim(pieceInside, px, py, 1), lighten(0.35)).noise(6, rng);

    scene.shade(gap.inside, darken(0.45), gap.bbox).bevel(gap.inside, gap.bbox, { depth: 4, raised: false, light: 0.45, shade: 0.55 });
    if (level >= 1) {
      // A decoy hole of a different outline: easy for a person to dismiss, noise for a naive edge detector.
      let dx = rng.int(BODY + 20, W - BODY - MARGIN);
      if (Math.abs(dx - gapX) < BODY + 16) dx = gapX > W / 2 ? BODY + 22 : W - BODY - MARGIN - 2;
      const decoy = pieceMask(rng.pick(PIECE_SHAPES.filter((s) => s !== shape)), dx, rng.int(MARGIN, H - BODY - MARGIN + 4), BODY * 0.9);
      scene.shade(decoy.inside, darken(0.7), decoy.bbox);
    }
    scene.noise(6, rng);

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
