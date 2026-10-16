# @nawa-captcha/server

**Nawa Captcha** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Node.js server: issue and verify challenges, Express middleware.

- 🧩 38 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work, an accessible text question and an audio challenge — [see them live](https://oriebalzyuot96.github.io/nawa-captcha/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly (text question and audio challenge); Arabic and English; RTL
- 🎨 Premium 3D design, six themes in light and dark plus high contrast (WCAG 2.2 AA), Pelagic UI tokens, optional sound effects
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaCaptcha.AspNetCore`, coming to NuGet)

## Install

> **On npm:** `npm i @nawa-captcha/server`, or `npm i nawa-captcha` for everything in one package.

```bash
npm i @nawa-captcha/server
# or
yarn add @nawa-captcha/server
# or
pnpm add @nawa-captcha/server
```

## Usage

```js
import express from 'express';
import { createNawaCaptcha } from '@nawa-captcha/server';
import { nawaCaptchaExpress, requireCaptcha } from '@nawa-captcha/server/express';

const guard = createNawaCaptcha({
  secret: process.env.NAWA_CAPTCHA_SECRET, // ≥ 32 chars, never sent to browsers
  siteKeys: ['main'],
  actions: ['login'],
});

const app = express();
// POST /captcha/challenge and POST /captcha/verify
app.use('/captcha', express.json({ limit: '32kb' }), nawaCaptchaExpress(guard));
// Protect a route: the token comes from the X-Nawa-Captcha-Token header or the nawa-captcha-token field
app.post('/login', express.urlencoded({ extended: false }),
  requireCaptcha(guard, { expectedAction: 'login', maxAgeSec: 300 }),
  (req, res) => res.send('ok'));
```

## Choosing puzzles

```js
const guard = createNawaCaptcha({
  secret: process.env.NAWA_CAPTCHA_SECRET,
  types: ['slider', 'rotate-object', 'pairs', 'maze'], // allow-list: one, two or many
  mode: 'random',                                      // 'random' | 'sequence' | 'adaptive' (default)
  weights: { maze: 2 },
  perAction: { login: ['pow', 'slider'], signup: { types: ['maze', 'spell'], steps: 2 } },
});
// Routes can demand more: requireCaptcha(guard, { expectedAction: 'signup', allowedTypes: ['maze', 'spell'], minSteps: 2 })
```

The browser can narrow the list (`<nawa-captcha types="slider,maze">`) but never widen it. With `steps` > 1, `POST /verify` returns `{ next }` until the last puzzle; the pass token then lists every solved type in `stp`. Every type, its keyboard operation and its blind-guess rate are in the [main README](https://github.com/oriebalzyuot96/nawa-captcha#puzzle-types).

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-captcha#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-captcha/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-captcha

MIT © oriebalzyuot96
