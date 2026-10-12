import { createCipheriv, createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import * as browser from '../src/primitives.browser.js';
import * as node from '../src/primitives.js';

const sizes = [0, 1, 15, 16, 17, 55, 56, 63, 64, 65, 200, 1000];

describe('browser primitives (demo mode) match node:crypto byte for byte', () => {
  it('SHA-256 and HMAC-SHA256', () => {
    for (const n of sizes) {
      const data = randomBytes(n);
      const key = randomBytes(n % 3 === 0 ? 100 : 32);
      expect(Buffer.from(browser.sha256(data)).toString('hex')).toBe(createHash('sha256').update(data).digest('hex'));
      expect(Buffer.from(browser.hmacSha256(key, data)).toString('hex')).toBe(createHmac('sha256', key).update(data).digest('hex'));
    }
  });

  it('HKDF-SHA256', () => {
    for (const len of [16, 32, 64]) {
      const ikm = randomBytes(40);
      const salt = Buffer.from('nawa-guard/v1');
      const info = Buffer.from('pass-token');
      expect(Buffer.from(browser.hkdfSha256(ikm, salt, info, len)).toString('hex')).toBe(Buffer.from(hkdfSync('sha256', ikm, salt, info, len)).toString('hex'));
    }
  });

  it('AES-256-GCM interoperates in both directions and rejects tampering', () => {
    for (const n of sizes) {
      const key = randomBytes(32);
      const iv = randomBytes(12);
      const aad = randomBytes(n % 20);
      const plain = randomBytes(n);
      const c = createCipheriv('aes-256-gcm', key, iv);
      c.setAAD(aad);
      const nodeCt = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
      expect(Buffer.from(browser.aesGcmEncrypt(key, iv, plain, aad)).toString('hex')).toBe(nodeCt.toString('hex'));
      expect(Buffer.from(browser.aesGcmDecrypt(key, iv, nodeCt, aad)!).toString('hex')).toBe(plain.toString('hex'));
      expect(Buffer.from(node.aesGcmDecrypt(key, iv, browser.aesGcmEncrypt(key, iv, plain, aad), aad)!).toString('hex')).toBe(plain.toString('hex'));
      const bad = Buffer.from(nodeCt);
      bad[0] = (bad[0] ?? 0) ^ 1;
      expect(browser.aesGcmDecrypt(key, iv, bad, aad)).toBeUndefined();
    }
  });

  it('stored deflate is valid zlib; base64 and randomness behave', () => {
    for (const n of [0, 10, 70_000, 140_000]) {
      const raw = randomBytes(n);
      expect(Buffer.from(inflateSync(browser.deflate(raw))).equals(raw)).toBe(true);
    }
    const bytes = randomBytes(1000);
    expect(browser.base64(bytes)).toBe(bytes.toString('base64'));
    expect(Buffer.from(browser.fromBase64(bytes.toString('base64'))).equals(bytes)).toBe(true);
    expect(browser.randomBytes(70_000).length).toBe(70_000);
    const seen = new Set(Array.from({ length: 2000 }, () => browser.randomInt(3, 10)));
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(browser.timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(browser.timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(browser.PLATFORM).toBe('browser');
    expect(node.PLATFORM).toBe('node');
  });
});
