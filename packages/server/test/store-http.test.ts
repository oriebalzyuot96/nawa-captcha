import { describe, expect, it } from 'vitest';
import { MemoryStore, handleChallenge, handleVerify, ioredisStore, nodeRedisStore, readPassToken, solvePow } from '../src/index.js';
import { nawaCaptchaExpress, requireCaptcha, type RequestLike, type ResponseLike } from '../src/express.js';
import { CLIENT, setup } from './helpers.js';

describe('MemoryStore', () => {
  it('honours TTLs and setIfAbsent semantics', async () => {
    let now = 0;
    const s = new MemoryStore({ now: () => now });
    expect(await s.setIfAbsent('a', 100)).toBe(true);
    expect(await s.setIfAbsent('a', 100)).toBe(false);
    now = 101;
    expect(await s.setIfAbsent('a', 100)).toBe(true);
    expect(await s.increment('c', 50)).toBe(1);
    expect(await s.increment('c', 50)).toBe(2);
    now = 200;
    expect(await s.count('c')).toBe(0);
  });

  it('evicts least-recently-used entries beyond maxEntries', async () => {
    const s = new MemoryStore({ maxEntries: 2 });
    await s.setIfAbsent('a', 1e6);
    await s.setIfAbsent('b', 1e6);
    await s.count('a'); // touch a
    await s.setIfAbsent('c', 1e6);
    expect(s.size).toBe(2);
    expect(await s.count('b')).toBe(0);
    expect(await s.count('a')).toBe(1);
  });
});

describe('Redis adapters (fake clients)', () => {
  function fake() {
    const data = new Map<string, number>();
    return {
      data,
      async set(key: string, _v: string, ...rest: unknown[]) {
        const nx = rest.includes('NX') || (rest[0] as { NX?: boolean } | undefined)?.NX;
        if (nx && data.has(key)) return null;
        data.set(key, 1);
        return 'OK' as const;
      },
      async eval(_script: string, ...args: unknown[]) {
        const key = typeof args[0] === 'number' ? (args[1] as string) : (args[0] as { keys: string[] }).keys[0]!;
        data.set(key, (data.get(key) ?? 0) + 1);
        return data.get(key);
      },
      async get(key: string) {
        return data.has(key) ? String(data.get(key)) : null;
      },
      async del(key: string) {
        return data.delete(key) ? 1 : 0;
      },
    };
  }

  it.each([
    ['ioredis', (c: ReturnType<typeof fake>) => ioredisStore(c as never)],
    ['node-redis', (c: ReturnType<typeof fake>) => nodeRedisStore(c as never)],
  ])('%s adapter maps the store contract', async (_name, make) => {
    const client = fake();
    const s = make(client);
    expect(await s.setIfAbsent('k', 1000)).toBe(true);
    expect(await s.setIfAbsent('k', 1000)).toBe(false);
    expect(await s.increment('n', 1000)).toBe(1);
    expect(await s.increment('n', 1000)).toBe(2);
    expect(await s.count('n')).toBe(2);
    // The default prefix deliberately keeps its pre-rename value so existing Redis data stays valid.
    expect([...client.data.keys()].every((k) => k.startsWith('nawa-guard:'))).toBe(true);
  });
});

describe('HTTP handlers', () => {
  it('validates input and never leaks internal failure reasons', async () => {
    const ctx = setup({ powBits: 8 });
    expect((await handleChallenge(ctx.guard, { body: 'nope', client: CLIENT })).status).toBe(400);
    const res = await handleChallenge(ctx.guard, { body: { type: 'pow', action: 'login' }, client: CLIENT });
    expect(res.status).toBe(200);
    expect(res.headers['Cache-Control']).toBe('no-store');
    const ch = res.body as { token: string; data: { salt: string; bits: number } };
    const bad = await handleVerify(ctx.guard, { body: { token: ch.token, answer: { nonce: 'x' } }, client: CLIENT });
    expect(bad.status).toBe(400);
    expect(bad.body).not.toHaveProperty('reason');
    // The bad attempt burned this pow challenge (maxAttempts 1): even the right nonce now fails, opaquely.
    const burned = await handleVerify(ctx.guard, { body: { token: ch.token, answer: { nonce: solvePow(ch.data.salt, ch.data.bits) } }, client: CLIENT });
    expect(burned.status).toBe(403);
    expect(burned.body).toEqual({ success: false, error: 'failed', retry: false });

    const fresh = (await handleChallenge(ctx.guard, { body: { type: 'pow' }, client: CLIENT })).body as typeof ch;
    const good = await handleVerify(ctx.guard, { body: { token: fresh.token, answer: { nonce: solvePow(fresh.data.salt, fresh.data.bits) } }, client: CLIENT });
    expect(good.status).toBe(200);
    expect(good.body).toMatchObject({ success: true, token: expect.stringMatching(/^ngp1\./) });
  });

  it('reads pass tokens from header or body field', () => {
    expect(readPassToken({ headers: { 'x-nawa-captcha-token': 'h' }, body: { 'nawa-captcha-token': 'b' } })).toBe('h');
    expect(readPassToken({ headers: {}, body: { 'nawa-captcha-token': 'b' } })).toBe('b');
    expect(readPassToken({ headers: {}, body: {} })).toBeUndefined();
    // Deprecated pre-rename names still work with the defaults (and the new names win).
    expect(readPassToken({ headers: { 'x-nawa-guard-token': 'old-h' }, body: {} })).toBe('old-h');
    expect(readPassToken({ headers: {}, body: { 'nawa-guard-token': 'old-b' } })).toBe('old-b');
    expect(readPassToken({ headers: { 'x-nawa-guard-token': 'old-h', 'x-nawa-captcha-token': 'new-h' }, body: {} })).toBe('new-h');
    expect(readPassToken({ headers: { 'x-nawa-guard-token': 'old-h' }, body: {} }, 'custom', 'x-custom')).toBeUndefined();
  });
});

describe('Express adapter', () => {
  function res() {
    const r = { statusCode: 200, headers: {} as Record<string, string>, body: '', done: Promise.resolve() as Promise<void> };
    let resolve!: () => void;
    r.done = new Promise<void>((ok) => (resolve = ok));
    const api: ResponseLike & typeof r = Object.assign(r, {
      setHeader: (k: string, v: string) => (r.headers[k] = v),
      end: (b?: string) => {
        r.body = b ?? '';
        resolve();
      },
    });
    return api;
  }

  it('serves /challenge and /verify, and requireCaptcha guards a route', async () => {
    const ctx = setup({ powBits: 8 });
    const mw = nawaCaptchaExpress(ctx.guard);
    const base = { ip: CLIENT.ip, headers: { 'user-agent': CLIENT.userAgent } };

    const r1 = res();
    mw({ ...base, method: 'POST', path: '/challenge', body: { type: 'pow', action: 'login' } }, r1, () => {});
    await r1.done;
    const ch = JSON.parse(r1.body);
    expect(r1.statusCode).toBe(200);

    const r2 = res();
    mw({ ...base, method: 'POST', path: '/verify', body: { token: ch.token, answer: { nonce: solvePow(ch.data.salt, ch.data.bits) } } }, r2, () => {});
    await r2.done;
    const { token } = JSON.parse(r2.body);
    expect(token).toMatch(/^ngp1\./);

    const guardMw = requireCaptcha(ctx.guard, { expectedAction: 'login' });
    let passed = false;
    const req: RequestLike = { ...base, method: 'POST', body: { 'nawa-captcha-token': token } };
    await new Promise<void>((done) => guardMw(req, res(), () => ((passed = true), done())));
    expect(passed).toBe(true);
    expect(req.nawaCaptcha?.act).toBe('login');

    const r3 = res();
    guardMw({ ...base, method: 'POST', body: { 'nawa-captcha-token': token } }, r3, () => {});
    await r3.done;
    expect(r3.statusCode).toBe(403);
    expect(JSON.parse(r3.body)).toEqual({ error: 'captcha-required', code: 'replayed' });

    const r4 = res();
    let nextCalled = false;
    mw({ ...base, method: 'GET', path: '/challenge' }, r4, () => (nextCalled = true));
    await r4.done;
    expect(r4.statusCode).toBe(405);
    mw({ ...base, method: 'GET', path: '/other' }, res(), () => (nextCalled = true));
    expect(nextCalled).toBe(true);
  });
});

describe('rename compatibility (Nawa Guard → Nawa Captcha)', () => {
  it('keeps the deprecated server entry points as aliases', async () => {
    const mod = await import('../src/index.js');
    const express = await import('../src/express.js');
    expect(mod.createNawaGuard).toBe(mod.createNawaCaptcha);
    expect(mod.NawaGuard).toBe(mod.NawaCaptcha);
    expect(express.nawaGuardExpress).toBe(express.nawaCaptchaExpress);
    expect(mod.LEGACY_TOKEN_HEADER).toBe('x-nawa-guard-token');
    expect(mod.DEFAULT_TOKEN_HEADER).toBe('x-nawa-captcha-token');
    expect(mod.HKDF_SALT).toBe('nawa-guard/v1'); // wire format: never renamed
  });
});
