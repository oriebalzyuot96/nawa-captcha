export const CHALLENGE_TYPES = ['slider', 'rotate', 'icons', 'math', 'order', 'trace', 'pow', 'accessible'] as const;
export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

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
}

export interface Generated<Sol, Pub> {
  readonly solution: Sol;
  readonly publicData: Pub;
  readonly prompt: string;
}

export type CheckFailure = 'invalid-answer' | 'wrong-answer' | 'bot-suspected';

export type CheckResult = { readonly ok: true } | { readonly ok: false; readonly reason: CheckFailure; readonly detail?: string };

export interface PuzzleDefinition<Sol = unknown, Pub = unknown> {
  readonly type: ChallengeType;
  /** Verification is refused if answered sooner than this after issue. */
  readonly minSolveMs: number;
  /** Wrong answers allowed on one challenge before it is burned. */
  readonly maxAttempts: number;
  generate(ctx: GenerateContext): Generated<Sol, Pub>;
  /** Validates the untrusted answer shape AND checks it against the sealed solution. */
  check(solution: Sol, answer: unknown, ctx: { readonly level: number }): CheckResult;
}

export const ok: CheckResult = { ok: true };
export const invalid = (detail?: string): CheckResult => ({ ok: false, reason: 'invalid-answer', ...(detail ? { detail } : {}) });
export const wrong = (detail?: string): CheckResult => ({ ok: false, reason: 'wrong-answer', ...(detail ? { detail } : {}) });
