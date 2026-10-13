import type { Rng } from './rng.js';

/**
 * Every challenge type, grouped by what the person does. Each type lives in its own module under
 * `src/puzzles/` and is rendered by one of the widget's generic views (see {@link ViewKind}).
 */
export const CHALLENGE_TYPES = [
  // drag, slide, rotate, hold
  'slider',
  'slide-unlock',
  'shadow-drag',
  'jigsaw',
  'rotate',
  'rotate-object',
  'rotate-match',
  'hold',
  // select in a picture grid
  'icons',
  'icons-weather',
  'icons-objects',
  'odd-one-out',
  'odd-rotation',
  'color-name',
  'biggest',
  'find-shape',
  'shadow-pick',
  'pattern',
  'clock',
  'math-compare',
  'symmetry',
  'pairs',
  // tap in order
  'tap-order',
  'spell',
  // put in order
  'order',
  'order-size',
  'order-numbers',
  'order-time',
  'story',
  // draw a path
  'trace',
  'trace-letters',
  'maze',
  // type the answer
  'math',
  'count',
  'dice',
  // invisible / text alternative
  'pow',
  'accessible',
  'audio',
] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

/**
 * The widget view that renders a type. Views are generic interaction patterns; the public data
 * of each view is documented next to the puzzles that use it.
 */
export const VIEW_KINDS = ['slide', 'drag', 'rotate', 'swap', 'hold', 'grid', 'pairs', 'taps', 'order', 'path', 'text', 'pow', 'accessible', 'audio'] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

export const LANGS = ['ar', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** A pointer/keyboard sample in image coordinates: [x, y, msSinceStart]. */
export type TracePoint = readonly [x: number, y: number, t: number];

export type InputMode = 'mouse' | 'touch' | 'pen' | 'keyboard';

export interface Interaction {
  readonly mode: InputMode;
  readonly trail: readonly TracePoint[];
}

export interface GenerateContext {
  readonly level: number;
  readonly lang: Lang;
  /** Randomness source. The engine always passes a CSPRNG; tests may pass a seeded one. */
  readonly rng: Rng;
}

export interface Generated<Sol, Pub> {
  readonly solution: Sol;
  readonly publicData: Pub;
  readonly prompt: string;
}

export interface CheckContext {
  readonly level: number;
  /** Server-measured ms between issue and verification (from the sealed `iat`). */
  readonly elapsedMs: number;
}

export type CheckFailure = 'invalid-answer' | 'wrong-answer' | 'bot-suspected';

export type CheckResult = { readonly ok: true } | { readonly ok: false; readonly reason: CheckFailure; readonly detail?: string };

export interface PuzzleDefinition<Sol = unknown, Pub = unknown> {
  readonly type: ChallengeType;
  /** Which widget view renders it. */
  readonly view: ViewKind;
  /** Verification is refused if answered sooner than this after issue. */
  readonly minSolveMs: number;
  /** Wrong answers allowed on one challenge before it is burned. */
  readonly maxAttempts: number;
  generate(ctx: GenerateContext): Generated<Sol, Pub>;
  /** Validates the untrusted answer shape AND checks it against the sealed solution. */
  check(solution: Sol, answer: unknown, ctx: CheckContext): CheckResult;
}

export const ok: CheckResult = { ok: true };
export const invalid = (detail?: string): CheckResult => ({ ok: false, reason: 'invalid-answer', ...(detail ? { detail } : {}) });
export const wrong = (detail?: string): CheckResult => ({ ok: false, reason: 'wrong-answer', ...(detail ? { detail } : {}) });
