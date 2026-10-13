# nawa-captcha

**Self-hosted, accessible puzzle CAPTCHA in one package.** 38 challenge types, an audio challenge, sound, 3D themes, Arabic and English with RTL — and your own server issues and verifies every challenge. An open-source alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking.

🌐 Live playground: https://oriebalzyuot96.github.io/nawa-captcha/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-captcha

```bash
npm i nawa-captcha
# or
yarn add nawa-captcha
# or
pnpm add nawa-captcha
```

Everything is inside: the server, the `<nawa-captcha>` web component, and React, Vue, Svelte and Angular components. Framework packages (react, vue, svelte, @angular/*) are optional peers — you only need the one you use.

## 1. Server (Node.js / Express)

```js
import express from 'express';
import { createNawaCaptcha } from 'nawa-captcha';
import { nawaCaptchaExpress, requireCaptcha } from 'nawa-captcha/express';

const captcha = createNawaCaptcha({
  secret: process.env.NAWA_CAPTCHA_SECRET, // ≥ 32 chars, never sent to browsers
  siteKeys: ['main'],
  actions: ['login'],
  types: ['slider', 'rotate', 'pairs'], // pick one, two or many puzzle types
});

const app = express();
app.use('/captcha', express.json({ limit: '32kb' }), nawaCaptchaExpress(captcha));
app.post('/login', express.urlencoded({ extended: false }),
  requireCaptcha(captcha, { expectedAction: 'login', maxAgeSec: 300 }),
  (req, res) => res.send('ok'));
```

## 2. Browser — any framework or plain HTML

```html
<script type="module">import 'nawa-captcha/widget';</script>
<form method="post" action="/login">
  <nawa-captcha site-key="main" endpoint="/captcha" action="login" lang="en" sound></nawa-captcha>
  <button>Sign in</button>
</form>
```

### React
```tsx
import { NawaCaptcha, useNawaCaptcha } from 'nawa-captcha/react';

const captcha = useNawaCaptcha();
<NawaCaptcha siteKey="main" action="login" {...captcha.bind} />
```

### Vue
```vue
<script setup>
import { ref } from 'vue';
import { NawaCaptcha } from 'nawa-captcha/vue';
const token = ref('');
</script>
<template><NawaCaptcha v-model="token" site-key="main" action="login" /></template>
```

### Svelte 5
```svelte
<script>
  import { NawaCaptcha } from 'nawa-captcha/svelte';
  let token = $state('');
</script>
<NawaCaptcha bind:token siteKey="main" action="login" />
```

### Angular
```ts
import { NawaCaptchaComponent } from 'nawa-captcha/angular';
// <nawa-captcha formControlName="captcha" siteKey="main" action="login"></nawa-captcha>
```

ASP.NET Core verification: `dotnet add package NawaCaptcha.AspNetCore` (see the main README).

## Why Nawa Captcha
- 🔒 Answers are sealed on the server (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use.
- ♿ Mouse, touch and full keyboard for every puzzle, plus text and audio alternatives (WCAG 2.2 AA).
- 🎨 Themes (Pelagic, Midnight, Aurora, Sand, Ocean, Mono) in light, dark and high contrast; follows Pelagic UI tokens automatically.
- 🔊 Optional synthesized sound, off by default.
- 🌍 Arabic and English, full RTL.

MIT © oriebalzyuot96
