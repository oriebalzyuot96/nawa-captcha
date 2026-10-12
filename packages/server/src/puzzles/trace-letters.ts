import { prompt } from '../i18n.js';
import type { PuzzleDefinition } from '../types.js';
import { checkConnect, connectDots, type PathPublic, type TraceSolution } from './trace.js';

/** Connect-the-dots variant: dots labelled A, B, C… joined in alphabetical order. */
export const traceLetters: PuzzleDefinition<TraceSolution, PathPublic> = {
  type: 'trace-letters',
  view: 'path',
  minSolveMs: 900,
  maxAttempts: 2,
  generate({ level, lang, rng }) {
    const count = level >= 2 ? 5 : 4;
    const labels = 'ABCDE'.slice(0, count).split('');
    const { dots, image } = connectDots(rng, labels, level >= 1 ? 3 : 2);
    return { solution: { dots }, prompt: prompt('traceLetters', lang, { last: labels[count - 1]! }), publicData: { image, width: 300, height: 200, count } };
  },
  check(solution, answer) {
    return checkConnect(solution.dots, answer);
  },
};
