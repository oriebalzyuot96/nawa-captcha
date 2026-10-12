import { sha256 } from '../crypto.js';
import { prompt } from '../i18n.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { isRecord } from './common.js';

export interface PowSolution {
  readonly salt: string;
  readonly bits: number;
}

export interface PowPublic {
  readonly algorithm: 'SHA-256';
  /** Find a decimal `nonce` such that SHA-256(UTF8(salt + ":" + nonce)) starts with `bits` zero bits. */
  readonly salt: string;
  readonly bits: number;
}

export const POW_MIN_BITS = 8;
export const POW_MAX_BITS = 26;

export function leadingZeroBits(hash: Uint8Array): number {
  let bits = 0;
  for (const byte of hash) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

export function powBitsFor(base: number, level: number): number {
  return Math.min(POW_MAX_BITS, Math.max(POW_MIN_BITS, base + level * 2));
}

/**
 * Hashcash-style proof of work. It proves the client spent CPU, not that it is human, so it is
 * meant as an invisible first line (or to tax bulk requests), with puzzles behind it.
 */
export function createPow(baseBits: number): PuzzleDefinition<PowSolution, PowPublic> {
  return {
    type: 'pow',
    view: 'pow',
    minSolveMs: 0,
    maxAttempts: 1,
    generate({ level, lang, rng }) {
      const salt = rng.id(16);
      const bits = powBitsFor(baseBits, level);
      // Salt and difficulty are public by nature; they are also sealed so neither can be swapped.
      return { solution: { salt, bits }, prompt: prompt('pow', lang), publicData: { algorithm: 'SHA-256', salt, bits } };
    },
    check(solution, answer) {
      if (!isRecord(answer) || typeof answer['nonce'] !== 'string' || !/^\d{1,16}$/.test(answer['nonce'])) return invalid('nonce');
      return leadingZeroBits(sha256(`${solution.salt}:${answer['nonce']}`)) >= solution.bits ? ok : wrong();
    },
  };
}

/** Reference solver (used by tests and server-side tooling; the widget has its own WebCrypto loop). */
export function solvePow(salt: string, bits: number, maxIterations = 50_000_000): string | undefined {
  for (let n = 0; n < maxIterations; n += 1) {
    if (leadingZeroBits(sha256(`${salt}:${n}`)) >= bits) return String(n);
  }
  return undefined;
}
