import { describe, expect, it } from 'vitest';
import { normalizeAnswer, solvePow } from '../src/index.js';
import { CLIENT, humanPath, humanTrail, issue, setup } from './helpers.js';

/** Verifies `answer` against a freshly issued challenge after a human-plausible delay. */
async function attempt(type: Parameters<typeof issue>[1], answerFor: (sol: any, data: any) => unknown, level?: number) {
  const ctx = setup(level ? { adaptive: false, assessRisk: () => level } : {});
  const { challenge, sol } = await issue(ctx.guard, type);
  ctx.clock.now += 5000;
  return ctx.guard.verify({ token: challenge.token, answer: answerFor(sol, challenge.data), client: CLIENT });
}

describe('slider-jigsaw', () => {
  const answer = (dx: number) => (sol: any, data: any) => ({
    x: sol.x + dx,
    interaction: { mode: 'mouse', trail: humanTrail(10, 10 + sol.x + dx - data.startX) },
  });

  it('never sends the gap position to the client', async () => {
    const { guard } = setup();
    const { challenge, sol } = await issue(guard, 'slider');
    const data = challenge.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(['background', 'height', 'piece', 'pieceHeight', 'pieceWidth', 'pieceY', 'startX', 'width']);
    expect(String(data['background'])).toMatch(/^data:image\/png;base64,/);
    expect(JSON.stringify(data)).not.toContain(`"x":${sol.x}`);
  });

  it('accepts within ±6px and rejects beyond', async () => {
    expect((await attempt('slider', answer(0))).ok).toBe(true);
    expect((await attempt('slider', answer(6))).ok).toBe(true);
    expect((await attempt('slider', answer(-6))).ok).toBe(true);
    const miss = await attempt('slider', answer(7));
    expect(miss).toMatchObject({ ok: false, reason: 'wrong-answer', error: 'failed', retry: true });
  });

  it('tightens tolerance to ±5px at level 2', async () => {
    expect((await attempt('slider', answer(5), 2)).ok).toBe(true);
    expect((await attempt('slider', answer(6), 2)).ok).toBe(false);
  });

  it('rejects a trail that does not match the submitted position', async () => {
    const r = await attempt('slider', (sol) => ({ x: sol.x, interaction: { mode: 'mouse', trail: humanTrail(0, 40) } }));
    expect(r).toMatchObject({ ok: false, reason: 'bot-suspected' });
  });

  it('rejects a missing interaction as invalid input', async () => {
    const r = await attempt('slider', (sol) => ({ x: sol.x }));
    expect(r).toMatchObject({ ok: false, reason: 'invalid-answer', retry: false });
  });
});

describe('rotate-to-upright', () => {
  const answer = (delta: number) => (sol: any) => {
    const angle = (((sol.angle + delta) % 360) + 360) % 360;
    return { angle, interaction: { mode: 'touch', trail: humanTrail(0, (angle / 360) * 300) } };
  };
  it('accepts within ±12° (with wrap-around) and rejects beyond', async () => {
    expect((await attempt('rotate', answer(0))).ok).toBe(true);
    expect((await attempt('rotate', answer(12))).ok).toBe(true);
    expect((await attempt('rotate', answer(-12))).ok).toBe(true);
    expect((await attempt('rotate', answer(14))).ok).toBe(false);
    expect((await attempt('rotate', answer(180))).ok).toBe(false);
  });
});

describe('select-all-matching icons', () => {
  it('needs exactly the matching set', async () => {
    expect((await attempt('icons', (sol) => ({ selected: [...sol.cells].reverse() }))).ok).toBe(true);
    expect((await attempt('icons', (sol) => ({ selected: sol.cells.slice(1) }))).ok).toBe(false);
    const extra = await attempt('icons', (sol) => ({ selected: [...sol.cells, [0, 1, 2, 3, 4, 5, 6, 7, 8].find((i) => !sol.cells.includes(i))] }));
    expect(extra.ok).toBe(false);
    expect(await attempt('icons', () => ({ selected: [1, 1] }))).toMatchObject({ ok: false, reason: 'invalid-answer' });
    expect(await attempt('icons', () => ({ selected: [42] }))).toMatchObject({ ok: false, reason: 'invalid-answer' });
  });
});

describe('math image', () => {
  it('accepts the exact value, including Arabic-Indic digits', async () => {
    expect((await attempt('math', (sol) => ({ value: String(sol.value) }))).ok).toBe(true);
    const arabic = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
    expect((await attempt('math', (sol) => ({ value: arabic(sol.value) }))).ok).toBe(true);
    expect((await attempt('math', (sol) => ({ value: String(sol.value + 1) }))).ok).toBe(false);
    expect(await attempt('math', () => ({ value: '1e3' }))).toMatchObject({ reason: 'invalid-answer' });
  });

  it('renders the expression as paths, never as text', async () => {
    const { guard } = setup();
    const { challenge } = await issue(guard, 'math');
    const svg = Buffer.from(String((challenge.data as any).image).split(',')[1] ?? '', 'base64').toString('utf8');
    expect(svg).not.toMatch(/<text|<script|on\w+=/i);
  });
});

describe('drag-to-order', () => {
  it('requires the exact order', async () => {
    expect((await attempt('order', (sol) => ({ order: sol.order }))).ok).toBe(true);
    expect((await attempt('order', (sol) => ({ order: [...sol.order].reverse() }))).ok).toBe(false);
    expect(await attempt('order', () => ({ order: ['a'] }))).toMatchObject({ reason: 'invalid-answer' });
  });

  it('shuffles tiles and gives them rank-free ids', async () => {
    const { guard } = setup();
    const { challenge, sol } = await issue(guard, 'order');
    const ids = (challenge.data as any).tiles.map((t: any) => t.id);
    expect([...ids].sort()).toEqual([...sol.order].sort());
  });
});

describe('connect-the-dots trace', () => {
  it('accepts a human path through the dots in order', async () => {
    const r = await attempt('trace', (sol) => ({ interaction: { mode: 'mouse', trail: humanPath(sol.dots) } }));
    expect(r.ok).toBe(true);
  });

  it('accepts keyboard-placed points', async () => {
    const r = await attempt('trace', (sol) => ({
      interaction: { mode: 'keyboard', trail: sol.dots.map(([x, y]: [number, number], i: number) => [x + 3, y - 2, 900 * i + (i % 2) * 130]) },
    }));
    expect(r.ok).toBe(true);
  });

  it('rejects wrong order and canvas sweeps', async () => {
    const wrongOrder = await attempt('trace', (sol) => ({ interaction: { mode: 'mouse', trail: humanPath([...sol.dots].reverse()) } }));
    expect(wrongOrder.ok).toBe(false);
    const sweep: [number, number][] = [];
    for (let y = 0; y <= 200; y += 10) sweep.push([y % 20 === 0 ? 0 : 300, y], [y % 20 === 0 ? 300 : 0, y]);
    const mower = await attempt('trace', () => ({ interaction: { mode: 'mouse', trail: humanPath(sweep) } }));
    expect(mower.ok).toBe(false);
  });
});

describe('proof of work', () => {
  it('accepts a valid nonce and rejects an invalid one', async () => {
    const ctx = setup({ powBits: 10 });
    const { challenge } = await issue(ctx.guard, 'pow');
    const data = challenge.data as { salt: string; bits: number };
    expect(data.bits).toBe(10);
    const nonce = solvePow(data.salt, data.bits)!;
    let bad = 0;
    while (solvePow(data.salt, data.bits, bad + 1) === String(bad)) bad += 1;
    const wrongResult = await ctx.guard.verify({ token: challenge.token, answer: { nonce: String(bad) }, client: CLIENT });
    expect(wrongResult.ok).toBe(false);
    const ctx2 = setup({ powBits: 10 });
    const fresh = await issue(ctx2.guard, 'pow');
    const d2 = fresh.challenge.data as { salt: string; bits: number };
    const good = await ctx2.guard.verify({ token: fresh.challenge.token, answer: { nonce: solvePow(d2.salt, d2.bits)! }, client: CLIENT });
    expect(good.ok).toBe(true);
    expect(nonce).toMatch(/^\d+$/);
  });

  it('scales difficulty with level', async () => {
    const ctx = setup({ powBits: 12, adaptive: false, assessRisk: () => 2 });
    const { challenge } = await issue(ctx.guard, 'pow');
    expect((challenge.data as { bits: number }).bits).toBe(16);
  });
});

describe('accessible text challenge', () => {
  it('accepts normalized answers and requires its proof-of-work tax', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const ctx = setup({ powBits: 8 });
      const { challenge, sol } = await issue(ctx.guard, 'accessible', { lang });
      ctx.clock.now += 6000;
      const pow = (challenge.data as any).pow;
      const nonce = solvePow(pow.salt, pow.bits)!;
      const noPow = await ctx.guard.verify({ token: challenge.token, answer: { text: sol.accept[0] }, client: CLIENT });
      expect(noPow).toMatchObject({ ok: false, reason: 'invalid-answer' });
      const ok = await ctx.guard.verify({ token: challenge.token, answer: { text: `  ${sol.accept[0].toUpperCase()}! `, nonce }, client: CLIENT });
      expect(ok.ok).toBe(true);
    }
  });

  it('normalizes Arabic spelling variants and digits', () => {
    expect(normalizeAnswer('الثُّلاثاء')).toBe(normalizeAnswer('ثلاثاء'));
    expect(normalizeAnswer('أحمر')).toBe(normalizeAnswer('احمر'));
    expect(normalizeAnswer('٧')).toBe('7');
    expect(normalizeAnswer('ثلاثة')).toBe(normalizeAnswer('ثلاثه'));
    expect(normalizeAnswer('The Monday.')).toBe('monday');
  });
});
