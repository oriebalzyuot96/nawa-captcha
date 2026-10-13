import { solvePow, type ChallengeType, type TracePoint } from '../src/index.js';
import { humanPath, humanTrail } from './helpers.js';

export type Mode = 'mouse' | 'keyboard';

/** Irregular keyboard timing: a person pressing keys, never machine-regular. */
function keyTimes(n: number): number[] {
  let t = 0;
  return Array.from({ length: n }, (_, i) => (t += 90 + ((i * 37) % 70)));
}

function keyboardSteps(from: number, to: number, step: number, y: number): TracePoint[] {
  const pts: number[] = [from];
  let x = from;
  while (Math.abs(to - x) > step) {
    x += Math.sign(to - x) * step;
    pts.push(x);
  }
  pts.push(to);
  const times = keyTimes(pts.length);
  return pts.map((v, i) => [v, y, times[i]!] as const);
}

function mazePath(sol: any): number[] {
  const { cols, rows, right, down, start, end } = sol;
  const open = (a: number, b: number): boolean => {
    const ax = a % cols;
    const ay = Math.floor(a / cols);
    const bx = b % cols;
    if (ay === Math.floor(b / cols)) return right[ay * (cols - 1) + Math.min(ax, bx)] === '0';
    return down[Math.min(ay, Math.floor(b / cols)) * cols + ax] === '0';
  };
  const prev = new Map<number, number>([[start, -1]]);
  const q = [start as number];
  while (q.length) {
    const c = q.shift()!;
    const x = c % cols;
    const y = Math.floor(c / cols);
    for (const [n, okDir] of [[c + 1, x + 1 < cols], [c - 1, x > 0], [c + cols, y + 1 < rows], [c - cols, y > 0]] as const) {
      if (okDir && !prev.has(n) && open(c, n)) {
        prev.set(n, c);
        q.push(n);
      }
    }
  }
  const path: number[] = [];
  for (let c = end as number; c !== -1; c = prev.get(c)!) path.unshift(c);
  return path;
}

const CELL = 40;
const center = (sol: any, c: number): [number, number] => [(c % sol.cols) * CELL + CELL / 2, Math.floor(c / sol.cols) * CELL + CELL / 2];

/** A correct answer for any type, built from the (white-box) sealed solution. */
export function correct(type: ChallengeType, sol: any, data: any, mode: Mode = 'mouse'): any {
  switch (type) {
    case 'slider':
    case 'slide-unlock':
      return {
        x: sol.x,
        interaction:
          mode === 'keyboard'
            ? { mode, trail: keyboardSteps(data.startX, sol.x, 2, data.pieceY) }
            : { mode, trail: humanTrail(data.startX, sol.x) },
      };
    case 'rotate':
    case 'rotate-object':
    case 'rotate-match': {
      const travel = (sol.angle / 360) * 300;
      return { angle: sol.angle, interaction: mode === 'keyboard' ? { mode, trail: keyboardSteps(0, travel, 2.5, 0) } : { mode, trail: humanTrail(0, travel) } };
    }
    case 'shadow-drag': {
      if (mode === 'keyboard') {
        const xs = keyboardSteps(data.startX, sol.x, 3, 0).map((p) => p[0]);
        const ys = keyboardSteps(data.startY, sol.y, 3, 0).map((p) => p[0]);
        const pts = [...xs.map((x) => [x, data.startY] as const), ...ys.slice(1).map((y) => [sol.x, y] as const)];
        const times = keyTimes(pts.length);
        return { x: sol.x, y: sol.y, interaction: { mode, trail: pts.map(([x, y], i) => [x, y, times[i]!]) } };
      }
      return { x: sol.x, y: sol.y, interaction: { mode, trail: humanPath([[data.startX, data.startY], [sol.x, sol.y]]).map(([x, y, t], i, a) => (i === a.length - 1 ? [sol.x, sol.y, t] : [x, y, t])) } };
    }
    case 'hold':
      return { heldMs: Math.round((sol.from + sol.to) / 2), mode };
    case 'pairs':
      return { pairs: sol.pairs };
    case 'tap-order':
    case 'spell': {
      const times = keyTimes(sol.targets.length).map((t) => t * 3);
      return { mode, taps: sol.targets.map(([x, y]: [number, number], i: number) => [x + 2, y - 1.5, times[i]]) };
    }
    case 'order':
    case 'order-size':
    case 'order-numbers':
    case 'order-time':
    case 'story':
    case 'jigsaw':
      return { order: sol.order };
    case 'trace':
    case 'trace-letters':
      return mode === 'keyboard'
        ? { interaction: { mode, trail: sol.dots.map(([x, y]: [number, number], i: number) => [x + 3, y - 2, 900 * i + (i % 2) * 130]) } }
        : { interaction: { mode, trail: humanPath(sol.dots) } };
    case 'maze': {
      const cells = mazePath(sol).map((c) => center(sol, c));
      if (mode === 'keyboard') {
        const times = keyTimes(cells.length);
        return { interaction: { mode, trail: cells.map(([x, y], i) => [x, y, times[i]!]) } };
      }
      return { interaction: { mode, trail: humanPath(cells).map(([x, y, t]) => [Math.min(sol.cols * CELL - 1, Math.max(1, x)), Math.min(sol.rows * CELL - 1, Math.max(1, y)), t]) } };
    }
    case 'math':
    case 'count':
    case 'dice':
      return { value: String(sol.value) };
    case 'pow':
      return { nonce: solvePow(data.salt, data.bits)! };
    case 'accessible':
    case 'audio':
      return { text: sol.accept[0], nonce: solvePow(data.pow.salt, data.pow.bits)! };
    default:
      return { selected: sol.cells };
  }
}

/** A plausible but wrong answer (right shape, wrong content). */
export function incorrect(type: ChallengeType, sol: any, data: any): unknown {
  switch (type) {
    case 'slider':
    case 'slide-unlock': {
      const x = sol.x > 150 ? sol.x - 25 : sol.x + 25;
      return { x, interaction: { mode: 'mouse', trail: humanTrail(data.startX, x) } };
    }
    case 'rotate':
    case 'rotate-object':
    case 'rotate-match': {
      const angle = (sol.angle + 90) % 360;
      return { angle, interaction: { mode: 'mouse', trail: humanTrail(0, (angle / 360) * 300) } };
    }
    case 'shadow-drag': {
      const x = sol.x > 150 ? sol.x - 50 : sol.x + 50;
      return { x, y: sol.y, interaction: { mode: 'mouse', trail: humanPath([[data.startX, data.startY], [x, sol.y]]).map(([px, py, t], i, a) => (i === a.length - 1 ? [x, sol.y, t] : [px, py, t])) } };
    }
    case 'hold':
      return { heldMs: sol.from > 600 ? sol.from - 400 : sol.to + 400, mode: 'mouse' };
    case 'pairs': {
      const [[a, b], [c, d], ...rest] = sol.pairs;
      return { pairs: [[a, c], [b, d], ...rest] };
    }
    case 'tap-order':
    case 'spell':
      return { mode: 'mouse', taps: [...sol.targets].reverse().map(([x, y]: [number, number], i: number) => [x, y, 400 * i + (i % 2) * 77]) };
    case 'order':
    case 'order-size':
    case 'order-numbers':
    case 'order-time':
    case 'story':
    case 'jigsaw':
      return { order: [...sol.order].reverse() };
    case 'trace':
    case 'trace-letters':
      return { interaction: { mode: 'mouse', trail: humanPath([...sol.dots].reverse()) } };
    case 'maze':
      return { interaction: { mode: 'mouse', trail: humanPath([center(sol, sol.end), center(sol, sol.start)]) } };
    case 'math':
    case 'count':
    case 'dice':
      return { value: String(sol.value + 1) };
    case 'pow':
      return { nonce: '0' };
    case 'accessible':
      return { text: 'zzzz', nonce: solvePow(data.pow.salt, data.pow.bits)! };
    case 'audio':
      return { text: /^d+$/.test(sol.accept[0]) ? String((Number(sol.accept[0][0]) + 1) % 10) + sol.accept[0].slice(1) : 'zzzz', nonce: solvePow(data.pow.salt, data.pow.bits)! };
    default: {
      const n: number = sol.n;
      const other = Array.from({ length: n }, (_, i) => i).find((i) => !sol.cells.includes(i))!;
      return { selected: sol.cells.length > 1 ? sol.cells.slice(1) : [other] };
    }
  }
}

/** Straight, constant-speed synthetic drag (what cheap automation produces). */
export function roboticTrail(from: [number, number], to: [number, number], n = 30): TracePoint[] {
  return Array.from({ length: n + 1 }, (_, i) => [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n, i * 16] as const);
}

/** Constant-speed straight segments through the given vertices. */
export function roboticPolyline(vertices: readonly (readonly number[])[], stepPx = 5): TracePoint[] {
  const out: TracePoint[] = [];
  let t = 0;
  for (let s = 0; s + 1 < vertices.length; s += 1) {
    const [ax, ay] = vertices[s] as [number, number];
    const [bx, by] = vertices[s + 1] as [number, number];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / stepPx));
    for (let i = s === 0 ? 0 : 1; i <= n; i += 1) out.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, (t += 16)]);
  }
  return out;
}
