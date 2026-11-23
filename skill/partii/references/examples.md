# Using the examples library

Repo: https://github.com/PartiiGames/partii-examples · index: `index.json` at the root.

## index.json

```json
{ "id": "03-save-load", "title": "...", "tags": ["save", "load", ...], "when": "one line: when to use it",
  "language": "typescript", "engine": "web", "path": "examples/03-save-load",
  "test": "cd examples/03-save-load && npm install && npm test", "status": "tested" }
```

`status`: `tested` (its test passes against staging), `pending` (test not run yet), `placeholder`
(planned; no folder). `.staging` holds the shared staging game and its publishable key; `.sdk` says
where each SDK comes from.

Search by intent words in `tags` and `when`:

```sh
jq -r '.examples[] | select(((.tags|join(" "))+" "+.when+" "+.title) | test("leader|score|rank";"i")) | .id' index.json
```

## The loop

1. **Pick** the closest example. Read its README (5 lines) and TRAPS.md.
2. **Copy** the folder (or the files you need) into the game.
3. **Run its test unchanged** against staging: `npm install && npm test`. It must pass before you edit.
   A failure here is the platform or your setup, not your code: check `PARTII_API`, the key, network.
4. **Stamp** each copied file: `// copied from PartiiGames/partii-examples@<sha> examples/03-save-load/src/saves.ts`.
5. **Point it at your game:** `.env.staging` (`VITE_PARTII_API`, `VITE_PARTII_KEY`, `VITE_PARTII_GAME`).
   Make the game and key with the CLI (cli.md). Run the test again.
6. **Change it** to fit the game. Keep the test and keep it passing; add your own cases.
7. **Production:** a separate game key in `.env.production`; `npm run build:prod`; `partii web deploy`.

## What each web example contains

```
examples/NN-name/
  README.md  TRAPS.md
  package.json      npm test = get-sdk + vitest against staging (hard 30 s per test)
  get-sdk.mjs       installs Partii's TS SDK into partii-sdk/ (gitignored; never edit, never commit)
  vite.config.ts    @partii/sdk alias, staging/production builds, test caps
  tsconfig.json     useDefineForClassFields: false, @partii/sdk paths
  .env.staging      VITE_PARTII_API / _KEY / _GAME (publishable key only)
  .env.production   empty until you fill it; the prod build refuses a missing key or staging API
  src/partii.ts     client, device id, guest sign-in (same in every example)
  src/<thing>.ts    the pattern
  src/main.ts       a tiny page using it (npm run dev)
  test/*.test.ts    the proof
```

`node get-sdk.mjs --check` exits 1 when Partii published a newer SDK; `--update` installs it; then
run the tests again.

## Running every example

From the repo root: `node tools/run-all.mjs` (or `node tools/run-all.mjs 03 05`). Each step has a hard
cap and a 120 s no-output watchdog; the last line is `SUMMARY n/m passed`. `node tools/check.mjs`
checks the library itself (index rows, shared files identical, no secrets).
