import { describe, expect, it } from 'vitest';
import { analyzeTrajectory, entropy, type TracePoint } from '../src/index.js';
import { CLIENT, humanTrail, issue, setup } from './helpers.js';

const line = (n: number, dx: number, dt: number): TracePoint[] => Array.from({ length: n }, (_, i) => [i * dx, 50, i * dt] as const);

describe('trajectory heuristics', () => {
  it('rejects a perfectly straight, instant drag', () => {
    const v = analyzeTrajectory({ mode: 'mouse', trail: line(10, 20, 1) }, { axis: 'x' });
    expect(v.human).toBe(false);
    expect(v.reasons).toContain('too-fast');
  });

  it('rejects a straight drag at constant velocity and cadence even when slow', () => {
    const v = analyzeTrajectory({ mode: 'mouse', trail: line(40, 5, 16) }, { axis: 'x' });
    expect(v.human).toBe(false);
    expect(v.reasons).toEqual(expect.arrayContaining(['uniform-timing', 'constant-velocity', 'perfectly-straight']));
  });

  it('rejects a two-point teleport', () => {
    expect(analyzeTrajectory({ mode: 'mouse', trail: [[0, 0, 0], [200, 0, 400]] }).human).toBe(false);
  });

  it('accepts a human-like drag', () => {
    const v = analyzeTrajectory({ mode: 'mouse', trail: humanTrail(0, 180) }, { axis: 'x' });
    expect(v.human).toBe(true);
    expect(v.score).toBeGreaterThanOrEqual(0.5);
  });

  it('is lenient with keyboard use but refuses machine cadence', () => {
    const keys: TracePoint[] = [[0, 0, 0], [10, 0, 180], [20, 0, 300], [30, 0, 520], [40, 0, 610]];
    expect(analyzeTrajectory({ mode: 'keyboard', trail: keys }).human).toBe(true);
    expect(analyzeTrajectory({ mode: 'keyboard', trail: line(10, 10, 50) }).human).toBe(false);
  });

  it('computes entropy', () => {
    expect(entropy([1, 1, 1])).toBe(0);
    expect(entropy([1, 2, 3, 4, 5, 6, 7, 8], 8)).toBeCloseTo(3, 5);
  });

  it('end-to-end: a bot-straight slider drag with the right answer is still refused', async () => {
    const ctx = setup();
    const { challenge, sol } = await issue(ctx.guard, 'slider');
    ctx.clock.now += 3000;
    const travel = sol.x - (challenge.data as any).startX;
    const trail = Array.from({ length: 12 }, (_, i) => [(travel * i) / 11, 20, i * 2] as const);
    const r = await ctx.guard.verify({ token: challenge.token, answer: { x: sol.x, interaction: { mode: 'mouse', trail } }, client: CLIENT });
    expect(r).toMatchObject({ ok: false, reason: 'bot-suspected', error: 'failed' });
  });
});
