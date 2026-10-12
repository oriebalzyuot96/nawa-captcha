import { randFloat, randInt } from '../crypto.js';
import { analyzeTrajectory, parseInteraction } from '../heuristics.js';
import { prompt } from '../i18n.js';
import { glyphStrokes } from '../render/glyphs.js';
import { pngDataUrl } from '../render/png.js';
import { hsl, type Pt } from '../render/raster.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { isRecord, scenicBackground } from './common.js';

export interface TraceSolution {
  readonly dots: readonly Pt[];
}

export interface TracePublic {
  readonly image: string;
  readonly width: number;
  readonly height: number;
  readonly count: number;
}

const W = 300;
const H = 200;
const HIT_RADIUS = 20;
const MARGIN = 26;

function placeDots(count: number, avoid: readonly Pt[], minGap: number): Pt[] {
  const out: Pt[] = [];
  for (let tries = 0; out.length < count && tries < 2000; tries += 1) {
    const p: Pt = [randFloat(MARGIN, W - MARGIN), randFloat(MARGIN, H - MARGIN)];
    if ([...avoid, ...out].every(([x, y]) => Math.hypot(x - p[0], y - p[1]) >= minGap)) out.push(p);
  }
  return out;
}

function pathLength(points: readonly (readonly [number, number, ...number[]])[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return len;
}

export const trace: PuzzleDefinition<TraceSolution, TracePublic> = {
  type: 'trace',
  minSolveMs: 900,
  maxAttempts: 2,
  generate({ level, lang }) {
    const count = level >= 2 ? 5 : 4;
    let dots = placeDots(count, [], 62);
    if (dots.length < count) dots = placeDots(count, [], 50);
    const decoys = placeDots(level >= 1 ? 3 : 2, dots, 44);

    const r = scenicBackground(W, H, 10);
    r.rect(0, 0, W, H, [255, 255, 255], 120);
    const dotColor = hsl(randInt(0, 360), 0.65, 0.35);
    for (const [x, y] of [...dots, ...decoys]) {
      r.circle(x, y, 8, [255, 255, 255]).circle(x, y, 6, dotColor);
    }
    dots.forEach(([x, y], i) => {
      const angle = randFloat(0, Math.PI * 2);
      const lx = Math.min(W - 10, Math.max(10, x + Math.cos(angle) * 17));
      const ly = Math.min(H - 12, Math.max(12, y + Math.sin(angle) * 17));
      for (const stroke of glyphStrokes(String(i + 1), { x: lx, y: ly, size: 15, rotateDeg: randFloat(-15, 15), jitter: 0.6 }, () => randFloat())) {
        r.stroke(stroke, 4.4, [255, 255, 255]);
        r.stroke(stroke, 2.2, dotColor);
      }
    });

    return {
      solution: { dots: dots.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as const) },
      prompt: prompt('trace', lang, { n: count }),
      publicData: { image: pngDataUrl(r.finish().noise(8)), width: W, height: H, count },
    };
  },
  check(solution, answer) {
    if (!isRecord(answer)) return invalid('answer');
    const interaction = parseInteraction(answer['interaction'], { w: W, h: H });
    if (!interaction || interaction.trail.length < 2) return invalid('interaction');
    const points = interaction.trail;

    // The dots must be visited as an ordered subsequence of the path. Brushing past a later dot
    // on the way is allowed (people do that); sweeping is prevented by the length bound below.
    let next = 0;
    for (const [x, y] of points) {
      const target = solution.dots[next];
      if (target && Math.hypot(target[0] - x, target[1] - y) <= HIT_RADIUS) next += 1;
      if (next === solution.dots.length) break;
    }
    if (next !== solution.dots.length) return wrong('incomplete');

    // Refuse "lawn-mower" sweeps: the path may wander, but not cover the whole canvas.
    const optimal = pathLength(solution.dots);
    if (pathLength(points) > optimal * 2.2 + 160) return wrong('path-too-long');

    if (interaction.mode === 'keyboard' && points.length > 40) return invalid('too-many-keyboard-points');
    const verdict = analyzeTrajectory(interaction, { axis: 'free', minDurationMs: 300 });
    return verdict.human ? ok : { ok: false, reason: 'bot-suspected', detail: verdict.reasons.join(',') };
  },
};
