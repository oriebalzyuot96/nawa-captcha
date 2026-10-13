# @nawa-captcha/vue

**Nawa Captcha** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Vue 3 component with v-model.

- 🧩 38 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work, an accessible text question and an audio challenge — [see them live](https://oriebalzyuot96.github.io/nawa-captcha/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly (text question and audio challenge); Arabic and English; RTL
- 🎨 Premium 3D design, six themes in light and dark plus high contrast (WCAG 2.2 AA), Orca UI tokens, optional sound effects
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaCaptcha.AspNetCore`, coming to NuGet)

## Install

> **Coming to npm.** `@nawa-captcha/vue` is published once the `@nawa-captcha` npm organisation exists. Until then, build it from the [repository](https://github.com/oriebalzyuot96/nawa-captcha) (`npm install && npm run build`, then `npm pack -w @nawa-captcha/vue`).

```bash
npm i @nawa-captcha/vue
# or
yarn add @nawa-captcha/vue
# or
pnpm add @nawa-captcha/vue
```

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { NawaCaptcha } from '@nawa-captcha/vue';
const token = ref('');
</script>

<template>
  <NawaCaptcha v-model="token" site-key="main" action="login" lang="en" />
  <button :disabled="!token">Sign in</button>
</template>
```

`types` narrows the server's allowed puzzles: `<NawaCaptcha v-model="token" action="login" :types="['slider', 'pairs']" />` (never widens them).

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-captcha#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-captcha/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-captcha

MIT © oriebalzyuot96
