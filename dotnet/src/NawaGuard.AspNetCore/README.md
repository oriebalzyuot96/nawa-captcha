# NawaGuard.AspNetCore

**Nawa Guard** — a self-hosted, privacy-friendly and accessible puzzle CAPTCHA. A drop-in alternative to reCAPTCHA, hCaptcha and Turnstile with no third-party tracking: your server issues the challenge and verifies the answer.

This package: ASP.NET Core verification of pass tokens — `services.AddNawaGuard()`, `[RequireNawaGuard]` and `.RequireNawaGuard()` for minimal APIs.

- 🧩 8 challenge types: slider jigsaw, rotate, pick icons, math image, drag to order, connect the dots, invisible proof-of-work, and an accessible text question
- 🔒 Answers are sealed (AES-256-GCM) and never reach the browser; pass tokens are signed and single-use
- ♿ Keyboard, touch and screen-reader friendly; Arabic and English; RTL; themes
- 🖥️ Backends: Node.js / Express and ASP.NET Core (`NawaGuard.AspNetCore` on NuGet)

## Install

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

Then verify on your backend before trusting the request — see the full guide.

📖 Docs: https://oriebalzyuot96.github.io/nawa-guard/ · 💻 Source: https://github.com/oriebalzyuot96/nawa-guard

MIT © oriebalzyuot96
