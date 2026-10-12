import type { ClientInfo } from './binding.js';
import type { NawaGuard, PassTokenClaims } from './index.js';
import { MAX_BODY_BYTES, checkPassToken, handleChallenge, handleVerify, type GuardHttpResponse, type ProtectOptions } from './http.js';

/*
 * Express adapter without a dependency on express: the request/response types below are the
 * structural subset used, so this works with Express 4/5 (and plain node:http + a router).
 */

export interface RequestLike {
  method?: string;
  url?: string;
  path?: string;
  ip?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  on?(event: 'data' | 'end' | 'error', cb: (arg?: unknown) => void): unknown;
  nawaGuard?: PassTokenClaims;
}

export interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
}

export type Next = (err?: unknown) => void;
export type Middleware = (req: RequestLike, res: ResponseLike, next: Next) => void;

export interface ExpressAdapterOptions {
  /** How to read the client IP/UA. Default: `req.ip` (honours Express "trust proxy") and the User-Agent header. */
  readonly getClient?: (req: RequestLike) => ClientInfo;
}

function defaultClient(req: RequestLike): ClientInfo {
  const ua = req.headers['user-agent'];
  return { ip: req.ip ?? req.socket?.remoteAddress, userAgent: Array.isArray(ua) ? ua[0] : ua };
}

function send(res: ResponseLike, r: GuardHttpResponse): void {
  res.statusCode = r.status;
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.end(JSON.stringify(r.body));
}

/** Uses `req.body` if a body parser ran; otherwise reads the stream itself (JSON, size-limited). */
function readJson(req: RequestLike): Promise<unknown> {
  if (req.body !== undefined) return Promise.resolve(req.body);
  if (!req.on) return Promise.resolve(undefined);
  const type = String(req.headers['content-type'] ?? '');
  if (!type.toLowerCase().startsWith('application/json')) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    req.on!('data', (chunk) => {
      if (done) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        reject(new PayloadTooLarge());
        return;
      }
      chunks.push(buf);
    });
    req.on!('end', () => {
      if (done) return;
      done = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        resolve(undefined);
      }
    });
    req.on!('error', (e) => {
      if (!done) {
        done = true;
        reject(e);
      }
    });
  });
}

class PayloadTooLarge extends Error {}

/**
 * Mount under any prefix: `app.use('/captcha', nawaGuardExpress(guard))` serves
 * `POST /captcha/challenge` and `POST /captcha/verify`.
 */
export function nawaGuardExpress(guard: NawaGuard, options: ExpressAdapterOptions = {}): Middleware {
  const getClient = options.getClient ?? defaultClient;
  return (req, res, next) => {
    const path = req.path ?? new URL(req.url ?? '/', 'http://localhost').pathname;
    const route = path === '/challenge' ? handleChallenge : path === '/verify' ? handleVerify : undefined;
    if (!route) return next();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(res, { status: 405, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: { success: false, error: 'method-not-allowed' } });
    }
    readJson(req)
      .then((body) => route(guard, { body, client: getClient(req) }))
      .then((r) => send(res, r))
      .catch((err: unknown) => {
        if (err instanceof PayloadTooLarge) return send(res, { status: 413, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: { success: false, error: 'payload-too-large' } });
        next(err);
      });
  };
}

export interface RequireCaptchaOptions extends ProtectOptions, ExpressAdapterOptions {
  /** Custom failure response. Default: 403 JSON `{ error: 'captcha-required', code }`. */
  readonly onFail?: (req: RequestLike, res: ResponseLike, code: string) => void;
}

/**
 * Guards a route: `app.post('/login', express.urlencoded(), requireCaptcha(guard, { expectedAction: 'login' }), handler)`.
 * The token is read from the `X-Nawa-Guard-Token` header or the `nawa-guard-token` body field,
 * verified (signature, expiry, action, binding) and redeemed once. Claims land on `req.nawaGuard`.
 */
export function requireCaptcha(guard: NawaGuard, options: RequireCaptchaOptions): Middleware {
  const getClient = options.getClient ?? defaultClient;
  return (req, res, next) => {
    checkPassToken(guard, { headers: req.headers, body: req.body, client: getClient(req) }, options)
      .then((result) => {
        if (result.ok) {
          req.nawaGuard = result.claims;
          return next();
        }
        if (options.onFail) return options.onFail(req, res, result.error);
        send(res, { status: 403, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: { error: 'captcha-required', code: result.error } });
      })
      .catch(next);
  };
}
