import type { Rng } from './rng.js';
import { CHALLENGE_TYPES, type ChallengeType } from './types.js';

/**
 * How the server picks a challenge type for a request:
 * - `adaptive` (default): the difficulty ladder (`ladder[level]`), limited to the allowed types;
 *   failures from the same client move it up the ladder.
 * - `random`: a weighted random pick from the allowed types.
 * - `sequence`: the allowed types in turn, per client and action (a rotation).
 */
export type SelectionMode = 'random' | 'sequence' | 'adaptive';

/** Per-action override. Any field left out falls back to the global option. */
export interface ActionPolicy {
  /** Allow-list for this action (replaces the global `types`). */
  readonly types?: readonly ChallengeType[];
  readonly weights?: Partial<Record<ChallengeType, number>>;
  readonly mode?: SelectionMode;
  /** Number of different puzzles to solve in a row before a pass token is issued (1-3). */
  readonly steps?: number;
  readonly ladder?: readonly (readonly ChallengeType[])[];
  /** Base proof-of-work difficulty (bits) for `pow` and the accessible PoW tax on this action. */
  readonly powBits?: number;
}

export interface ResolvedPolicy {
  readonly types: readonly ChallengeType[];
  readonly weights: Partial<Record<ChallengeType, number>>;
  readonly mode: SelectionMode;
  readonly steps: number;
  readonly ladder: readonly (readonly ChallengeType[])[];
  readonly powBits: number;
}

export const DEFAULT_LADDER: readonly (readonly ChallengeType[])[] = [
  ['slider', 'rotate'],
  ['icons', 'order', 'trace', 'slider', 'rotate-object', 'shadow-drag', 'jigsaw', 'pairs', 'find-shape', 'tap-order', 'icons-objects'],
  ['icons', 'trace', 'math', 'order', 'maze', 'spell', 'symmetry', 'rotate-match', 'story', 'order-time', 'color-name', 'trace-letters'],
];

/** Types used by `random`/`sequence` when no allow-list is configured (everything visual). */
export const DEFAULT_POOL: readonly ChallengeType[] = CHALLENGE_TYPES.filter((t) => t !== 'pow' && t !== 'accessible' && t !== 'audio');

export const MAX_STEPS = 3;

export function isChallengeType(v: unknown): v is ChallengeType {
  return typeof v === 'string' && (CHALLENGE_TYPES as readonly string[]).includes(v);
}

/** Validates a configured type list; unknown names are a configuration error, not silently dropped. */
export function checkTypes(list: readonly unknown[] | undefined, where: string): ChallengeType[] | undefined {
  if (list === undefined) return undefined;
  if (!Array.isArray(list)) throw new Error(`nawa-guard: ${where} must be an array of challenge types`);
  const bad = list.filter((t) => !isChallengeType(t));
  if (bad.length) throw new Error(`nawa-guard: unknown challenge type(s) in ${where}: ${bad.join(', ')}. Known: ${CHALLENGE_TYPES.join(', ')}`);
  return [...new Set(list as ChallengeType[])];
}

export function checkSteps(steps: number | undefined, where: string): number | undefined {
  if (steps === undefined) return undefined;
  if (!Number.isInteger(steps) || steps < 1 || steps > MAX_STEPS) throw new Error(`nawa-guard: ${where} must be an integer from 1 to ${MAX_STEPS}`);
  return steps;
}

/**
 * Parses the browser's optional narrowing hint (`types: ['slider', 'rotate']` or "slider,rotate").
 * Unknown names are ignored; the result is only ever used to NARROW the server's allow-list.
 */
export function parseClientTypes(value: unknown): ChallengeType[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : undefined;
  if (!raw || raw.length > CHALLENGE_TYPES.length) return undefined;
  const out = raw.map((t) => (typeof t === 'string' ? t.trim() : t)).filter(isChallengeType);
  return out.length ? [...new Set(out)] : undefined;
}

/** The pool a challenge is drawn from: allow-list ∩ client narrowing (ignored if it leaves nothing). */
export function effectivePool(policy: ResolvedPolicy, clientTypes: readonly ChallengeType[] | undefined): ChallengeType[] {
  const usable = policy.types.filter((t) => (policy.weights[t] ?? 1) > 0);
  const base = usable.length ? usable : [...policy.types];
  if (!clientTypes?.length) return base;
  const narrowed = base.filter((t) => clientTypes.includes(t));
  return narrowed.length ? narrowed : base;
}

export function weightedPick(rng: Rng, pool: readonly ChallengeType[], weights: Partial<Record<ChallengeType, number>>): ChallengeType {
  const ws = pool.map((t) => Math.max(0, weights[t] ?? 1));
  const total = ws.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return rng.pick(pool);
  let x = rng.next() * total;
  for (let i = 0; i < pool.length; i += 1) {
    x -= ws[i]!;
    if (x < 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

/** Random pool without the text/audio alternatives (chosen by the person, never drawn at random). */
export function drawable(pool: readonly ChallengeType[]): ChallengeType[] {
  const visual = pool.filter((t) => t !== 'accessible' && t !== 'audio');
  return visual.length ? visual : [...pool];
}

/**
 * Adaptive pick: the ladder rung for `level` limited to the pool. If that rung has nothing allowed,
 * the nearest lower rung is used, then higher ones, then the whole pool.
 */
export function ladderPool(ladder: readonly (readonly ChallengeType[])[], level: number, pool: readonly ChallengeType[]): ChallengeType[] {
  const top = Math.min(level, ladder.length - 1);
  const order = [...Array.from({ length: top + 1 }, (_, i) => top - i), ...Array.from({ length: ladder.length - top - 1 }, (_, i) => top + 1 + i)];
  for (const rung of order) {
    const hit = (ladder[rung] ?? []).filter((t) => pool.includes(t));
    if (hit.length) return hit;
  }
  return [...pool];
}
