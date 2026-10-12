import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

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
  key(kid: string, purpose: KeyPurpose): Buffer | undefined;
}

const KID_RE = /^[A-Za-z0-9_-]{1,16}$/;
export const MIN_SECRET_LENGTH = 32;

export function deriveKey(secret: string, purpose: KeyPurpose): Buffer {
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.from(HKDF_SALT, 'utf8'), Buffer.from(purpose, 'utf8'), 32));
}

/**
 * Builds a keyring from one or more secrets. The first entry signs/seals new tokens; all entries
 * are accepted when opening/verifying, which is what makes zero-downtime rotation possible.
 */
export function createKeyring(secrets: string | readonly SecretEntry[]): Keyring {
  const list: readonly SecretEntry[] = typeof secrets === 'string' ? [{ kid: 'k1', secret: secrets }] : secrets;
  if (list.length === 0) throw new Error('nawa-guard: at least one secret is required');
  const keys = new Map<string, Map<KeyPurpose, Buffer>>();
  for (const { kid, secret } of list) {
    if (!KID_RE.test(kid)) throw new Error(`nawa-guard: invalid kid "${kid}" (1-16 chars of A-Z a-z 0-9 _ -)`);
    if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`nawa-guard: secret for kid "${kid}" must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    if (keys.has(kid)) throw new Error(`nawa-guard: duplicate kid "${kid}"`);
    keys.set(
      kid,
      new Map<KeyPurpose, Buffer>([
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
  return Buffer.from(buf).toString('base64url');
}

const B64URL_RE = /^[A-Za-z0-9_-]*$/;

export function fromB64url(text: string): Buffer | undefined {
  if (!B64URL_RE.test(text)) return undefined;
  return Buffer.from(text, 'base64url');
}

export function randomId(bytes = 16): string {
  return b64url(randomBytes(bytes));
}

export function hmac(key: Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

export function sha256(data: string | Uint8Array): Buffer {
  return createHash('sha256').update(data).digest();
}

/** Constant-time equality that is also safe for inputs of different lengths. */
export function safeEqual(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const left = typeof a === 'string' ? Buffer.from(a, 'utf8') : Buffer.from(a);
  const right = typeof b === 'string' ? Buffer.from(b, 'utf8') : Buffer.from(b);
  if (left.length !== right.length) {
    // Still burn a comparison so the timing does not reveal the length mismatch early.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** AES-256-GCM seal: returns iv(12) and ciphertext||tag(16). */
export function seal(key: Buffer, plaintext: string, aad: string): { iv: Buffer; data: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv, data: Buffer.concat([ct, cipher.getAuthTag()]) };
}

export function open(key: Buffer, iv: Buffer, data: Buffer, aad: string): string | undefined {
  if (iv.length !== 12 || data.length < 17) return undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(data.subarray(data.length - 16));
    return Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString('utf8');
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- randomness helpers (CSPRNG only)

/** Uniform integer in [min, maxExclusive); fractional bounds are rounded inward. */
export function randInt(min: number, maxExclusive: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(maxExclusive);
  return hi <= lo ? lo : randomInt(lo, hi);
}

export function randFloat(min = 0, max = 1): number {
  // 48 bits of entropy is plenty for geometry jitter.
  return min + (randomBytes(6).readUIntBE(0, 6) / 2 ** 48) * (max - min);
}

export function pick<T>(items: readonly T[]): T {
  const item = items[randomInt(0, items.length)];
  if (item === undefined) throw new Error('nawa-guard: pick from empty list');
  return item;
}

export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
  return items;
}

export function sample<T>(items: readonly T[], count: number): T[] {
  return shuffle([...items]).slice(0, count);
}
