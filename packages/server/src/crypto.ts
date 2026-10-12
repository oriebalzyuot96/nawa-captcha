import { aesGcmDecrypt, aesGcmEncrypt, fromBase64, hkdfSha256, hmacSha256, randomBytes, sha256 as sha256Bytes, timingSafeEqual } from './primitives.js';
import { bytesToB64url, cryptoRng } from './rng.js';

/** HKDF salt shared by every Nawa Guard implementation (Node, .NET). Changing it breaks interop. */
export const HKDF_SALT = 'nawa-guard/v1';

export type KeyPurpose = 'challenge-token' | 'pass-token' | 'client-binding';

export interface SecretEntry {
  /** Key id embedded in every token so secrets can be rotated. 1-16 chars of [A-Za-z0-9_-]. */
  readonly kid: string;
  /** High-entropy secret, at least 32 characters. Never ship it to a browser. */
  readonly secret: string;
}

export interface Keyring {
  /** The kid used for new tokens (first entry). */
  readonly activeKid: string;
  key(kid: string, purpose: KeyPurpose): Uint8Array | undefined;
}

const KID_RE = /^[A-Za-z0-9_-]{1,16}$/;
export const MIN_SECRET_LENGTH = 32;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export const utf8 = (text: string): Uint8Array => encoder.encode(text);
export function fromUtf8(bytes: Uint8Array): string | undefined {
  try {
    return decoder.decode(bytes);
  } catch {
    return undefined;
  }
}

export function deriveKey(secret: string, purpose: KeyPurpose): Uint8Array {
  return hkdfSha256(utf8(secret), utf8(HKDF_SALT), utf8(purpose), 32);
}

/**
 * Builds a keyring from one or more secrets. The first entry signs/seals new tokens; all entries
 * are accepted when opening/verifying, which is what makes zero-downtime rotation possible.
 */
export function createKeyring(secrets: string | readonly SecretEntry[]): Keyring {
  const list: readonly SecretEntry[] = typeof secrets === 'string' ? [{ kid: 'k1', secret: secrets }] : secrets;
  if (list.length === 0) throw new Error('nawa-guard: at least one secret is required');
  const keys = new Map<string, Map<KeyPurpose, Uint8Array>>();
  for (const { kid, secret } of list) {
    if (!KID_RE.test(kid)) throw new Error(`nawa-guard: invalid kid "${kid}" (1-16 chars of A-Z a-z 0-9 _ -)`);
    if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`nawa-guard: secret for kid "${kid}" must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    if (keys.has(kid)) throw new Error(`nawa-guard: duplicate kid "${kid}"`);
    keys.set(
      kid,
      new Map<KeyPurpose, Uint8Array>([
        ['challenge-token', deriveKey(secret, 'challenge-token')],
        ['pass-token', deriveKey(secret, 'pass-token')],
        ['client-binding', deriveKey(secret, 'client-binding')],
      ]),
    );
  }
  const first = list[0];
  if (!first) throw new Error('nawa-guard: at least one secret is required');
  return {
    activeKid: first.kid,
    key: (kid, purpose) => keys.get(kid)?.get(purpose),
  };
}

export function isValidKid(kid: string): boolean {
  return KID_RE.test(kid);
}

export function b64url(buf: Uint8Array): string {
  return bytesToB64url(buf);
}

const B64URL_RE = /^[A-Za-z0-9_-]*$/;

export function fromB64url(text: string): Uint8Array | undefined {
  if (!B64URL_RE.test(text) || text.length % 4 === 1) return undefined;
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return fromBase64(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  } catch {
    return undefined;
  }
}

export function randomId(bytes = 16): string {
  return b64url(randomBytes(bytes));
}

export function hmac(key: Uint8Array, data: string): Uint8Array {
  return hmacSha256(key, utf8(data));
}

export function sha256(data: string | Uint8Array): Uint8Array {
  return sha256Bytes(typeof data === 'string' ? utf8(data) : data);
}

/** Constant-time equality that is also safe for inputs of different lengths. */
export function safeEqual(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const left = typeof a === 'string' ? utf8(a) : a;
  const right = typeof b === 'string' ? utf8(b) : b;
  if (left.length !== right.length) {
    // Still burn a comparison so the timing does not reveal the length mismatch early.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** AES-256-GCM seal: returns iv(12) and ciphertext||tag(16). */
export function seal(key: Uint8Array, plaintext: string, aad: string): { iv: Uint8Array; data: Uint8Array } {
  const iv = randomBytes(12);
  return { iv, data: aesGcmEncrypt(key, iv, utf8(plaintext), utf8(aad)) };
}

export function open(key: Uint8Array, iv: Uint8Array, data: Uint8Array, aad: string): string | undefined {
  if (iv.length !== 12 || data.length < 17) return undefined;
  const plain = aesGcmDecrypt(key, iv, data, utf8(aad));
  return plain ? fromUtf8(plain) : undefined;
}

// ---------------------------------------------------------------- randomness helpers (CSPRNG only)

/** Uniform integer in [min, maxExclusive); fractional bounds are rounded inward. */
export const randInt = (min: number, maxExclusive: number): number => cryptoRng.int(min, maxExclusive);
export const randFloat = (min = 0, max = 1): number => cryptoRng.float(min, max);
export const pick = <T>(items: readonly T[]): T => cryptoRng.pick(items);
export const shuffle = <T>(items: T[]): T[] => cryptoRng.shuffle(items);
export const sample = <T>(items: readonly T[], count: number): T[] => cryptoRng.sample(items, count);
