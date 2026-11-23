# 01 · Starter shell

A Vite + TypeScript web game wired to Partii: a canvas loop, this device's guest player, analytics
(batched every 30 s and on page hide, with `session_end`), script errors reported as they happen,
staging and production builds, and a tsconfig that keeps Phaser-style class fields alive.
Start here for any new web game, then add 02–06 as you need them.

## Run it

```sh
npm install
npm test            # against Partii staging, headless, ~10 s
npm run dev         # the page, on staging
npm run build       # staging build → dist/
npm run build:prod  # production build → dist-prod/ (set .env.production first)
```

`npm test` proves: a guest signs in and stays the same player (saved token, and token lost);
the analytics session is accepted with 0 dropped; an error report comes back grouped; and the
tsconfig keeps `useDefineForClassFields: false` (it compiles a class both ways to show why).

## Files

| File | What |
|---|---|
| `src/partii.ts` | The client, device id, guest sign-in. The same file is in every example. |
| `src/analytics.ts` | Events and sessions (the full story is example 06). |
| `src/errors.ts` | `error` and `unhandledrejection` → Partii, de-duplicated and rate-capped. |
| `src/main.ts` | The game loop: replace `drawFrame` with your game. |
| `.env.staging`, `.env.production` | API, publishable key, game id per build. |
| `get-sdk.mjs` | Installs Partii's TS SDK into `partii-sdk/` (imported as `@partii/sdk`, never edited). |

## Make it yours

1. `partii projects put <studio>`, `partii keys create <studio> --key-id web`, `partii games put <game> --project <studio> --platforms '["web"]'`
   (once against staging with `PARTII_API=https://api-staging.partii.games`, once against production).
2. Put each game id and `pk_...` key in `.env.staging` / `.env.production`.
3. `npm run build:prod && partii web deploy <game> dist-prod`.

Copying files into your game: stamp each one `// copied from PartiiGames/partii-examples@<sha> <path>`.
Read [TRAPS.md](TRAPS.md) first.
