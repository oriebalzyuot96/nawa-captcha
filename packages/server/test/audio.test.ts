import { describe, expect, it } from 'vitest';
import { createAudio, digitsOnly, seededRng, solvePow, type AudioPublic, type AudioSolution } from '../src/index.js';
import { encodeWav, SAMPLE_RATE, speakDigit, Track } from '../src/render/audio.js';
import { CLIENT, issue, setup } from './helpers.js';

const audio = createAudio(8);

function wavBytes(pub: AudioPublic): Buffer {
  expect(pub.audio).toMatch(/^data:audio\/wav;base64,[A-Za-z0-9+/]+={0,2}$/);
  return Buffer.from(pub.audio.slice('data:audio/wav;base64,'.length), 'base64');
}

describe('audio challenge: WAV encoding', () => {
  it('writes a valid canonical PCM WAV header (RIFF/WAVE, fmt 16-bit mono, data size)', () => {
    const g = audio.generate({ level: 0, lang: 'en', rng: seededRng('wav-header') });
    const buf = wavBytes(g.publicData);
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.readUInt32LE(4)).toBe(buf.length - 8);
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    expect(buf.toString('ascii', 12, 16)).toBe('fmt ');
    expect(buf.readUInt32LE(16)).toBe(16);
    expect(buf.readUInt16LE(20)).toBe(1); // PCM
    expect(buf.readUInt16LE(22)).toBe(1); // mono
    expect(buf.readUInt32LE(24)).toBe(SAMPLE_RATE);
    expect(buf.readUInt32LE(28)).toBe(SAMPLE_RATE * 2);
    expect(buf.readUInt16LE(32)).toBe(2);
    expect(buf.readUInt16LE(34)).toBe(16);
    expect(buf.toString('ascii', 36, 40)).toBe('data');
    expect(buf.readUInt32LE(40)).toBe(buf.length - 44);
    // Duration in the payload matches the samples.
    const samples = (buf.length - 44) / 2;
    expect(Math.abs((samples / SAMPLE_RATE) * 1000 - g.publicData.durationMs)).toBeLessThan(2);
    // Not silent and not clipped.
    let peak = 0;
    for (let i = 44; i < buf.length; i += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(i)));
    expect(peak).toBeGreaterThan(20_000);
    expect(peak).toBeLessThan(32_767);
  });

  it('encodes an empty track as a 44-byte file', () => {
    expect(encodeWav(new Track(0)).length).toBe(44);
  });

  it('synthesizes every digit as a non-empty, normalized word', () => {
    for (let d = 0; d < 10; d += 1) {
      const w = speakDigit(d, { f0: 120, scale: 1, rate: 1 }, () => 0.1);
      expect(w.length).toBeGreaterThan(SAMPLE_RATE * 0.2);
      expect(Math.max(...w.map(Math.abs))).toBeCloseTo(0.9, 1);
    }
  });
});

describe('audio challenge: generation', () => {
  it('is byte-identical for the same seed and different for another seed', () => {
    for (const lang of ['en', 'ar'] as const) {
      const a = audio.generate({ level: 1, lang, rng: seededRng('det-1') });
      const b = audio.generate({ level: 1, lang, rng: seededRng('det-1') });
      const c = audio.generate({ level: 1, lang, rng: seededRng('det-2') });
      expect(b.publicData.audio).toBe(a.publicData.audio);
      expect(b.solution).toEqual(a.solution);
      expect(c.publicData.audio).not.toBe(a.publicData.audio);
    }
  });

  it('speaks digits in English and uses language-neutral beeps for Arabic', () => {
    const en = audio.generate({ level: 0, lang: 'en', rng: seededRng('kind') });
    expect(en.publicData.kind).toBe('digits');
    expect(en.publicData.length).toBe(4);
    expect(en.solution.accept[0]).toMatch(/^\d{4}$/);
    expect(audio.generate({ level: 2, lang: 'en', rng: seededRng('kind') }).publicData.length).toBe(5);
    const ar = audio.generate({ level: 0, lang: 'ar', rng: seededRng('kind') });
    expect(ar.publicData.kind).toBe('beeps');
    expect(Number(ar.solution.accept[0])).toBeGreaterThanOrEqual(3);
    expect(Number(ar.solution.accept[0])).toBeLessThanOrEqual(7);
  });

  it('never puts the answer in the payload (only the sound carries it)', () => {
    for (let i = 0; i < 12; i += 1) {
      const g = audio.generate({ level: i % 3, lang: i % 2 ? 'ar' : 'en', rng: seededRng(`leak-${i}`) });
      const { audio: clip, ...rest } = g.publicData;
      expect(Object.keys(g.publicData).sort()).toEqual(['audio', 'durationMs', 'kind', 'maxPlays', 'pow', ...(g.publicData.length ? ['length'] : [])].sort());
      const text = JSON.stringify(rest) + g.prompt;
      for (const a of g.solution.accept) expect(text).not.toContain(a.length > 1 ? a : `"${a}"`);
      // The clip is real audio, not text: no ASCII run of the answer digits in the PCM bytes.
      expect(Buffer.from(clip.slice(22), 'base64').toString('latin1')).not.toContain(g.solution.accept[0]!.length > 2 ? g.solution.accept[0]! : '\u0000\u0000never');
    }
  });

  it('normalizes typed digits (spaces, dashes, Arabic-Indic numerals)', () => {
    expect(digitsOnly('4 7-2 1')).toBe('4721');
    expect(digitsOnly('٤٧٢١')).toBe('4721');
    expect(digitsOnly('۴۷۲۱')).toBe('4721');
  });
});

describe('audio challenge: engine', () => {
  it('is available on request as an accessible alternative, but never drawn at random', async () => {
    const { guard } = setup({ allowClientType: false, mode: 'random' });
    const r = await guard.createChallenge({ type: 'audio', client: CLIENT });
    expect(r.ok && r.challenge.type).toBe('audio');
    expect(r.ok && r.challenge.view).toBe('audio');
    for (let i = 0; i < 40; i += 1) {
      const x = await guard.createChallenge({ client: CLIENT });
      expect(x.ok && x.challenge.type).not.toBe('audio');
    }
    const strict = setup({ allowAccessible: false, types: ['slider'] });
    const s = await strict.guard.createChallenge({ client: CLIENT, type: 'audio' });
    expect(s.ok && s.challenge.type).toBe('slider');
  });

  it('accepts spaced digits after one listen, refuses answers faster than the clip', async () => {
    const ctx = setup({ powBits: 8 });
    const { challenge, sol } = await issue(ctx.guard, 'audio', { lang: 'en' });
    const data = challenge.data as AudioPublic;
    const nonce = solvePow(data.pow.salt, data.pow.bits)!;
    const s = sol as AudioSolution;
    ctx.clock.now += 2600;
    const early = await ctx.guard.verify({ token: challenge.token, answer: { text: s.accept[0], nonce }, client: CLIENT });
    expect(early).toMatchObject({ ok: false, reason: 'bot-suspected' });
    ctx.clock.now += Math.min(data.durationMs, 4000);
    const spaced = s.accept[0]!.split('').join(' ');
    const r = await ctx.guard.verify({ token: challenge.token, answer: { text: spaced, nonce }, client: CLIENT });
    expect(r).toMatchObject({ ok: true });
  });

  it('accepts a beep count in Arabic words', async () => {
    const ctx = setup({ powBits: 8 });
    const { challenge, sol } = await issue(ctx.guard, 'audio', { lang: 'ar' });
    const data = challenge.data as AudioPublic;
    const words: Record<string, string> = { '3': 'ثلاثة', '4': 'أربعة', '5': 'خمسة', '6': 'ستة', '7': 'سبعة' };
    ctx.clock.now += 6000;
    const r = await ctx.guard.verify({ token: challenge.token, answer: { text: words[(sol as AudioSolution).accept[0]!], nonce: solvePow(data.pow.salt, data.pow.bits)! }, client: CLIENT });
    expect(r).toMatchObject({ ok: true });
  });
});
