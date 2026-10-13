import { sha256 } from '../crypto.js';
import { prompt } from '../i18n.js';
import { base64 } from '../primitives.js';
import { babble, backgroundNoise, beep, encodeWav, master, noiseSource, speakDigit, Track, type Voice } from '../render/audio.js';
import { invalid, ok, wrong, type PuzzleDefinition } from '../types.js';
import { isRecord } from './common.js';
import { normalizeAnswer } from './accessible.js';
import { leadingZeroBits, powBitsFor } from './pow.js';

export type AudioKind = 'digits' | 'beeps';

export interface AudioSolution {
  /** Normalized accepted answers. */
  readonly accept: readonly string[];
  /** Length of the clip; answers sooner than (most of) one listen are refused. */
  readonly ms: number;
  readonly pow: { readonly salt: string; readonly bits: number };
}

/**
 * View `audio`: a WAV clip (data: URL, synthesized on the server) plus a silent proof-of-work tax.
 * No transcript, no per-item timing, nothing but the sound itself.
 */
export interface AudioPublic {
  readonly audio: string;
  readonly durationMs: number;
  /** What to listen for: digits to type, or high beeps to count. */
  readonly kind: AudioKind;
  /** Digits only: how many digits are spoken (so the input can say so). */
  readonly length?: number;
  /** Plays allowed by the widget (a UX limit; the clip itself is in the payload). */
  readonly maxPlays: number;
  readonly pow: { readonly algorithm: 'SHA-256'; readonly salt: string; readonly bits: number };
}

const NUMBER_WORDS: Readonly<Record<number, readonly string[]>> = {
  3: ['three', 'ثلاثة', 'ثلاث'],
  4: ['four', 'أربعة', 'أربع'],
  5: ['five', 'خمسة', 'خمس'],
  6: ['six', 'ستة', 'ست'],
  7: ['seven', 'سبعة', 'سبع'],
  8: ['eight', 'ثمانية', 'ثماني', 'ثمان'],
  9: ['nine', 'تسعة', 'تسع'],
};

/** Accepts "4 7 2 1", "4-7-2-1", Arabic-Indic digits, … — everything but the digits is dropped. */
export function digitsOnly(text: string): string {
  return normalizeAnswer(text).replace(/\D+/g, '');
}

/**
 * Audio challenge for blind and low-vision visitors.
 * - `digits` (English): 4–5 digits spoken by a randomized formant voice over rain-like noise and
 *   muffled crowd babble; type the digits.
 * - `beeps` (language-neutral, used for Arabic): a run of low and high beeps; type how many were high.
 * The answer is sealed server-side like every other type; the clip only exists as audio.
 */
export function createAudio(powBaseBits: number): PuzzleDefinition<AudioSolution, AudioPublic> {
  return {
    type: 'audio',
    view: 'audio',
    minSolveMs: 2500,
    maxAttempts: 3,
    generate({ lang, level, rng }) {
      const rnd = noiseSource(rng);
      const kind: AudioKind = lang === 'en' ? 'digits' : 'beeps';
      let track: Track;
      let accept: string[];
      let length: number | undefined;
      if (kind === 'digits') {
        length = level >= 2 ? 5 : 4;
        const digits = Array.from({ length }, () => rng.int(0, 10));
        const voice: Voice = { f0: rng.float(95, 175), scale: rng.float(0.94, 1.12), rate: rng.float(0.95, 1.12) };
        const words = digits.map((d) => speakDigit(d, voice, rnd));
        const gaps = digits.map(() => rng.int(380, 720));
        const lead = rng.int(450, 700);
        const totalMs = lead + words.reduce((s, w, i) => s + (w.length / 11.025) + gaps[i]!, 0) + 200;
        track = Track.ms(totalMs);
        let at = lead;
        words.forEach((w, i) => {
          track.mix(w, at, rng.float(0.8, 1));
          at += w.length / 11.025 + gaps[i]!;
        });
        backgroundNoise(track, 0.05 + level * 0.012, rnd);
        babble(track, 0.12 + level * 0.03, rnd, 4 + level * 2);
        accept = [digits.join('')];
      } else {
        const highs = rng.int(3, 8);
        const lows = rng.int(3, 6) + Math.min(level, 3);
        const pattern = rng.shuffle([...Array<boolean>(highs).fill(true), ...Array<boolean>(lows).fill(false)]);
        const low = rng.float(330, 470);
        const high = low * rng.float(2.4, 3.1);
        const lead = rng.int(400, 650);
        const steps = pattern.map(() => rng.int(300, 560));
        const lens = pattern.map(() => rng.int(110, 190));
        track = Track.ms(lead + steps.reduce((a, b) => a + b, 0) + 400);
        let at = lead;
        pattern.forEach((isHigh, i) => {
          track.mix(beep(isHigh ? high * rng.float(0.97, 1.03) : low * rng.float(0.97, 1.03), lens[i]!, rnd), at, rng.float(0.55, 0.8));
          at += steps[i]!;
        });
        backgroundNoise(track, 0.08 + level * 0.02, rnd);
        accept = [String(highs), ...(NUMBER_WORDS[highs] ?? [])];
      }
      master(track);
      const pow = { salt: rng.id(16), bits: powBitsFor(powBaseBits, level) };
      const wav = encodeWav(track);
      return {
        solution: { accept: [...new Set(accept.map((a) => (kind === 'digits' ? digitsOnly(a) : normalizeAnswer(a))))], ms: track.durationMs, pow },
        prompt: prompt(kind === 'digits' ? 'audioDigits' : 'audioBeeps', lang, { n: length ?? 0 }),
        publicData: {
          audio: `data:audio/wav;base64,${base64(wav)}`,
          durationMs: track.durationMs,
          kind,
          ...(length ? { length } : {}),
          maxPlays: 3,
          pow: { algorithm: 'SHA-256', ...pow },
        },
      };
    },
    check(solution, answer, { elapsedMs }) {
      if (!isRecord(answer) || typeof answer['text'] !== 'string' || answer['text'].length > 64) return invalid('text');
      if (typeof answer['nonce'] !== 'string' || !/^\d{1,16}$/.test(answer['nonce'])) return invalid('nonce');
      if (leadingZeroBits(sha256(`${solution.pow.salt}:${answer['nonce']}`)) < solution.pow.bits) return wrong('pow');
      // Nobody can answer before hearing most of the clip once.
      if (elapsedMs < Math.min(solution.ms * 0.75, 4000)) return { ok: false, reason: 'bot-suspected', detail: 'too-fast-for-audio' };
      const text = answer['text'];
      const given = /\d|[٠-٩۰-۹]/.test(text) && solution.accept[0] && /^\d+$/.test(solution.accept[0]) ? digitsOnly(text) : normalizeAnswer(text);
      return given.length > 0 && solution.accept.includes(given) ? ok : wrong();
    },
  };
}
