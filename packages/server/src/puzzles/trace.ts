import { analyzeTrajectory, parseInteraction } from '../heuristics.js';
import { prompt } from '../i18n.js';
import { glyphStrokes } from '../render/glyphs.js';
import { pngDataUrl } from '../render/png.js';
import { hsl, type Pt } from '../render/raster.js';
import type { Rng } from '../rng.js';
import { invalid, ok, wrong, type CheckResult, type PuzzleDefinition } from '../types.js';
import { isRecord, roundPt, scatter, scenicBackground } from './common.js';

export interface TraceSolution {
  readonly dots: readonly Pt[];
}

/**
 * View `path`: draw on a picture (pointer) or place points with a keyboard crosshair. With `grid`
 * the keyboard moves cell by cell (mazes).
 */
export interface PathPublic {
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly count?: number;
  readonly grid?: { readonly cols: number; readonly rows: number };
}

const W = 300;
const H = 200;
const HIT_RADIUS = 20;
const MARGIN = 26;

function pathLength(points: readonly (readonly [number, number, ...number[]])[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) len += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  return len;
}

/** Shared connect-the-dots generator; `labels` are drawn next to the dots in order. */
export function connectDots(rng: Rng, labels: readonly string[], decoyCount: number): { dots: Pt[]; image: string } {
  const dots = scatter(rng, labels.length, { x0: MARGIN, y0: MARGIN, x1: W - MARGIN, y1: H - MARGIN }, 62);
  const decoys = scatter(rng, decoyCount, { x0: MARGIN, y0: MARGIN, x1: W - MARGIN, y1: H - MARGIN }, 44, dots);
  const r = scenicBackground(rng, W, H, 10);
  r.rect(0, 0, W, H, [255, 255, 255], 120);
  const dotColor = hsl(rng.int(0, 360), 0.65, 0.35);
  for (const [x, y] of [...dots, ...decoys]) r.circle(x, y, 8, [255, 255, 255]).circle(x, y, 6, dotColor);
  dots.forEach(([x, y], i) => {
    const angle = rng.float(0, Math.PI * 2);
    const lx = Math.min(W - 10, Math.max(10, x + Math.cos(angle) * 17));
    const ly = Math.min(H - 12, Math.max(12, y + Math.sin(angle) * 17));
    for (const stroke of glyphStrokes(labels[i]!, { x: lx, y: ly, size: 15, rotateDeg: rng.float(-15, 15), jitter: 0.6 }, () => rng.next())) {
      r.stroke(stroke, 4.4, [255, 255, 255]);
      r.stroke(stroke, 2.2, dotColor);
    }
  });
  return { dots: dots.map(roundPt), image: pngDataUrl(r.finish().noise(8, rng)) };
}

/** Checks that the path visits the dots in order without sweeping the canvas. */
export function checkConnect(dots: readonly Pt[], answer: unknown): CheckResult {
  if (!isRecord(answer)) return invalid('answer');
  const interaction = parseInteraction(answer['interaction'], { w: W, h: H });
  if (!interaction || interaction.trail.length < 2) return invalid('interaction');
  const points = interaction.trail;
  // The dots must be visited as an ordered subsequence of the path. Brushing past a later dot
  // on the way is allowed (people do that); sweeping is prevented by the length bound below.
  let next = 0;
  for (const [x, y] of points) {
    const target = dots[next];
    if (target && Math.hypot(target[0] - x, target[1] - y) <= HIT_RADIUS) next += 1;
    if (next === dots.length) break;
  }
  if (next !== dots.length) return wrong('incomplete');
  // Refuse "lawn-mower" sweeps: the path may wander, but not cover the whole canvas.
  if (pathLength(points) > pathLength(dots) * 2.2 + 160) return wrong('path-too-long');
  if (interaction.mode === 'keyboard' && points.length > 40) return invalid('too-many-keyboard-points');
  const verdict = analyzeTrajectory(interaction, { axis: 'free', minDurationMs: 300 });
  return verdict.human ? ok : { ok: false, reason: 'bot-suspected', detail: verdict.reasons.join(',') };
}

/** Connect numbered dots in order (unnumbered decoys are present). */
export const trace: PuzzleDefinition<TraceSolution, PathPublic> = {
  type: 'trace',
  view: 'path',
  minSolveMs: 900,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const count = level >= 2 ? 5 : 4;
    const { dots, image } = connectDots(rng, Array.from({ length: count }, (_, i) => String(i + 1)), level >= 1 ? 3 : 2);
    return { solution: { dots }, prompt: prompt('trace', lang, { n: count }), publicData: { image, width: W, height: H, count } };
  },
  check(solution, answer) {
    return checkConnect(solution.dots, answer);
  },
};

/** @deprecated alias of {@link PathPublic}. */
export type TracePublic = PathPublic;
