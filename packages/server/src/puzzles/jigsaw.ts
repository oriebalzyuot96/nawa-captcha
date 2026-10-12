import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import type { PuzzleDefinition } from '../types.js';
import { checkOrder, landscape } from './common.js';

export interface JigsawSolution {
  /** Piece ids in slot order (row-major). */
  readonly order: readonly string[];
}

/** View `swap`: pieces (separate PNGs with random ids) laid out in a rows×cols frame; swap two at a time. */
export interface SwapPublic {
  readonly tiles: readonly { readonly id: string; readonly image: string }[];
  readonly rows: number;
  readonly cols: number;
  readonly width: number;
  readonly height: number;
}

const W = 240;
const H = 160;

/**
 * Simple jigsaw: an outdoor picture cut into four quarters that are shuffled; swap pieces until the
 * picture is whole. A blind guess is right 1 time in 23.
 */
export const jigsaw: PuzzleDefinition<JigsawSolution, SwapPublic> = {
  type: 'jigsaw',
  view: 'swap',
  minSolveMs: 1500,
  maxAttempts: 2,
  generate({ lang, rng }) {
    const rows = 2;
    const cols = 2;
    const scene = landscape(rng, W, H, { kind: 'both' }).finish();
    const pw = W / cols;
    const ph = H / rows;
    const pieces = Array.from({ length: rows * cols }, (_, i) => ({
      id: rng.id(6),
      image: pngDataUrl(scene.crop((i % cols) * pw, Math.floor(i / cols) * ph, pw, ph).noise(8, rng)),
    }));
    let shuffled = rng.shuffle([...pieces]);
    if (shuffled.every((p, i) => p.id === pieces[i]!.id)) shuffled = [...shuffled.slice(1), shuffled[0]!];
    return {
      solution: { order: pieces.map((p) => p.id) },
      prompt: prompt('jigsaw', lang),
      publicData: { tiles: shuffled, rows, cols, width: W, height: H },
    };
  },
  check(solution, answer) {
    return checkOrder(solution.order, answer);
  },
};
