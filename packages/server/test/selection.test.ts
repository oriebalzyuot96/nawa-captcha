import { describe, expect, it } from 'vitest';
import { createNawaGuard, handleChallenge, handleVerify, openChallenge, solvePow, verifyPassToken, type ChallengeType } from '../src/index.js';
import { correct } from './answers.js';
import { CLIENT, SECRET, setup } from './helpers.js';

async function types(guard: ReturnType<typeof setup>['guard'], n: number, extra: Record<string, unknown> = {}): Promise<ChallengeType[]> {
  const out: ChallengeType[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = await guard.createChallenge({ client: CLIENT, action: 'login', ...extra });
    if (!r.ok) throw new Error(r.error);
    out.push(r.challenge.type);
  }
  return out;
}

/** Solves whatever challenge is given, white-box, after a human-plausible delay. */
async function solveAny(ctx: ReturnType<typeof setup>, challenge: { token: string; type: ChallengeType; data: unknown }) {
  const sol = openChallenge(ctx.guard.keys, challenge.token)!.claims.sol;
  ctx.clock.now += 6000;
  return ctx.guard.verify({ token: challenge.token, answer: correct(challenge.type, sol, challenge.data), client: CLIENT });
}

describe('choosing puzzle types', () => {
  it('uses only the configured allow-list (one, two or many types)', async () => {
    expect(new Set(await types(setup({ allowClientType: false, types: ['maze'] }).guard, 5))).toEqual(new Set(['maze']));
    const two = new Set(await types(setup({ allowClientType: false, types: ['slider', 'pairs'], mode: 'random' }).guard, 40));
    expect(two).toEqual(new Set(['slider', 'pairs']));
  });

  it('random mode honours weights (0 disables a type)', async () => {
    const seen = await types(setup({ allowClientType: false, types: ['slider', 'pairs', 'dice'], weights: { dice: 0, pairs: 9 }, mode: 'random' }).guard, 60);
    expect(seen).not.toContain('dice');
    expect(seen.filter((t) => t === 'pairs').length).toBeGreaterThan(seen.filter((t) => t === 'slider').length);
  });

  it('sequence mode rotates through the allowed types per client', async () => {
    const { guard } = setup({ allowClientType: false, types: ['slider', 'rotate', 'maze'], mode: 'sequence' });
    expect(await types(guard, 6)).toEqual(['slider', 'rotate', 'maze', 'slider', 'rotate', 'maze']);
  });

  it('adaptive mode climbs the ladder but stays inside the allow-list', async () => {
    const ctx = setup({ allowClientType: false, types: ['slider', 'maze'], adaptive: { windowSec: 600, failuresPerLevel: 1, maxLevel: 3 } });
    expect(await types(ctx.guard, 3)).toEqual(['slider', 'slider', 'slider']);
    for (let i = 0; i < 2; i += 1) {
      const r = await ctx.guard.createChallenge({ client: CLIENT, action: 'login' });
      if (r.ok) await ctx.guard.verify({ token: r.challenge.token, answer: { x: 1 }, client: CLIENT });
    }
    expect(new Set(await types(ctx.guard, 4))).toEqual(new Set(['maze']));
  });

  it('per-action overrides (array shorthand or full policy)', async () => {
    const { guard } = setup({ allowClientType: false, types: ['slider'], perAction: { login: ['pow', 'rotate'], signup: { types: ['pairs'], steps: 2 } } });
    const login = new Set(await types(guard, 30));
    expect([...login].every((t) => t === 'pow' || t === 'rotate')).toBe(true);
    const signup = await guard.createChallenge({ client: CLIENT, action: 'signup' });
    expect(signup.ok && [signup.challenge.type, signup.challenge.steps]).toEqual(['pairs', 2]);
    const other = await guard.createChallenge({ client: CLIENT, action: 'contact' });
    expect(other.ok && other.challenge.type).toBe('slider');
  });

  it('the browser can narrow the allow-list but never widen it', async () => {
    const { guard } = setup({ allowClientType: false, types: ['pow', 'math', 'dice'], mode: 'random' });
    expect(new Set(await types(guard, 12, { types: ['math'] }))).toEqual(new Set(['math']));
    expect(new Set(await types(guard, 24, { types: 'math,pow' }))).toEqual(new Set(['math', 'pow']));
    // Asking only for types outside the allow-list does not widen it: the server list is used.
    expect(new Set(await types(guard, 30, { types: ['maze', 'slider'] }))).toEqual(new Set(['pow', 'math', 'dice']));
    expect(new Set(await types(guard, 12, { types: ['maze', 'dice'] }))).toEqual(new Set(['dice']));
    expect((await guard.createChallenge({ client: CLIENT, types: 42 })).ok).toBe(false);
    const off = setup({ allowClientType: false, types: ['pow', 'math'], mode: 'random', clientNarrowing: false });
    expect(new Set(await types(off.guard, 30, { types: ['math'] }))).toEqual(new Set(['pow', 'math']));
  });

  it('keeps the accessible alternative available even when not in the allow-list', async () => {
    const { guard } = setup({ allowClientType: false, types: ['slider'] });
    const r = await guard.createChallenge({ client: CLIENT, type: 'accessible' });
    expect(r.ok && r.challenge.type).toBe('accessible');
    const strict = setup({ allowClientType: false, types: ['slider'], allowAccessible: false });
    const s = await strict.guard.createChallenge({ client: CLIENT, type: 'accessible' });
    expect(s.ok && s.challenge.type).toBe('slider');
  });

  it('reports configuration mistakes at startup', () => {
    expect(() => createNawaGuard({ secret: SECRET, types: ['slider', 'nope' as ChallengeType] })).toThrow(/unknown challenge type/);
    expect(() => createNawaGuard({ secret: SECRET, types: [] })).toThrow(/at least one/);
    expect(() => createNawaGuard({ secret: SECRET, steps: 4 })).toThrow(/steps/);
    expect(() => createNawaGuard({ secret: SECRET, mode: 'chaos' as never })).toThrow(/mode/);
    expect(() => createNawaGuard({ secret: SECRET, perAction: { login: ['sliders' as ChallengeType] } })).toThrow(/perAction\["login"\]/);
  });

  it('sends the view for every challenge', async () => {
    const { guard } = setup();
    const r = await handleChallenge(guard, { body: { type: 'maze' }, client: CLIENT });
    expect(r.body).toMatchObject({ success: true, type: 'maze', view: 'path', step: 1, steps: 1 });
  });
});

describe('multi-step', () => {
  it('requires different puzzles in a row before issuing a pass token', async () => {
    const ctx = setup({ allowClientType: false, types: ['slider', 'pairs', 'dice'], mode: 'random', steps: 3 });
    const first = await ctx.guard.createChallenge({ client: CLIENT, action: 'login' });
    if (!first.ok) throw new Error(first.error);
    expect(first.challenge).toMatchObject({ step: 1, steps: 3 });
    let current = first.challenge;
    const seen = [current.type];
    for (const step of [2, 3]) {
      const r = await solveAny(ctx, current);
      if (!r.ok || !r.next) throw new Error(`expected next step, got ${JSON.stringify(r)}`);
      expect(r.next).toMatchObject({ step, steps: 3 });
      expect(seen).not.toContain(r.next.type);
      seen.push(r.next.type);
      current = r.next;
    }
    const done = await solveAny(ctx, current);
    if (!done.ok || done.next) throw new Error('expected a pass token');
    expect(done.solvedTypes).toEqual(seen);
    const v = await ctx.guard.verifyPassToken(done.passToken, { expectedAction: 'login', client: CLIENT, minSteps: 3 });
    expect(v).toMatchObject({ ok: true, claims: { typ: seen[2], stp: seen } });
  });

  it('works over HTTP: verify returns { next } until the last step', async () => {
    const ctx = setup({ allowClientType: false, perAction: { checkout: { types: ['dice', 'math'], steps: 2 } } });
    const c = await handleChallenge(ctx.guard, { body: { action: 'checkout' }, client: CLIENT });
    const ch = c.body as { token: string; type: ChallengeType; data: unknown };
    const sol = openChallenge(ctx.guard.keys, ch.token)!.claims.sol;
    ctx.clock.now += 6000;
    const v1 = await handleVerify(ctx.guard, { body: { token: ch.token, answer: correct(ch.type, sol, ch.data) }, client: CLIENT });
    expect(v1.status).toBe(200);
    const next = (v1.body as { next: { token: string; type: ChallengeType; data: unknown } }).next;
    expect(next.type).not.toBe(ch.type);
    const sol2 = openChallenge(ctx.guard.keys, next.token)!.claims.sol;
    ctx.clock.now += 6000;
    const v2 = await handleVerify(ctx.guard, { body: { token: next.token, answer: correct(next.type, sol2, next.data) }, client: CLIENT });
    expect(v2.body).toMatchObject({ success: true, solvedTypes: [ch.type, next.type] });
  });

  it('a failed step does not skip ahead, and each step is single-use', async () => {
    const ctx = setup({ allowClientType: false, types: ['dice', 'math'], steps: 2, mode: 'random' });
    const first = await ctx.guard.createChallenge({ client: CLIENT });
    if (!first.ok) throw new Error();
    const r = await solveAny(ctx, first.challenge);
    expect(r.ok && r.next).toBeTruthy();
    const again = await solveAny(ctx, first.challenge);
    expect(again).toMatchObject({ ok: false, reason: 'replayed' });
  });
});

describe('pass-token rules for chains', () => {
  async function chainToken(types: ChallengeType[]) {
    const ctx = setup({ allowClientType: false, types, steps: types.length, mode: 'sequence', powBits: 8 });
    let r = await ctx.guard.createChallenge({ client: CLIENT, action: 'login' });
    if (!r.ok) throw new Error();
    let c = r.challenge;
    for (;;) {
      const v = await solveAny(ctx, c);
      if (!v.ok) throw new Error(JSON.stringify(v));
      if (!v.next) return { ...ctx, pass: v.passToken, solved: v.solvedTypes };
      c = v.next;
    }
  }

  it('allowedTypes passes when at least one solved step is allowed; minSteps counts steps', async () => {
    const { pass, solved, clock } = await chainToken(['pow', 'dice']);
    expect(solved).toEqual(['pow', 'dice']);
    const base = { secret: SECRET, expectedAction: 'login', client: CLIENT, now: () => clock.now };
    expect(await verifyPassToken(pass, { ...base, allowedTypes: ['slider'] })).toEqual({ ok: false, error: 'type-not-allowed' });
    expect(await verifyPassToken(pass, { ...base, minSteps: 3 })).toEqual({ ok: false, error: 'too-few-steps' });
    expect(await verifyPassToken(pass, { ...base, allowedTypes: ['dice'], minSteps: 2 })).toMatchObject({ ok: true });
  });

  it('single-step tokens carry no stp claim (v1 format unchanged)', async () => {
    const ctx = setup({ powBits: 8 });
    const r = await ctx.guard.createChallenge({ client: CLIENT, type: 'pow' });
    if (!r.ok) throw new Error();
    const d = r.challenge.data as { salt: string; bits: number };
    const v = await ctx.guard.verify({ token: r.challenge.token, answer: { nonce: solvePow(d.salt, d.bits)! }, client: CLIENT });
    if (!v.ok || v.next) throw new Error();
    const payload = JSON.parse(Buffer.from(v.passToken.split('.')[2]!, 'base64url').toString('utf8'));
    expect(Object.keys(payload).sort()).toEqual(['cb', 'cbm', 'exp', 'iat', 'jti', 'lvl', 'sk', 'typ', 'v', 'act'].sort());
    expect(await ctx.guard.verifyPassToken(v.passToken, { expectedAction: 'default', client: CLIENT, minSteps: 2 })).toEqual({ ok: false, error: 'too-few-steps' });
  });
});
