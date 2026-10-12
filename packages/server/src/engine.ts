import { bindingHash, clientKey as deriveClientKey, type BindMode, type ClientInfo, BIND_MODES } from './binding.js';
import { createKeyring, pick, randomId, safeEqual, type Keyring, type SecretEntry } from './crypto.js';
import { createRegistry } from './puzzles/index.js';
import { MemoryStore, type NawaGuardStore } from './store.js';
import { MAX_TOKEN_LENGTH, openChallenge, parsePassToken, sealChallenge, signPassToken, type ChallengeClaims, type PassTokenClaims } from './tokens.js';
import { CHALLENGE_TYPES, LANGS, type ChallengeType, type CheckFailure, type Lang, type PuzzleDefinition } from './types.js';

export type RateLimitHook = (ctx: { kind: 'challenge' | 'verify'; clientKey: string; client: ClientInfo }) => boolean | Promise<boolean>;

export interface RateLimitOptions {
  readonly windowSec: number;
  /** Challenges per client per window. */
  readonly challenge: number;
  /** Verify calls per client per window. */
  readonly verify: number;
}

export interface AdaptiveOptions {
  /** How long failures are remembered. */
  readonly windowSec: number;
  /** Failures that raise the difficulty one level. */
  readonly failuresPerLevel: number;
  readonly maxLevel: number;
}

export type GuardEvent =
  | { type: 'challenge-issued'; challengeType: ChallengeType; level: number; clientKey: string; action: string }
  | { type: 'verify-success'; challengeType: ChallengeType; level: number; clientKey: string; action: string; solveMs: number }
  | { type: 'verify-failed'; challengeType?: ChallengeType; reason: VerifyFailure; detail?: string; clientKey: string }
  | { type: 'rate-limited'; kind: 'challenge' | 'verify'; clientKey: string };

export interface NawaGuardOptions {
  /** Server secret (≥32 chars), or a list of `{ kid, secret }` for rotation (first one signs). */
  readonly secret: string | readonly SecretEntry[];
  /** Allowed public site keys. When omitted any well-formed site key is accepted. */
  readonly siteKeys?: readonly string[];
  /** Allowed action names. When omitted any well-formed action is accepted. */
  readonly actions?: readonly string[];
  readonly store?: NawaGuardStore;
  readonly challengeTtlSec?: number;
  readonly passTtlSec?: number;
  /** Bind tokens to the client's IP and/or User-Agent. Default `ip+ua`. */
  readonly bind?: BindMode;
  /** Enabled challenge types. Default: all. */
  readonly types?: readonly ChallengeType[];
  /** Type pools by difficulty level (index = level). */
  readonly ladder?: readonly (readonly ChallengeType[])[];
  /** Start every client at an invisible proof-of-work; visible puzzles only after failures/risk. */
  readonly invisibleFirst?: boolean;
  /** Base proof-of-work difficulty in leading zero bits (each level adds 2). Default 16. */
  readonly powBits?: number;
  /** Let the browser pick the puzzle type (demos). The accessible type is always selectable. */
  readonly allowClientType?: boolean;
  readonly maxAttempts?: Partial<Record<ChallengeType, number>>;
  readonly minSolveMs?: Partial<Record<ChallengeType, number>>;
  readonly rateLimit?: false | RateLimitOptions | RateLimitHook;
  readonly adaptive?: false | AdaptiveOptions;
  /** Extra levels from your own risk signals (e.g. failed logins for this account). */
  readonly assessRisk?: (ctx: { client: ClientInfo; action: string; clientKey: string }) => number | Promise<number>;
  readonly onEvent?: (event: GuardEvent) => void;
  readonly defaultLang?: Lang;
  readonly now?: () => number;
}

export interface ChallengeRequest {
  readonly siteKey?: unknown;
  readonly action?: unknown;
  readonly lang?: unknown;
  readonly type?: unknown;
  readonly client: ClientInfo;
}

export interface ChallengeResponse {
  readonly token: string;
  readonly type: ChallengeType;
  readonly lang: Lang;
  readonly prompt: string;
  readonly data: unknown;
  readonly level: number;
  /** Unix ms. */
  readonly expiresAt: number;
}

export type ChallengeError = 'invalid-input' | 'rate-limited';

export type VerifyFailure =
  | 'invalid-input'
  | 'invalid-token'
  | 'expired'
  | 'client-mismatch'
  | 'replayed'
  | 'attempts-exceeded'
  | 'too-fast'
  | 'rate-limited'
  | CheckFailure;

/** What the browser is told. Deliberately coarser than {@link VerifyFailure} (no tuning oracle for bots). */
export type PublicVerifyError = 'invalid-input' | 'invalid-token' | 'expired' | 'failed' | 'rate-limited';

export type VerifyResult =
  | { ok: true; passToken: string; expiresAt: number; type: ChallengeType }
  | { ok: false; error: PublicVerifyError; reason: VerifyFailure; detail?: string; retry: boolean };

export interface VerifyRequest {
  readonly token: unknown;
  readonly answer: unknown;
  readonly client: ClientInfo;
}

export type PassTokenError =
  | 'missing-token'
  | 'malformed'
  | 'unknown-key'
  | 'bad-signature'
  | 'expired'
  | 'not-yet-valid'
  | 'too-old'
  | 'action-mismatch'
  | 'site-mismatch'
  | 'type-not-allowed'
  | 'client-mismatch'
  | 'replayed';

export type PassTokenResult = { ok: true; claims: PassTokenClaims } | { ok: false; error: PassTokenError };

export interface VerifyPassTokenOptions {
  /** Same secret(s) as the issuing server; pass a list to accept rotated keys. */
  readonly secret: string | readonly SecretEntry[] | Keyring;
  /** The action the protected route expects (e.g. "login"). Required: tokens are not interchangeable across actions. */
  readonly expectedAction: string | readonly string[];
  readonly expectedSiteKey?: string;
  /** Reject tokens issued longer ago than this, even if not yet expired. */
  readonly maxAgeSec?: number;
  /** Shared store for single-use enforcement. Defaults to a process-wide in-memory store. */
  readonly store?: NawaGuardStore;
  /** The request's client info; required when the token is client-bound. */
  readonly client?: ClientInfo;
  /** Restrict which challenge types are acceptable for this route (e.g. exclude 'pow'). */
  readonly allowedTypes?: readonly ChallengeType[];
  readonly clockSkewSec?: number;
  readonly now?: () => number;
}

const SITE_KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ACTION_RE = /^[A-Za-z0-9_.:-]{1,48}$/;
const DEFAULT_LADDER: readonly (readonly ChallengeType[])[] = [
  ['slider', 'rotate'],
  ['icons', 'order', 'trace', 'slider'],
  ['icons', 'trace', 'math', 'order'],
];
const DEFAULT_RATE: RateLimitOptions = { windowSec: 60, challenge: 30, verify: 60 };
const DEFAULT_ADAPTIVE: AdaptiveOptions = { windowSec: 900, failuresPerLevel: 2, maxLevel: 3 };
const CLOCK_SKEW_MS = 5000;

function isChallengeType(v: unknown): v is ChallengeType {
  return typeof v === 'string' && (CHALLENGE_TYPES as readonly string[]).includes(v);
}

export class NawaGuard {
  readonly keys: Keyring;
  readonly store: NawaGuardStore;
  private readonly registry: Record<ChallengeType, PuzzleDefinition>;
  private readonly enabled: readonly ChallengeType[];
  private readonly ladder: readonly (readonly ChallengeType[])[];
  private readonly bind: BindMode;
  private readonly now: () => number;

  constructor(readonly options: NawaGuardOptions) {
    this.keys = createKeyring(options.secret);
    this.store = options.store ?? new MemoryStore();
    this.registry = createRegistry(options.powBits ?? 16);
    this.enabled = options.types?.length ? options.types.filter(isChallengeType) : CHALLENGE_TYPES;
    this.bind = options.bind ?? 'ip+ua';
    if (!BIND_MODES.includes(this.bind)) throw new Error(`nawa-guard: invalid bind mode "${this.bind}"`);
    this.now = options.now ?? Date.now;
    const base = options.ladder ?? DEFAULT_LADDER;
    this.ladder = (options.invisibleFirst ? [['pow'] as const, ...base] : base)
      .map((pool) => pool.filter((t) => this.enabled.includes(t)))
      .filter((pool) => pool.length > 0);
    if (this.ladder.length === 0) {
      const fallback = this.enabled.filter((t) => t !== 'accessible');
      if (fallback.length === 0) throw new Error('nawa-guard: no usable challenge types enabled');
      this.ladder = [fallback];
    }
    for (const kind of ['challengeTtlSec', 'passTtlSec'] as const) {
      const v = options[kind];
      if (v !== undefined && (!Number.isFinite(v) || v < 10 || v > 3600)) throw new Error(`nawa-guard: ${kind} must be 10..3600`);
    }
  }

  private emit(event: GuardEvent): void {
    try {
      this.options.onEvent?.(event);
    } catch {
      // Observability must never break verification.
    }
  }

  private clientKeyOf(client: ClientInfo): string {
    return deriveClientKey(this.keys.key(this.keys.activeKid, 'client-binding')!, client);
  }

  private async allowed(kind: 'challenge' | 'verify', ck: string, client: ClientInfo): Promise<boolean> {
    const rl = this.options.rateLimit ?? DEFAULT_RATE;
    if (rl === false) return true;
    if (typeof rl === 'function') return rl({ kind, clientKey: ck, client });
    const count = await this.store.increment(`rl:${kind}:${ck}`, rl.windowSec * 1000);
    return count <= (kind === 'challenge' ? rl.challenge : rl.verify);
  }

  private async levelFor(ck: string, client: ClientInfo, action: string): Promise<number> {
    const adaptive = this.options.adaptive ?? DEFAULT_ADAPTIVE;
    let level = 0;
    if (adaptive !== false) {
      const failures = await this.store.count(`fail:${ck}`);
      level = Math.min(adaptive.maxLevel, Math.floor(failures / Math.max(1, adaptive.failuresPerLevel)));
    }
    if (this.options.assessRisk) {
      const extra = Number(await this.options.assessRisk({ client, action, clientKey: ck }));
      if (Number.isFinite(extra) && extra > 0) level += Math.floor(extra);
    }
    return Math.min(level, 6);
  }

  private maxAttempts(type: ChallengeType): number {
    return Math.max(1, this.options.maxAttempts?.[type] ?? this.registry[type].maxAttempts);
  }

  private minSolveMs(type: ChallengeType): number {
    return Math.max(0, this.options.minSolveMs?.[type] ?? this.registry[type].minSolveMs);
  }

  async createChallenge(req: ChallengeRequest): Promise<{ ok: true; challenge: ChallengeResponse } | { ok: false; error: ChallengeError }> {
    const siteKey = req.siteKey ?? 'default';
    const action = req.action ?? 'default';
    if (typeof siteKey !== 'string' || !SITE_KEY_RE.test(siteKey)) return { ok: false, error: 'invalid-input' };
    if (typeof action !== 'string' || !ACTION_RE.test(action)) return { ok: false, error: 'invalid-input' };
    if (this.options.siteKeys && !this.options.siteKeys.includes(siteKey)) return { ok: false, error: 'invalid-input' };
    if (this.options.actions && !this.options.actions.includes(action)) return { ok: false, error: 'invalid-input' };
    if (req.type !== undefined && req.type !== null && !isChallengeType(req.type)) return { ok: false, error: 'invalid-input' };
    const lang: Lang = (LANGS as readonly unknown[]).includes(req.lang) ? (req.lang as Lang) : (this.options.defaultLang ?? 'en');

    const ck = this.clientKeyOf(req.client);
    if (!(await this.allowed('challenge', ck, req.client))) {
      this.emit({ type: 'rate-limited', kind: 'challenge', clientKey: ck });
      return { ok: false, error: 'rate-limited' };
    }

    const level = await this.levelFor(ck, req.client, action);
    const requested = isChallengeType(req.type) && this.enabled.includes(req.type) ? req.type : undefined;
    // The browser does not get to pick the easiest puzzle; only the accessible alternative is always available.
    const type: ChallengeType =
      requested && (requested === 'accessible' || this.options.allowClientType)
        ? requested
        : pick(this.ladder[Math.min(level, this.ladder.length - 1)] ?? this.ladder[0]!);

    const generated = this.registry[type].generate({ level, lang });
    const iat = this.now();
    const exp = iat + (this.options.challengeTtlSec ?? 120) * 1000;
    const cb = bindingHash(this.keys.key(this.keys.activeKid, 'client-binding')!, this.bind, req.client);
    const claims: ChallengeClaims = {
      v: 1,
      id: randomId(16),
      typ: type,
      sk: siteKey,
      act: action,
      lang,
      iat,
      exp,
      lvl: level,
      // If the binding material is unavailable (e.g. no UA header) the token is simply unbound.
      cbm: cb ? this.bind : 'none',
      ...(cb ? { cb } : {}),
      sol: generated.solution,
    };
    this.emit({ type: 'challenge-issued', challengeType: type, level, clientKey: ck, action });
    return {
      ok: true,
      challenge: { token: sealChallenge(this.keys, claims), type, lang, prompt: generated.prompt, data: generated.publicData, level, expiresAt: exp },
    };
  }

  async verify(req: VerifyRequest): Promise<VerifyResult> {
    const ck = this.clientKeyOf(req.client);
    const fail = async (reason: VerifyFailure, opts: { claims?: ChallengeClaims; detail?: string; retry?: boolean } = {}): Promise<VerifyResult> => {
      if (reason !== 'rate-limited' && reason !== 'invalid-input') {
        const adaptive = this.options.adaptive ?? DEFAULT_ADAPTIVE;
        if (adaptive !== false) await this.store.increment(`fail:${ck}`, adaptive.windowSec * 1000);
      }
      this.emit({ type: 'verify-failed', reason, clientKey: ck, ...(opts.claims ? { challengeType: opts.claims.typ } : {}), ...(opts.detail ? { detail: opts.detail } : {}) });
      return { ok: false, error: publicError(reason), reason, ...(opts.detail ? { detail: opts.detail } : {}), retry: opts.retry ?? false };
    };

    if (typeof req.token !== 'string' || req.token.length === 0 || req.token.length > MAX_TOKEN_LENGTH) return fail('invalid-input');
    if (req.answer === undefined || req.answer === null || typeof req.answer !== 'object') return fail('invalid-input');

    if (!(await this.allowed('verify', ck, req.client))) {
      this.emit({ type: 'rate-limited', kind: 'verify', clientKey: ck });
      return { ok: false, error: 'rate-limited', reason: 'rate-limited', retry: false };
    }

    const opened = openChallenge(this.keys, req.token);
    if (!opened) return fail('invalid-token');
    const claims = opened.claims;
    if (!isChallengeType(claims.typ)) return fail('invalid-token');
    const now = this.now();
    if (claims.iat > now + CLOCK_SKEW_MS) return fail('invalid-token', { claims });
    if (now > claims.exp) return fail('expired', { claims });

    if (claims.cbm !== 'none') {
      const expected = bindingHash(this.keys.key(opened.kid, 'client-binding')!, claims.cbm, req.client);
      if (!expected || !claims.cb || !safeEqual(expected, claims.cb)) return fail('client-mismatch', { claims });
    }

    const ttl = Math.max(1000, claims.exp - now + CLOCK_SKEW_MS);
    if ((await this.store.count(`used:${claims.id}`)) > 0) return fail('replayed', { claims });
    const attempts = await this.store.increment(`att:${claims.id}`, ttl);
    const max = this.maxAttempts(claims.typ);
    if (attempts > max) return fail('attempts-exceeded', { claims });
    const retry = attempts < max;

    const solveMs = now - claims.iat;
    if (solveMs < this.minSolveMs(claims.typ)) return fail('too-fast', { claims, retry });

    const result = this.registry[claims.typ].check(claims.sol, req.answer, { level: claims.lvl });
    if (!result.ok) return fail(result.reason, { claims, retry: retry && result.reason !== 'invalid-answer', ...(result.detail ? { detail: result.detail } : {}) });

    // Atomic one-time redemption: of two concurrent correct submissions only one wins.
    if (!(await this.store.setIfAbsent(`used:${claims.id}`, ttl))) return fail('replayed', { claims });

    const iat = Math.floor(now / 1000);
    const exp = iat + (this.options.passTtlSec ?? 120);
    const cb = claims.cbm === 'none' ? undefined : bindingHash(this.keys.key(this.keys.activeKid, 'client-binding')!, claims.cbm, req.client);
    const passToken = signPassToken(this.keys, {
      v: 1,
      jti: randomId(16),
      sk: claims.sk,
      act: claims.act,
      typ: claims.typ,
      lvl: claims.lvl,
      iat,
      exp,
      cbm: cb ? claims.cbm : 'none',
      ...(cb ? { cb } : {}),
    });
    this.emit({ type: 'verify-success', challengeType: claims.typ, level: claims.lvl, clientKey: ck, action: claims.act, solveMs });
    return { ok: true, passToken, expiresAt: exp * 1000, type: claims.typ };
  }

  /** Server-side pass-token check using this instance's secrets and store. */
  verifyPassToken(token: unknown, opts: Omit<VerifyPassTokenOptions, 'secret' | 'store'> & { store?: NawaGuardStore }): Promise<PassTokenResult> {
    return verifyPassToken(token, { now: this.now, ...opts, secret: this.keys, store: opts.store ?? this.store });
  }
}

export function createNawaGuard(options: NawaGuardOptions): NawaGuard {
  return new NawaGuard(options);
}

function publicError(reason: VerifyFailure): PublicVerifyError {
  switch (reason) {
    case 'invalid-input':
    case 'invalid-answer':
      return 'invalid-input';
    case 'invalid-token':
    case 'client-mismatch':
      return 'invalid-token';
    case 'expired':
    case 'replayed':
      return 'expired';
    case 'rate-limited':
      return 'rate-limited';
    default:
      return 'failed';
  }
}

// ------------------------------------------------------------------ pass-token verification

let defaultStore: MemoryStore | undefined;
const keyringCache = new Map<string, Keyring>();

function keyringFrom(secret: VerifyPassTokenOptions['secret']): Keyring {
  if (typeof secret === 'object' && 'activeKid' in secret) return secret as Keyring;
  const cacheKey = typeof secret === 'string' ? secret : JSON.stringify(secret);
  let ring = keyringCache.get(cacheKey);
  if (!ring) {
    ring = createKeyring(secret as string | readonly SecretEntry[]);
    if (keyringCache.size > 32) keyringCache.clear();
    keyringCache.set(cacheKey, ring);
  }
  return ring;
}

/**
 * Verifies a pass token on your backend (the equivalent of reCAPTCHA siteverify, but local):
 * signature, expiry, max age, action, site key, allowed types, client binding, and single use.
 */
export async function verifyPassToken(token: unknown, opts: VerifyPassTokenOptions): Promise<PassTokenResult> {
  if (typeof token !== 'string' || token.length === 0) return { ok: false, error: 'missing-token' };
  const keys = keyringFrom(opts.secret);
  const parsed = parsePassToken(keys, token);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { claims, kid } = parsed;

  const nowSec = Math.floor((opts.now ?? Date.now)() / 1000);
  const skew = opts.clockSkewSec ?? 5;
  if (claims.iat > nowSec + skew) return { ok: false, error: 'not-yet-valid' };
  if (nowSec >= claims.exp) return { ok: false, error: 'expired' };
  if (opts.maxAgeSec !== undefined && nowSec - claims.iat > opts.maxAgeSec) return { ok: false, error: 'too-old' };

  const actions = typeof opts.expectedAction === 'string' ? [opts.expectedAction] : opts.expectedAction;
  if (!actions.includes(claims.act)) return { ok: false, error: 'action-mismatch' };
  if (opts.expectedSiteKey !== undefined && claims.sk !== opts.expectedSiteKey) return { ok: false, error: 'site-mismatch' };
  if (opts.allowedTypes && !opts.allowedTypes.includes(claims.typ)) return { ok: false, error: 'type-not-allowed' };

  if (claims.cbm !== 'none') {
    const key = keys.key(kid, 'client-binding');
    const expected = key && opts.client ? bindingHash(key, claims.cbm, opts.client) : undefined;
    if (!expected || !claims.cb || !safeEqual(expected, claims.cb)) return { ok: false, error: 'client-mismatch' };
  }

  const store = opts.store ?? (defaultStore ??= new MemoryStore());
  const ttlMs = Math.max(1000, (claims.exp - nowSec + skew) * 1000);
  if (!(await store.setIfAbsent(`pass:${claims.jti}`, ttlMs))) return { ok: false, error: 'replayed' };
  return { ok: true, claims };
}
