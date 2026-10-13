/*
 * Dependency-free audio for the audio challenge: 16-bit PCM WAV encoding, tones, coloured noise
 * and a small formant ("Klatt-lite") speech synthesizer that can say the English digits.
 *
 * Everything is driven by a local PRNG seeded from the puzzle's Rng, so a seeded Rng gives
 * byte-identical audio (tests) while production gets CSPRNG-seeded variation per challenge.
 */
import type { Rng } from '../rng.js';

export const SAMPLE_RATE = 11_025;

/** Mono float buffer in [-1, 1] at {@link SAMPLE_RATE}. */
export class Track {
  readonly data: Float32Array;
  constructor(readonly length: number) {
    this.data = new Float32Array(length);
  }
  static ms(ms: number): Track {
    return new Track(Math.round((ms / 1000) * SAMPLE_RATE));
  }
  get durationMs(): number {
    return Math.round((this.length / SAMPLE_RATE) * 1000);
  }
  /** Mixes `src` in at `atMs` with gain `g`. */
  mix(src: Float32Array, atMs: number, g = 1): this {
    const o = Math.round((atMs / 1000) * SAMPLE_RATE);
    for (let i = 0; i < src.length && o + i < this.length; i += 1) if (o + i >= 0) this.data[o + i] = (this.data[o + i] ?? 0) + (src[i] ?? 0) * g;
    return this;
  }
}

/** xorshift128+ style generator seeded from the puzzle Rng (fast per-sample noise). */
export function noiseSource(rng: Rng): () => number {
  const seed = rng.bytes(16);
  const dv = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
  let a = dv.getUint32(0) | 1;
  let b = dv.getUint32(4) | 2;
  let c = dv.getUint32(8) | 4;
  let d = dv.getUint32(12) | 8;
  return () => {
    const t = a ^ (a << 11);
    a = b;
    b = c;
    c = d;
    d = (d ^ (d >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return (d / 4294967296) * 2 - 1;
  };
}

/** Two-pole resonator (Klatt). Coefficients may change per sample. */
class Resonator {
  private y1 = 0;
  private y2 = 0;
  step(x: number, f: number, bw: number): number {
    const T = 1 / SAMPLE_RATE;
    const c = -Math.exp(-2 * Math.PI * bw * T);
    const b = 2 * Math.exp(-Math.PI * bw * T) * Math.cos(2 * Math.PI * Math.min(f, SAMPLE_RATE * 0.45) * T);
    const a = 1 - b - c;
    const y = a * x + b * this.y1 + c * this.y2;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

function envelope(n: number, attack: number, release: number): (i: number) => number {
  return (i) => Math.min(1, i / Math.max(1, attack), (n - i) / Math.max(1, release));
}

/** A soft sine "beep" with a few harmonics and a short attack/release. */
export function beep(freq: number, ms: number, rnd: () => number): Float32Array {
  const n = Math.round((ms / 1000) * SAMPLE_RATE);
  const out = new Float32Array(n);
  const env = envelope(n, SAMPLE_RATE * 0.012, SAMPLE_RATE * 0.04);
  const vib = 2 + rnd() * 2;
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const f = freq * (1 + 0.004 * Math.sin((2 * Math.PI * vib * i) / SAMPLE_RATE));
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    out[i] = env(i) * (0.78 * Math.sin(phase) + 0.16 * Math.sin(2 * phase) + 0.06 * Math.sin(3 * phase));
  }
  return out;
}

/** Brown-ish background noise with a slow amplitude wobble (rain/room tone). */
export function backgroundNoise(track: Track, level: number, rnd: () => number): void {
  let last = 0;
  const wobble = 0.3 + rnd() * 0.5;
  for (let i = 0; i < track.length; i += 1) {
    last = last * 0.96 + rnd() * 0.2;
    const w = 0.75 + 0.25 * Math.sin((2 * Math.PI * wobble * i) / SAMPLE_RATE);
    track.data[i] = (track.data[i] ?? 0) + (last * 1.6 + rnd() * 0.15) * level * w;
  }
}

// ------------------------------------------------------------------------- formant speech

type F3 = readonly [number, number, number];

export interface Phone {
  /** Formant targets at the start and end of the segment (diphthongs glide between them). */
  readonly f: F3;
  readonly f2?: F3;
  readonly ms: number;
  /** Voicing amplitude 0..1. */
  readonly av: number;
  /** Frication amplitude 0..1 and its resonance. */
  readonly af?: number;
  readonly fc?: number;
  readonly fbw?: number;
  /** Aspiration (breathy noise through the formants). */
  readonly ah?: number;
}

const V = (f: F3, ms: number, f2?: F3): Phone => ({ f, ms, av: 1, ...(f2 ? { f2 } : {}) });
const SIL = (ms: number, f: F3 = [400, 1500, 2500]): Phone => ({ f, ms, av: 0 });

const P = {
  iy: [280, 2250, 2950] as F3,
  ih: [400, 1950, 2550] as F3,
  eh: [540, 1800, 2480] as F3,
  ah: [660, 1200, 2400] as F3,
  ao: [580, 880, 2400] as F3,
  uw: [310, 900, 2250] as F3,
  er: [480, 1300, 1650] as F3,
};

/** English digit words as phone sequences. */
const DIGITS: Readonly<Record<number, readonly Phone[]>> = {
  0: [{ f: [250, 1600, 2500], ms: 95, av: 0.45, af: 2, fc: 4300, fbw: 900 }, V(P.iy, 110), { f: [320, 1100, 1450], ms: 70, av: 0.85 }, V([520, 950, 2300], 210, [380, 780, 2250])],
  1: [{ f: [300, 650, 2150], ms: 85, av: 0.8 }, V(P.ah, 170), { f: [280, 1650, 2600], ms: 140, av: 0.55 }],
  2: [SIL(60, [400, 1700, 2700]), { f: [400, 1800, 2700], ms: 30, av: 0, af: 7, fc: 4200, fbw: 1500 }, { f: [380, 1600, 2600], ms: 55, av: 0, ah: 3 }, V([330, 1350, 2350], 280, [300, 950, 2250])],
  3: [{ f: [350, 1400, 2500], ms: 120, av: 0, af: 2, fc: 3800, fbw: 3000 }, { f: [330, 1150, 1500], ms: 90, av: 0.9 }, V([300, 2100, 2800], 250, [270, 2300, 3000])],
  4: [{ f: [350, 1200, 2400], ms: 115, av: 0, af: 1.2, fc: 3000, fbw: 2600 }, V(P.ao, 170), V(P.er, 140)],
  5: [{ f: [350, 1200, 2400], ms: 110, av: 0, af: 1.2, fc: 3000, fbw: 2600 }, V([720, 1150, 2450], 250, [330, 2150, 2850]), { f: [300, 1500, 2400], ms: 85, av: 0.5, af: 0.8, fc: 3000, fbw: 2600 }],
  6: [{ f: [400, 1800, 2600], ms: 130, av: 0, af: 3, fc: 4400, fbw: 900 }, V(P.ih, 110), SIL(55, [350, 2000, 2700]), { f: [350, 2000, 2700], ms: 30, av: 0, af: 5, fc: 2100, fbw: 700 }, { f: [400, 1800, 2600], ms: 140, av: 0, af: 3, fc: 4400, fbw: 900 }],
  7: [{ f: [400, 1800, 2600], ms: 120, av: 0, af: 3, fc: 4400, fbw: 900 }, V(P.eh, 110), { f: [300, 1500, 2400], ms: 60, av: 0.55, af: 0.8, fc: 3000, fbw: 2600 }, V([550, 1350, 2450], 70), { f: [280, 1650, 2600], ms: 130, av: 0.55 }],
  8: [V([500, 1900, 2500], 250, [320, 2250, 2900]), SIL(60, [350, 1800, 2700]), { f: [350, 1800, 2700], ms: 45, av: 0, af: 6, fc: 3900, fbw: 1200 }],
  9: [{ f: [280, 1650, 2600], ms: 90, av: 0.55 }, V([720, 1150, 2450], 240, [330, 2150, 2850]), { f: [280, 1650, 2600], ms: 140, av: 0.55 }],
};

export interface Voice {
  /** Base pitch in Hz. */
  readonly f0: number;
  /** Formant scale (vocal tract length): ~0.9 deep .. 1.15 bright. */
  readonly scale: number;
  /** Speaking-rate multiplier for durations. */
  readonly rate: number;
}

/** Synthesizes one English digit word. Returns normalized float samples. */
export function speakDigit(digit: number, voice: Voice, rnd: () => number): Float32Array {
  const phones = DIGITS[digit];
  if (!phones) throw new Error(`no phones for ${digit}`);
  return speakPhones(phones, voice, rnd);
}

/** Synthesizes a phone sequence (exported for tuning tools). */
export function speakPhones(phones: readonly Phone[], voice: Voice, rnd: () => number): Float32Array {
  const segs = phones.map((p) => ({ ...p, n: Math.max(1, Math.round(((p.ms * voice.rate) / 1000) * SAMPLE_RATE)) }));
  const total = segs.reduce((s, p) => s + p.n, 0) + Math.round(0.03 * SAMPLE_RATE);
  const out = new Float32Array(total);
  const r1 = new Resonator();
  const r2 = new Resonator();
  const r3 = new Resonator();
  const r4 = new Resonator();
  const rf = new Resonator();
  const glottal = [0, 0];
  let phase = 0;
  let prevSample = 0;
  // Smoothed parameters (one-pole smoothing ≈ coarticulation).
  let F = [...segs[0]!.f] as number[];
  let av = 0;
  let af = 0;
  let ah = 0;
  let fc = segs[0]!.fc ?? 4000;
  let fbw = segs[0]!.fbw ?? 1500;
  const kF = 1 - Math.exp(-1 / (0.018 * SAMPLE_RATE));
  const kA = 1 - Math.exp(-1 / (0.008 * SAMPLE_RATE));
  let i = 0;
  for (const seg of segs) {
    for (let j = 0; j < seg.n; j += 1, i += 1) {
      const t = j / seg.n;
      const target = seg.f2 ? seg.f.map((v, k) => v + (seg.f2![k]! - v) * t) : seg.f;
      for (let k = 0; k < 3; k += 1) F[k] = F[k]! + (target[k]! * voice.scale - F[k]!) * kF;
      av += (seg.av - av) * kA;
      af += ((seg.af ?? 0) - af) * kA;
      ah += ((seg.ah ?? 0) - ah) * kA;
      fc += ((seg.fc ?? fc) - fc) * kF;
      fbw += ((seg.fbw ?? fbw) - fbw) * kF;
      // Pitch: gentle fall across the word plus jitter.
      const p = i / total;
      const f0 = voice.f0 * (1.12 - 0.22 * p) * (1 + (rnd() * 0.012));
      phase += f0 / SAMPLE_RATE;
      let pulse = 0;
      if (phase >= 1) {
        phase -= 1;
        pulse = 1;
      }
      // Glottal shaping: impulse through two one-pole low-passes, plus a little breath.
      glottal[0] = glottal[0]! * 0.94 + pulse;
      glottal[1] = glottal[1]! * 0.94 + glottal[0]! * 0.06;
      const noise = rnd();
      const source = glottal[1]! * av * 18 + noise * (ah * 0.08 + av * 0.002);
      let y = r1.step(source, F[0]!, 80);
      y = r2.step(y, F[1]!, 100);
      y = r3.step(y, F[2]!, 140);
      y = r4.step(y, 3300 * voice.scale, 250);
      const fric = rf.step(noise, fc, fbw) * af * 0.025;
      const sample = y + fric;
      // Lip radiation (first difference) brightens the voice.
      out[i] = sample - prevSample * 0.92;
      prevSample = sample;
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let k = 0; k < out.length; k += 1) out[k] = (out[k]! / peak) * 0.9;
  return out;
}

/** Muffled vowel "babble" fragments (a distant crowd) to frustrate off-the-shelf recognisers. */
export function babble(track: Track, level: number, rnd: () => number, count: number): void {
  for (let c = 0; c < count; c += 1) {
    const digit = Math.floor(((rnd() + 1) / 2) * 10) % 10;
    const voice: Voice = { f0: 150 + rnd() * 60, scale: 1.05 + rnd() * 0.1, rate: 1.4 };
    const word = speakDigit(digit, voice, rnd);
    // Low-pass it heavily so it reads as background, not as a competing digit.
    let lp = 0;
    for (let i = 0; i < word.length; i += 1) {
      lp = lp * 0.85 + word[i]! * 0.15;
      word[i] = lp;
    }
    track.mix(word, ((rnd() + 1) / 2) * track.durationMs, level);
  }
}

/** Peak-normalizes to `peak` and applies tiny fades at both ends. */
export function master(track: Track, peak = 0.85): Track {
  let max = 0;
  for (const v of track.data) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? peak / max : 1;
  const fade = Math.round(0.02 * SAMPLE_RATE);
  for (let i = 0; i < track.length; i += 1) {
    const f = Math.min(1, i / fade, (track.length - 1 - i) / fade);
    track.data[i] = track.data[i]! * g * f;
  }
  return track;
}

/** Encodes as a canonical 44-byte-header PCM WAV (mono, 16-bit, {@link SAMPLE_RATE}). */
export function encodeWav(track: Track): Uint8Array {
  const n = track.length;
  const out = new Uint8Array(44 + n * 2);
  const dv = new DataView(out.buffer);
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i += 1) out[o + i] = s.charCodeAt(i);
  };
  str(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, SAMPLE_RATE, true);
  dv.setUint32(28, SAMPLE_RATE * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  str(36, 'data');
  dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 1) dv.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round((track.data[i] ?? 0) * 32767))), true);
  return out;
}
