/*
 * The interactive playground on the project site. Everything runs in this page: the real
 * challenge generator and verifier (packages/server, browser build) answer the real widget
 * (packages/widget) through an in-page endpoint shim.
 */
import { CHALLENGE_TYPES, openChallenge, TYPE_INFO, type ChallengeType, type SelectionMode, type TypeFamily } from '../../packages/server/src/index.js';
import { DemoBackend, type ExchangeLog } from './demo-endpoint.js';

type Lang = 'en' | 'ar';
const ACTION = 'signup';

const UI: Record<Lang, Record<string, string>> = {
  en: {
    banner: 'Demo mode: challenges are generated and verified in your browser; in production your server does this.',
    puzzles: 'Puzzles',
    pickOne: 'Try one',
    pickMany: 'Mix several',
    all: 'All',
    none: 'Clear',
    selected: '{n} selected',
    mode: 'Selection',
    random: 'Random',
    sequence: 'Sequence',
    adaptive: 'Adaptive',
    steps: 'Puzzles in a row',
    level: 'Difficulty level',
    language: 'Language',
    theme: 'Page',
    light: 'Light',
    dark: 'Dark',
    wtheme: 'Widget theme',
    auto: 'Auto (page tokens)',
    appearance: 'Appearance',
    page: 'Page',
    hc: 'High contrast',
    sound: 'Sound effects',
    on: 'On',
    off: 'Off',
    soundHelp: 'Visitors can always switch it with the speaker button.',
    a11yAlt: 'Accessible alternatives',
    tryAudio: 'Try the audio challenge',
    preview: 'Live widget',
    formTitle: 'Create your account',
    email: 'Email',
    submit: 'Sign up',
    config: 'Your configuration',
    received: 'What the browser received',
    receivedNote: 'Pictures, a prompt and an opaque sealed token. No answer.',
    sealed: 'Inside the sealed token (visible only in demo mode)',
    sealedNote: 'AES-256-GCM sealed. Your server opens it; the browser cannot.',
    pass: 'Pass token',
    passNote: 'Signed (HMAC-SHA256), short-lived, single use. Readable by design: it holds no secret.',
    verifyBackend: 'Verify as the backend would',
    log: 'Event log',
    waiting: 'Solve the puzzle to get a pass token.',
  },
  ar: {
    banner: 'وضع العرض: تُولَّد التحديات ويُتحقق منها داخل متصفحك؛ في بيئة الإنتاج يقوم خادمك بذلك.',
    puzzles: 'الألغاز',
    pickOne: 'جرّب لغزًا',
    pickMany: 'امزج عدة ألغاز',
    all: 'الكل',
    none: 'مسح',
    selected: 'تم اختيار {n}',
    mode: 'طريقة الاختيار',
    random: 'عشوائي',
    sequence: 'بالتتابع',
    adaptive: 'تكيّفي',
    steps: 'عدد الألغاز المتتالية',
    level: 'مستوى الصعوبة',
    language: 'اللغة',
    theme: 'الصفحة',
    light: 'فاتح',
    dark: 'داكن',
    wtheme: 'نمط الأداة',
    auto: 'تلقائي (ألوان الصفحة)',
    appearance: 'المظهر',
    page: 'الصفحة',
    hc: 'تباين عالٍ',
    sound: 'المؤثرات الصوتية',
    on: 'تشغيل',
    off: 'إيقاف',
    soundHelp: 'يستطيع الزائر تغييرها دائمًا بزر السماعة.',
    a11yAlt: 'البدائل الميسّرة',
    tryAudio: 'جرّب التحدي الصوتي',
    preview: 'الأداة مباشرة',
    formTitle: 'أنشئ حسابك',
    email: 'البريد الإلكتروني',
    submit: 'تسجيل',
    config: 'إعداداتك',
    received: 'ما وصل إلى المتصفح',
    receivedNote: 'صور ونص التعليمات ورمز مختوم معتم. بلا إجابة.',
    sealed: 'داخل الرمز المختوم (يظهر في وضع العرض فقط)',
    sealedNote: 'مختوم بـ AES-256-GCM. يفتحه خادمك فقط، لا المتصفح.',
    pass: 'رمز العبور',
    passNote: 'موقّع (HMAC-SHA256)، قصير العمر، يُستخدم مرة واحدة. مقروء عمدًا لأنه لا يحمل سرًا.',
    verifyBackend: 'تحقّق كما يفعل الخادم الخلفي',
    log: 'سجل الأحداث',
    waiting: 'حلّ اللغز للحصول على رمز العبور.',
  },
};
const MODE_HELP: Record<Lang, Record<SelectionMode, string>> = {
  en: { random: 'A weighted random pick from the selected types.', sequence: 'The selected types in turn, per visitor.', adaptive: 'The difficulty ladder, limited to the selected types.' },
  ar: { random: 'اختيار عشوائي من الأنواع المحددة.', sequence: 'الأنواع المحددة بالتناوب لكل زائر.', adaptive: 'سلّم الصعوبة ضمن الأنواع المحددة.' },
};
const FAMILY_NAMES: Record<TypeFamily, Record<Lang, string>> = {
  drag: { en: 'Drag · rotate · hold', ar: 'سحب وتدوير وضغط' },
  select: { en: 'Select in a picture', ar: 'اختيار من صورة' },
  tap: { en: 'Tap in order', ar: 'النقر بالترتيب' },
  order: { en: 'Put in order', ar: 'الترتيب' },
  draw: { en: 'Draw a path', ar: 'رسم مسار' },
  type: { en: 'Type the answer', ar: 'كتابة الإجابة' },
  invisible: { en: 'Invisible · text · audio', ar: 'غير مرئي ونصي وصوتي' },
};

const state = {
  pick: 'one' as 'one' | 'many',
  selected: new Set<ChallengeType>(['slider']),
  mode: 'random' as SelectionMode,
  steps: 1,
  level: 0,
  lang: 'en' as Lang,
  wtheme: 'auto',
  appear: 'page' as 'page' | 'light' | 'dark' | 'high-contrast',
  sound: false,
};

const pageIsDark = (): boolean => {
  const forced = document.documentElement.dataset['theme'];
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

/** Applies the chosen theme/appearance/sound to the playground and hero widgets. */
function applyLook(): void {
  for (const w of document.querySelectorAll<HTMLElement>('#pg-widget, #hero-widget')) {
    w.setAttribute('theme', state.wtheme);
    w.setAttribute('appearance', state.appear === 'page' ? (pageIsDark() ? 'dark' : 'light') : state.appear);
    w.setAttribute('sound', state.sound ? 'on' : 'off');
  }
}

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
const root = $('#playground');
const widget = $<HTMLElement & { reset(): void; token: string }>('#pg-widget');

function t(key: string, vars: Record<string, string | number> = {}): string {
  return (UI[state.lang][key] ?? UI.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

function options() {
  return {
    types: [...state.selected],
    mode: state.mode,
    steps: state.steps,
    adaptive: false as const,
    assessRisk: () => state.level,
    powBits: 12,
    bind: 'ua' as const,
    // The theme gallery uses its own action, so it can show other puzzles than the playground.
    perAction: { gallery: { types: ['icons', 'order', 'rotate'] as ChallengeType[], mode: 'random' as const } },
  };
}

const backend = new DemoBackend(options());
// Define <nawa-captcha> only now, so the widgets' first request already reaches the in-page endpoint.
await import('../../packages/widget/src/index.js');

// ------------------------------------------------------------------------------- rendering

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

function renderGallery(): void {
  const host = $('#pg-gallery');
  const groups = new Map<TypeFamily, ChallengeType[]>();
  for (const type of CHALLENGE_TYPES) {
    const f = TYPE_INFO[type].family;
    groups.set(f, [...(groups.get(f) ?? []), type]);
  }
  host.replaceChildren(
    ...[...groups].map(([family, types]) =>
      el(
        'div',
        { class: 'pg-group', role: 'group', 'aria-label': FAMILY_NAMES[family][state.lang] },
        el('p', { class: 'pg-group-title' }, FAMILY_NAMES[family][state.lang]),
        el(
          'div',
          { class: 'pg-chips' },
          ...types.map((type) => {
            const b = el('button', { type: 'button', class: 'pg-chip', 'aria-pressed': String(state.selected.has(type)), 'data-type': type, title: `${type} · blind guess ${TYPE_INFO[type].guess}` }, TYPE_INFO[type][state.lang]);
            b.addEventListener('click', () => {
              if (state.pick === 'one') state.selected = new Set([type]);
              else if (state.selected.has(type) && state.selected.size > 1) state.selected.delete(type);
              else state.selected.add(type);
              apply();
            });
            return b;
          }),
        ),
      ),
    ),
  );
  $('#pg-count').textContent = t('selected', { n: state.selected.size });
}

function setPressed(groupSel: string, value: string): void {
  for (const b of root.querySelectorAll<HTMLButtonElement>(`${groupSel} button`)) b.setAttribute('aria-pressed', String(b.dataset['value'] === value));
}

function renderControls(): void {
  setPressed('#pg-pick', state.pick);
  setPressed('#pg-mode', state.mode);
  setPressed('#pg-steps', String(state.steps));
  setPressed('#pg-lang', state.lang);
  setPressed('#pg-theme', pageIsDark() ? 'dark' : 'light');
  setPressed('#pg-wtheme', state.wtheme);
  setPressed('#pg-appear', state.appear);
  setPressed('#pg-sound', state.sound ? 'on' : 'off');
  ($('#pg-level') as HTMLInputElement).value = String(state.level);
  $('#pg-level-value').textContent = String(state.level);
  $('#pg-mode-help').textContent = MODE_HELP[state.lang][state.mode];
  for (const n of root.querySelectorAll<HTMLElement>('[data-i18n]')) n.textContent = t(n.dataset['i18n']!);
  // The playground panels follow the chosen language; the page around them stays as it is.
  for (const part of root.querySelectorAll<HTMLElement>('.pg, .demo-banner')) {
    part.setAttribute('lang', state.lang);
    part.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
  }
  renderConfig();
}

function renderConfig(): void {
  const types = [...state.selected].map((x) => `'${x}'`).join(', ');
  const lines = [
    `import { createNawaCaptcha } from '@nawa-captcha/server';`,
    ``,
    `const guard = createNawaCaptcha({`,
    `  secret: process.env.NAWA_CAPTCHA_SECRET,`,
    `  types: [${types}],`,
    `  mode: '${state.mode}',`,
    ...(state.steps > 1 ? [`  steps: ${state.steps},`] : []),
    `});`,
    ``,
    `<nawa-captcha site-key="main" endpoint="/captcha"`,
    `            action="${ACTION}" lang="${state.lang}"`,
    ...(state.wtheme !== 'auto' ? [`            theme="${state.wtheme}"`] : []),
    ...(state.appear !== 'page' ? [`            appearance="${state.appear}"`] : []),
    ...(state.sound ? [`            sound`] : []),
    `></nawa-captcha>`,
  ];
  $('#pg-config').textContent = lines.join('\n');
}

function short(value: unknown): unknown {
  if (typeof value === 'string' && (value.startsWith('data:image/') || value.startsWith('data:audio/'))) {
    const kb = ((value.length * 3) / 4 / 1024).toFixed(1);
    return `${value.slice(0, 26)}… (${kb} kB ${value.startsWith('data:audio/') ? 'WAV' : 'image'})`;
  }
  if (typeof value === 'string' && value.length > 80) return `${value.slice(0, 40)}…${value.slice(-12)}`;
  if (Array.isArray(value)) return value.map(short);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, short(v)]));
  return value;
}

const json = (v: unknown): string => JSON.stringify(v, null, 2);

function showChallenge(c: Record<string, unknown>): void {
  $('#pg-received').textContent = json(short(c));
  const opened = typeof c['token'] === 'string' ? openChallenge(backend.guard.keys, c['token']) : undefined;
  $('#pg-sealed').textContent = opened ? json(short(opened.claims)) : '';
}

function decodePass(token: string): void {
  const [prefix, kid, payload, sig] = token.split('.');
  const b64 = payload!.replace(/-/g, '+').replace(/_/g, '/');
  const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0))));
  $('#pg-pass').textContent = `${prefix}.${kid}.${payload!.slice(0, 18)}….${sig!.slice(0, 10)}…\n\n${json({ format: `${prefix} (pass token v1)`, kid, claims, signature: `HMAC-SHA256, ${sig!.length} chars base64url` })}`;
  const button = $<HTMLButtonElement>('#pg-verify');
  button.disabled = false;
  button.onclick = async () => {
    const r = await backend.guard.verifyPassToken(token, { expectedAction: ACTION, client: backend.client, maxAgeSec: 300 });
    log(r.ok ? `verifyPassToken → ok (typ ${r.claims.typ}${r.claims.stp ? `, steps ${r.claims.stp.join(' → ')}` : ''})` : `verifyPassToken → ${r.error} (tokens are single-use)`, r.ok ? 'ok' : 'bad');
  };
}

function log(message: string, tone: 'ok' | 'bad' | 'info' = 'info'): void {
  const list = $('#pg-log');
  list.prepend(el('li', { class: `pg-log-${tone}` }, el('time', {}, new Date().toLocaleTimeString()), ' ', message));
  while (list.children.length > 30) list.lastElementChild?.remove();
}

let lastChallenge: Record<string, unknown> | undefined;
backend.onExchange = (x: ExchangeLog) => {
  const res = x.response as Record<string, unknown>;
  if (res['token'] && res['type']) lastChallenge = res;
  if (res['next']) lastChallenge = res['next'] as Record<string, unknown>;
  if (x.path === '/challenge') {
    if (res['success']) {
      log(`POST /challenge → ${res['type']} (view ${res['view']}${Number(res['steps']) > 1 ? `, step ${res['step']}/${res['steps']}` : ''})`);
      showChallenge(res);
    } else log(`POST /challenge → ${x.status} ${String(res['error'])}`, 'bad');
    return;
  }
  if (res['next']) {
    const next = res['next'] as Record<string, unknown>;
    log(`POST /verify → correct, next step ${next['step']}/${next['steps']}: ${next['type']}`, 'ok');
    showChallenge(next);
  } else if (res['success']) {
    log(`POST /verify → pass token issued (${(res['solvedTypes'] as string[]).join(' → ')})`, 'ok');
    decodePass(String(res['token']));
  } else log(`POST /verify → ${x.status} ${String(res['error'])}${res['retry'] ? ' (retry allowed)' : ''}`, 'bad');
};

// ------------------------------------------------------------------------------- wiring

function apply(reload = true): void {
  if (state.steps > 1 && state.selected.size < 2 && state.pick === 'many') state.steps = Math.max(1, state.selected.size);
  backend.configure(options());
  renderGallery();
  renderControls();
  $('#pg-pass').textContent = t('waiting');
  $<HTMLButtonElement>('#pg-verify').disabled = true;
  widget.setAttribute('lang', state.lang);
  widget.removeAttribute('type');
  applyLook();
  if (reload) widget.reset();
}

function segmented(sel: string, onPick: (v: string) => void): void {
  for (const b of root.querySelectorAll<HTMLButtonElement>(`${sel} button`)) b.addEventListener('click', () => onPick(b.dataset['value']!));
}

segmented('#pg-pick', (v) => {
  state.pick = v as 'one' | 'many';
  if (state.pick === 'one') state.selected = new Set([[...state.selected][0] ?? 'slider']);
  apply();
});
segmented('#pg-mode', (v) => {
  state.mode = v as SelectionMode;
  apply();
});
segmented('#pg-steps', (v) => {
  state.steps = Number(v);
  if (state.steps > 1 && state.selected.size < 2) {
    state.pick = 'many';
    for (const extra of ['rotate-object', 'pairs', 'icons-weather'] as const) if (state.selected.size < state.steps) state.selected.add(extra);
  }
  apply();
});
segmented('#pg-lang', (v) => {
  state.lang = v as Lang;
  apply();
});
segmented('#pg-theme', (v) => {
  document.documentElement.dataset['theme'] = v;
  try {
    localStorage.setItem('nawa-captcha-theme', v);
  } catch {
    // storage unavailable: the choice just is not remembered
  }
  applyLook();
  renderControls();
});
segmented('#pg-wtheme', (v) => {
  state.wtheme = v;
  applyLook();
  renderControls();
});
segmented('#pg-appear', (v) => {
  state.appear = v as typeof state.appear;
  applyLook();
  renderControls();
});
segmented('#pg-sound', (v) => {
  state.sound = v === 'on';
  applyLook();
  renderControls();
});
$('#pg-audio').addEventListener('click', () => {
  widget.setAttribute('type', 'audio');
  widget.reset();
  log('Requested the audio challenge (type "audio" is always allowed as an accessible alternative).');
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  applyLook();
  renderControls();
});
$('#pg-all').addEventListener('click', () => {
  state.pick = 'many';
  state.selected = new Set(CHALLENGE_TYPES.filter((x) => x !== 'accessible' && x !== 'audio'));
  apply();
});
$('#pg-none').addEventListener('click', () => {
  state.pick = 'one';
  state.selected = new Set(['slider']);
  state.steps = 1;
  apply();
});
$<HTMLInputElement>('#pg-level').addEventListener('change', (e) => {
  state.level = Number((e.target as HTMLInputElement).value);
  apply();
});
widget.addEventListener('nawa-captcha:verified', () => ($<HTMLButtonElement>('#pg-submit').disabled = false));
widget.addEventListener('nawa-captcha:expired', () => ($<HTMLButtonElement>('#pg-submit').disabled = true));
$('#pg-form').addEventListener('submit', (e) => {
  e.preventDefault();
  log('Form submitted with the pass token in the hidden field "nawa-captcha-token".', 'ok');
});

apply(false);
log('Demo backend started in this page with a random secret.');

// Debug hook for automated checks of the demo (never present in production widgets).
(window as unknown as { nawaDemo: unknown }).nawaDemo = {
  backend,
  state,
  apply,
  last: () => lastChallenge,
  open: (token: string) => openChallenge(backend.guard.keys, token)?.claims,
};
