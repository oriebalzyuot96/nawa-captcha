import { describe, expect, it } from 'vitest';
import { createKeyring, openChallenge, parsePassToken, sealChallenge, signPassToken, type ChallengeClaims, type PassTokenClaims } from '../src/index.js';
import { SECRET } from './helpers.js';

const claims: ChallengeClaims = {
  v: 1,
  id: 'abc',
  typ: 'slider',
  sk: 'site',
  act: 'login',
  lang: 'en',
  iat: 1,
  exp: 2,
  lvl: 0,
  cbm: 'none',
  sol: { x: 137 },
};

const pass: PassTokenClaims = { v: 1, jti: 'j1', sk: 'site', act: 'login', typ: 'slider', lvl: 0, iat: 100, exp: 220, cbm: 'none' };

function flip(token: string, part: number): string {
  const parts = token.split('.');
  const p = parts[part]!;
  const i = Math.floor(p.length / 2);
  parts[part] = p.slice(0, i) + (p[i] === 'A' ? 'B' : 'A') + p.slice(i + 1);
  return parts.join('.');
}

describe('challenge token sealing (AES-256-GCM)', () => {
  const keys = createKeyring(SECRET);

  it('round-trips and keeps the solution unreadable', () => {
    const token = sealChallenge(keys, claims);
    expect(token.startsWith('ngc1.k1.')).toBe(true);
    const raw = token
      .split('.')
      .slice(2)
      .map((p) => Buffer.from(p, 'base64url').toString('latin1'))
      .join('');
    expect(raw).not.toContain('137');
    expect(raw).not.toContain('"sol"');
    expect(openChallenge(keys, token)?.claims).toEqual(claims);
  });

  it('uses a fresh IV per token (same claims → different tokens)', () => {
    expect(sealChallenge(keys, claims)).not.toBe(sealChallenge(keys, claims));
  });

  it('rejects any tampering with ciphertext, IV, or kid', () => {
    const token = sealChallenge(keys, claims);
    expect(openChallenge(keys, flip(token, 3))).toBeUndefined();
    expect(openChallenge(keys, flip(token, 2))).toBeUndefined();
    expect(openChallenge(keys, token.replace('.k1.', '.k2.'))).toBeUndefined();
    expect(openChallenge(keys, token.replace('ngc1', 'ngc2'))).toBeUndefined();
    expect(openChallenge(keys, 'garbage')).toBeUndefined();
    expect(openChallenge(keys, 'x'.repeat(9000))).toBeUndefined();
  });

  it('rejects tokens sealed under another secret', () => {
    const other = createKeyring('another-secret-0123456789-abcdefghijklmn');
    expect(openChallenge(other, sealChallenge(keys, claims))).toBeUndefined();
  });

  it('supports rotation: old kid still opens, new tokens use the first kid', () => {
    const old = createKeyring([{ kid: 'old', secret: SECRET }]);
    const rotated = createKeyring([
      { kid: 'new', secret: 'rotated-secret-0123456789-abcdefghijklmn' },
      { kid: 'old', secret: SECRET },
    ]);
    const legacy = sealChallenge(old, claims);
    expect(openChallenge(rotated, legacy)?.kid).toBe('old');
    expect(sealChallenge(rotated, claims).startsWith('ngc1.new.')).toBe(true);
  });

  it('refuses weak secrets and malformed kids', () => {
    expect(() => createKeyring('short')).toThrow();
    expect(() => createKeyring([{ kid: 'bad kid', secret: SECRET }])).toThrow();
    expect(() => createKeyring([])).toThrow();
  });
});

describe('pass token signing (HMAC-SHA256)', () => {
  const keys = createKeyring(SECRET);

  it('round-trips', () => {
    const token = signPassToken(keys, pass);
    expect(token.split('.')).toHaveLength(4);
    const parsed = parsePassToken(keys, token);
    expect(parsed.ok && parsed.claims).toEqual(pass);
  });

  it('detects payload and signature tampering', () => {
    const token = signPassToken(keys, pass);
    const forged = token.split('.');
    forged[2] = Buffer.from(JSON.stringify({ ...pass, act: 'admin' })).toString('base64url');
    expect(parsePassToken(keys, forged.join('.'))).toEqual({ ok: false, error: 'bad-signature' });
    expect(parsePassToken(keys, flip(token, 3))).toMatchObject({ ok: false });
    expect(parsePassToken(keys, token.replace('.k1.', '.zz.'))).toEqual({ ok: false, error: 'unknown-key' });
    expect(parsePassToken(keys, 'a.b.c')).toEqual({ ok: false, error: 'malformed' });
  });
});
