# @nawa-guard/vue

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Vue 3 component with v-model.

- 🧩 8 challenge types: slider jigsaw, rotate, pick icons, math image, drag to order, connect the dots, invisible proof-of-work, and an accessible text question
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore` on NuGet)

## Install

```bash
npm i @nawa-guard/vue
# or
yarn add @nawa-guard/vue
# or
pnpm add @nawa-guard/vue
```

## Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { NawaGuard } from '@nawa-guard/vue';
const token = ref('');
</script>

<template>
  <NawaGuard v-model="token" site-key="main" action="login" lang="en" />
  <button :disabled="!token">Sign in</button>
</template>
```

Then verify on your backend before trusting the request — see the full guide.

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
