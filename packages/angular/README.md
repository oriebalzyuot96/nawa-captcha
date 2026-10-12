# @nawa-guard/angular

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Angular standalone component (reactive forms).

- 🧩 8 challenge types: slider jigsaw, rotate, pick icons, math image, drag to order, connect the dots, invisible proof-of-work, and an accessible text question
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore` on NuGet)

## Install

```bash
npm i @nawa-guard/angular
# or
yarn add @nawa-guard/angular
# or
pnpm add @nawa-guard/angular
```

## Usage

```ts
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NawaGuardComponent } from '@nawa-guard/angular';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, NawaGuardComponent],
  template: `
    <form [formGroup]="form">
      <input formControlName="email" type="email" />
      <nawa-guard-captcha formControlName="captcha" siteKey="main" action="login" lang="en" />
      <button [disabled]="form.invalid">Sign in</button>
    </form>`,
})
export class LoginComponent {
  form = inject(FormBuilder).group({ email: ['', Validators.required], captcha: ['', Validators.required] });
}
```

Then verify on your backend before trusting the request — see the full guide.

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
