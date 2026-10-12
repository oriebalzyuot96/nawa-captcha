# @nawa-guard/react

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: React component and hook.

- 🧩 37 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work and an accessible text question — [see them live](https://oriebalzyuot96.github.io/nawa-guard/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore`, coming to NuGet)

## Install

> **Coming to npm.** `@nawa-guard/react` is published once the `@nawa-guard` npm organisation exists. Until then, build it from the [repository](https://github.com/oriebalzyuot96/nawa-guard) (`npm install && npm run build`, then `npm pack -w @nawa-guard/react`).

```bash
npm i @nawa-guard/react
# or
yarn add @nawa-guard/react
# or
pnpm add @nawa-guard/react
```

## Usage

```tsx
import { NawaGuard, useNawaGuard } from '@nawa-guard/react';

function Login() {
  const guard = useNawaGuard();
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await fetch('/api/login', { method: 'POST', headers: { 'X-Nawa-Guard-Token': guard.token } });
      guard.reset(); // tokens are single-use
    }}>
      <NawaGuard siteKey="main" action="login" lang="en" {...guard.bind} />
      <button disabled={!guard.verified}>Sign in</button>
    </form>
  );
}
```

`types` narrows the server's allowed puzzles: `<NawaGuard action="login" types={['slider', 'pairs']} />` (never widens them).

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-guard#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
