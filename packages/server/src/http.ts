import type { ClientInfo } from './binding.js';
import type { NawaCaptcha, PassTokenResult, VerifyPassTokenOptions } from './engine.js';
import { verifyPassToken } from './engine.js';
import type { NawaCaptchaStore } from './store.js';

/** Framework-agnostic request: what the handlers need, nothing else. */
export interface GuardHttpRequest {
  /** Parsed JSON body (or undefined). */
  readonly body: unknown;
  readonly client: ClientInfo;
}

export interface GuardHttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'application/json; charset=utf-8',
  // Challenges and pass tokens must never be cached by a browser or proxy.
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

/** Maximum accepted JSON body for the captcha endpoints (trails are the largest part). */
export const MAX_BODY_BYTES = 32 * 1024;

const json = (status: number, body: unknown): GuardHttpResponse => ({ status, headers: SECURITY_HEADERS, body });

function record(body: unknown): Record<string, unknown> | undefined {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
}

/** POST /challenge  body: { siteKey?, action?, lang?, type?, types? } */
export async function handleChallenge(guard: NawaCaptcha, req: GuardHttpRequest): Promise<GuardHttpResponse> {
  const body = record(req.body ?? {});
  if (!body) return json(400, { success: false, error: 'invalid-input' });
  const result = await guard.createChallenge({ siteKey: body['siteKey'], action: body['action'], lang: body['lang'], type: body['type'], types: body['types'], client: req.client });
  if (!result.ok) return json(result.error === 'rate-limited' ? 429 : 400, { success: false, error: result.error });
  return json(200, { success: true, ...result.challenge });
}

/**
 * POST /verify  body: { token, answer } → { success, token (pass token), expiresAt }, or for a
 * multi-step policy { success, next: <the next challenge> } until the last step is solved.
 */
export async function handleVerify(guard: NawaCaptcha, req: GuardHttpRequest): Promise<GuardHttpResponse> {
  const body = record(req.body);
  if (!body) return json(400, { success: false, error: 'invalid-input', retry: false });
  const result = await guard.verify({ token: body['token'], answer: body['answer'], client: req.client });
  if (result.ok && result.next) return json(200, { success: true, next: result.next });
  if (result.ok) {
    return json(200, { success: true, token: result.passToken, expiresAt: result.expiresAt, expiresInMs: result.expiresInMs, type: result.type, solvedTypes: result.solvedTypes });
  }
  // `reason`/`detail` stay server-side (onEvent); the browser only learns the coarse outcome.
  const status = result.error === 'rate-limited' ? 429 : result.error === 'invalid-input' ? 400 : 403;
  return json(status, { success: false, error: result.error, retry: result.retry });
}

export interface PassTokenSource {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body?: unknown;
}

export const DEFAULT_TOKEN_FIELD = 'nawa-captcha-token';
export const DEFAULT_TOKEN_HEADER = 'x-nawa-captcha-token';
/** @deprecated Pre-rename (Nawa Guard) names, still accepted by default for this release. */
export const LEGACY_TOKEN_FIELD = 'nawa-guard-token';
/** @deprecated Pre-rename (Nawa Guard) names, still accepted by default for this release. */
export const LEGACY_TOKEN_HEADER = 'x-nawa-guard-token';

function pick(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Reads a pass token from a header (preferred for JSON APIs) or a form/body field. With the
 * defaults, the deprecated `X-Nawa-Guard-Token` header and `nawa-guard-token` field also work.
 */
export function readPassToken(src: PassTokenSource, field = DEFAULT_TOKEN_FIELD, header = DEFAULT_TOKEN_HEADER): string | undefined {
  const legacy = field === DEFAULT_TOKEN_FIELD && header === DEFAULT_TOKEN_HEADER;
  const body = record(src.body);
  return (
    pick(src.headers[header.toLowerCase()]) ??
    (legacy ? pick(src.headers[LEGACY_TOKEN_HEADER]) : undefined) ??
    pick(body?.[field]) ??
    (legacy ? pick(body?.[LEGACY_TOKEN_FIELD]) : undefined)
  );
}

export interface ProtectOptions extends Omit<VerifyPassTokenOptions, 'secret' | 'client' | 'store'> {
  readonly field?: string;
  readonly header?: string;
  readonly store?: NawaCaptchaStore;
}

/** One call for protected routes in any framework: read + verify the pass token. */
export async function checkPassToken(guard: NawaCaptcha, src: PassTokenSource & { client: ClientInfo }, opts: ProtectOptions): Promise<PassTokenResult> {
  const token = readPassToken(src, opts.field, opts.header);
  return guard.verifyPassToken(token, { ...opts, client: src.client });
}

export { verifyPassToken };
