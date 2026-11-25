# Partii examples

Short, working examples for building games on [Partii](https://partii.games), one hard thing each.
Every example comes with **a test that proves it works** against Partii's staging platform (run it
after you copy the example: if it passes, you copied it right), a 5-line README, and a **TRAPS.md**
of the things that failed silently for someone before you.

Made for coding agents first, people too. MIT licensed.

## Find one

`index.json` lists them all (`id, title, tags, when, language, engine, path, test, status`).

| Example | When |
|---|---|
| [01-starter-shell](examples/01-starter-shell) | Any new web game: Vite + TS, guest player, analytics, error reports, staging/production builds |
| [02-sign-in](examples/02-sign-in) | A guest keeps their progress with an email account; sign out |
| [03-save-load](examples/03-save-load) | Progress across devices, with conflict merge |
| [04-leaderboard](examples/04-leaderboard) | Score/time boards: once per run, rank, top 10 |
| [05-buy-unlock](examples/05-buy-unlock) | Sell an item for Pops and unlock it |
| [06-analytics](examples/06-analytics) | Events and sessions, and the rules that silently drop events |
| [13-godot-addon](examples/13-godot-addon) | A Godot 4 web game on Partii (source: [partii-godot](https://github.com/PartiiGames/partii-godot)) |
| [14-motionii](examples/14-motionii) | A character moved live by a motion model (NVIDIA MotionBricks on WebGPU), with a replan on every command |
| [15-hlab](examples/15-hlab) | A generated human on three.js walking and running with WASD (hlab) |

## Use one

```sh
cd examples/03-save-load
npm install
npm test          # Node 22+, headless, against https://api-staging.partii.games
npm run dev       # the example's page
```

Then copy what you need into your game and stamp each copied file:
`// copied from PartiiGames/partii-examples@<sha> examples/03-save-load/src/saves.ts`.

**Copy game code; import Partii.** Anything that talks to Partii comes from Partii's SDK, never a
copy: each web example's `get-sdk.mjs` installs Partii's TypeScript SDK from
`https://partii.games/docs/sdk-ts/` into `partii-sdk/` (gitignored), imported as `@partii/sdk`.
`node get-sdk.mjs --check` tells you when Partii changed it.

The tests use the shared staging game `partii-examples` and its publishable key (in `.env.staging`
and `index.json`; publishable keys are public by design). Use your own game's key for your game.

Run everything: `node tools/run-all.mjs` (hard caps, a watchdog, `SUMMARY n/m passed`).
Check the library itself: `node tools/check.mjs`.

## The Partii skill (for AI agents)

`skill/partii/` is one skill any agent can install: how to build on Partii, the CLI, the SDKs, the
rules, the known traps, this library, the free CC0 asset library, and how to file feedback. Partii's
in-app builder, Lindii, uses the same skill. To install it, paste [INSTALL-PROMPT.md](INSTALL-PROMPT.md)
into Claude Code, Codex, Gemini CLI or any other agent.

## Feedback

A bug, a missing feature, or an example you needed and didn't find:
[open an issue](../../issues/new/choose) (Bug, Feature request, New example). Agents: `gh issue create`
with the form's headings, or `partii feedback send` without GitHub; see
`skill/partii/references/feedback.md`.

## Docs

Partii's developer guide: https://partii.games/docs/GUIDE.md · API reference:
https://partii.games/docs/API.md · CLI: `partii help --json`.
