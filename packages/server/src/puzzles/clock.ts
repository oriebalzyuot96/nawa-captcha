import { prompt } from '../i18n.js';
import { drawClock, formatTime } from '../render/clock.js';
import { pngDataUrl } from '../render/png.js';
import type { PuzzleDefinition } from '../types.js';
import { checkGridSolution, finishGrid, gridCanvas, type GridPublic, type GridSolution } from './grid.js';

type Time = readonly [h: number, m: number];

const key = ([h, m]: Time): string => `${h}:${m}`;

/**
 * Clock reading: six analogue clocks; select the one showing the time in the prompt. Distractors
 * are the typical misreadings (hands swapped, hour off by one, minutes off by a quarter).
 */
export const clock: PuzzleDefinition<GridSolution, GridPublic> = {
  type: 'clock',
  view: 'grid',
  minSolveMs: 1500,
  maxAttempts: 1,
  generate({ level, lang, rng }) {
    const rows = 2;
    const cols = 3;
    const n = rows * cols;
    const stepMin = level >= 1 ? 5 : 15;
    const h = rng.int(1, 13);
    let m = rng.int(0, 60 / stepMin) * stepMin;
    if (h * 5 === m) m = (m + stepMin) % 60; // keep "hands swapped" distinguishable
    const target: Time = [h, m];
    const wrap = (x: number): number => ((x - 1 + 12) % 12) + 1;
    const pool: Time[] = [
      [wrap(m / 5 || 12), (h % 12) * 5],
      [wrap(h + 1), m],
      [wrap(h - 1), m],
      [h, (m + 15) % 60],
      [h, (m + 45) % 60],
      [wrap(h + 6), m],
      [wrap(h + rng.int(2, 5)), (m + 30) % 60],
    ];
    const seen = new Set([key(target)]);
    const distractors: Time[] = [];
    for (const t of rng.shuffle(pool)) {
      if (distractors.length === n - 1) break;
      if (!seen.has(key(t))) {
        seen.add(key(t));
        distractors.push(t);
      }
    }
    while (distractors.length < n - 1) {
      const t: Time = [rng.int(1, 13), rng.int(0, 12) * 5];
      if (!seen.has(key(t))) {
        seen.add(key(t));
        distractors.push(t);
      }
    }
    const answer = rng.int(0, n);
    const times = [...distractors];
    times.splice(answer, 0, target);
    const g = gridCanvas(rng, rows, cols, 92, 92);
    times.forEach(([th, tm], i) => {
      const [x, y] = g.center(i);
      drawClock(g.r, rng, x + rng.float(-3, 3), y + rng.float(-3, 3), rng.float(36, 40), th, tm);
    });
    return {
      solution: { cells: [answer], n },
      prompt: prompt('clock', lang, { time: formatTime(h, m) }),
      publicData: { image: pngDataUrl(finishGrid(g, rows, cols).finish().noise(8, rng)), width: g.width, height: g.height, rows, cols, gridTop: 0, select: 'one', target: formatTime(h, m) },
    };
  },
  check: checkGridSolution,
};
