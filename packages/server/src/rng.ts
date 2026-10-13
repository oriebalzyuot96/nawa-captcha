import { randomBytes, randomInt, sha256 } from './primitives.js';

/**
 * Source of randomness for puzzle generation. Production always uses {@link cryptoRng} (CSPRNG).
 * {@link seededRng} exists so tests can assert that generation is deterministic for a seed; it is
 * never used by the engine.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, maxExclusive); fractional bounds are rounded inward. */
  int(min: number, maxExclusive: number): number;
  /** Uniform float in [min, max). */
  float(min?: number, max?: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: T[]): T[];
  sample<T>(items: readonly T[], count: number): T[];
  bytes(n: number): Uint8Array;
  /** base64url id with `bytes` bytes of entropy. */
  id(bytes?: number): string;
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function bytesToB64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64URL[n >> 18]! + B64URL[(n >> 12) & 63]! + B64URL[(n >> 6) & 63]! + B64URL[n & 63]!;
  }
  if (i < bytes.length) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += B64URL[n >> 18]! + B64URL[(n >> 12) & 63]!;
    if (i + 1 < bytes.length) out += B64URL[(n >> 6) & 63]!;
  }
  return out;
}

function build(next: () => number, bytes: (n: number) => Uint8Array, intImpl?: (lo: number, hi: number) => number): Rng {
  const rng: Rng = {
    next,
    int(min, maxExclusive) {
      const lo = Math.ceil(min);
      const hi = Math.floor(maxExclusive);
      if (hi <= lo) return lo;
      return intImpl ? intImpl(lo, hi) : lo + Math.floor(next() * (hi - lo));
    },
    float(min = 0, max = 1) {
      return min + next() * (max - min);
    },
    pick(items) {
      const item = items[rng.int(0, items.length)];
      if (item === undefined) throw new Error('nawa-captcha: pick from empty list');
      return item;
    },
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i -= 1) {
        const j = rng.int(0, i + 1);
        const a = items[i]!;
        items[i] = items[j]!;
        items[j] = a;
      }
      return items;
    },
    sample(items, count) {
      return rng.shuffle([...items]).slice(0, count);
    },
    bytes,
    id(n = 16) {
      return bytesToB64url(bytes(n));
    },
  };
  return rng;
}

/** CSPRNG-backed randomness (node:crypto or crypto.getRandomValues). */
export const cryptoRng: Rng = build(
  () => {
    const b = randomBytes(6);
    // 48 bits of entropy is plenty for geometry jitter.
    return ((b[0]! * 2 ** 40) + (b[1]! * 2 ** 32) + (((b[2]! << 24) | (b[3]! << 16) | (b[4]! << 8) | b[5]!) >>> 0)) / 2 ** 48;
  },
  randomBytes,
  (lo, hi) => randomInt(lo, hi),
);

/** Deterministic sfc32 generator seeded from SHA-256(seed). For tests and tooling only. */
export function seededRng(seed: string | number): Rng {
  const h = sha256(new TextEncoder().encode(`nawa-guard-seed:${seed}`));
  const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
  let a = dv.getUint32(0);
  let b = dv.getUint32(4);
  let c = dv.getUint32(8);
  let d = dv.getUint32(12);
  const next = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i += 1) next();
  return build(next, (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) out[i] = Math.floor(next() * 256);
    return out;
  });
}
