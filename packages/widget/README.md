# @nawa-guard/widget

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Framework-agnostic web component.

- 🧩 37 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work and an accessible text question — [see them live](https://oriebalzyuot96.github.io/nawa-guard/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore`, coming to NuGet)

## Install

> **Coming to npm.** `@nawa-guard/widget` is published once the `@nawa-guard` npm organisation exists. Until then, build it from the [repository](https://github.com/oriebalzyuot96/nawa-guard) (`npm install && npm run build`, then `npm pack -w @nawa-guard/widget`).

```bash
npm i @nawa-guard/widget
# or
yarn add @nawa-guard/widget
# or
pnpm add @nawa-guard/widget
```

## Usage

```html
<script type="module">import '@nawa-guard/widget';</script>

<form method="post" action="/login">
  <nawa-guard site-key="main" endpoint="/captcha" action="login" lang="en"></nawa-guard>
  <button>Sign in</button>
</form>
```

## Attributes

| Attribute | Meaning |
|---|---|
| `site-key`, `endpoint`, `action` | Public site key, base URL of the two endpoints (default `/captcha`), action name |
| `lang` | `ar` or `en` (Arabic switches to RTL) |
| `types` | Comma-separated list that **narrows** the server's allowed puzzle types, e.g. `slider,rotate-object`. It never widens them. |
| `type` | One exact type (only if the server sets `allowClientType`, except `accessible`) |
| `name` | Hidden input name (default `nawa-guard-token`) |

Multi-step policies (`steps: 2`) are handled for you: the widget shows "Step 1 of 2", loads the next puzzle and fires `nawa-guard:verified` after the last one. Every puzzle works with mouse, touch and keyboard, and the accessible text alternative is one click away.

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-guard#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
