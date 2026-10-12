import { prompt } from '../i18n.js';
import { drawPicto, FAMILIES, type PictoKind } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { Raster, hsl } from '../render/raster.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { checkDrag2d, clutter, finiteIn, isRecord, ink, scatter, softBackground } from './common.js';

export interface ShadowDragSolution {
  /** Top-left position of the piece when it covers its shadow. */
  readonly x: number;
  readonly y: number;
}

/** View `drag`: a piece image dragged freely (2D) over a background image. */
export interface DragPublic {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly piece: string;
  readonly pieceWidth: number;
  readonly pieceHeight: number;
  readonly startX: number;
  readonly startY: number;
}

const W = 300;
const H = 180;
const PS = 58;

/** Drag a coloured pictogram onto the one silhouette (among decoys) that has the same outline. */
export const shadowDrag: PuzzleDefinition<ShadowDragSolution, DragPublic> = {
  type: 'shadow-drag',
  view: 'drag',
  minSolveMs: 600,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const pool: PictoKind[] = [...FAMILIES.objects, ...FAMILIES.weather.filter((k) => k !== 'moon' && k !== 'star')];
    const kinds = rng.sample(pool, level >= 1 ? 4 : 3);
    const target = kinds[0]!;
    const rot = rng.float(-20, 20);
    const bg = softBackground(rng, W, H);
    clutter(bg, rng, 0, 0, W, H, 6);
    const spots = scatter(rng, kinds.length, { x0: 92 + PS / 2, y0: PS / 2 + 4, x1: W - PS / 2 - 4, y1: H - PS / 2 - 4 }, PS + 6);
    const shade = hsl(rng.int(200, 260), 0.15, 0.22);
    kinds.forEach((kind, i) => {
      const [cx, cy] = spots[i]!;
      drawPicto(bg, kind, cx, cy, PS * 0.86, i === 0 ? rot : rng.float(-20, 20), { color: shade, silhouette: true, alpha: 200 });
    });
    // A dashed "home" frame where the piece starts.
    const startX = 8;
    const startY = Math.round(rng.float(8, H - PS - 8));
    for (let k = 0; k < 4; k += 1) bg.rect(startX + k * 15, startY - 2, 8, 1.5, [255, 255, 255], 230).rect(startX + k * 15, startY + PS, 8, 1.5, [255, 255, 255], 230);

    const piece = new Raster(PS, PS, 2);
    const color = ink(rng);
    drawPicto(piece, target, PS / 2, PS / 2, PS * 0.86, rot, { color, accent: hsl(rng.int(0, 360), 0.6, 0.28) });

    const [tx, ty] = spots[0]!;
    return {
      solution: { x: Math.round((tx - PS / 2) * 10) / 10, y: Math.round((ty - PS / 2) * 10) / 10 },
      prompt: prompt('shadowDrag', lang),
      publicData: {
        width: W,
        height: H,
        background: pngDataUrl(bg.finish().noise(8, rng)),
        piece: pngDataUrl(piece.finish().noise(5, rng)),
        pieceWidth: PS,
        pieceHeight: PS,
        startX,
        startY,
      },
    };
  },
  check(solution, answer, { level }) {
    if (!isRecord(answer) || !finiteIn(answer['x'], -PS, W) || !finiteIn(answer['y'], -PS, H)) return invalid('xy');
    const x = answer['x'];
    const y = answer['y'];
    const drag = checkDrag2d(answer['interaction'], { w: W, h: H }, [x, y], 8);
    if (!drag.ok) return drag;
    return Math.hypot(x - solution.x, y - solution.y) <= (level >= 2 ? 10 : 13) ? ok : wrong();
  },
};
