import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createNawaGuard } from '@nawa-guard/server';
import { nawaGuardExpress, requireCaptcha } from '@nawa-guard/server/express';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 5180);

// In production the secret comes from a secret store; never commit it, never send it to a browser.
const secret = process.env.NAWA_GUARD_SECRET ?? randomBytes(32).toString('base64url');
if (!process.env.NAWA_GUARD_SECRET) console.warn('[demo] NAWA_GUARD_SECRET not set: using a random per-process secret.');

const guard = createNawaGuard({
  secret,
  siteKeys: ['demo'],
  actions: ['login', 'gallery', 'contact'],
  // The gallery lets you pick each puzzle type; real deployments leave this off.
  allowClientType: true,
  // The gallery loads 10 widgets at once; keep the limiter generous for the demo.
  rateLimit: { windowSec: 60, challenge: 120, verify: 120 },
  onEvent: (e) => {
    if (e.type !== 'challenge-issued') console.log('[nawa-guard]', JSON.stringify(e));
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
app.use('/captcha', express.json({ limit: '32kb' }), nawaGuardExpress(guard));

// 2) A protected HTML form post (token arrives in the hidden `nawa-guard-token` field).
app.post('/login', express.urlencoded({ extended: false, limit: '8kb' }), requireCaptcha(guard, { expectedAction: 'login', maxAgeSec: 300 }), (req, res) => {
  const user = String(req.body.email ?? '').slice(0, 80);
  res.type('html').send(
    `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/app.css"><main class="page"><h1>Signed in (demo)</h1><p>The server verified a single-use pass token for action <code>${escapeHtml(req.nawaGuard.act)}</code>, solved via <code>${escapeHtml(req.nawaGuard.typ)}</code>.</p><p>User: <code>${escapeHtml(user)}</code></p><p><a href="/">Back</a></p></main>`,
  );
});

// 3) A protected JSON API (token arrives in the X-Nawa-Guard-Token header).
app.post('/api/contact', express.json({ limit: '8kb' }), requireCaptcha(guard, { expectedAction: 'contact' }), (req, res) => {
  res.json({ ok: true, message: 'Message accepted', solvedWith: req.nawaGuard.typ });
});

app.use('/widget', express.static(join(here, '..', 'packages', 'widget', 'dist')));
app.use(express.static(join(here, 'public')));

app.listen(port, () => console.log(`Nawa Guard demo on http://localhost:${port}`));

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
