import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { Raster, hsl, type Pt } from '../render/raster.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { finiteIn, isRecord, softBackground } from './common.js';

export interface HoldSolution {
  /** Accepted hold window in ms (inclusive). */
  readonly from: number;
  readonly to: number;
}

/**
 * View `hold`: press-and-hold. While held, the widget sweeps a progress arc clockwise from 12
 * o'clock, one full turn per `cycleMs`, over `image` (a dial whose target zone is only in pixels).
 */
export interface HoldPublic {
  readonly size: number;
  readonly image: string;
  readonly cycleMs: number;
  /** Ring radius and stroke width (image px) so the client arc lines up with the dial. */
  readonly radius: number;
  readonly stroke: number;
}

const S = 160;
const R = 58;
const STROKE = 16;
const CYCLE = 3000;
const SLACK_MS = 70;

function arc(cx: number, cy: number, r: number, from: number, to: number): Pt[] {
  const pts: Pt[] = [];
  const steps = Math.max(4, Math.ceil((to - from) * 90));
  for (let i = 0; i <= steps; i += 1) {
    const a = -Math.PI / 2 + (from + ((to - from) * i) / steps) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/**
 * Hold-and-release timing. The green zone's position is random and drawn into the PNG. Keyboard:
 * hold Space, or press Enter to start and Enter again to stop (for people who cannot hold a key).
 */
export const hold: PuzzleDefinition<HoldSolution, HoldPublic> = {
  type: 'hold',
  view: 'hold',
  minSolveMs: 600,
  // A blind guess lands in the zone roughly 1 time in 4, so one attempt only (see README).
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const width = level >= 2 ? rng.float(0.12, 0.14) : rng.float(0.15, 0.18);
    const start = rng.float(0.12, 0.94 - width);
    const r = softBackground(rng, S, S);
    const c = S / 2;
    const circle = (rad: number): Pt[] => arc(c, c, rad, 0, 1).slice(0, -1);
    r.rings([circle(R + STROKE / 2), circle(R - STROKE / 2)], [255, 255, 255], 235);
    r.rings([circle(R + STROKE / 2 - 3), circle(R - STROKE / 2 + 3)], hsl(rng.int(200, 240), 0.12, 0.82));
    if (level >= 1) {
      // A red decoy zone: "not here".
      let d = rng.float(0.1, 0.9);
      if (Math.abs(d - start) < 0.25) d = (start + 0.5) % 0.9;
      r.stroke(arc(c, c, R, d, Math.min(0.98, d + rng.float(0.06, 0.1))), STROKE - 4, hsl(rng.int(350, 370) % 360, 0.7, 0.5));
    }
    r.stroke(arc(c, c, R, start, start + width), STROKE - 2, hsl(rng.int(120, 150), 0.65, 0.4));
    // Start tick at 12 o'clock and a centre "press" hint.
    r.rect(c - 1.5, c - R - STROKE / 2 - 4, 3, STROKE + 8, [70, 70, 90]);
    r.circle(c, c, 24, hsl(rng.int(0, 360), 0.3, 0.92)).circle(c, c, 8, hsl(rng.int(0, 360), 0.4, 0.55));
    return {
      solution: { from: Math.round(start * CYCLE), to: Math.round((start + width) * CYCLE) },
      prompt: prompt('hold', lang),
      publicData: { size: S, image: pngDataUrl(r.finish().noise(6, rng)), cycleMs: CYCLE, radius: R, stroke: STROKE },
    };
  },
  check(solution, answer, { elapsedMs }) {
    if (!isRecord(answer) || !finiteIn(answer['heldMs'], 0, 60_000)) return invalid('heldMs');
    const mode = answer['mode'];
    if (mode !== 'mouse' && mode !== 'touch' && mode !== 'pen' && mode !== 'keyboard') return invalid('mode');
    const held = answer['heldMs'];
    // The server's own clock must have seen at least as much time pass as the claimed hold.
    if (held > elapsedMs) return { ok: false, reason: 'bot-suspected', detail: 'hold-longer-than-elapsed' };
    return held >= solution.from - SLACK_MS && held <= solution.to + SLACK_MS ? ok : wrong();
  },
};
