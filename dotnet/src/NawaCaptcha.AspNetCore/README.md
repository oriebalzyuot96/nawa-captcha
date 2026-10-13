# NawaCaptcha.AspNetCore

**Nawa Captcha** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: ASP.NET Core verification of pass tokens — `services.AddNawaCaptcha()`, `[RequireNawaCaptcha]` and `.RequireNawaCaptcha()` for minimal APIs.

- 🧩 38 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work, an accessible text question and an audio challenge — [see them live](https://oriebalzyuot96.github.io/nawa-captcha/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaCaptcha.AspNetCore`, coming to NuGet)

> **Renamed from `NawaGuard.AspNetCore`.** Change the package reference and `using NawaCaptcha.AspNetCore;`. `INawaGuardVerifier`, `AddNawaGuard`, `[RequireNawaGuard]` and `.RequireNawaGuard()` still compile (marked `[Obsolete]`), the `X-Nawa-Guard-Token` header and `nawa-guard-token` field are still accepted (`AcceptLegacyNames`, default true), and `AddNawaCaptcha(builder.Configuration)` reads the `"NawaCaptcha"` section or falls back to `"NawaGuard"`. The token format is unchanged.

## Install

> **Coming to NuGet.** Until `NawaCaptcha.AspNetCore` is published, reference the project from the [repository](https://github.com/oriebalzyuot96/nawa-captcha) (`dotnet add reference dotnet/src/NawaCaptcha.AspNetCore`) or `dotnet pack` it.

```bash
dotnet add package NawaCaptcha.AspNetCore
```

## Usage

```csharp
// Program.cs
builder.Services.AddNawaCaptcha(builder.Configuration.GetSection("NawaCaptcha"));
// configuration: NawaCaptcha__Secret=<same secret as the Node server>, NawaCaptcha__ExpectedSiteKey=main

var app = builder.Build();
app.UseForwardedHeaders(); // if behind a proxy

// Minimal API
app.MapPost("/api/contact", (ContactDto dto) => Results.Ok()).RequireNawaCaptcha("contact");

// Controllers
[HttpPost("login"), RequireNawaCaptcha("login")]
public IActionResult Login(LoginDto dto) => Ok();
```

## Choosing which puzzles a route accepts

```csharp
// appsettings.json
// "NawaCaptcha": { "AllowedTypes": ["slider", "maze", "pairs"], "ActionAllowedTypes": { "login": ["pow", "slider"] }, "MinSteps": 1 }

app.MapPost("/pay", Pay).RequireNawaCaptcha("checkout", new NawaCaptchaRequirements(AllowedTypes: ["slider", "maze"], MinSteps: 2));

[HttpPost("signup"), RequireNawaCaptcha("signup", AllowedTypes = new[] { "maze", "pairs" }, MinSteps = 2)]
public IActionResult Signup(SignupDto dto) => Ok();
```

A multi-step token (the Node server's `steps` option) passes `AllowedTypes` when at least one solved step is allowed; `MinSteps` counts the solved steps (`too-few-steps` otherwise). `NawaCaptchaChallengeTypes.All` lists every type (unknown names fail at startup) and `NawaCaptchaChallengeTypes.LowAssurance` the ones you may want to exclude on sensitive routes. `result.Claims.SolvedTypes` gives the solved types.

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-captcha#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-captcha/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-captcha

MIT © oriebalzyuot96
