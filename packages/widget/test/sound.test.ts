import { afterEach, describe, expect, it } from 'vitest';
import { setNawaCaptchaMuted, SOUND_STORAGE_KEY, SoundEngine, type AudioContextLike, type StorageLike } from '../src/sound.js';

/** A fake AudioContext that records what was scheduled. */
function fakeContext() {
  const log = { contexts: 0, oscillators: 0, starts: 0, resumes: 0 };
  const param = () => ({ value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });
  const create = (): AudioContextLike => {
    log.contexts += 1;
    return {
      currentTime: 0,
      state: 'running',
      destination: {},
      resume: async () => {
        log.resumes += 1;
      },
      createOscillator: () => {
        log.oscillators += 1;
        return { type: 'sine', frequency: param(), connect: () => undefined, start: () => void (log.starts += 1), stop: () => undefined };
      },
      createGain: () => ({ gain: param(), connect: () => undefined }),
    };
  };
  return { log, create };
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const trusted = { isTrusted: true };

afterEach(() => setNawaCaptchaMuted(false));

describe('sound: gating', () => {
  it('is off by default and never creates an AudioContext on its own', () => {
    const ctx = fakeContext();
    const s = new SoundEngine({ createContext: ctx.create, storage: () => memoryStorage() });
    expect(s.enabled).toBe(false);
    s.unlock(trusted);
    expect(s.play('success')).toBe(false);
    expect(ctx.log.contexts).toBe(0);
  });

  it('stays silent before a user gesture even when enabled (no autoplay)', () => {
    const ctx = fakeContext();
    const s = new SoundEngine({ createContext: ctx.create, storage: () => memoryStorage() });
    s.setDefault(true); // the `sound` attribute
    expect(s.enabled).toBe(true);
    expect(s.play('grab')).toBe(false);
    expect(ctx.log.contexts).toBe(0);
    s.unlock({ isTrusted: false }); // synthetic events do not count
    expect(s.play('grab')).toBe(false);
    s.unlock(trusted);
    expect(s.play('grab')).toBe(true);
    expect(ctx.log.contexts).toBe(1);
    expect(ctx.log.starts).toBeGreaterThan(0);
  });

  it('plays every cue once unlocked, reusing one context', () => {
    const ctx = fakeContext();
    const s = new SoundEngine({ createContext: ctx.create, storage: () => memoryStorage() });
    s.setEnabled(true);
    s.unlock(trusted);
    for (const cue of ['grab', 'snap', 'tick', 'step', 'success', 'error', 'toggle'] as const) expect(s.play(cue)).toBe(true);
    expect(ctx.log.contexts).toBe(1);
  });

  it('respects the element mute, the app-level mute and volume 0', () => {
    const ctx = fakeContext();
    const s = new SoundEngine({ createContext: ctx.create, storage: () => memoryStorage() });
    s.setEnabled(true);
    s.unlock(trusted);
    s.muted = true;
    expect(s.play('snap')).toBe(false);
    s.muted = false;
    setNawaCaptchaMuted(true);
    expect(s.audible).toBe(false);
    expect(s.play('snap')).toBe(false);
    setNawaCaptchaMuted(false);
    s.setVolume(0);
    expect(s.play('snap')).toBe(false);
    s.setVolume(0.5);
    expect(s.play('snap')).toBe(true);
  });

  it('notifies listeners when the app-level mute changes, and unsubscribes', () => {
    const s = new SoundEngine({ createContext: () => undefined, storage: () => memoryStorage() });
    let calls = 0;
    s.onChange = () => (calls += 1);
    const off = s.listen();
    setNawaCaptchaMuted(true);
    expect(calls).toBe(1);
    off();
    setNawaCaptchaMuted(false);
    expect(calls).toBe(1);
  });

  it('fails quietly when Web Audio is unavailable', () => {
    const s = new SoundEngine({ createContext: () => undefined, storage: () => memoryStorage() });
    s.setEnabled(true);
    s.unlock(trusted);
    expect(s.play('success')).toBe(false);
  });
});

describe('sound: persistence', () => {
  it('remembers the visitor choice and volume per site', () => {
    const store = memoryStorage();
    const a = new SoundEngine({ createContext: () => undefined, storage: () => store });
    a.setEnabled(true);
    a.setVolume(0.35);
    expect(JSON.parse(store.data[SOUND_STORAGE_KEY]!)).toEqual({ on: true, volume: 0.35 });
    const b = new SoundEngine({ createContext: () => undefined, storage: () => store });
    expect(b.enabled).toBe(true);
    expect(b.volume).toBeCloseTo(0.35);
  });

  it("the visitor's own choice beats the site's `sound` default", () => {
    const store = memoryStorage({ [SOUND_STORAGE_KEY]: JSON.stringify({ on: false }) });
    const s = new SoundEngine({ createContext: () => undefined, storage: () => store });
    s.setDefault(true);
    expect(s.enabled).toBe(false);
  });

  it('survives storage that throws or holds garbage', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    const s = new SoundEngine({ createContext: () => undefined, storage: () => throwing });
    expect(() => s.setEnabled(true)).not.toThrow();
    expect(s.enabled).toBe(true);
    const junk = new SoundEngine({ createContext: () => undefined, storage: () => memoryStorage({ [SOUND_STORAGE_KEY]: '{not json' }) });
    expect(junk.enabled).toBe(false);
    const noStorage = new SoundEngine({ createContext: () => undefined, storage: () => undefined });
    expect(noStorage.enabled).toBe(false);
  });

  it('clamps volume', () => {
    const s = new SoundEngine({ createContext: () => undefined, storage: () => memoryStorage() });
    s.setVolume(7);
    expect(s.volume).toBe(1);
    s.setVolume(-1);
    expect(s.volume).toBe(0);
    s.setVolume(Number.NaN);
    expect(s.volume).toBe(0.6);
  });
});

describe('sound: rename compatibility', () => {
  it('still reads a choice stored under the pre-rename key', () => {
    const store = memoryStorage({ 'nawa-guard:sound': JSON.stringify({ on: true, volume: 0.4 }) });
    const s = new SoundEngine({ createContext: () => undefined, storage: () => store });
    expect(s.enabled).toBe(true);
    expect(s.volume).toBeCloseTo(0.4);
    s.setVolume(0.5);
    expect(JSON.parse(store.data[SOUND_STORAGE_KEY]!)).toEqual({ on: true, volume: 0.5 });
    expect(SOUND_STORAGE_KEY).toBe('nawa-captcha:sound');
  });
});
