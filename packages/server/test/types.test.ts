import { describe, expect, it } from 'vitest';
import { ACCESSIBLE_TEMPLATES, CHALLENGE_TYPES, createRegistry, handleChallenge, normalizeAnswer, seededRng, TYPE_INFO, TYPE_VIEWS, type ChallengeType } from '../src/index.js';
import { correct, incorrect, roboticPolyline, roboticTrail } from './answers.js';
import { CLIENT, issue, setup } from './helpers.js';

const registry = createRegistry(8);

/** Keys that would hand the answer to the browser if they ever appeared in public data. */
const FORBIDDEN_KEYS = ['sol', 'solution', 'answer', 'answers', 'accept', 'cells', 'order', 'targets', 'dots', 'value', 'angle', 'x', 'y', 'pairs', 'from', 'to', 'right', 'down', 'start', 'end', 'correct', 'index'];

function keysDeep(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysDeep(x, out);
    }
  }
  return out;
}

const stripImages = (json: string): string => json.replace(/data:image\/[^"]+/g, 'IMG');
const INTERACTIVE: readonly ChallengeType[] = ['slider', 'slide-unlock', 'rotate', 'rotate-object', 'rotate-match', 'shadow-drag', 'trace', 'trace-letters', 'maze', 'tap-order', 'spell', 'hold'];

async function attempt(type: ChallengeType, build: (sol: any, data: any) => unknown, opts: { level?: number; lang?: 'ar' | 'en' } = {}) {
  const ctx = setup({ powBits: 8, ...(opts.level ? { adaptive: false, assessRisk: () => opts.level! } : {}) });
  const { challenge, sol } = await issue(ctx.guard, type, { lang: opts.lang ?? 'en' });
  ctx.clock.now += 6000;
  return ctx.guard.verify({ token: challenge.token, answer: build(sol, challenge.data), client: CLIENT });
}

describe('catalogue', () => {
  it('has at least 30 distinct challenge types, each with a view, a module and a description', () => {
    expect(CHALLENGE_TYPES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(CHALLENGE_TYPES).size).toBe(CHALLENGE_TYPES.length);
    for (const t of CHALLENGE_TYPES) {
      expect(registry[t].type).toBe(t);
      expect(TYPE_VIEWS[t]).toBe(registry[t].view);
      expect(TYPE_INFO[t].en.length).toBeGreaterThan(2);
      expect(TYPE_INFO[t].ar.length).toBeGreaterThan(2);
    }
  });
});

describe.each(CHALLENGE_TYPES.map((t) => [t]))('%s', (type) => {
  it('generates deterministically for a seed and differently for another seed', () => {
    for (const level of [0, 2]) {
      const a = registry[type].generate({ level, lang: 'en', rng: seededRng(`${type}-1`) });
      const b = registry[type].generate({ level, lang: 'en', rng: seededRng(`${type}-1`) });
      const c = registry[type].generate({ level, lang: 'en', rng: seededRng(`${type}-2`) });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
      expect(JSON.stringify(c)).not.toBe(JSON.stringify(a));
    }
  });

  it('never puts answer-derivable fields in the payload sent to the browser', async () => {
    for (let i = 0; i < 8; i += 1) {
      const level = i % 3;
      const g = registry[type].generate({ level, lang: i % 2 ? 'ar' : 'en', rng: seededRng(`${type}-leak-${i}`) });
      const keys = keysDeep(g.publicData);
      expect([...keys].filter((k) => FORBIDDEN_KEYS.includes(k))).toEqual([]);
      const pub = stripImages(JSON.stringify(g.publicData));
      const sol = JSON.stringify(g.solution);
      if (type !== 'pow') expect(pub).not.toContain(sol);
      // Images are data: URLs of raster PNGs or path-only SVGs (no text, no script).
      for (const m of JSON.stringify(g.publicData).matchAll(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g)) {
        expect(Buffer.from(m[1]!, 'base64').toString('utf8')).not.toMatch(/<text|<script|on\w+=|<foreignObject/i);
      }
      // Ordered tiles are never handed out already in order.
      const tiles = (g.publicData as { tiles?: { id: string }[] }).tiles;
      if (tiles) expect(tiles.map((t) => t.id)).not.toEqual((g.solution as { order: string[] }).order);
    }
    // The HTTP response carries only the opaque sealed token plus public data.
    const { guard } = setup();
    const res = await handleChallenge(guard, { body: { type, action: 'login' }, client: CLIENT });
    const body = res.body as Record<string, unknown>;
    expect(body['type']).toBe(type);
    expect(Object.keys(body).sort()).toEqual(['data', 'expiresAt', 'expiresInMs', 'lang', 'level', 'prompt', 'step', 'steps', 'success', 'token', 'type', 'view']);
    expect(String(body['token'])).toMatch(/^ngc1\.k1\.[\w-]+\.[\w-]+$/);
    expect(JSON.stringify(body)).not.toContain('"sol"');
  });

  it('accepts the correct answer (mouse/touch path)', async () => {
    for (const lang of ['en', 'ar'] as const) {
      const r = await attempt(type, (sol, data) => correct(type, sol, data, 'mouse'), { lang });
      expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
    }
  });

  it('is solvable with the keyboard alone', async () => {
    const r = await attempt(type, (sol, data) => correct(type, sol, data, 'keyboard'));
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
  });

  it('accepts at the highest difficulty level', async () => {
    const r = await attempt(type, (sol, data) => correct(type, sol, data, 'mouse'), { level: 3 });
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
  });

  it('rejects a wrong answer and malformed input', async () => {
    const wrong = await attempt(type, (sol, data) => incorrect(type, sol, data));
    expect(wrong).toMatchObject({ ok: false, error: 'failed' });
    const bad = await attempt(type, () => ({ nonsense: true }));
    expect(bad).toMatchObject({ ok: false, error: 'invalid-input' });
  });

  if (INTERACTIVE.includes(type) && type !== 'hold' && type !== 'tap-order' && type !== 'spell') {
    it('rejects a synthetic straight constant-speed gesture (heuristics)', async () => {
      const r = await attempt(type, (sol, data) => {
        const good = correct(type, sol, data, 'mouse') as { interaction: { trail: number[][] } };
        const trail = good.interaction.trail;
        const first = trail[0]!;
        const last = trail[trail.length - 1]!;
        const vertices = type === 'maze' ? correct(type, sol, data, 'keyboard').interaction.trail : type.startsWith('trace') ? sol.dots : undefined;
        return { ...good, interaction: { mode: 'mouse', trail: vertices ? roboticPolyline(vertices) : roboticTrail([first[0]!, first[1]!], [last[0]!, last[1]!]) } };
      });
      expect(r).toMatchObject({ ok: false });
    });
  }
});

describe('type-specific rules', () => {
  it('slider family: tolerance ±6px (±5 at level 2), trail must match the answer', async () => {
    for (const type of ['slider', 'slide-unlock'] as const) {
      const at = (dx: number) => (sol: any, data: any) => ({ x: sol.x + dx, interaction: { mode: 'mouse', trail: correct(type, { x: sol.x + dx }, data).interaction.trail } });
      expect((await attempt(type, at(6) as any)).ok).toBe(true);
      expect((await attempt(type, at(-6) as any)).ok).toBe(true);
      expect((await attempt(type, at(8) as any)).ok).toBe(false);
      expect((await attempt(type, at(6) as any, { level: 2 })).ok).toBe(false);
    }
  });

  it('rotate family: ±12° with wrap-around', async () => {
    for (const type of ['rotate', 'rotate-object', 'rotate-match'] as const) {
      const at = (d: number) => (sol: any, data: any) => correct(type, { angle: (((sol.angle + d) % 360) + 360) % 360 }, data);
      expect((await attempt(type, at(11))).ok).toBe(true);
      expect((await attempt(type, at(-11))).ok).toBe(true);
      expect((await attempt(type, at(16))).ok).toBe(false);
    }
  });

  it('shadow-drag: drop within 13px of the shadow', async () => {
    const at = (dx: number) => (sol: any, data: any) => correct('shadow-drag', { x: sol.x + dx, y: sol.y }, data);
    expect((await attempt('shadow-drag', at(10))).ok).toBe(true);
    expect((await attempt('shadow-drag', at(18))).ok).toBe(false);
  });

  it('hold: inside the zone passes, and the server clock must have seen the hold', async () => {
    const ctx = setup();
    const { challenge, sol } = await issue(ctx.guard, 'hold');
    ctx.clock.now += 700; // less than the claimed hold
    const r = await ctx.guard.verify({ token: challenge.token, answer: { heldMs: sol.to, mode: 'keyboard' }, client: CLIENT });
    expect(r).toMatchObject({ ok: false });
    if (sol.to <= 700) return;
    expect(r).toMatchObject({ reason: 'bot-suspected' });
  });

  it('taps: every tap must land on its target in order', async () => {
    const miss = await attempt('tap-order', (sol) => ({ mode: 'mouse', taps: sol.targets.map(([x, y]: number[], i: number) => [x! + (i === 1 ? 40 : 0), y, 300 * i + i * 13]) }));
    expect(miss.ok).toBe(false);
    const machine = await attempt('tap-order', (sol) => ({ mode: 'mouse', taps: sol.targets.map(([x, y]: number[], i: number) => [x, y, i * 20]) }));
    expect(machine).toMatchObject({ ok: false, reason: 'bot-suspected' });
  });

  it('pairs: reusing a cell is invalid input', async () => {
    const r = await attempt('pairs', (sol) => ({ pairs: [[sol.pairs[0][0], sol.pairs[0][1]], [sol.pairs[0][0], sol.pairs[1][1]], ...sol.pairs.slice(2)] }));
    expect(r).toMatchObject({ ok: false, error: 'invalid-input' });
  });

  it('maze: a path through a wall is rejected', async () => {
    let checked = 0;
    for (let i = 0; i < 6; i += 1) {
      let hasWall = false;
      const r = await attempt('maze', (sol) => {
        const c = (cell: number) => [(cell % sol.cols) * 40 + 20, Math.floor(cell / sol.cols) * 40 + 20] as [number, number];
        const x = sol.start % sol.cols;
        const y = Math.floor(sol.start / sol.cols);
        // A neighbour of the start cell that is behind a wall (start is in the first column).
        const walled = [
          y > 0 && sol.down[(y - 1) * sol.cols + x] === '1' ? sol.start - sol.cols : -1,
          y + 1 < sol.rows && sol.down[y * sol.cols + x] === '1' ? sol.start + sol.cols : -1,
          sol.right[y * (sol.cols - 1) + x] === '1' ? sol.start + 1 : -1,
        ].find((n) => n >= 0);
        const via = walled ?? sol.start;
        hasWall = walled !== undefined;
        if (hasWall) checked += 1;
        return { interaction: { mode: 'keyboard', trail: [c(sol.start), c(via), c(sol.end)].map(([px, py], k) => [px, py, k * 300 + 100]) } };
      });
      if (hasWall) expect(r).toMatchObject({ ok: false, reason: 'wrong-answer' });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('accessible: has at least 40 templates, all answerable in Arabic and English', () => {
    expect(ACCESSIBLE_TEMPLATES.length).toBeGreaterThanOrEqual(40);
    ACCESSIBLE_TEMPLATES.forEach((tpl, i) => {
      for (const lang of ['ar', 'en'] as const) {
        const q = tpl(lang, seededRng(`tpl-${i}-${lang}`));
        expect(q.question.length).toBeGreaterThan(8);
        expect(q.accept.map(normalizeAnswer).filter(Boolean).length).toBeGreaterThan(0);
        if (lang === 'ar') expect(q.question).toMatch(/[؀-ۿ]/);
      }
    });
  });
});
