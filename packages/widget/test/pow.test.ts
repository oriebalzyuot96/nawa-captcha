import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { leadingZeroBits as serverZeroBits } from '../../server/src/index.js';
import { leadingZeroBits, sha256Words, solvePow } from '../src/pow.js';

const hex = (words: Uint32Array): string => [...words].map((w) => (w >>> 0).toString(16).padStart(8, '0')).join('');

describe('widget SHA-256 / proof of work', () => {
  it('matches node:crypto for short and multi-block inputs', () => {
    for (const input of ['', 'abc', 'salt:123', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'q'.repeat(200)]) {
      expect(hex(sha256Words(input))).toBe(createHash('sha256').update(input, 'latin1').digest('hex'));
    }
  });

  it('finds nonces the server accepts', async () => {
    const salt = 'Zm9vYmFyYmF6cXV4MTIzNA';
    const nonce = await solvePow(salt, 12);
    expect(nonce).toMatch(/^\d+$/);
    const digest = createHash('sha256').update(`${salt}:${nonce}`).digest();
    expect(serverZeroBits(digest)).toBeGreaterThanOrEqual(12);
    expect(leadingZeroBits(sha256Words(`${salt}:${nonce}`))).toBe(serverZeroBits(digest));
  });

  it('stops when aborted', async () => {
    const ctl = new AbortController();
    ctl.abort();
    expect(await solvePow('never', 40, ctl.signal)).toBeUndefined();
  });
});
