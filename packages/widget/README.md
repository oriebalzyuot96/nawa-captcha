# @nawa-captcha/widget

**Nawa Captcha** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: Framework-agnostic web component.

- 🧩 38 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work, an accessible text question and an audio challenge — [see them live](https://oriebalzyuot96.github.io/nawa-captcha/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly (text question and audio challenge); Arabic and English; RTL
- 🎨 Premium 3D design; six themes (`pelagic`, `midnight`, `aurora`, `sand`, `ocean`, `mono`) in light and dark plus high contrast, all WCAG 2.2 AA; picks up Pelagic UI `--pl-*` tokens (legacy `--nw-*` too)
- 🔊 Optional synthesized sound effects (off by default, never before a gesture, volume, app-level mute)
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaCaptcha.AspNetCore`, coming to NuGet)

## Install

> **Coming to npm.** `@nawa-captcha/widget` is published once the `@nawa-captcha` npm organisation exists. Until then, build it from the [repository](https://github.com/oriebalzyuot96/nawa-captcha) (`npm install && npm run build`, then `npm pack -w @nawa-captcha/widget`).

```bash
npm i @nawa-captcha/widget
# or
yarn add @nawa-captcha/widget
# or
pnpm add @nawa-captcha/widget
```

## Usage

```html
<script type="module">import '@nawa-captcha/widget';</script>

<form method="post" action="/login">
  <nawa-captcha site-key="main" endpoint="/captcha" action="login" lang="en"></nawa-captcha>
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
| `name` | Hidden input name (default `nawa-captcha-token`) |
| `theme` | `auto` (default: page Pelagic UI tokens, else Pelagic), `pelagic`, `midnight`, `aurora`, `sand`, `ocean`, `mono`; shorthands `light`, `dark`, `high-contrast` |
| `appearance` | `auto` (follows `prefers-color-scheme` / `prefers-contrast`), `light`, `dark`, `high-contrast` |
| `sound` | Sound effects on by default (the visitor's speaker toggle, remembered per site, still wins). Off when absent. |
| `volume` | Sound volume `0`–`1` (default `0.6`) |
| `muted` | Silence this widget (your app's mute). `setNawaCaptchaMuted(true)` mutes all widgets. |
| `tilt` | `off` disables the pointer tilt (already off for touch, reduced motion and high contrast) |

## Theming

```html
<nawa-captcha theme="aurora" appearance="dark" …></nawa-captcha>
<nawa-captcha style="--nawa-captcha-primary:#0a7cff" …></nawa-captcha>
```

Each colour resolves `--nawa-captcha-<name>` → explicit preset / high contrast → Pelagic UI `--pl-<name>` → legacy `--nw-<name>` → built-in Pelagic palette. Names: `primary`, `primary-hover`, `primary-soft`, `on-primary`, `accent`, `surface`, `surface-alt`, `text`, `text-muted`, `border`, `control-border`, `focus`, `success`, `success-soft`, `danger`, `danger-soft` (plus `radius`, `radius-sm`, `font`). `checkContrast()`, `contrastRatio()`, `PALETTES` and `CONTRAST_PAIRS` are exported if you want to check your own overrides.

## Sound and the audio challenge

UI cues (grab, snap, select, step, verified, wrong) are synthesized with Web Audio: no files, off by default, no `AudioContext` before a trusted gesture inside the widget, every change also announced in the live region. The accessibility button offers a **text question** and an **audio challenge** (server-synthesized WAV of spoken digits or beeps to count; Play button, three plays, no transcript).

Multi-step policies (`steps: 2`) are handled for you: the widget shows "Step 1 of 2", loads the next puzzle and fires `nawa-captcha:verified` after the last one. Every puzzle works with mouse, touch and keyboard, and the accessible text alternative is one click away.

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-captcha#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-captcha/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-captcha

MIT © oriebalzyuot96
