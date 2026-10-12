# NawaGuard.AspNetCore

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: ASP.NET Core verification of pass tokens — `services.AddNawaGuard()`, `[RequireNawaGuard]` and `.RequireNawaGuard()` for minimal APIs.

- 🧩 37 challenge types you choose from (one, two or many, per action): slider jigsaws, rotate, drag to the shadow, jigsaw, hold, icon/colour/clock/symmetry grids, match pairs, tap in order, spell, order and story tiles, connect the dots, maze, math, dice, invisible proof-of-work and an accessible text question — [see them live](https://oriebalzyuot96.github.io/nawa-guard/#playground)
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore`, coming to NuGet)

## Install

> **Coming to NuGet.** Until `NawaGuard.AspNetCore` is published, reference the project from the [repository](https://github.com/oriebalzyuot96/nawa-guard) (`dotnet add reference dotnet/src/NawaGuard.AspNetCore`) or `dotnet pack` it.

```bash
dotnet add package NawaGuard.AspNetCore
```

## Usage

```csharp
// Program.cs
builder.Services.AddNawaGuard(builder.Configuration.GetSection("NawaGuard"));
// configuration: NawaGuard__Secret=<same secret as the Node server>, NawaGuard__ExpectedSiteKey=main

var app = builder.Build();
app.UseForwardedHeaders(); // if behind a proxy

// Minimal API
app.MapPost("/api/contact", (ContactDto dto) => Results.Ok()).RequireNawaGuard("contact");

// Controllers
[HttpPost("login"), RequireNawaGuard("login")]
public IActionResult Login(LoginDto dto) => Ok();
```

## Choosing which puzzles a route accepts

```csharp
// appsettings.json
// "NawaGuard": { "AllowedTypes": ["slider", "maze", "pairs"], "ActionAllowedTypes": { "login": ["pow", "slider"] }, "MinSteps": 1 }

app.MapPost("/pay", Pay).RequireNawaGuard("checkout", new NawaGuardRequirements(AllowedTypes: ["slider", "maze"], MinSteps: 2));

[HttpPost("signup"), RequireNawaGuard("signup", AllowedTypes = new[] { "maze", "pairs" }, MinSteps = 2)]
public IActionResult Signup(SignupDto dto) => Ok();
```

A multi-step token (the Node server's `steps` option) passes `AllowedTypes` when at least one solved step is allowed; `MinSteps` counts the solved steps (`too-few-steps` otherwise). `NawaGuardChallengeTypes.All` lists every type (unknown names fail at startup) and `NawaGuardChallengeTypes.LowAssurance` the ones you may want to exclude on sensitive routes. `result.Claims.SolvedTypes` gives the solved types.

Then verify on your backend before trusting the request — see the [full guide](https://github.com/oriebalzyuot96/nawa-guard#readme).

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
