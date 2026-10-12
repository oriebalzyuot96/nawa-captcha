const TYPES = [
  ['slider', 'Slider jigsaw', 'لغز السحب'],
  ['rotate', 'Rotate to upright', 'تدوير الصورة'],
  ['icons', 'Select matching icons', 'اختيار الأشكال'],
  ['math', 'Math image', 'عملية حسابية'],
  ['order', 'Drag to order', 'ترتيب البطاقات'],
  ['trace', 'Connect the dots', 'توصيل النقاط'],
  ['pow', 'Invisible proof-of-work', 'إثبات عمل غير مرئي'],
  ['accessible', 'Accessible text', 'تحدٍّ نصي ميسّر'],
];

const gallery = document.getElementById('gallery');
let lang = 'en';

function renderGallery() {
  gallery.replaceChildren(
    ...TYPES.map(([type, en, ar]) => {
      const card = document.createElement('article');
      card.className = 'card';
      const h = document.createElement('h3');
      h.textContent = lang === 'ar' ? ar : en;
      const w = document.createElement('nawa-guard');
      w.setAttribute('site-key', 'demo');
      w.setAttribute('endpoint', '/captcha');
      w.setAttribute('action', 'gallery');
      w.setAttribute('type', type);
      w.setAttribute('lang', lang);
      const out = document.createElement('p');
      out.className = 'token';
      w.addEventListener('nawa-guard:verified', (e) => (out.textContent = `pass token: ${e.detail.token.slice(0, 32)}…`));
      w.addEventListener('nawa-guard:expired', () => (out.textContent = ''));
      card.append(h, w, out);
      return card;
    }),
  );
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

// JSON API: send the pass token in a header.
const apiGuard = document.getElementById('api-guard');
const apiSend = document.getElementById('api-send');
const apiResult = document.getElementById('api-result');
apiGuard.addEventListener('nawa-guard:verified', () => (apiSend.disabled = false));
apiSend.addEventListener('click', async () => {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Nawa-Guard-Token': apiGuard.token },
    body: JSON.stringify({ message: 'hello' }),
  });
  apiResult.textContent = `${res.status} ${JSON.stringify(await res.json())}`;
  apiSend.disabled = true;
  apiGuard.reset();
});

renderGallery();
