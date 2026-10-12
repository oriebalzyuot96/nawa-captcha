const FAMILIES = {
  drag: ['Drag, slide, rotate, hold', 'سحب وتدوير وضغط'],
  select: ['Select in a picture', 'اختيار من صورة'],
  tap: ['Tap in order', 'النقر بالترتيب'],
  order: ['Put in order', 'الترتيب'],
  draw: ['Draw a path', 'رسم مسار'],
  type: ['Type the answer', 'كتابة الإجابة'],
  invisible: ['Invisible and text alternative', 'غير مرئي وبديل نصي'],
};

const gallery = document.getElementById('gallery');
let lang = 'en';
let types = {};

function widget(attrs) {
  const w = document.createElement('nawa-guard');
  for (const [k, v] of Object.entries(attrs)) w.setAttribute(k, v);
  return w;
}

function renderGallery() {
  const sections = Object.entries(FAMILIES).map(([family, [en, ar]]) => {
    const section = document.createElement('section');
    const h = document.createElement('h3');
    h.className = 'family';
    h.textContent = lang === 'ar' ? ar : en;
    const grid = document.createElement('div');
    grid.className = 'gallery';
    for (const [type, info] of Object.entries(types)) {
      if (info.family !== family) continue;
      const card = document.createElement('article');
      card.className = 'card';
      const title = document.createElement('h4');
      title.textContent = `${lang === 'ar' ? info.ar : info.en}`;
      const code = document.createElement('code');
      code.textContent = type;
      title.append(' ', code);
      const w = widget({ 'site-key': 'demo', endpoint: '/captcha', action: 'gallery', type, lang });
      const out = document.createElement('p');
      out.className = 'token';
      w.addEventListener('nawa-guard:verified', (e) => (out.textContent = `pass token: ${e.detail.token.slice(0, 32)}…`));
      w.addEventListener('nawa-guard:expired', () => (out.textContent = ''));
      card.append(title, w, out);
      grid.append(card);
    }
    section.append(h, grid);
    return section;
  });
  gallery.replaceChildren(...sections);
}

document.getElementById('lang-toggle').addEventListener('click', (e) => {
  lang = lang === 'en' ? 'ar' : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  e.currentTarget.textContent = lang === 'ar' ? 'English' : 'العربية';
  for (const w of document.querySelectorAll('nawa-guard')) w.setAttribute('lang', lang);
  renderGallery();
});

document.getElementById('theme-toggle').addEventListener('click', (e) => {
  const dark = document.documentElement.classList.toggle('dark');
  e.currentTarget.setAttribute('aria-pressed', String(dark));
});

// Login form: enable submit only once verified.
const loginGuard = document.querySelector('form nawa-guard');
const loginSubmit = document.getElementById('login-submit');
loginGuard.addEventListener('nawa-guard:verified', () => (loginSubmit.disabled = false));
loginGuard.addEventListener('nawa-guard:expired', () => (loginSubmit.disabled = true));

// JSON APIs: send the pass token in a header.
function wireApi(guardId, buttonId, resultId, url) {
  const guard = document.getElementById(guardId);
  const send = document.getElementById(buttonId);
  const result = document.getElementById(resultId);
  guard.addEventListener('nawa-guard:verified', () => (send.disabled = false));
  send.addEventListener('click', async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nawa-Guard-Token': guard.token },
      body: JSON.stringify({ message: 'hello' }),
    });
    result.textContent = `${res.status} ${JSON.stringify(await res.json())}`;
    send.disabled = true;
    guard.reset();
  });
}
wireApi('api-guard', 'api-send', 'api-result', '/api/contact');
wireApi('checkout-guard', 'checkout-send', 'checkout-result', '/api/checkout');

fetch('/types.json')
  .then((r) => r.json())
  .then((t) => {
    types = t;
    document.getElementById('type-count').textContent = String(Object.keys(t).length);
    renderGallery();
  });
