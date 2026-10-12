import { BIND_MODES, type BindMode } from './binding.js';
import { b64url, fromB64url, hmac, isValidKid, open, safeEqual, seal, type Keyring } from './crypto.js';
import type { ChallengeType } from './types.js';

export const CHALLENGE_PREFIX = 'ngc1';
export const PASS_PREFIX = 'ngp1';
/** Upper bound for anything that claims to be a token; checked before any parsing. */
export const MAX_TOKEN_LENGTH = 8192;

/** Contents of a challenge token. Sealed with AES-256-GCM: the client can neither read nor alter it. */
export interface ChallengeClaims {
  readonly v: 1;
  /** Random challenge id; the one-time-redemption and attempt-counter key. */
  readonly id: string;
  readonly typ: ChallengeType;
  readonly sk: string;
  readonly act: string;
  readonly lang: string;
  /** Issued-at / expiry in unix milliseconds (ms precision is needed for minimum solve time). */
  readonly iat: number;
  readonly exp: number;
  /** Difficulty level that produced this challenge. */
  readonly lvl: number;
  readonly cbm: BindMode;
  readonly cb?: string;
  /** Type-specific solution. Never leaves the server in readable form. */
  readonly sol: unknown;
}

/** Contents of a pass token. Signed (HMAC-SHA256), readable by design; holds no secret. */
export interface PassTokenClaims {
  readonly v: 1;
  readonly jti: string;
  readonly sk: string;
  readonly act: string;
  readonly typ: ChallengeType;
  readonly lvl: number;
  /** Unix seconds. */
  readonly iat: number;
  readonly exp: number;
  readonly cbm: BindMode;
  readonly cb?: string;
}

// ------------------------------------------------------------------ challenge tokens

export function sealChallenge(keys: Keyring, claims: ChallengeClaims): string {
  const kid = keys.activeKid;
  const key = keys.key(kid, 'challenge-token');
  if (!key) throw new Error('nawa-guard: active key missing');
  const aad = `${CHALLENGE_PREFIX}.${kid}`;
  const { iv, data } = seal(key, JSON.stringify(claims), aad);
  return `${aad}.${b64url(iv)}.${b64url(data)}`;
}

export function openChallenge(keys: Keyring, token: string): { claims: ChallengeClaims; kid: string } | undefined {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return undefined;
  const parts = token.split('.');
  if (parts.length !== 4) return undefined;
  const [prefix, kid, ivText, dataText] = parts as [string, string, string, string];
  if (prefix !== CHALLENGE_PREFIX || !isValidKid(kid)) return undefined;
  const key = keys.key(kid, 'challenge-token');
  const iv = fromB64url(ivText);
  const data = fromB64url(dataText);
  if (!key || !iv || !data) return undefined;
  const json = open(key, iv, data, `${prefix}.${kid}`);
  if (json === undefined) return undefined;
  try {
    const claims = JSON.parse(json) as ChallengeClaims;
    return claims && claims.v === 1 && typeof claims.id === 'string' ? { claims, kid } : undefined;
  } catch {
    return undefined;
  }
}

// ------------------------------------------------------------------ pass tokens

/**
 * Format (documented in README and mirrored by the .NET verifier):
 *   ngp1.<kid>.<base64url(JSON claims)>.<base64url(HMAC-SHA256(K_pass, "ngp1.<kid>.<payload>"))>
 */
export function signPassToken(keys: Keyring, claims: PassTokenClaims): string {
  const kid = keys.activeKid;
  const key = keys.key(kid, 'pass-token');
  if (!key) throw new Error('nawa-guard: active key missing');
  const head = `${PASS_PREFIX}.${kid}.${b64url(Buffer.from(JSON.stringify(claims), 'utf8'))}`;
  return `${head}.${b64url(hmac(key, head))}`;
}

export type PassTokenParse =
  | { ok: true; claims: PassTokenClaims; kid: string }
  | { ok: false; error: 'malformed' | 'unknown-key' | 'bad-signature' };

export function parsePassToken(keys: Keyring, token: string): PassTokenParse {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) return { ok: false, error: 'malformed' };
  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, error: 'malformed' };
  const [prefix, kid, payload, sig] = parts as [string, string, string, string];
  if (prefix !== PASS_PREFIX || !isValidKid(kid)) return { ok: false, error: 'malformed' };
  const key = keys.key(kid, 'pass-token');
  if (!key) return { ok: false, error: 'unknown-key' };
  const sigBytes = fromB64url(sig);
  if (!sigBytes || !fromB64url(payload)) return { ok: false, error: 'malformed' };
  // Signature first: nothing inside the payload is trusted (or even parsed) before it verifies.
  if (!safeEqual(sigBytes, hmac(key, `${prefix}.${kid}.${payload}`))) return { ok: false, error: 'bad-signature' };
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as PassTokenClaims;
    if (!isPassClaims(claims)) return { ok: false, error: 'malformed' };
    return { ok: true, claims, kid };
  } catch {
    return { ok: false, error: 'malformed' };
  }
}

function isPassClaims(c: unknown): c is PassTokenClaims {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    o['v'] === 1 &&
    typeof o['jti'] === 'string' &&
    typeof o['sk'] === 'string' &&
    typeof o['act'] === 'string' &&
    typeof o['typ'] === 'string' &&
    Number.isInteger(o['iat']) &&
    Number.isInteger(o['exp']) &&
    Number.isInteger(o['lvl']) &&
    typeof o['cbm'] === 'string' &&
    BIND_MODES.includes(o['cbm'] as BindMode) &&
    (o['cb'] === undefined || typeof o['cb'] === 'string')
  );
}
