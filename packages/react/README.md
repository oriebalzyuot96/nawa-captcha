# @nawa-captcha/react

**Nawa Captcha** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: React component and hook.

- 🧩 38 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work, an accessible text question and an audio challenge — [see them live](https://oriebalzyuot96.github.io/nawa-captcha/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly (text question and audio challenge); Arabic and English; RTL
- 🎨 Premium 3D design, six themes in light and dark plus high contrast (WCAG 2.2 AA), Pelagic UI tokens, optional sound effects
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaCaptcha.AspNetCore`, coming to NuGet)

## Install

> **On npm:** `npm i @nawa-captcha/react`, or `npm i nawa-captcha` for everything in one package.

```bash
npm i @nawa-captcha/react
# or
yarn add @nawa-captcha/react
# or
pnpm add @nawa-captcha/react
```

## Usage

```tsx
import { NawaCaptcha, useNawaCaptcha } from '@nawa-captcha/react';

function Login() {
  const guard = useNawaCaptcha();
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await fetch('/api/login', { method: 'POST', headers: { 'X-Nawa-Captcha-Token': guard.token } });
      guard.reset(); // tokens are single-use
    }}>
      <NawaCaptcha siteKey="main" action="login" lang="en" {...guard.bind} />
      <button disabled={!guard.verified}>Sign in</button>
    </form>
  );
}
```

`types` narrows the server's allowed puzzles: `<NawaCaptcha action="login" types={['slider', 'pairs']} />` (never widens them).

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-captcha#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-captcha/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-captcha

MIT © oriebalzyuot96
