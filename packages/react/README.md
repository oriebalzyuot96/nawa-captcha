# @nawa-guard/react

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: React component and hook.

- 🧩 8 challenge types: slider jigsaw, rotate, pick icons, math image, drag to order, connect the dots, invisible proof-of-work, and an accessible text question
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore` on NuGet)

## Install

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

Then verify on your backend before trusting the request — see the full guide.

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
