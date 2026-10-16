# @nawa-captcha/svelte

**Nawa Captcha** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Svelte 5 component.

- 🧩 38 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work, an accessible text question and an audio challenge — [see them live](https://oriebalzyuot96.github.io/nawa-captcha/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly (text question and audio challenge); Arabic and English; RTL
- 🎨 Premium 3D design, six themes in light and dark plus high contrast (WCAG 2.2 AA), Pelagic UI tokens, optional sound effects
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaCaptcha.AspNetCore`, coming to NuGet)

## Install

> **On npm:** `npm i @nawa-captcha/svelte`, or `npm i nawa-captcha` for everything in one package.

```bash
npm i @nawa-captcha/svelte
# or
yarn add @nawa-captcha/svelte
# or
pnpm add @nawa-captcha/svelte
```

## Usage

```svelte
<script lang="ts">
  import { NawaCaptcha } from '@nawa-captcha/svelte';
  let token = $state('');
</script>

<NawaCaptcha bind:token siteKey="main" action="login" lang="en" />
<button disabled={!token}>Sign in</button>
```

`types` narrows the server's allowed puzzles: `<NawaCaptcha bind:token action="login" types={['slider', 'pairs']} />` (never widens them).

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-captcha#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-captcha/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-captcha

MIT © oriebalzyuot96
