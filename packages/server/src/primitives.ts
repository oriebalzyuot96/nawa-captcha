/*
 * Platform primitives (Node build). Everything else in the server is platform-agnostic and only
 * reaches the platform through this module. `primitives.browser.ts` implements the same exports
 * without Node built-ins; bundlers pick it through the package.json "browser" map (the site's
 * demo mode uses it to run the real engine in a web page).
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes as nodeRandomBytes, randomInt as nodeRandomInt, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import { deflateSync } from 'node:zlib';

export const PLATFORM = 'node' as const;

export function randomBytes(n: number): Uint8Array {
  return new Uint8Array(nodeRandomBytes(n));
}

/** Uniform integer in [min, maxExclusive). */
export function randomInt(min: number, maxExclusive: number): number {
  return nodeRandomInt(min, maxExclusive);
}

export function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

export function hmacSha256(key: Uint8Array, data: Uint8Array): Uint8Array {
  return new Uint8Array(createHmac('sha256', key).update(data).digest());
}

export function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  return new Uint8Array(hkdfSync('sha256', ikm, salt, info, length));
}

/** AES-256-GCM: returns ciphertext || tag(16). */
export function aesGcmEncrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Uint8Array {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return new Uint8Array(Buffer.concat([ct, cipher.getAuthTag()]));
}

/** Opens ciphertext || tag(16); undefined when the tag does not verify. */
export function aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array, aad: Uint8Array): Uint8Array | undefined {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(data.subarray(data.length - 16));
    return new Uint8Array(Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]));
  } catch {
    return undefined;
  }
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && nodeTimingSafeEqual(a, b);
}

/** zlib-wrapped deflate (what PNG IDAT expects). */
export function deflate(raw: Uint8Array): Uint8Array {
  return new Uint8Array(deflateSync(raw, { level: 9 }));
}

export function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

export function fromBase64(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'base64'));
}
