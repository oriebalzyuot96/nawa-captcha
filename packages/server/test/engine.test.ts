import { describe, expect, it } from 'vitest';
import { MemoryStore, createNawaCaptcha, signPassToken, solvePow, verifyPassToken, type GuardEvent } from '../src/index.js';
import { CLIENT, SECRET, issue, setup } from './helpers.js';

async function solvedPass(ctx = setup({ powBits: 8 }), action = 'login') {
  const { challenge } = await issue(ctx.guard, 'pow', { action });
  const d = challenge.data as { salt: string; bits: number };
  const r = await ctx.guard.verify({ token: challenge.token, answer: { nonce: solvePow(d.salt, d.bits)! }, client: CLIENT });
  if (!r.ok) throw new Error(`verify failed: ${r.reason}`);
  return { ...ctx, pass: r.passToken };
}

describe('challenge lifecycle', () => {
  it('expires challenges after challengeTtlSec', async () => {
    const ctx = setup({ challengeTtlSec: 60 });
    const { challenge, sol } = await issue(ctx.guard, 'icons');
    ctx.clock.now += 61_000;
    const r = await ctx.guard.verify({ token: challenge.token, answer: { selected: sol.cells }, client: CLIENT });
    expect(r).toMatchObject({ ok: false, reason: 'expired', error: 'expired' });
  });

  it('rejects replay of a solved challenge', async () => {
    const ctx = setup();
    const { challenge, sol } = await issue(ctx.guard, 'icons');
    ctx.clock.now += 3000;
    const first = await ctx.guard.verify({ token: challenge.token, answer: { selected: sol.cells }, client: CLIENT });
    expect(first.ok).toBe(true);
    const second = await ctx.guard.verify({ token: challenge.token, answer: { selected: sol.cells }, client: CLIENT });
    expect(second).toMatchObject({ ok: false, reason: 'replayed', error: 'expired' });
  });

  it('lets only one of two concurrent correct submissions win', async () => {
    const ctx = setup({ maxAttempts: { icons: 5 } });
    const { challenge, sol } = await issue(ctx.guard, 'icons');
    ctx.clock.now += 3000;
    const results = await Promise.all([1, 2, 3].map(() => ctx.guard.verify({ token: challenge.token, answer: { selected: sol.cells }, client: CLIENT })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it('enforces the attempt limit', async () => {
    const ctx = setup();
    const { challenge, sol } = await issue(ctx.guard, 'math'); // maxAttempts 1
    ctx.clock.now += 3000;
    const wrong = await ctx.guard.verify({ token: challenge.token, answer: { value: String(sol.value + 1) }, client: CLIENT });
    expect(wrong).toMatchObject({ ok: false, retry: false });
    const right = await ctx.guard.verify({ token: challenge.token, answer: { value: String(sol.value) }, client: CLIENT });
    expect(right).toMatchObject({ ok: false, reason: 'attempts-exceeded' });
  });

  it('refuses answers faster than the minimum solve time', async () => {
    const ctx = setup();
    const { challenge, sol } = await issue(ctx.guard, 'icons');
    ctx.clock.now += 200;
    const r = await ctx.guard.verify({ token: challenge.token, answer: { selected: sol.cells }, client: CLIENT });
    expect(r).toMatchObject({ ok: false, reason: 'too-fast', error: 'failed' });
  });

  it('binds the challenge to the client IP and user agent', async () => {
    const ctx = setup();
    const { challenge, sol } = await issue(ctx.guard, 'icons');
    ctx.clock.now += 3000;
    const r = await ctx.guard.verify({ token: challenge.token, answer: { selected: sol.cells }, client: { ...CLIENT, ip: '198.51.100.1' } });
    expect(r).toMatchObject({ ok: false, reason: 'client-mismatch', error: 'invalid-token' });
    // IPv4-mapped IPv6 is the same client.
    const ok = await ctx.guard.verify({ token: challenge.token, answer: { selected: sol.cells }, client: { ...CLIENT, ip: `::ffff:${CLIENT.ip}` } });
    expect(ok.ok).toBe(true);
  });

  it('rejects malformed input without touching state', async () => {
    const { guard } = setup();
    expect(await guard.verify({ token: 42, answer: {}, client: CLIENT })).toMatchObject({ ok: false, error: 'invalid-input' });
    expect(await guard.verify({ token: 'ngc1.k1.a.b', answer: 'x', client: CLIENT })).toMatchObject({ ok: false, error: 'invalid-input' });
    expect(await guard.verify({ token: 'ngc1.k1.a.b', answer: {}, client: CLIENT })).toMatchObject({ ok: false, error: 'invalid-token' });
    expect(await guard.createChallenge({ action: 'bad action!', client: CLIENT })).toEqual({ ok: false, error: 'invalid-input' });
    expect(await guard.createChallenge({ type: 'nope', client: CLIENT })).toEqual({ ok: false, error: 'invalid-input' });
  });

  it('enforces configured site keys and actions', async () => {
    const { guard } = setup({ siteKeys: ['main'], actions: ['login'] });
    expect((await guard.createChallenge({ siteKey: 'main', action: 'login', client: CLIENT })).ok).toBe(true);
    expect((await guard.createChallenge({ siteKey: 'other', action: 'login', client: CLIENT })).ok).toBe(false);
    expect((await guard.createChallenge({ siteKey: 'main', action: 'signup', client: CLIENT })).ok).toBe(false);
  });

  it('does not let the browser choose the puzzle unless allowed (except accessible)', async () => {
    const { guard } = setup({ allowClientType: false, ladder: [['slider']] });
    const a = await guard.createChallenge({ type: 'math', client: CLIENT });
    expect(a.ok && a.challenge.type).toBe('slider');
    const b = await guard.createChallenge({ type: 'accessible', client: CLIENT });
    expect(b.ok && b.challenge.type).toBe('accessible');
  });
});

describe('rate limiting and adaptive difficulty', () => {
  it('rate-limits challenge issuance per client', async () => {
    const events: GuardEvent[] = [];
    const { guard } = setup({ rateLimit: { windowSec: 60, challenge: 3, verify: 10 }, onEvent: (e) => events.push(e) });
    for (let i = 0; i < 3; i += 1) expect((await guard.createChallenge({ client: CLIENT })).ok).toBe(true);
    expect(await guard.createChallenge({ client: CLIENT })).toEqual({ ok: false, error: 'rate-limited' });
    expect((await guard.createChallenge({ client: { ...CLIENT, ip: '192.0.2.9' } })).ok).toBe(true);
    expect(events.some((e) => e.type === 'rate-limited')).toBe(true);
  });

  it('supports a custom rate-limit hook', async () => {
    const { guard } = setup({ rateLimit: ({ kind }) => kind !== 'challenge' });
    expect(await guard.createChallenge({ client: CLIENT })).toEqual({ ok: false, error: 'rate-limited' });
  });

  it('escalates the puzzle ladder after failures', async () => {
    const ctx = setup({ allowClientType: false, invisibleFirst: true, adaptive: { windowSec: 600, failuresPerLevel: 1, maxLevel: 3 } });
    const first = await ctx.guard.createChallenge({ client: CLIENT });
    expect(first.ok && first.challenge.type).toBe('pow');
    expect(first.ok && first.challenge.level).toBe(0);
    if (!first.ok) return;
    await ctx.guard.verify({ token: first.challenge.token, answer: { nonce: '0' }, client: CLIENT });
    const second = await ctx.guard.createChallenge({ client: CLIENT });
    expect(second.ok && second.challenge.level).toBe(1);
    expect(second.ok && ['slider', 'rotate']).toContain(second.ok && second.challenge.type);
  });
});

describe('pass tokens', () => {
  it('verifies once, then reports replay', async () => {
    const { guard, pass } = await solvedPass();
    expect(await guard.verifyPassToken(pass, { expectedAction: 'login', client: CLIENT })).toMatchObject({ ok: true, claims: { act: 'login', typ: 'pow' } });
    expect(await guard.verifyPassToken(pass, { expectedAction: 'login', client: CLIENT })).toEqual({ ok: false, error: 'replayed' });
  });

  it('works standalone with just the secret (siteverify-style)', async () => {
    const { pass, clock } = await solvedPass();
    const store = new MemoryStore();
    const now = () => clock.now;
    const opts = { secret: SECRET, expectedAction: 'login', maxAgeSec: 60, client: CLIENT, store, now };
    expect((await verifyPassToken(pass, opts)).ok).toBe(true);
    expect(await verifyPassToken(pass, opts)).toEqual({ ok: false, error: 'replayed' });
  });

  it('checks action, site key, type, binding, age and expiry', async () => {
    const base = await solvedPass();
    const now = () => base.clock.now;
    const store = new MemoryStore();
    const v = (o: Record<string, unknown>) => verifyPassToken(base.pass, { secret: SECRET, expectedAction: 'login', client: CLIENT, store, now, ...o });
    expect(await v({ expectedAction: 'checkout' })).toEqual({ ok: false, error: 'action-mismatch' });
    expect(await v({ expectedSiteKey: 'elsewhere' })).toEqual({ ok: false, error: 'site-mismatch' });
    expect(await v({ allowedTypes: ['slider'] })).toEqual({ ok: false, error: 'type-not-allowed' });
    expect(await v({ client: { ...CLIENT, userAgent: 'curl/8' } })).toEqual({ ok: false, error: 'client-mismatch' });
    expect(await v({ client: undefined })).toEqual({ ok: false, error: 'client-mismatch' });
    expect(await v({ maxAgeSec: 10, now: () => base.clock.now + 30_000 })).toEqual({ ok: false, error: 'too-old' });
    expect(await v({ now: () => base.clock.now + 121_000 })).toEqual({ ok: false, error: 'expired' });
    expect(await v({ secret: 'not-the-secret-0123456789-abcdefghijk' })).toEqual({ ok: false, error: 'bad-signature' });
    expect(await v({})).toMatchObject({ ok: true });
  });

  it('rejects missing and forged tokens', async () => {
    expect(await verifyPassToken(undefined, { secret: SECRET, expectedAction: 'login' })).toEqual({ ok: false, error: 'missing-token' });
    const { guard } = setup();
    const forged = signPassToken(createNawaCaptcha({ secret: 'attacker-secret-0123456789-abcdefghijk' }).keys, {
      v: 1, jti: 'x', sk: 'default', act: 'login', typ: 'slider', lvl: 0, iat: 1_800_000_000, exp: 1_800_000_100, cbm: 'none',
    });
    expect(await guard.verifyPassToken(forged, { expectedAction: 'login' })).toEqual({ ok: false, error: 'bad-signature' });
  });
});
