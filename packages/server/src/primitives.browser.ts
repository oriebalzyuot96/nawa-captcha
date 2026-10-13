/*
 * Platform primitives without Node built-ins (browser / workers / edge runtimes). Same exports as
 * `primitives.ts`. Everything is synchronous so the engine's API does not change:
 *   - randomness: crypto.getRandomValues (a CSPRNG in every modern runtime)
 *   - SHA-256, HMAC-SHA256, HKDF-SHA256, AES-256-GCM: small, dependency-free implementations,
 *     tested byte-for-byte against node:crypto (packages/server/test/primitives.test.ts)
 *   - deflate: stored (uncompressed) zlib blocks. Valid PNGs, just larger; fine in-page.
 *
 * This file exists for the in-browser demo mode. A real deployment keeps the secret on a server;
 * a page that holds the secret can of course mint its own tokens.
 */

export const PLATFORM = 'browser' as const;

const webcrypto = (globalThis as { crypto?: { getRandomValues<T extends ArrayBufferView>(a: T): T } }).crypto;

export function randomBytes(n: number): Uint8Array {
  if (!webcrypto) throw new Error('nawa-captcha: crypto.getRandomValues is not available');
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) webcrypto.getRandomValues(out.subarray(i, Math.min(n, i + 65536)));
  return out;
}

/** Uniform integer in [min, maxExclusive) by rejection sampling (no modulo bias). */
export function randomInt(min: number, maxExclusive: number): number {
  const range = maxExclusive - min;
  if (!(range > 0) || range > 2 ** 32) throw new RangeError('nawa-captcha: bad randomInt range');
  const limit = Math.floor(2 ** 32 / range) * range;
  const buf = new Uint32Array(1);
  for (;;) {
    webcrypto!.getRandomValues(buf);
    const v = buf[0]!;
    if (v < limit) return min + (v % range);
  }
}

// ------------------------------------------------------------------------------ SHA-256

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const W = new Uint32Array(64);
const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

export function sha256(data: Uint8Array): Uint8Array {
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, (len * 8) >>> 0);
  dv.setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i += 1) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const a = W[i - 15]!;
      const b = W[i - 2]!;
      W[i] = (W[i - 16]! + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + W[i - 7]! + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0;
    }
    let a = h[0]!, b = h[1]!, c = h[2]!, d = h[3]!, e = h[4]!, f = h[5]!, g = h[6]!, hh = h[7]!;
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + W[i]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0]! + a) | 0;
    h[1] = (h[1]! + b) | 0;
    h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0;
    h[5] = (h[5]! + f) | 0;
    h[6] = (h[6]! + g) | 0;
    h[7] = (h[7]! + hh) | 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) odv.setUint32(i * 4, h[i]!);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  let k = key.length > 64 ? sha256(key) : key;
  const block = new Uint8Array(64);
  block.set(k);
  k = block;
  const ipad = k.map((b) => b ^ 0x36);
  const opad = k.map((b) => b ^ 0x5c);
  return sha256(concat(opad, sha256(concat(ipad, data))));
}

/** RFC 5869. */
export function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const prk = hmacSha256(salt.length ? salt : new Uint8Array(32), ikm);
  const out = new Uint8Array(length);
  let prev: Uint8Array = new Uint8Array(0);
  for (let i = 1, o = 0; o < length; i += 1) {
    prev = hmacSha256(prk, concat(prev, info, new Uint8Array([i])));
    out.set(prev.subarray(0, Math.min(prev.length, length - o)), o);
    o += prev.length;
  }
  return out;
}

// ------------------------------------------------------------------------------ AES-256-GCM

const SBOX = new Uint8Array(256);
(() => {
  // Build the S-box from the GF(2^8) inverse + affine transform (no 256-byte literal to mistype).
  let p = 1;
  let q = 1;
  do {
    p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    const x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    SBOX[p] = (x ^ 0x63) & 0xff;
  } while (p !== 1);
  SBOX[0] = 0x63;
})();

const xtime = (b: number): number => ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;

function expandKey(key: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('nawa-captcha: AES-256 needs a 32-byte key');
  const w = new Uint8Array(240);
  w.set(key);
  let rcon = 1;
  for (let i = 32; i < 240; i += 4) {
    let t0 = w[i - 4]!, t1 = w[i - 3]!, t2 = w[i - 2]!, t3 = w[i - 1]!;
    if (i % 32 === 0) {
      const tmp = t0;
      t0 = SBOX[t1]! ^ rcon;
      t1 = SBOX[t2]!;
      t2 = SBOX[t3]!;
      t3 = SBOX[tmp]!;
      rcon = xtime(rcon);
    } else if (i % 32 === 16) {
      t0 = SBOX[t0]!;
      t1 = SBOX[t1]!;
      t2 = SBOX[t2]!;
      t3 = SBOX[t3]!;
    }
    w[i] = w[i - 32]! ^ t0;
    w[i + 1] = w[i - 31]! ^ t1;
    w[i + 2] = w[i - 30]! ^ t2;
    w[i + 3] = w[i - 29]! ^ t3;
  }
  return w;
}

function encryptBlock(w: Uint8Array, input: Uint8Array): Uint8Array {
  const s = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) s[i] = input[i]! ^ w[i]!;
  const t = new Uint8Array(16);
  for (let round = 1; round <= 14; round += 1) {
    // SubBytes + ShiftRows (column-major state)
    for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) t[c * 4 + r] = SBOX[s[((c + r) % 4) * 4 + r]!]!;
    if (round < 14) {
      for (let c = 0; c < 4; c += 1) {
        const a0 = t[c * 4]!, a1 = t[c * 4 + 1]!, a2 = t[c * 4 + 2]!, a3 = t[c * 4 + 3]!;
        const all = a0 ^ a1 ^ a2 ^ a3;
        s[c * 4] = a0 ^ all ^ xtime(a0 ^ a1);
        s[c * 4 + 1] = a1 ^ all ^ xtime(a1 ^ a2);
        s[c * 4 + 2] = a2 ^ all ^ xtime(a2 ^ a3);
        s[c * 4 + 3] = a3 ^ all ^ xtime(a3 ^ a0);
      }
    } else s.set(t);
    for (let i = 0; i < 16; i += 1) s[i]! ^= w[round * 16 + i]!;
  }
  return s;
}

function gfMul(x: Uint8Array, y: Uint8Array): Uint8Array {
  const z = new Uint8Array(16);
  const v = Uint8Array.from(y);
  for (let i = 0; i < 128; i += 1) {
    if ((x[i >> 3]! >> (7 - (i & 7))) & 1) for (let k = 0; k < 16; k += 1) z[k]! ^= v[k]!;
    const lsb = v[15]! & 1;
    for (let k = 15; k > 0; k -= 1) v[k] = (v[k]! >> 1) | ((v[k - 1]! & 1) << 7);
    v[0] = v[0]! >> 1;
    if (lsb) v[0]! ^= 0xe1;
  }
  return z;
}

function ghash(h: Uint8Array, aad: Uint8Array, ct: Uint8Array): Uint8Array {
  let y: Uint8Array = new Uint8Array(16);
  const absorb = (data: Uint8Array): void => {
    for (let off = 0; off < data.length; off += 16) {
      const block = new Uint8Array(16);
      block.set(data.subarray(off, off + 16));
      for (let k = 0; k < 16; k += 1) block[k]! ^= y[k]!;
      y = gfMul(block, h);
    }
  };
  absorb(aad);
  absorb(ct);
  const lens = new Uint8Array(16);
  const dv = new DataView(lens.buffer);
  dv.setUint32(4, (aad.length * 8) >>> 0);
  dv.setUint32(0, Math.floor((aad.length * 8) / 2 ** 32));
  dv.setUint32(12, (ct.length * 8) >>> 0);
  dv.setUint32(8, Math.floor((ct.length * 8) / 2 ** 32));
  for (let k = 0; k < 16; k += 1) lens[k]! ^= y[k]!;
  return gfMul(lens, h);
}

function ctr(w: Uint8Array, j0: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  const counter = Uint8Array.from(j0);
  const dv = new DataView(counter.buffer);
  for (let off = 0; off < data.length; off += 16) {
    dv.setUint32(12, (dv.getUint32(12) + 1) >>> 0);
    const ks = encryptBlock(w, counter);
    for (let k = 0; k < 16 && off + k < data.length; k += 1) out[off + k] = data[off + k]! ^ ks[k]!;
  }
  return out;
}

function gcmSetup(key: Uint8Array, iv: Uint8Array): { w: Uint8Array; h: Uint8Array; j0: Uint8Array } {
  if (iv.length !== 12) throw new Error('nawa-captcha: GCM needs a 12-byte IV');
  const w = expandKey(key);
  const h = encryptBlock(w, new Uint8Array(16));
  const j0 = new Uint8Array(16);
  j0.set(iv);
  j0[15] = 1;
  return { w, h, j0 };
}

export function aesGcmEncrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array {
  const { w, h, j0 } = gcmSetup(key, iv);
  const ct = ctr(w, j0, plaintext);
  const s = ghash(h, aad, ct);
  const ek = encryptBlock(w, j0);
  const tag = s.map((b, i) => b ^ ek[i]!);
  return concat(ct, tag);
}

export function aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array, aad: Uint8Array): Uint8Array | undefined {
  if (data.length < 16) return undefined;
  const { w, h, j0 } = gcmSetup(key, iv);
  const ct = data.subarray(0, data.length - 16);
  const s = ghash(h, aad, ct);
  const ek = encryptBlock(w, j0);
  const tag = s.map((b, i) => b ^ ek[i]!);
  if (!timingSafeEqual(tag, data.subarray(data.length - 16))) return undefined;
  return ctr(w, j0, ct);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ------------------------------------------------------------------------------ deflate (stored)

export function deflate(raw: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(raw.length / 65535));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let o = 2;
  for (let b = 0; b < blocks; b += 1) {
    const start = b * 65535;
    const len = Math.min(65535, raw.length - start);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = len & 0xff;
    out[o++] = len >> 8;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >> 8) & 0xff;
    out.set(raw.subarray(start, start + len), o);
    o += len;
  }
  let a = 1;
  let c = 0;
  for (let i = 0; i < raw.length; i += 1) {
    a = (a + raw[i]!) % 65521;
    c = (c + a) % 65521;
  }
  new DataView(out.buffer).setUint32(o, ((c << 16) | a) >>> 0);
  return out;
}

// ------------------------------------------------------------------------------ base64

export function base64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function fromBase64(text: string): Uint8Array {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
