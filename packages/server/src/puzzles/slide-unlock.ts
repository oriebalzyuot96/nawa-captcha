import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { Raster, hsl, type Pt } from '../render/raster.js';
import { iconPolygon } from '../render/shapes.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { checkDrag, finiteIn, isRecord, softBackground } from './common.js';
import type { SliderPublic } from './slider.js';

export interface SlideUnlockSolution {
  readonly x: number;
}

const W = 300;
const H = 76;
const KNOB = 44;
const GROOVE_Y = 50;
const START_X = 4;

function outline(r: Raster, points: readonly Pt[], width: number, color: readonly [number, number, number]): void {
  r.stroke([...points, points[0]!], width, color);
}

/**
 * Slide to unlock, with a moving target: the handle must stop under a ring drawn at a random,
 * jittered position among decoy outlines. The ring position exists only in the PNG.
 */
export const slideUnlock: PuzzleDefinition<SlideUnlockSolution, SliderPublic> = {
  type: 'slide-unlock',
  view: 'slide',
  minSolveMs: 450,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const bg = softBackground(rng, W, H);
    const accent = hsl(rng.int(0, 360), 0.6, 0.38);
    // groove + ticks
    bg.rect(KNOB / 2, GROOVE_Y - 4, W - KNOB, 8, [255, 255, 255], 200);
    for (let x = KNOB / 2; x <= W - KNOB / 2; x += rng.float(9, 13)) bg.rect(x, GROOVE_Y - 9, 1.2, 4, accent, 90);
    const slots = [];
    const minX = KNOB / 2 + 70;
    const maxX = W - KNOB / 2 - 4;
    const tx = rng.float(minX, maxX);
    slots.push(tx);
    const decoys = level >= 1 ? 3 : 2;
    for (let i = 0; i < decoys; i += 1) {
      let d = 0;
      for (let tries = 0; tries < 200; tries += 1) {
        d = rng.float(KNOB / 2 + 30, maxX);
        if (slots.every((s) => Math.abs(s - d) > 30)) break;
      }
      slots.push(d);
    }
    const ty = 17;
    bg.circle(tx, ty, 11, accent).circle(tx, ty, 7, [255, 255, 255]);
    const decoyKinds = rng.shuffle(['triangle', 'square', 'diamond', 'hexagon'] as const);
    slots.slice(1).forEach((dx, i) => outline(bg, iconPolygon(decoyKinds[i % decoyKinds.length]!, dx, ty + rng.float(-2, 2), 22, rng.float(-10, 10)), 3.4, accent));
    const background = bg.finish().noise(8, rng);

    const knob = new Raster(KNOB, KNOB, 2);
    knob.circle(KNOB / 2, KNOB / 2, KNOB / 2 - 1, accent).circle(KNOB / 2, KNOB / 2, KNOB / 2 - 4, hsl(rng.int(0, 360), 0.25, 0.97));
    knob.polygon([[KNOB / 2, 7], [KNOB / 2 - 8, 19], [KNOB / 2 + 8, 19]], accent).rect(KNOB / 2 - 2.5, 18, 5, 15, accent);

    return {
      solution: { x: Math.round((tx - KNOB / 2) * 10) / 10 },
      prompt: prompt('slideUnlock', lang),
      publicData: {
        width: W,
        height: H,
        background: pngDataUrl(background),
        piece: pngDataUrl(knob.finish().noise(4, rng)),
        pieceWidth: KNOB,
        pieceHeight: KNOB,
        pieceY: GROOVE_Y - KNOB / 2,
        startX: START_X,
      },
    };
  },
  check(solution, answer, { level }) {
    if (!isRecord(answer) || !finiteIn(answer['x'], 0, W)) return invalid('x');
    const x = answer['x'];
    const drag = checkDrag(answer['interaction'], { w: W, h: H }, x - START_X, 8);
    if (!drag.ok) return drag;
    return Math.abs(x - solution.x) <= (level >= 2 ? 5 : 6) ? ok : wrong();
  },
};
