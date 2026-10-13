/*
 * UI sound layer: tiny synthesized cues (Web Audio API, no audio files).
 *
 * Rules:
 * - OFF by default. Turned on by the `sound` attribute/property or the speaker toggle; the
 *   visitor's own toggle choice is remembered per site (localStorage, failures ignored).
 * - Never makes a sound before the visitor has interacted with the widget (a trusted pointer or
 *   key event): the AudioContext is not even created until then.
 * - `muted` on the element, or `setNawaGuardMuted(true)` for the whole app, silences everything.
 * - Sound is never the only signal: every state change is also announced in the live region.
 */

export type Cue = 'grab' | 'snap' | 'tick' | 'step' | 'success' | 'error' | 'toggle';

/** The subset of the Web Audio API used here (lets tests inject a fake). */
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): unknown; exponentialRampToValueAtTime(v: number, t: number): unknown };
    connect(node: unknown): unknown;
    start(t?: number): void;
    stop(t?: number): void;
  };
  createGain(): {
    gain: { value: number; setValueAtTime(v: number, t: number): unknown; linearRampToValueAtTime(v: number, t: number): unknown; exponentialRampToValueAtTime(v: number, t: number): unknown };
    connect(node: unknown): unknown;
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SoundEnv {
  createContext?: () => AudioContextLike | undefined;
  storage?: () => StorageLike | undefined;
}

export const SOUND_STORAGE_KEY = 'nawa-guard:sound';

// ------------------------------------------------------------------------------- app-level mute

let appMuted = false;
const muteListeners = new Set<() => void>();

/** Mutes (or unmutes) every Nawa Guard widget on the page, e.g. from your app's own sound setting. */
export function setNawaGuardMuted(muted: boolean): void {
  appMuted = !!muted;
  for (const l of muteListeners) l();
}

export function isNawaGuardMuted(): boolean {
  return appMuted || (typeof document !== 'undefined' && document.documentElement?.hasAttribute('data-nawa-guard-muted'));
}

// ------------------------------------------------------------------------------- defaults

function defaultContext(): AudioContextLike | undefined {
  const g = globalThis as unknown as { AudioContext?: new () => AudioContextLike; webkitAudioContext?: new () => AudioContextLike };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  try {
    return Ctor ? new Ctor() : undefined;
  } catch {
    return undefined;
  }
}

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined; // e.g. storage blocked in a sandboxed iframe
  }
}

interface Stored {
  on?: boolean;
  volume?: number;
}

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6);

// ------------------------------------------------------------------------------- engine

export class SoundEngine {
  #ctx: AudioContextLike | undefined;
  #enabled = false;
  #volume = 0.6;
  #unlocked = false;
  #userChoice = false;
  muted = false;
  readonly #env: Required<SoundEnv>;
  onChange: () => void = () => undefined;

  constructor(env: SoundEnv = {}) {
    this.#env = { createContext: env.createContext ?? defaultContext, storage: env.storage ?? defaultStorage };
    const stored = this.#read();
    if (typeof stored.on === 'boolean') {
      this.#enabled = stored.on;
      this.#userChoice = true;
    }
    if (typeof stored.volume === 'number') this.#volume = clamp01(stored.volume);
  }

  /** Follows app-level mute changes; returns the unsubscribe function. */
  listen(): () => void {
    const listener = (): void => this.onChange();
    muteListeners.add(listener);
    return () => muteListeners.delete(listener);
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  get volume(): number {
    return this.#volume;
  }

  /** True when a cue would actually be heard right now. */
  get audible(): boolean {
    return this.#enabled && !this.muted && !isNawaGuardMuted() && this.#unlocked && this.#volume > 0;
  }

  /** Whether the AudioContext exists (it is only created after a user gesture). */
  get hasContext(): boolean {
    return this.#ctx !== undefined;
  }

  /** The site's default (`sound` attribute). Ignored once the visitor has made their own choice. */
  setDefault(on: boolean): void {
    if (!this.#userChoice) this.#enabled = on;
  }

  /** The visitor's choice (speaker toggle or the `sound` property); remembered per site. */
  setEnabled(on: boolean, remember = true): void {
    this.#enabled = on;
    if (remember) {
      this.#userChoice = true;
      this.#write();
    }
    this.onChange();
  }

  setVolume(v: number, remember = true): void {
    this.#volume = clamp01(v);
    if (remember) this.#write();
    this.onChange();
  }

  /** Call from trusted user-gesture handlers (pointerdown, keydown, click). */
  unlock(event?: { isTrusted?: boolean }): void {
    if (event && event.isTrusted === false) return;
    this.#unlocked = true;
    if (this.#ctx && this.#ctx.state === 'suspended') void this.#ctx.resume().catch(() => undefined);
  }

  /** Plays a cue if sound is on, unmuted and unlocked. Returns whether it was scheduled. */
  play(cue: Cue): boolean {
    if (!this.audible) return false;
    if (!this.#ctx) this.#ctx = this.#env.createContext();
    const ctx = this.#ctx;
    if (!ctx) return false;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    try {
      schedule(ctx, cue, this.#volume);
      return true;
    } catch {
      return false;
    }
  }

  #read(): Stored {
    try {
      const raw = this.#env.storage()?.getItem(SOUND_STORAGE_KEY);
      const v = raw ? (JSON.parse(raw) as unknown) : undefined;
      return v && typeof v === 'object' ? (v as Stored) : {};
    } catch {
      return {};
    }
  }

  #write(): void {
    try {
      this.#env.storage()?.setItem(SOUND_STORAGE_KEY, JSON.stringify({ on: this.#enabled, volume: Math.round(this.#volume * 100) / 100 }));
    } catch {
      // Storage full or blocked: the choice simply is not remembered.
    }
  }
}

// ------------------------------------------------------------------------------- synthesis

type Note = { f: number; to?: number; at: number; dur: number; type?: string; gain?: number };

const CUES: Record<Cue, Note[]> = {
  // Soft lift: a quick upward chirp.
  grab: [{ f: 520, to: 700, at: 0, dur: 0.07, type: 'sine', gain: 0.35 }],
  // Click into place: bright tick plus a low "thock".
  snap: [
    { f: 1500, to: 900, at: 0, dur: 0.035, type: 'triangle', gain: 0.4 },
    { f: 210, to: 140, at: 0, dur: 0.09, type: 'sine', gain: 0.6 },
  ],
  tick: [{ f: 1100, to: 1250, at: 0, dur: 0.035, type: 'sine', gain: 0.3 }],
  // Step complete: two rising notes.
  step: [
    { f: 660, at: 0, dur: 0.11, type: 'sine', gain: 0.45 },
    { f: 990, at: 0.09, dur: 0.16, type: 'sine', gain: 0.45 },
  ],
  // Verified: a gentle major arpeggio with a shimmer on top.
  success: [
    { f: 784, at: 0, dur: 0.16, type: 'sine', gain: 0.45 },
    { f: 988, at: 0.08, dur: 0.18, type: 'sine', gain: 0.42 },
    { f: 1175, at: 0.16, dur: 0.34, type: 'sine', gain: 0.42 },
    { f: 2350, at: 0.16, dur: 0.3, type: 'triangle', gain: 0.08 },
  ],
  // Not quite: two soft descending notes (never harsh).
  error: [
    { f: 330, at: 0, dur: 0.12, type: 'triangle', gain: 0.45 },
    { f: 247, at: 0.11, dur: 0.18, type: 'triangle', gain: 0.45 },
  ],
  toggle: [{ f: 880, at: 0, dur: 0.08, type: 'sine', gain: 0.35 }],
};

function schedule(ctx: AudioContextLike, cue: Cue, volume: number): void {
  const t0 = ctx.currentTime + 0.005;
  const master = ctx.createGain();
  master.gain.value = 0.22 * volume * volume; // perceptual curve; UI cues stay quiet
  master.connect(ctx.destination);
  for (const n of CUES[cue]) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = n.type ?? 'sine';
    const start = t0 + n.at;
    const end = start + n.dur;
    osc.frequency.setValueAtTime(n.f, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, end);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(n.gain ?? 0.4, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
