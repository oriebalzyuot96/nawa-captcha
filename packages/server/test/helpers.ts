import { createNawaCaptcha, MemoryStore, openChallenge, type ChallengeType, type NawaCaptchaOptions, type TracePoint } from '../src/index.js';

export const SECRET = 'test-secret-0123456789-abcdefghijklmnop';
export const CLIENT = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (Vitest)' } as const;

export function setup(overrides: Partial<NawaCaptchaOptions> = {}) {
  const clock = { now: 1_800_000_000_000 };
  const store = new MemoryStore({ now: () => clock.now });
  const guard = createNawaCaptcha({ secret: SECRET, allowClientType: true, rateLimit: false, store, now: () => clock.now, ...overrides });
  return { guard, store, clock };
}

/** Issues a challenge of `type` and returns it together with its (white-box) sealed solution. */
export async function issue(guard: ReturnType<typeof setup>['guard'], type: ChallengeType, extra: { lang?: 'ar' | 'en'; action?: string } = {}) {
  const r = await guard.createChallenge({ type, client: CLIENT, lang: extra.lang ?? 'en', action: extra.action ?? 'login' });
  if (!r.ok) throw new Error(`challenge failed: ${r.error}`);
  const opened = openChallenge(guard.keys, r.challenge.token);
  if (!opened) throw new Error('could not open own token');
  return { challenge: r.challenge, claims: opened.claims, sol: opened.claims.sol as any };
}

/** A plausible human drag along x: ease-in-out progress, a little vertical wobble, irregular timing. */
export function humanTrail(fromX: number, toX: number, y = 20, durationMs = 700): TracePoint[] {
  const pts: TracePoint[] = [];
  let t = 0;
  const steps = 40;
  for (let i = 0; i <= steps; i += 1) {
    const p = i / steps;
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    pts.push([fromX + (toX - fromX) * eased, y + Math.sin(i * 1.7) * 1.4, Math.round(t)]);
    t += durationMs / steps + ((i * 7) % 5) - 2;
  }
  return pts;
}

/** A human-ish freehand path through the given points (bowed segments, jitter, variable speed). */
export function humanPath(points: readonly (readonly [number, number])[]): TracePoint[] {
  const out: TracePoint[] = [];
  let t = 0;
  for (let s = 0; s + 1 < points.length; s += 1) {
    const [ax, ay] = points[s]!;
    const [bx, by] = points[s + 1]!;
    const nx = -(by - ay);
    const ny = bx - ax;
    const len = Math.hypot(nx, ny) || 1;
    for (let i = 0; i <= 20; i += 1) {
      const p = i / 20;
      const bow = Math.sin(p * Math.PI) * 6;
      out.push([ax + (bx - ax) * p + (nx / len) * bow + Math.sin(i * 2.3) * 0.8, ay + (by - ay) * p + (ny / len) * bow + Math.cos(i * 1.9) * 0.8, Math.round(t)]);
      t += 10 + ((i * 13) % 9);
    }
  }
  return out;
}
