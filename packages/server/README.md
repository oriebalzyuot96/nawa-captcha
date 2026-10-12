# @nawa-guard/server

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Node.js server: issue and verify challenges, Express middleware.

- 🧩 8 challenge types: slider jigsaw, rotate, pick icons, math image, drag to order, connect the dots, invisible proof-of-work, and an accessible text question
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore` on NuGet)

## Install

```bash
npm i @nawa-guard/server
# or
yarn add @nawa-guard/server
# or
pnpm add @nawa-guard/server
```

## Usage

```js
import express from 'express';
import { createNawaGuard } from '@nawa-guard/server';
import { nawaGuardExpress, requireCaptcha } from '@nawa-guard/server/express';

const guard = createNawaGuard({
  secret: process.env.NAWA_GUARD_SECRET, // ≥ 32 chars, never sent to browsers
  siteKeys: ['main'],
  actions: ['login'],
});

const app = express();
// POST /captcha/challenge and POST /captcha/verify
app.use('/captcha', express.json({ limit: '32kb' }), nawaGuardExpress(guard));
// Protect a route: the token comes from the X-Nawa-Guard-Token header or the nawa-guard-token field
app.post('/login', express.urlencoded({ extended: false }),
  requireCaptcha(guard, { expectedAction: 'login', maxAgeSec: 300 }),
  (req, res) => res.send('ok'));
```

Then verify on your backend before trusting the request — see the full guide.

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
