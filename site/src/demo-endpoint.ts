/*
 * Demo mode for the static site: the real @nawa-guard/server engine runs in this page (built with
 * the browser primitives) and an in-page endpoint shim answers the widget's fetch() calls to
 * DEMO_ENDPOINT. In production these two endpoints live on YOUR server, with the secret.
 */
import { createNawaGuard, handleChallenge, handleVerify, MemoryStore, type ClientInfo, type NawaGuard, type NawaGuardOptions } from '../../packages/server/src/index.js';

export const DEMO_ENDPOINT = '/__nawa-guard-demo__';

export interface ExchangeLog {
  readonly path: '/challenge' | '/verify';
  readonly request: unknown;
  readonly status: number;
  readonly response: unknown;
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export class DemoBackend {
  guard: NawaGuard;
  readonly secret = randomSecret();
  readonly store = new MemoryStore();
  readonly client: ClientInfo = { ip: '192.0.2.10', userAgent: navigator.userAgent };
  onExchange: (log: ExchangeLog) => void = () => undefined;

  constructor(options: Omit<NawaGuardOptions, 'secret'>) {
    this.guard = this.create(options);
    this.install();
  }

  private create(options: Omit<NawaGuardOptions, 'secret'>): NawaGuard {
    return createNawaGuard({ rateLimit: { windowSec: 60, challenge: 200, verify: 400 }, ...options, secret: this.secret, store: this.store });
  }

  /** Rebuilds the engine with new options (same secret and store). */
  configure(options: Omit<NawaGuardOptions, 'secret'>): void {
    this.guard = this.create(options);
  }

  private install(): void {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(DEMO_ENDPOINT)) return realFetch(input, init);
      const path = url.pathname.slice(DEMO_ENDPOINT.length);
      let body: unknown;
      try {
        body = JSON.parse(typeof init?.body === 'string' ? init.body : 'null');
      } catch {
        body = undefined;
      }
      // Let the browser paint the loading state; generation is synchronous CPU work.
      await new Promise((r) => setTimeout(r, 30));
      const handler = path === '/challenge' ? handleChallenge : path === '/verify' ? handleVerify : undefined;
      if (!handler) return new Response(JSON.stringify({ success: false, error: 'not-found' }), { status: 404 });
      const res = await handler(this.guard, { body, client: this.client });
      this.onExchange({ path: path as ExchangeLog['path'], request: body, status: res.status, response: res.body });
      return new Response(JSON.stringify(res.body), { status: res.status, headers: res.headers });
    };
  }
}
