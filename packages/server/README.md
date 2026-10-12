# @nawa-guard/server

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Node.js server: issue and verify challenges, Express middleware.

- 🧩 37 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work and an accessible text question — [see them live](https://oriebalzyuot96.github.io/nawa-guard/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore`, coming to NuGet)

## Install

> **Coming to npm.** `@nawa-guard/server` is published once the `@nawa-guard` npm organisation exists. Until then, build it from the [repository](https://github.com/oriebalzyuot96/nawa-guard) (`npm install && npm run build`, then `npm pack -w @nawa-guard/server`).

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

## Choosing puzzles

```js
const guard = createNawaGuard({
  secret: process.env.NAWA_GUARD_SECRET,
  types: ['slider', 'rotate-object', 'pairs', 'maze'], // allow-list: one, two or many
  mode: 'random',                                      // 'random' | 'sequence' | 'adaptive' (default)
  weights: { maze: 2 },
  perAction: { login: ['pow', 'slider'], signup: { types: ['maze', 'spell'], steps: 2 } },
});
// Routes can demand more: requireCaptcha(guard, { expectedAction: 'signup', allowedTypes: ['maze', 'spell'], minSteps: 2 })
```

The browser can narrow the list (`<nawa-guard types="slider,maze">`) but never widen it. With `steps` > 1, `POST /verify` returns `{ next }` until the last puzzle; the pass token then lists every solved type in `stp`. Every type, its keyboard operation and its blind-guess rate are in the [main README](https://github.com/oriebalzyuot96/nawa-guard#puzzle-types).

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-guard#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
