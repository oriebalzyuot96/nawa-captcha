import { audioView } from './audio-view.js';
import { h, icon } from './dom.js';
import { SoundEngine, isNawaCaptchaMuted, type Cue } from './sound.js';
import { t, type Lang, type StringKey } from './strings.js';
import { STYLES } from './styles.js';
import { isPreset, resolveTheme } from './themes.js';
import { accessibleView, gridView, mathView, orderView, pathView, powView, rotateView, sliderView, type PuzzleView, type ViewHost } from './views.js';
import { dragView, holdView, pairsView, swapView, tapsView } from './views-extra.js';

export interface NawaCaptchaVerifiedDetail {
  /** The pass token to send to your backend. */
  readonly token: string;
  /** Milliseconds until the pass token expires. */
  readonly expiresInMs: number;
  readonly type: string;
}

export interface NawaCaptchaErrorDetail {
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
const MAX_TILT_DEG = 4;

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
const DEFAULT_FIELD = 'nawa-captcha-token';
/** Deprecated names kept working for this release (Nawa Guard was renamed to Nawa Captcha). */
export const LEGACY_TAG_NAME = 'nawa-guard';
const LEGACY_FIELD = 'nawa-guard-token';

const media = (q: string): MediaQueryList | undefined => (typeof matchMedia === 'function' ? matchMedia(q) : undefined);
const offValue = (v: string | null): boolean => v !== null && /^(off|false|0|no)$/i.test(v.trim());

/**
 * <nawa-captcha site-key="…" endpoint="/captcha" action="login" lang="ar|en" name="nawa-captcha-token"
 *             theme="auto|orca|midnight|aurora|sand|ocean|mono|light|dark|high-contrast"
 *             appearance="auto|light|dark|high-contrast" sound volume="0.6" muted>
 *
 * Fetches a challenge from your server, renders it, and on success writes the pass token into a
 * hidden <input> (light DOM, so it submits with the surrounding form) and fires
 * `nawa-captcha:verified`. The widget never sees a solution: it only reports what the user did.
 */
export class NawaCaptchaElement extends Base {
  static get observedAttributes(): string[] {
    return ['lang', 'site-key', 'endpoint', 'action', 'name', 'type', 'types', 'theme', 'appearance', 'sound', 'volume', 'muted', 'dir'];
  }

  #root: ShadowRoot;
  #box: HTMLDivElement;
  #title: HTMLParagraphElement;
  #stepBadge: HTMLSpanElement;
  #prompt: HTMLParagraphElement;
  #notice: HTMLDivElement;
  #alt: HTMLDivElement;
  #altText: HTMLButtonElement;
  #altAudio: HTMLButtonElement;
  #body: HTMLDivElement;
  #status: HTMLParagraphElement;
  #brand: HTMLSpanElement;
  #vol: HTMLLabelElement;
  #volInput: HTMLInputElement;
  #soundBtn: HTMLButtonElement;
  #a11yBtn: HTMLButtonElement;
  #refreshBtn: HTMLButtonElement;
  #input: HTMLInputElement | undefined;
  #challenge: Challenge | undefined;
  #view: PuzzleView | undefined;
  #ctl: AbortController | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #accessible = false;
  #altKind: 'text' | 'audio' = 'text';
  #busy = false;
  #token = '';
  #loadSeq = 0;
  #sound = new SoundEngine();
  #cleanup: Array<() => void> = [];
  #raf = 0;

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
    this.#soundBtn = h('button', { type: 'button', class: 'icon-btn sound-btn', 'aria-pressed': 'false' });
    this.#a11yBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-pressed': 'false' }, icon('a11y'));
    this.#refreshBtn = h('button', { type: 'button', class: 'icon-btn' }, icon('refresh'));
    this.#altText = h('button', { type: 'button', 'aria-pressed': 'true' }, icon('text'), h('span'));
    this.#altAudio = h('button', { type: 'button', 'aria-pressed': 'false' }, icon('headphones'), h('span'));
    this.#alt = h('div', { class: 'alt', role: 'group', hidden: true }, this.#altText, this.#altAudio);
    this.#notice = h('div', { class: 'notice', 'aria-hidden': 'true', hidden: true });
    this.#prompt = h('p', { class: 'prompt', id: 'ng-prompt' });
    this.#body = h('div', { class: 'body' });
    this.#status = h('p', { class: 'status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    this.#brand = h('span');
    this.#volInput = h('input', { type: 'range', min: 0, max: 100, step: 5 });
    this.#vol = h('label', { class: 'vol', hidden: true }, h('span', { class: 'sr-only' }), this.#volInput);
    this.#box = h(
      'div',
      { class: 'ng', part: 'container', role: 'group', 'aria-labelledby': 'ng-title', 'aria-describedby': 'ng-prompt', 'data-theme': 'auto', 'data-scheme': 'light' },
      h(
        'div',
        { class: 'head' },
        h('span', { class: 'mark', 'aria-hidden': 'true' }, icon('shield')),
        h('div', { class: 'titles' }, this.#title, this.#stepBadge),
        h('div', { class: 'tools' }, this.#soundBtn, this.#a11yBtn, this.#refreshBtn),
      ),
      this.#alt,
      this.#notice,
      this.#prompt,
      this.#body,
      this.#status,
      h('div', { class: 'foot' }, h('span', { class: 'brandline' }, icon('shield'), this.#brand), this.#vol),
    );
    if (style) this.#root.append(style);
    this.#root.append(this.#box);

    this.#a11yBtn.addEventListener('click', () => {
      this.#accessible = !this.#accessible;
      void this.#load(true);
    });
    this.#refreshBtn.addEventListener('click', () => void this.#load(true));
    const pickAlt = (kind: 'text' | 'audio'): void => {
      if (this.#altKind === kind) return;
      this.#altKind = kind;
      void this.#load(true);
    };
    this.#altText.addEventListener('click', () => pickAlt('text'));
    this.#altAudio.addEventListener('click', () => pickAlt('audio'));
    this.#soundBtn.addEventListener('click', (e) => {
      this.#sound.unlock(e);
      this.#sound.setEnabled(!this.#sound.enabled);
      this.#sound.play('toggle');
      this.#setStatus(this.#t(this.#sound.enabled ? 'soundIsOn' : 'soundIsOff'));
    });
    this.#volInput.addEventListener('input', () => this.#sound.setVolume(Number(this.#volInput.value) / 100));
    this.#volInput.addEventListener('change', () => this.#sound.play('tick'));
    this.#sound.onChange = () => this.#applySound();

    // Sound may only start after a real gesture inside the widget.
    const unlock = (e: Event): void => this.#sound.unlock(e);
    this.#box.addEventListener('pointerdown', unlock, { capture: true });
    this.#box.addEventListener('keydown', unlock, { capture: true });
    this.#wireTilt();
  }

  // ------------------------------------------------------------------ public API

  /** The current pass token ('' when not verified). */
  get token(): string {
    return this.#token;
  }

  /**
   * Whether UI sound effects are on. Setting it sets the site's default (the `sound` attribute);
   * the visitor's own speaker-toggle choice, remembered per site, still wins.
   */
  get sound(): boolean {
    return this.#sound.enabled;
  }

  set sound(on: boolean) {
    this.setAttribute('sound', on ? 'on' : 'off');
  }

  /** UI sound volume, 0..1. */
  get volume(): number {
    return this.#sound.volume;
  }

  set volume(v: number) {
    this.#sound.setVolume(Number(v));
  }

  /** Silences this widget's sound regardless of the visitor's toggle (an app-level mute). */
  get muted(): boolean {
    return this.hasAttribute('muted') && !offValue(this.getAttribute('muted'));
  }

  set muted(v: boolean) {
    this.toggleAttribute('muted', !!v);
  }

  /** Theme preset or appearance shorthand (see README). Reflects the `theme` attribute. */
  get theme(): string {
    return this.getAttribute('theme') ?? 'auto';
  }

  set theme(v: string) {
    this.setAttribute('theme', v);
  }

  /** Discards any token and loads a fresh challenge. */
  reset(): void {
    this.#setToken('');
    void this.#load(false);
  }

  connectedCallback(): void {
    this.#ensureInput();
    this.#applyTheme();
    this.#readSoundAttrs();
    for (const q of ['(prefers-color-scheme: dark)', '(prefers-contrast: more)', '(forced-colors: active)']) {
      const m = media(q);
      if (!m) continue;
      const fn = (): void => this.#applyTheme();
      m.addEventListener?.('change', fn);
      this.#cleanup.push(() => m.removeEventListener?.('change', fn));
    }
    this.#cleanup.push(this.#sound.listen());
    this.#applyStrings();
    if (!this.#challenge && !this.#token) void this.#load(false);
  }

  disconnectedCallback(): void {
    this.#ctl?.abort();
    this.#clearTimer();
    for (const fn of this.#cleanup.splice(0)) fn();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.isConnected) return;
    if (name === 'name') {
      this.#input?.setAttribute('name', newValue || this.#defaultField);
      return;
    }
    if (name === 'theme' || name === 'appearance') {
      this.#applyTheme();
      return;
    }
    if (name === 'sound' || name === 'volume' || name === 'muted') {
      this.#readSoundAttrs();
      return;
    }
    this.#applyStrings();
    if (name === 'dir') return;
    if (this.#token) {
      // Already verified: keep the token, just re-render the success state in the new language.
      if (name === 'lang') this.#showDone(false);
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

  get #reducedMotion(): boolean {
    return !!media('(prefers-reduced-motion: reduce)')?.matches || !!media('(forced-colors: active)')?.matches;
  }

  #t(key: StringKey, vars?: Record<string, string | number>): string {
    return t(this.#lang, key, vars);
  }

  #ensureInput(): void {
    if (this.#input?.isConnected) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = this.getAttribute('name') || this.#defaultField;
    input.value = this.#token;
    input.setAttribute('data-nawa-captcha', '');
    this.append(input);
    this.#input = input;
  }

  #applyTheme(): void {
    const r = resolveTheme(this.getAttribute('theme'), this.getAttribute('appearance'), {
      dark: !!media('(prefers-color-scheme: dark)')?.matches,
      moreContrast: !!media('(prefers-contrast: more)')?.matches,
    });
    const theme = this.getAttribute('theme');
    this.#box.dataset['theme'] = isPreset(theme) ? r.preset : 'auto';
    this.#box.dataset['scheme'] = r.scheme;
    if (r.highContrast) this.#box.dataset['contrast'] = 'high';
    else delete this.#box.dataset['contrast'];
  }

  #readSoundAttrs(): void {
    const s = this.getAttribute('sound');
    this.#sound.setDefault(s !== null && !offValue(s));
    const v = this.getAttribute('volume');
    if (v !== null && Number.isFinite(Number(v))) this.#sound.setVolume(Number(v), false);
    this.#sound.muted = this.muted;
    this.#applySound();
  }

  #applySound(): void {
    const on = this.#sound.enabled;
    const muted = this.#sound.muted || isNawaCaptchaMuted();
    const label = muted ? this.#t('soundMuted') : this.#t(on ? 'soundOff' : 'soundOn');
    this.#soundBtn.replaceChildren(icon(on && !muted ? 'sound-on' : 'sound-off'));
    this.#soundBtn.setAttribute('aria-pressed', String(on && !muted));
    this.#soundBtn.setAttribute('aria-label', label);
    this.#soundBtn.title = label;
    this.#soundBtn.disabled = muted;
    this.#vol.hidden = !on || muted;
    this.#volInput.value = String(Math.round(this.#sound.volume * 100));
    this.#volInput.setAttribute('aria-valuetext', `${Math.round(this.#sound.volume * 100)}%`);
  }

  #cue(c: Cue): void {
    this.#sound.play(c);
  }

  /** Subtle perspective tilt + parallax following a mouse/pen (never touch, never with reduced motion). */
  #wireTilt(): void {
    const box = this.#box;
    let pending: PointerEvent | undefined;
    const apply = (): void => {
      this.#raf = 0;
      const e = pending;
      if (!e) return;
      const r = box.getBoundingClientRect();
      const nx = Math.min(1, Math.max(-1, ((e.clientX - r.left) / r.width) * 2 - 1));
      const ny = Math.min(1, Math.max(-1, ((e.clientY - r.top) / r.height) * 2 - 1));
      box.style.setProperty('--_rx', `${(nx * MAX_TILT_DEG).toFixed(2)}deg`);
      box.style.setProperty('--_ry', `${(-ny * MAX_TILT_DEG * 0.8).toFixed(2)}deg`);
      box.style.setProperty('--_px', nx.toFixed(3));
      box.style.setProperty('--_py', ny.toFixed(3));
      box.style.setProperty('--_mx', `${(((nx + 1) / 2) * 100).toFixed(1)}%`);
      box.style.setProperty('--_my', `${(((ny + 1) / 2) * 100).toFixed(1)}%`);
      box.dataset['tilt'] = '';
    };
    const reset = (): void => {
      pending = undefined;
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
      delete box.dataset['tilt'];
      for (const p of ['--_rx', '--_ry', '--_px', '--_py', '--_mx', '--_my']) box.style.removeProperty(p);
    };
    box.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || this.#reducedMotion || this.getAttribute('tilt') === 'off' || box.dataset['contrast'] === 'high') return reset();
      if (box.dataset['pressed'] !== undefined) return;
      pending = e;
      if (!this.#raf) this.#raf = requestAnimationFrame(apply);
    });
    box.addEventListener('pointerleave', reset);
    // Flatten while a gesture is in progress so pointer → puzzle coordinates stay exact.
    box.addEventListener('pointerdown', () => {
      box.dataset['pressed'] = '';
    }, { capture: true });
    const release = (): void => {
      delete box.dataset['pressed'];
    };
    box.addEventListener('pointerup', release, { capture: true });
    box.addEventListener('pointercancel', release, { capture: true });
    box.addEventListener('lostpointercapture', release, { capture: true });
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
    this.#alt.setAttribute('aria-label', this.#t('altGroup'));
    this.#altText.lastElementChild!.textContent = this.#t('altText');
    this.#altAudio.lastElementChild!.textContent = this.#t('altAudio');
    this.#altText.setAttribute('aria-pressed', String(this.#altKind === 'text'));
    this.#altAudio.setAttribute('aria-pressed', String(this.#altKind === 'audio'));
    this.#brand.textContent = this.#t('brand');
    this.#vol.firstElementChild!.textContent = this.#t('volume');
    this.#applySound();
  }

  #setStatus(message: string, tone: 'info' | 'error' | 'success' = 'info'): void {
    this.#status.dataset['tone'] = tone;
    // Clear first so an identical message is announced again by screen readers.
    this.#status.textContent = '';
    if (message) setTimeout(() => (this.#status.textContent = message), 30);
  }

  #flash(kind: 'error' | 'success'): void {
    delete this.#box.dataset['flash'];
    void this.#box.offsetWidth;
    this.#box.dataset['flash'] = kind;
  }

  #clearTimer(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #setToken(token: string): void {
    this.#token = token;
    if (this.#input) this.#input.value = token;
  }

  /** The deprecated <nawa-guard> tag keeps its old default field name. */
  get #defaultField(): string {
    return this.localName === LEGACY_TAG_NAME ? LEGACY_FIELD : DEFAULT_FIELD;
  }

  #emit<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
    // Deprecated: the pre-rename event names (nawa-guard:*) still fire for this release.
    this.dispatchEvent(new CustomEvent<T>(name.replace(/^nawa-captcha:/, 'nawa-guard:'), { detail, bubbles: true, composed: true }));
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

  #loadingView(): HTMLElement {
    return h(
      'div',
      { class: 'loading', 'aria-hidden': 'true' },
      h('div', { class: 'skel' }, h('div', { class: 'stack' }, h('i'), h('i'), h('i'))),
      h('div', { class: 'skel-bar' }),
    );
  }

  async #load(userInitiated: boolean, message?: string): Promise<void> {
    const seq = (this.#loadSeq += 1);
    this.#ctl?.abort();
    this.#clearTimer();
    this.#view = undefined;
    this.#challenge = undefined;
    this.#busy = false;
    this.#setToken('');
    delete this.#box.dataset['state'];
    this.#applyStrings();
    const ctl = new AbortController();
    this.#ctl = ctl;
    this.#a11yBtn.hidden = false;
    this.#refreshBtn.hidden = false;
    this.#alt.hidden = !this.#accessible;
    this.#prompt.hidden = true;
    this.#body.inert = false;
    this.#body.classList.remove('verifying');
    this.#body.replaceChildren(this.#loadingView());
    this.#box.setAttribute('aria-busy', 'true');
    const expired = message === this.#t('expired');
    this.#notice.hidden = !expired;
    if (expired) this.#notice.replaceChildren(icon('clock'), h('span', {}, `${this.#t('expiredTitle')} · ${this.#t('fresh')}`));
    if (!message) this.#setStatus(this.#t('loading'));

    const type = this.#accessible ? (this.#altKind === 'audio' ? 'audio' : 'accessible') : this.getAttribute('type') || undefined;
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
      cue: (cue) => this.#cue(cue),
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
      : c.view === 'audio' ? audioView(host, c.data)
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
    this.#body.classList.add('verifying');
    this.#notice.hidden = true;
    this.#setStatus(this.#t('verifying'));
    const res = await this.#api('/verify', { token: c.token, answer }, ctl.signal);
    if (ctl.signal.aborted) return;
    this.#busy = false;
    this.#body.inert = false;
    this.#body.classList.remove('verifying');
    const b = res.body;

    const next = res.status === 200 && b && b['success'] === true && b['next'] && typeof b['next'] === 'object' ? parseChallenge(b['next'] as Record<string, unknown>) : undefined;
    if (next) {
      // Multi-step: this puzzle was right; show the next one.
      this.#cue('step');
      this.#flash('success');
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
    this.#cue('error');
    this.#flash('error');
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
    this.#showDone(true);
    this.#cue('success');
    this.#emit<NawaCaptchaVerifiedDetail>('nawa-captcha:verified', { token, expiresInMs, type });
    this.#timer = setTimeout(() => {
      this.#setToken('');
      this.#emit('nawa-captcha:expired', {});
      void this.#load(false, this.#t('expired'));
    }, Math.max(5_000, expiresInMs - 5_000));
  }

  #showDone(celebrate: boolean): void {
    this.#prompt.hidden = true;
    this.#alt.hidden = true;
    this.#notice.hidden = true;
    this.#a11yBtn.hidden = true;
    this.#refreshBtn.hidden = true;
    this.#box.dataset['state'] = 'verified';
    const sparks = celebrate && !this.#reducedMotion ? Array.from({ length: 10 }, (_, i) => h('i', { class: 'spark', style: `--a:${i * 36 + (i % 2) * 12}deg` })) : [];
    this.#body.replaceChildren(
      h(
        'div',
        { class: 'done' },
        h('span', { class: 'seal', 'aria-hidden': 'true' }, ...sparks, h('span', { class: 'seal-orb' }, icon('check'))),
        h('div', {}, h('strong', { class: 'done-title' }, this.#t('done')), h('span', { class: 'done-sub' }, this.#t('doneSub'))),
      ),
    );
    if (celebrate) this.#flash('success');
    this.#setStatus(this.#t('success'), 'success');
  }

  #fail(error: NawaCaptchaErrorDetail['error']): void {
    this.#busy = false;
    this.#view = undefined;
    this.#body.classList.remove('verifying');
    const key: StringKey = error === 'network' ? 'network' : error === 'rate-limited' ? 'rateLimited' : 'config';
    const retry = h('button', { type: 'button', class: 'btn secondary' }, this.#t('retry'));
    retry.addEventListener('click', () => void this.#load(true));
    this.#prompt.hidden = true;
    this.#notice.hidden = true;
    this.#box.dataset['state'] = 'error';
    this.#body.replaceChildren(h('div', { class: 'error-box' }, h('span', { class: 'err-icon', 'aria-hidden': 'true' }, icon('alert')), h('span', {}, this.#t(key)), h('div', { class: 'row' }, retry)));
    this.#cue('error');
    this.#setStatus(this.#t(key), 'error');
    this.#emit<NawaCaptchaErrorDetail>('nawa-captcha:error', { error });
  }
}

/** @deprecated The <nawa-guard> tag: use <nawa-captcha>. Same element, old default field name. */
export class NawaGuardLegacyElement extends NawaCaptchaElement {}

declare global {
  interface HTMLElementTagNameMap {
    'nawa-captcha': NawaCaptchaElement;
    /** @deprecated use 'nawa-captcha' */
    'nawa-guard': NawaCaptchaElement;
  }
  interface HTMLElementEventMap {
    'nawa-captcha:verified': CustomEvent<NawaCaptchaVerifiedDetail>;
    'nawa-captcha:expired': CustomEvent<Record<string, never>>;
    'nawa-captcha:error': CustomEvent<NawaCaptchaErrorDetail>;
    /** @deprecated use 'nawa-captcha:verified' */
    'nawa-guard:verified': CustomEvent<NawaCaptchaVerifiedDetail>;
    /** @deprecated use 'nawa-captcha:expired' */
    'nawa-guard:expired': CustomEvent<Record<string, never>>;
    /** @deprecated use 'nawa-captcha:error' */
    'nawa-guard:error': CustomEvent<NawaCaptchaErrorDetail>;
  }
}
