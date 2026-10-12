# Contributing to Nawa Guard

Thanks for helping! Bug reports, new puzzle types, translations and framework wrappers are all welcome.

## Setup

```bash
npm install
npm run typecheck
npm test
npm run demo          # http://localhost:5180
dotnet test dotnet/NawaGuard.sln   # .NET verifier (needs the .NET 8 SDK)
```

## Guidelines

- Never send a solution, or anything a script could derive it from, to the browser.
- Every puzzle must work with mouse, touch and keyboard, and have an accessible alternative.
- Keep the server free of runtime dependencies (`node:crypto` and `node:zlib` only).
- If you change the pass-token format, update the .NET verifier and regenerate the fixture with `npm run fixture:dotnet`.
- Add tests for every behaviour change. Security issues: see SECURITY.md, not a public issue.

## Translations

Strings live in `packages/widget/src/strings.ts` and the accessible question bank in `packages/server/src/puzzles/accessible.ts`. Arabic and English ship today; more languages are very welcome.
