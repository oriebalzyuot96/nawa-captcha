# Contributing to Nawa Captcha

Thanks for helping! Bug reports, new puzzle types, translations and framework wrappers are all welcome.

## Setup

```bash
npm install
npm run typecheck
npm test
npm run demo          # http://localhost:5180
dotnet test dotnet/NawaCaptcha.sln   # .NET verifier (needs the .NET 8 SDK)
```

## Guidelines

- Never send a solution, or anything a script could derive it from, to the browser.
- Every puzzle must work with mouse, touch and keyboard, and have an accessible alternative.
- Keep the server free of runtime dependencies. Only `src/primitives.ts` may touch Node built-ins (`node:crypto`, `node:zlib`); `src/primitives.browser.ts` mirrors it for the site's demo mode.
- If you change the pass-token format, update the .NET verifier and regenerate the fixture with `npm run fixture:dotnet`.
- Add tests for every behaviour change. Security issues: see SECURITY.md, not a public issue.

## Adding a puzzle type

1. Create `packages/server/src/puzzles/<type>.ts` exporting a `PuzzleDefinition`: draw with the rasterizer (`render/`), use only the `rng` you are given (so tests can seed it), seal the answer in `solution`, and reuse a widget view (`slide`, `drag`, `rotate`, `swap`, `hold`, `grid`, `pairs`, `taps`, `order`, `path`, `text`) where you can.
2. Register it in `CHALLENGE_TYPES` (`types.ts`), `puzzles/index.ts`, `catalog.ts` (names and blind-guess rate) and `i18n.ts` (prompts in Arabic and English).
3. Add it to `NawaCaptchaChallengeTypes.All` in the .NET package and run `npm run fixture:dotnet` (a test compares the lists).
4. Add correct/incorrect answers to `packages/server/test/answers.ts`; the generic tests then cover determinism, payload leaks, keyboard solvability and wrong answers. Run `npm run build:site` to refresh the site tables.

## Translations

Strings live in `packages/widget/src/strings.ts` and the accessible question bank in `packages/server/src/puzzles/accessible.ts`. Arabic and English ship today; more languages are very welcome.
