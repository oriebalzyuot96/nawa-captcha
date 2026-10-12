import type { InputMode, Interaction, TracePoint } from './types.js';

export const MAX_TRAIL_POINTS = 800;
const INPUT_MODES: readonly InputMode[] = ['mouse', 'touch', 'pen', 'keyboard'];

/** Validates an untrusted trail: bounded length, finite numbers, non-decreasing time. */
export function parseTrail(value: unknown, bounds: { w: number; h: number }): TracePoint[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_TRAIL_POINTS) return undefined;
  const out: TracePoint[] = [];
  let lastT = -Infinity;
  for (const p of value) {
    if (!Array.isArray(p) || p.length !== 3) return undefined;
    const [x, y, t] = p as unknown[];
    if (typeof x !== 'number' || typeof y !== 'number' || typeof t !== 'number') return undefined;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) return undefined;
    // Generous margin: a finger may legitimately overshoot the image while dragging.
    if (x < -bounds.w || x > bounds.w * 2 || y < -bounds.h || y > bounds.h * 2 || t < 0 || t > 600_000) return undefined;
    if (t < lastT) return undefined;
    lastT = t;
    out.push([x, y, t]);
  }
  return out;
}

export function parseInteraction(value: unknown, bounds: { w: number; h: number }): Interaction | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (!INPUT_MODES.includes(v['mode'] as InputMode)) return undefined;
  const trail = parseTrail(v['trail'], bounds);
  return trail ? { mode: v['mode'] as InputMode, trail } : undefined;
}

export interface TrajectoryOptions {
  /** Minimum duration of the gesture itself, in ms. */
  readonly minDurationMs?: number;
  /** 'x' for one-axis drags (slider) where off-axis wobble is a human signal. */
  readonly axis?: 'x' | 'free';
  /** Score below which the gesture is rejected (0..1). */
  readonly threshold?: number;
}

export interface TrajectoryVerdict {
  readonly human: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
}

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

function std(xs: readonly number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Shannon entropy (bits) of values quantized into `bins` equal-width buckets. */
export function entropy(xs: readonly number[], bins = 8): number {
  if (xs.length === 0) return 0;
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (max - min < 1e-9) return 0;
  const counts = new Array<number>(bins).fill(0);
  for (const x of xs) counts[Math.min(bins - 1, Math.floor(((x - min) / (max - min)) * bins))]! += 1;
  return counts.reduce((h, c) => (c === 0 ? h : h - (c / xs.length) * Math.log2(c / xs.length)), 0);
}

/**
 * Scores how human a drag looks. These are cost-raising signals, not proof: a scripted mouse
 * with recorded human jitter will pass. What it reliably rejects is the cheap attack —
 * synthetic events in a perfectly straight line at constant speed, or an instant "teleport".
 */
export function analyzeTrajectory(interaction: Interaction, opts: TrajectoryOptions = {}): TrajectoryVerdict {
  const { trail, mode } = interaction;
  const minDuration = opts.minDurationMs ?? 180;
  const threshold = opts.threshold ?? 0.5;
  const reasons: string[] = [];
  const first = trail[0];
  const last = trail[trail.length - 1];
  if (!first || !last) return { human: false, score: 0, reasons: ['no-samples'] };
  const duration = last[2] - first[2];

  if (mode === 'keyboard') {
    // Keyboard users press keys; we only refuse the impossible (zero time, machine-perfect cadence).
    if (duration < Math.min(minDuration, 120) && trail.length > 1) reasons.push('too-fast');
    const dts = trail.slice(1).map((p, i) => p[2] - (trail[i] as TracePoint)[2]);
    if (dts.length >= 6 && std(dts) < 0.5) reasons.push('uniform-key-timing');
    const score = reasons.length === 0 ? 1 : 0;
    return { human: score >= threshold, score, reasons };
  }

  if (trail.length < 5) return { human: false, score: 0, reasons: ['too-few-samples'] };
  if (duration < minDuration) return { human: false, score: 0, reasons: ['too-fast'] };

  let score = 1;
  const dts: number[] = [];
  const speeds: number[] = [];
  for (let i = 1; i < trail.length; i += 1) {
    const a = trail[i - 1] as TracePoint;
    const b = trail[i] as TracePoint;
    const dt = b[2] - a[2];
    dts.push(dt);
    if (dt > 0) speeds.push(Math.hypot(b[0] - a[0], b[1] - a[1]) / dt);
  }

  // Synthetic event loops fire at a perfectly regular cadence.
  if (dts.length >= 8 && std(dts) < 0.5) {
    score -= 0.2;
    reasons.push('uniform-timing');
  }

  // Humans accelerate and decelerate; scripts tend to move at a constant velocity.
  const moving = speeds.filter((s) => s > 0.001);
  const cv = moving.length > 2 ? std(moving) / (mean(moving) || 1) : 0;
  if (cv < 0.12) {
    score -= 0.4;
    reasons.push('constant-velocity');
  }
  if (moving.length > 6 && entropy(moving) < 1) {
    score -= 0.15;
    reasons.push('low-speed-entropy');
  }

  // A one-axis drag by a hand always wanders a little off-axis.
  if ((opts.axis ?? 'free') === 'x') {
    const ys = trail.map((p) => p[1]);
    if (Math.max(...ys) - Math.min(...ys) < 0.5) {
      score -= 0.25;
      reasons.push('perfectly-straight');
    }
  } else {
    // Straight machine segments only change heading at the corners.
    const turns = directionChanges(trail);
    if (trail.length > 10 && turns / (trail.length - 1) < 0.1) {
      score -= 0.25;
      reasons.push('no-direction-noise');
    }
  }

  score = Math.max(0, Math.round(score * 100) / 100);
  return { human: score >= threshold, score, reasons };
}

/** Counts small heading changes (> ~3°) between consecutive segments. */
function directionChanges(trail: readonly TracePoint[]): number {
  let changes = 0;
  let prev: number | undefined;
  for (let i = 1; i < trail.length; i += 1) {
    const a = trail[i - 1] as TracePoint;
    const b = trail[i] as TracePoint;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) continue;
    const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (prev !== undefined) {
      let d = Math.abs(heading - prev);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > 0.05 && d < 1.2) changes += 1;
    }
    prev = heading;
  }
  return changes;
}
