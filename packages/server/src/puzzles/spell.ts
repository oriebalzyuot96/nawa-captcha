import { prompt } from '../i18n.js';
import { pngDataUrl } from '../render/png.js';
import { hsl } from '../render/raster.js';
import type { PuzzleDefinition } from '../types.js';
import { checkTaps, drawText, roundPt, scatter, softBackground } from './common.js';
import { bubble, TAP_RADIUS, type TapsPublic, type TapsSolution } from './tap-order.js';

/** Short words without repeated letters, so every tap has exactly one right bubble. */
const WORDS = ['CAT', 'SUN', 'MAP', 'KEY', 'BOX', 'CUP', 'HAT', 'PEN', 'JAR', 'FISH', 'BIRD', 'LAMP', 'STAR', 'CAKE', 'FROG', 'DUCK', 'WIND', 'GOLD', 'MILK', 'ROSE'] as const;
const ALPHABET = 'ABCDEFGHIJKLMNOPRSTUVWXYZ';

const W = 300;
const H = 220;
const HEADER = 54;

/**
 * Tap letters to spell the word shown at the top. The word and the letters are stroke paths in
 * the PNG (no text, no font); decoy letters are mixed in.
 */
export const spell: PuzzleDefinition<TapsSolution, TapsPublic> = {
  type: 'spell',
  view: 'taps',
  minSolveMs: 1800,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const word = rng.pick(level >= 1 ? WORDS.filter((w) => w.length === 4) : WORDS);
    const decoys = rng.sample([...ALPHABET].filter((c) => !word.includes(c)), level >= 1 ? 3 : 2);
    const r = softBackground(rng, W, H);
    const pill = hsl(rng.int(0, 360), 0.55, 0.4);
    r.rect(W / 2 - 74, 8, 148, HEADER - 16, pill).rect(W / 2 - 71, 11, 142, HEADER - 22, [255, 255, 255]);
    drawText(r, rng, word, W / 2, HEADER / 2 - 0.5, 24, pill, { tilt: 4, weight: 3.4 });
    const letters = [...word, ...decoys];
    const spots = scatter(rng, letters.length, { x0: 28, y0: HEADER + 28, x1: W - 28, y1: H - 26 }, 54);
    letters.forEach((ch, i) => bubble(r, rng, ch, spots[i]![0], spots[i]![1], 21));
    return {
      solution: { targets: spots.slice(0, word.length).map(roundPt) },
      prompt: prompt('spell', lang),
      publicData: { image: pngDataUrl(r.finish().noise(8, rng)), width: W, height: H, count: word.length },
    };
  },
  check(solution, answer) {
    return checkTaps(solution.targets, answer, { w: W, h: H }, TAP_RADIUS + 4);
  },
};
