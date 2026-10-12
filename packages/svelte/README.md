# @nawa-guard/svelte

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Svelte 5 component.

- 🧩 8 challenge types: slider jigsaw, rotate, pick icons, math image, drag to order, connect the dots, invisible proof-of-work, and an accessible text question
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore` on NuGet)

## Install

```bash
npm i @nawa-guard/svelte
# or
yarn add @nawa-guard/svelte
# or
pnpm add @nawa-guard/svelte
```

## Usage

```svelte
<script lang="ts">
  import { NawaGuard } from '@nawa-guard/svelte';
  let token = $state('');
</script>

<NawaGuard bind:token siteKey="main" action="login" lang="en" />
<button disabled={!token}>Sign in</button>
```

Then verify on your backend before trusting the request — see the full guide.

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
