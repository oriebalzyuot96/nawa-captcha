import { h, icon } from './dom.js';
import { t, type Lang, type StringKey } from './strings.js';
import { STYLES } from './styles.js';
import { accessibleView, gridView, mathView, orderView, pathView, powView, rotateView, sliderView, type PuzzleView, type ViewHost } from './views.js';
import { dragView, holdView, pairsView, swapView, tapsView } from './views-extra.js';

export interface NawaGuardVerifiedDetail {
  /** The pass token to send to your backend. */
  readonly token: string;
  /** Milliseconds until the pass token expires. */
  readonly expiresInMs: number;
  readonly type: string;
}

export interface NawaGuardErrorDetail {
  readonly error: 'network' | 'rate-limited' | 'config';
}

interface Challenge {
  readonly token: string;
  readonly type: string;
  readonly view: string;
  readonly step: number;
  readonly steps: number;
  readonly prompt: string;
  readonly data: Record<string, unknown>;
  readonly expiresInMs: number;
}

function parseChallenge(b: Record<string, unknown>): Challenge | undefined {
  if (typeof b['token'] !== 'string' || typeof b['type'] !== 'string') return undefined;
  const type = b['type'];
  return {
    token: b['token'],
    type,
    // Servers before 0.2 did not send a view; their types map 1:1.
    view: typeof b['view'] === 'string' ? b['view'] : (LEGACY_VIEWS[type] ?? type),
    step: Number(b['step']) || 1,
    steps: Number(b['steps']) || 1,
    prompt: typeof b['prompt'] === 'string' ? b['prompt'] : '',
    data: b['data'] && typeof b['data'] === 'object' ? (b['data'] as Record<string, unknown>) : {},
    expiresInMs: Number(b['expiresInMs']) || 120_000,
  };
}

const LEGACY_VIEWS: Record<string, string> = { slider: 'slide', icons: 'grid', math: 'text', trace: 'path' };

type ApiResult = { status: number; body: Record<string, unknown> } | { status: 0; body: null };

const REQUEST_TIMEOUT_MS = 15_000;

let sheet: CSSStyleSheet | undefined;
function sharedSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(STYLES);
  }
  return sheet;
}

/** Lets the module be imported during SSR (Angular Universal, Next, SvelteKit) without a DOM. */
const Base: typeof HTMLElement = typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement;
const DEFAULT_FIELD = 'nawa-guard-token';

/**
 * <nawa-guard site-key="…" endpoint="/captcha" action="login" lang="ar|en" name="nawa-guard-token">
 *
 * Fetches a challenge from your server, renders it, and on success writes the pass token into a
 * hidden <input> (light DOM, so it submits with the surrounding form) and fires
 * `nawa-guard:verified`. The widget never sees a solution: it only reports what the user did.
 */
export class NawaGuardElement extends Base {
  static get observedAttributes(): string[] {
    return ['lang', 'site-key', 'endpoint', 'action', 'name', 'type', 'types'];
  }

  #root: ShadowRoot;
  #box: HTMLDivElement;
  #title: HTMLParagraphElement;
  #stepBadge: HTMLSpanElement;
  #prompt: HTMLParagraphElement;
  #body: HTMLDivElement;
  #status: HTMLParagraphElement;
  #a11yBtn: HTMLButtonElement;
  #refreshBtn: HTMLButtonElement;
  #input: HTMLInputElement | undefined;
  #challenge: Challenge | undefined;
  #view: PuzzleView | undefined;
  #ctl: AbortController | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #accessible = false;
  #busy = false;
  #token = '';
  #loadSeq = 0;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    // Constructable stylesheets are not subject to CSP style-src; fall back to <style> elsewhere.
    let style: HTMLStyleElement | undefined;
    if ('adoptedStyleSheets' in this.#root && typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
      this.#root.adoptedStyleSheets = [sharedSheet()];
    } else {
      style = document.createElement('style');
      style.textContent = STYLES;
    }
    this.#title = h('p', { class: 'title', id: 'ng-title' });
    this.#stepBadge = h('span', { class: 'step', hidden: true });
    this.#a11yBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-pressed': 'false' }, icon('a11y'));
    this.#refreshBtn = h('button', { type: 'button', class: 'icon-btn' }, icon('refresh'));
    this.#prompt = h('p', { class: 'prompt', id: 'ng-prompt' });
    this.#body = h('div', { class: 'body' });
    this.#status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    this.#box = h(
      'div',
      { class: 'ng', part: 'container', role: 'group', 'aria-labelledby': 'ng-title', 'aria-describedby': 'ng-prompt' },
      h('div', { class: 'head' }, this.#title, this.#stepBadge, h('div', { class: 'tools' }, this.#a11yBtn, this.#refreshBtn)),
      this.#prompt,
      this.#body,
      this.#status,
    );
    if (style) this.#root.append(style);
    this.#root.append(this.#box);
    this.#a11yBtn.addEventListener('click', () => {
      this.#accessible = !this.#accessible;
      void this.#load(true);
    });
    this.#refreshBtn.addEventListener('click', () => void this.#load(true));
  }

  // ------------------------------------------------------------------ public API

  /** The current pass token ('' when not verified). */
  get token(): string {
    return this.#token;
  }

  /** Discards any token and loads a fresh challenge. */
  reset(): void {
    this.#setToken('');
    void this.#load(false);
  }

  connectedCallback(): void {
    this.#ensureInput();
    this.#applyStrings();
    if (!this.#challenge && !this.#token) void this.#load(false);
  }

  disconnectedCallback(): void {
    this.#ctl?.abort();
    this.#clearTimer();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.isConnected) return;
    if (name === 'name') {
      this.#input?.setAttribute('name', newValue || DEFAULT_FIELD);
      return;
    }
    this.#applyStrings();
    if (this.#token) {
      // Already verified: keep the token, just re-render the success state in the new language.
      if (name === 'lang') this.#showDone();
      return;
    }
    void this.#load(false);
  }

  // ------------------------------------------------------------------ internals

  get #lang(): Lang {
    const own = this.getAttribute('lang') ?? this.closest('[lang]')?.getAttribute('lang') ?? document.documentElement.lang ?? 'en';
    return own.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  get #rtl(): boolean {
    const dir = this.getAttribute('dir');
    return dir ? dir === 'rtl' : this.#lang === 'ar';
  }

  get #endpoint(): string {
    return (this.getAttribute('endpoint') || '/captcha').replace(/\/+$/, '');
  }

  #t(key: StringKey, vars?: Record<string, string | number>): string {
    return t(this.#lang, key, vars);
  }

  #ensureInput(): void {
    if (this.#input?.isConnected) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = this.getAttribute('name') || DEFAULT_FIELD;
    input.value = this.#token;
    input.setAttribute('data-nawa-guard', '');
    this.append(input);
    this.#input = input;
  }

  #applyStrings(): void {
    this.#box.setAttribute('dir', this.#rtl ? 'rtl' : 'ltr');
    this.#box.setAttribute('lang', this.#lang);
    this.#title.textContent = this.#t('title');
    const a11yLabel = this.#t(this.#accessible ? 'a11yOff' : 'a11yOn');
    this.#a11yBtn.setAttribute('aria-label', a11yLabel);
    this.#a11yBtn.title = a11yLabel;
    this.#a11yBtn.setAttribute('aria-pressed', String(this.#accessible));
    this.#refreshBtn.setAttribute('aria-label', this.#t('refresh'));
    this.#refreshBtn.title = this.#t('refresh');
  }

  #setStatus(message: string, tone: 'info' | 'error' | 'success' = 'info'): void {
    this.#status.dataset['tone'] = tone;
    // Clear first so an identical message is announced again by screen readers.
    this.#status.textContent = '';
    if (message) setTimeout(() => (this.#status.textContent = message), 30);
  }

  #clearTimer(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #setToken(token: string): void {
    this.#token = token;
    if (this.#input) this.#input.value = token;
  }

  #emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }

  async #api(path: string, payload: unknown, signal: AbortSignal): Promise<ApiResult> {
    const ctl = new AbortController();
    const onAbort = (): void => ctl.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.#endpoint}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: ctl.signal,
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { status: res.status, body: body && typeof body === 'object' ? body : {} };
    } catch {
      return { status: 0, body: null };
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
    }
  }

  async #load(userInitiated: boolean, message?: string): Promise<void> {
    const seq = (this.#loadSeq += 1);
    this.#ctl?.abort();
    this.#clearTimer();
    this.#view = undefined;
    this.#challenge = undefined;
    this.#busy = false;
    this.#setToken('');
    this.#applyStrings();
    const ctl = new AbortController();
    this.#ctl = ctl;
    this.#a11yBtn.hidden = false;
    this.#refreshBtn.hidden = false;
    this.#prompt.hidden = true;
    this.#body.inert = false;
    this.#body.replaceChildren(h('div', { class: 'progress', 'aria-hidden': 'true' }, h('div')));
    this.#box.setAttribute('aria-busy', 'true');
    if (!message) this.#setStatus(this.#t('loading'));

    const type = this.#accessible ? 'accessible' : this.getAttribute('type') || undefined;
    const types = (this.getAttribute('types') || '').split(',').map((t) => t.trim()).filter(Boolean);
    const res = await this.#api(
      '/challenge',
      { siteKey: this.getAttribute('site-key') || undefined, action: this.getAttribute('action') || undefined, lang: this.#lang, type, ...(types.length && !this.#accessible ? { types } : {}) },
      ctl.signal,
    );
    if (seq !== this.#loadSeq) return;
    this.#box.removeAttribute('aria-busy');

    const b = res.body;
    const challenge = res.status === 200 && b && b['success'] === true ? parseChallenge(b) : undefined;
    if (challenge) {
      this.#show(challenge, ctl.signal, message ?? (userInitiated ? this.#t('fresh') : ''), message ? 'error' : 'info', userInitiated);
      return;
    }
    this.#fail(res.status === 0 ? 'network' : res.status === 429 ? 'rate-limited' : 'config');
  }

  /** Mounts a challenge, announces it, and schedules a refresh shortly before it expires. */
  #show(challenge: Challenge, signal: AbortSignal, message: string, tone: 'info' | 'error' | 'success', focus: boolean): void {
    this.#clearTimer();
    this.#challenge = challenge;
    const view = this.#mount(challenge, signal);
    if (!view) return;
    this.#setStatus(message, tone);
    // Refresh a little before the server-side expiry so the user never submits a dead challenge.
    this.#timer = setTimeout(() => void this.#load(false, this.#t('expired')), Math.max(5_000, challenge.expiresInMs - 3_000));
    if (focus) view.focus();
  }

  #mount(c: Challenge, signal: AbortSignal): PuzzleView | undefined {
    const host: ViewHost = {
      lang: this.#lang,
      rtl: this.#rtl,
      signal,
      t: (key, vars) => this.#t(key, vars),
      submit: (answer) => void this.#submit(answer),
      announce: (m) => this.#setStatus(m),
    };
    const d = c.data as Record<string, number | string>;
    const view =
      c.view === 'slide' ? sliderView(host, d)
      : c.view === 'rotate' ? rotateView(host, d)
      : c.view === 'grid' ? gridView(host, c.data)
      : c.view === 'text' ? mathView(host, d)
      : c.view === 'order' ? orderView(host, c.data as { tiles?: Array<{ id: string; image: string }> })
      : c.view === 'path' ? pathView(host, c.data)
      : c.view === 'drag' ? dragView(host, c.data)
      : c.view === 'swap' ? swapView(host, c.data)
      : c.view === 'hold' ? holdView(host, c.data)
      : c.view === 'pairs' ? pairsView(host, c.data)
      : c.view === 'taps' ? tapsView(host, c.data)
      : c.view === 'pow' ? powView(host, d)
      : c.view === 'accessible' ? accessibleView(host, c.data)
      : undefined;
    if (!view) {
      this.#fail('config');
      return undefined;
    }
    this.#view = view;
    this.#prompt.textContent = c.prompt;
    this.#prompt.hidden = c.view === 'pow';
    this.#stepBadge.hidden = c.steps < 2;
    this.#stepBadge.textContent = c.steps < 2 ? '' : this.#t('step', { i: c.step, n: c.steps });
    this.#body.replaceChildren(view.el);
    return view;
  }

  async #submit(answer: Record<string, unknown>): Promise<void> {
    const c = this.#challenge;
    const ctl = this.#ctl;
    if (!c || !ctl || this.#busy) return;
    this.#busy = true;
    this.#body.inert = true;
    this.#setStatus(this.#t('verifying'));
    const res = await this.#api('/verify', { token: c.token, answer }, ctl.signal);
    if (ctl.signal.aborted) return;
    this.#busy = false;
    this.#body.inert = false;
    const b = res.body;

    const next = res.status === 200 && b && b['success'] === true && b['next'] && typeof b['next'] === 'object' ? parseChallenge(b['next'] as Record<string, unknown>) : undefined;
    if (next) {
      // Multi-step: this puzzle was right; show the next one.
      this.#show(next, ctl.signal, this.#t('nextStep', { i: next.step, n: next.steps }), 'success', true);
      return;
    }
    if (res.status === 200 && b && b['success'] === true && typeof b['token'] === 'string') {
      this.#succeed(b['token'], Number(b['expiresInMs']) || 120_000, c.type);
      return;
    }
    if (res.status === 0) return this.#fail('network');
    const error = b?.['error'];
    if (error === 'rate-limited') return this.#fail('rate-limited');
    if (error === 'failed' && b?.['retry'] === true) {
      this.#setStatus(this.#t('wrong'), 'error');
      this.#body.classList.remove('shake');
      void this.#body.offsetWidth;
      this.#body.classList.add('shake');
      this.#view?.reset();
      this.#view?.focus();
      return;
    }
    // Burned, expired or replayed: start over with a fresh challenge and say why.
    await this.#load(true, this.#t(error === 'expired' || error === 'invalid-token' ? 'expired' : 'wrong'));
  }

  #succeed(token: string, expiresInMs: number, type: string): void {
    this.#clearTimer();
    this.#ctl?.abort();
    this.#view = undefined;
    this.#challenge = undefined;
    this.#setToken(token);
    this.#showDone();
    this.#emit<NawaGuardVerifiedDetail>('nawa-guard:verified', { token, expiresInMs, type });
    this.#timer = setTimeout(() => {
      this.#setToken('');
      this.#emit('nawa-guard:expired', {});
      void this.#load(false, this.#t('expired'));
    }, Math.max(5_000, expiresInMs - 5_000));
  }

  #showDone(): void {
    this.#prompt.hidden = true;
    this.#a11yBtn.hidden = true;
    this.#refreshBtn.hidden = true;
    this.#body.replaceChildren(h('div', { class: 'done' }, icon('check'), h('span', {}, this.#t('done'))));
    this.#setStatus(this.#t('success'), 'success');
  }

  #fail(error: NawaGuardErrorDetail['error']): void {
    this.#busy = false;
    this.#view = undefined;
    const key: StringKey = error === 'network' ? 'network' : error === 'rate-limited' ? 'rateLimited' : 'config';
    const retry = h('button', { type: 'button', class: 'btn secondary' }, this.#t('retry'));
    retry.addEventListener('click', () => void this.#load(true));
    this.#prompt.hidden = true;
    this.#body.replaceChildren(h('div', { class: 'error-box' }, h('span', {}, this.#t(key)), h('div', { class: 'row' }, retry)));
    this.#setStatus(this.#t(key), 'error');
    this.#emit<NawaGuardErrorDetail>('nawa-guard:error', { error });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nawa-guard': NawaGuardElement;
  }
  interface HTMLElementEventMap {
    'nawa-guard:verified': CustomEvent<NawaGuardVerifiedDetail>;
    'nawa-guard:expired': CustomEvent<Record<string, never>>;
    'nawa-guard:error': CustomEvent<NawaGuardErrorDetail>;
  }
}
