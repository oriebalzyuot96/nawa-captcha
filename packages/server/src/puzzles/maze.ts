import { analyzeTrajectory, parseInteraction } from '../heuristics.js';
import { prompt } from '../i18n.js';
import { drawPicto } from '../render/pictograms.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { Rng } from '../rng.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { isRecord, softBackground } from './common.js';
import type { PathPublic } from './trace.js';

export interface MazeSolution {
  readonly cols: number;
  readonly rows: number;
  /** "1" = wall to the right of cell i (row-major, cols-1 per row). */
  readonly right: string;
  /** "1" = wall below cell i (row-major, rows-1 rows). */
  readonly down: string;
  readonly start: number;
  readonly end: number;
}

const CELL = 40;

function carve(rng: Rng, cols: number, rows: number): { right: boolean[]; down: boolean[] } {
  const right = new Array<boolean>(rows * (cols - 1)).fill(true);
  const down = new Array<boolean>((rows - 1) * cols).fill(true);
  const seen = new Array<boolean>(cols * rows).fill(false);
  const stack = [rng.int(0, cols * rows)];
  seen[stack[0]!] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const x = cur % cols;
    const y = Math.floor(cur / cols);
    const options: Array<[number, () => void]> = [];
    if (x + 1 < cols && !seen[cur + 1]) options.push([cur + 1, () => (right[y * (cols - 1) + x] = false)]);
    if (x > 0 && !seen[cur - 1]) options.push([cur - 1, () => (right[y * (cols - 1) + x - 1] = false)]);
    if (y + 1 < rows && !seen[cur + cols]) options.push([cur + cols, () => (down[y * cols + x] = false)]);
    if (y > 0 && !seen[cur - cols]) options.push([cur - cols, () => (down[(y - 1) * cols + x] = false)]);
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [next, open] = rng.pick(options);
    open();
    seen[next] = true;
    stack.push(next);
  }
  return { right, down };
}

/** True if a step between two 4-neighbouring cells is open. */
function open(sol: MazeSolution, a: number, b: number): boolean {
  const { cols } = sol;
  const ax = a % cols;
  const ay = Math.floor(a / cols);
  const bx = b % cols;
  const by = Math.floor(b / cols);
  if (ay === by && Math.abs(ax - bx) === 1) return sol.right[ay * (cols - 1) + Math.min(ax, bx)] === '0';
  if (ax === bx && Math.abs(ay - by) === 1) return sol.down[Math.min(ay, by) * cols + ax] === '0';
  return false;
}

/**
 * Maze: draw a path from the start dot to the flag without crossing walls. The wall layout is
 * only in the PNG and the sealed solution. Keyboard: arrow keys move one cell at a time.
 */
export const maze: PuzzleDefinition<MazeSolution, PathPublic> = {
  type: 'maze',
  view: 'path',
  minSolveMs: 1500,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const cols = level >= 1 ? 8 : 7;
    const rows = 5;
    const W = cols * CELL;
    const H = rows * CELL;
    const { right, down } = carve(rng, cols, rows);
    const start = rng.int(0, rows) * cols;
    const end = rng.int(0, rows) * cols + cols - 1;
    const r = softBackground(rng, W, H);
    const wall = hsl(rng.int(200, 280), 0.35, 0.28);
    const t = 5;
    r.rect(0, 0, W, t / 2 + 1, wall).rect(0, H - t / 2 - 1, W, t / 2 + 1, wall).rect(0, 0, t / 2 + 1, H, wall).rect(W - t / 2 - 1, 0, t / 2 + 1, H, wall);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (x < cols - 1 && right[y * (cols - 1) + x]) r.rect((x + 1) * CELL - t / 2, y * CELL - t / 2, t, CELL + t, wall);
        if (y < rows - 1 && down[y * cols + x]) r.rect(x * CELL - t / 2, (y + 1) * CELL - t / 2, CELL + t, t, wall);
      }
    }
    const sx = (start % cols) * CELL + CELL / 2;
    const sy = Math.floor(start / cols) * CELL + CELL / 2;
    r.circle(sx, sy, 10, [255, 255, 255]).circle(sx, sy, 8, hsl(135, 0.6, 0.4));
    const ex = (end % cols) * CELL + CELL / 2;
    const ey = Math.floor(end / cols) * CELL + CELL / 2;
    drawPicto(r, 'flag', ex, ey, 26, 0, { color: hsl(rng.int(0, 30), 0.8, 0.5), accent: [60, 60, 70] });
    return {
      solution: { cols, rows, right: right.map((b) => (b ? '1' : '0')).join(''), down: down.map((b) => (b ? '1' : '0')).join(''), start, end },
      prompt: prompt('maze', lang),
      publicData: { image: pngDataUrl(r.finish().noise(6, rng)), width: W, height: H, grid: { cols, rows } },
    };
  },
  check(sol, answer) {
    if (!isRecord(answer)) return invalid('answer');
    const W = sol.cols * CELL;
    const H = sol.rows * CELL;
    const interaction = parseInteraction(answer['interaction'], { w: W, h: H });
    if (!interaction || interaction.trail.length < 2) return invalid('interaction');
    const cellAt = (x: number, y: number): number | undefined =>
      x < 0 || y < 0 || x >= W || y >= H ? undefined : Math.floor(y / CELL) * sol.cols + Math.floor(x / CELL);
    const first = interaction.trail[0]!;
    let cur = cellAt(first[0], first[1]);
    if (cur !== sol.start) return wrong('start');
    // Walk the polyline in small steps; every change of cell must go through an open side.
    for (let i = 1; i < interaction.trail.length && cur !== sol.end; i += 1) {
      const [ax, ay] = interaction.trail[i - 1]!;
      const [bx, by] = interaction.trail[i]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
      for (let s = 1; s <= steps; s += 1) {
        const c = cellAt(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
        if (c === undefined) return wrong('outside');
        if (c === cur) continue;
        const dx = (c % sol.cols) - (cur! % sol.cols);
        const dy = Math.floor(c / sol.cols) - Math.floor(cur! / sol.cols);
        // A diagonal corner cut is fine if either L-shaped route around the corner is open.
        const viaX = cur! + dx;
        const viaY = cur! + dy * sol.cols;
        const passable =
          Math.abs(dx) + Math.abs(dy) === 1
            ? open(sol, cur!, c)
            : Math.abs(dx) === 1 && Math.abs(dy) === 1 && ((open(sol, cur!, viaX) && open(sol, viaX, c)) || (open(sol, cur!, viaY) && open(sol, viaY, c)));
        if (!passable) return wrong('wall');
        cur = c;
        if (cur === sol.end) break;
      }
    }
    if (cur !== sol.end) return wrong('incomplete');
    const verdict = analyzeTrajectory(interaction, { axis: 'free', minDurationMs: 400 });
    return verdict.human ? ok : { ok: false, reason: 'bot-suspected', detail: verdict.reasons.join(',') };
  },
};
