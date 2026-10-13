import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createNawaCaptcha, TYPE_INFO } from '@nawa-captcha/server';
import { nawaCaptchaExpress, requireCaptcha } from '@nawa-captcha/server/express';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 5180);

// In production the secret comes from a secret store; never commit it, never send it to a browser.
// NAWA_GUARD_SECRET is the deprecated (pre-rename) name and still read as a fallback.
const secret = process.env.NAWA_CAPTCHA_SECRET ?? process.env.NAWA_GUARD_SECRET ?? randomBytes(32).toString('base64url');
if (!process.env.NAWA_CAPTCHA_SECRET && !process.env.NAWA_GUARD_SECRET) console.warn('[demo] NAWA_CAPTCHA_SECRET not set: using a random per-process secret.');

const guard = createNawaCaptcha({
  secret,
  siteKeys: ['demo'],
  actions: ['login', 'gallery', 'contact', 'checkout'],
  // The gallery lets you pick each puzzle type; real deployments leave this off.
  allowClientType: true,
  // Per-action selection: the login form gets one of three puzzles at random; checkout needs two
  // different puzzles in a row before a pass token is issued.
  perAction: {
    login: { types: ['slider', 'rotate-object', 'pairs'], mode: 'random' },
    checkout: { types: ['shadow-drag', 'icons-objects', 'tap-order', 'maze'], mode: 'random', steps: 2 },
  },
  // The gallery loads ~40 widgets at once; keep the limiter generous for the demo.
  rateLimit: { windowSec: 60, challenge: 400, verify: 400 },
  onEvent: (e) => {
    if (e.type !== 'challenge-issued') console.log('[nawa-captcha]', JSON.stringify(e));
  },
});

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// 1) The two captcha endpoints: POST /captcha/challenge, POST /captcha/verify.
app.use('/captcha', express.json({ limit: '32kb' }), nawaCaptchaExpress(guard));

// 2) A protected HTML form post (token arrives in the hidden `nawa-captcha-token` field).
app.post('/login', express.urlencoded({ extended: false, limit: '8kb' }), requireCaptcha(guard, { expectedAction: 'login', maxAgeSec: 300 }), (req, res) => {
  const user = String(req.body.email ?? '').slice(0, 80);
  res.type('html').send(
    `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><main class="page"><h1>Signed in (demo)</h1><p>The server verified a single-use pass token for action <code>${escapeHtml(req.nawaCaptcha.act)}</code>, solved via <code>${escapeHtml(req.nawaCaptcha.typ)}</code>.</p><p>User: <code>${escapeHtml(user)}</code></p><p><a href="/">Back</a></p></main>`,
  );
});

app.post('/api/checkout', express.json({ limit: '8kb' }), requireCaptcha(guard, { expectedAction: 'checkout', minSteps: 2 }), (req, res) => {
  res.json({ ok: true, solvedWith: req.nawaCaptcha.stp });
});

// The puzzle catalogue for the gallery.
app.get('/types.json', (_req, res) => res.json(TYPE_INFO));

// 3) A protected JSON API (token arrives in the X-Nawa-Captcha-Token header).
app.post('/api/contact', express.json({ limit: '8kb' }), requireCaptcha(guard, { expectedAction: 'contact' }), (req, res) => {
  res.json({ ok: true, message: 'Message accepted', solvedWith: req.nawaCaptcha.typ });
});

app.use('/widget', express.static(join(here, '..', 'packages', 'widget', 'dist')));
app.use(express.static(join(here, 'public')));

app.listen(port, () => console.log(`Nawa Captcha demo on http://localhost:${port}`));

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
