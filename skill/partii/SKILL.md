---
name: partii
description: Build, test and ship games on Partii (partii.games), the platform for players, saves, purchases with Pops, leaderboards, analytics, rooms and phone controllers. Use when a game talks to Partii, when the user mentions Partii, the partii CLI, Pops, a publishable key (pk_...), partii.games, a Partii room or jam, or Lindii; when adding sign-in, cloud saves, a leaderboard, an unlock/shop, analytics or error reports to a web, Godot or Rust game on Partii; or when filing a Partii bug, feature request or example request.
---

# Building on Partii

Partii gives a game: guest players that upgrade to accounts, cloud saves, items bought with Pops,
leaderboards, analytics and error reports, rooms with codes, phone controllers, hosting at
`<game>.partii.games`, and a store page. Everything is driven by the `partii` CLI (one JSON document
per command) and Partii's SDKs. Lindii, Partii's in-app builder, uses this same skill.

## Golden rules

1. **Start from a working example, with its test.** Search the examples library (below), copy the
   example, run its test against **staging**, then change it. The passing test is how you know you
   copied it right. Re-run it after every change that touches Partii.
2. **Import anything that talks to Partii; copy only game code.** Auth, saves, buying, leaderboards,
   rooms and analytics transport come from Partii's SDK (web: installed by `get-sdk.mjs`; Godot: the
   partii-godot add-on; Rust: `partii-account` from PartiiGames/partii-sdk). Copies of Partii's client
   drift silently when Partii changes.
3. **Stamp every file you copy:** first line `// copied from PartiiGames/partii-examples@<sha> <path>`
   (`#` for GDScript). Get the sha with `git ls-remote https://github.com/PartiiGames/partii-examples main`
   or the commit you cloned.
4. **Staging first, always.** `PARTII_API=https://api-staging.partii.games`. Tests never touch
   production. Production gets a separate game key in a separate build.
5. **Only publishable keys (`pk_...`) go in a game.** Never a developer token (`dt_...`), a player
   token (`pt_...`) or any secret in code, commits, logs or chat.
6. **A game never spends a player's Pops itself.** Use the SDK's `buy()`; the player confirms on
   Partii's sheet. A direct call to the item buy endpoint is refused (`403 confirm_on_partii`) and
   raises an incident; buying for a player without permission gets a game removed.
7. **Read the example's TRAPS.md before you write code.** The worst bugs on Partii are silent:
   dropped analytics events, wiped class fields, lost guest progress.
8. **Nothing sexual or suggestive, ever,** in a game, its art, text or store page. Partii is for all ages.

## The examples library

Repo: https://github.com/PartiiGames/partii-examples (MIT). `index.json` lists every example:
`id, title, tags, when, language, engine, path, test, status`.

```sh
# Find one (no clone needed):
curl -fsSL https://raw.githubusercontent.com/PartiiGames/partii-examples/main/index.json \
  | jq -r '.examples[] | select((.tags|join(" ")) + " " + .when | test("save|load"; "i")) | "\(.id)\t\(.when)"'
# Get it and prove it works before touching it:
git clone --depth 1 https://github.com/PartiiGames/partii-examples /tmp/partii-examples
cp -r /tmp/partii-examples/examples/03-save-load ./partii-saves && cd partii-saves
npm install && npm test        # must pass against staging before you change anything
```


| Need | Example |
|---|---|
| A new web game (Vite + TS), guest, analytics, errors, builds | `01-starter-shell` |
| Guest → email account, sign out | `02-sign-in` |
| Cloud saves with conflict merge | `03-save-load` |
| Score board, rank, top 10 | `04-leaderboard` |
| Unlock an item with Pops | `05-buy-unlock` |
| Events, sessions, drop rules | `06-analytics` |
| Godot 4 web export | `13-godot-addon` (source: PartiiGames/partii-godot) |

Nothing fits? Ask for it (Feedback, below), then build from the closest one and Partii's docs.
More detail: [references/examples.md](references/examples.md).

## The CLI

```sh
curl -fsSL https://partii.games/install.sh | sh      # Windows: irm https://partii.games/install.ps1 | iex
export PARTII_API=https://api-staging.partii.games   # staging
partii login --email you@example.com                 # staging answers with the code itself
partii login --email you@example.com --code 123456
partii projects put mystudio --name "My Studio"
partii keys create mystudio --key-id web             # → pk_mystudio_web_...
partii games put my-game --project mystudio --title "My Game" --platforms '["web"]'
partii web deploy mygame ./dist                     # → https://mygame-staging.partii.games
partii help --json                                   # every command, argument and example
```

**An agent works on its own account:** `partii login` with the agent's own email, then an owner or
admin runs `partii members invite <project> --email <agent email> --role builder` (admin to make keys
and publish) and the agent runs `partii members invites` and `partii members accept <invite>`.
`partii roles list <project>` says what each role can do. A new site goes live once Partii's review
approves it; the deploy's `preview_url` works at once. Never pass tokens or keys between agents.

Every command prints one JSON document; exit 0 ok, 1 Partii said no (`error.hint` says what to do),
2 bad command line. Mutations are safe to repeat; add `--dry-run` to preview. Full tour:
[references/cli.md](references/cli.md).

## The SDKs

| Engine | Get it | Notes |
|---|---|---|
| Web (TS/JS) | each example's `get-sdk.mjs` installs `client.ts`, `generated.ts`, `buy.ts` from `https://partii.games/docs/sdk-ts/` | `createClient({base, key})`, one typed method per API operation; import as `@partii/sdk`. A site game picks its API and key from its address with `siteConfig` (`site.ts`); rooms hold events until your handlers are set with `roomEvents` (`room-events.ts`) |
| Godot 4 | https://github.com/PartiiGames/partii-godot (Asset Library: "Partii") | `Partii.configure`, `sign_in`, `save_slot`, `buy`, `submit_score`, `track` |
| Rust / Bevy | `partii-account = { git = "https://github.com/PartiiGames/partii-sdk" }` | guest, saves, `owns`, `buy`, `track`, panic hook |

The API itself (every operation, auth, fields): https://partii.games/docs/API.md and the developer
guide https://partii.games/docs/GUIDE.md. Details: [references/sdk.md](references/sdk.md).

## Testing

- Headless only, against staging, with a hard timeout on every test and a progress signal.
- Web examples: `npm test` (Vitest, Node). Shared staging test game: `partii-examples`, key in
  `index.json` `.staging.key`. For your own game make a staging game and key (CLI above).
- Player tokens for tests: `partii test players create` (developer token needed), or a guest via
  `playersGuest` with a random device id.
- Staging email codes come back in the reply; production emails them. Codes are limited to 3 per
  address per 15 min and 10 per network per hour: don't loop sign-ins.
- Godot: export headless, then the add-on's Playwright tests (`tests/web/*.mjs`).

## Known traps (short list; all of them in [references/traps.md](references/traps.md))

- Analytics events that break a rule are **dropped with no error**: the reply only says `dropped: N`.
  Names `^[a-z][a-z0-9_.]{0,47}$`, prop keys `^[A-Za-z0-9_]{1,40}$`, flat values (no null, arrays,
  objects, NaN), strings ≤ 200, props ≤ 1 KB. One bad prop drops the whole event.
  Rules: [references/drop-rules.md](references/drop-rules.md).
- `useDefineForClassFields: true` (TS default for ES2022+) wipes `body!: Arcade.Body`-style fields:
  Phaser physics vanishes. Keep it `false`.
- Sign in **with the guest's token** or the guest's progress stays behind; keep the new token every time.
- Don't forget the player token on a network error; only on 401/403.
- Saves: no save is a 404 (not an error); always send `base_rev`; on 409 merge theirs, never re-send yours.
- Leaderboards: submit once per run; set `--higher-is-better false` before anyone submits times.
- Never buy for the player; unlock only what `playersItems` lists.
- A staging key in a production build (or the reverse) "works" against the wrong world. On a site,
  let `siteConfig` pick the key from the address (live, `-staging`, `<deploy>--` previews).
- Rooms: a `member_joined` heard before your handlers are set is lost, and the engine drops a
  joiner's first packets if they beat its `member_joined`. Feed `poll()` into `roomEvents()` from
  the start, and have joiners repeat hello until the host answers.

## Assets

Partii's Asset Library: thousands of free CC0 models, textures, HDRIs, sounds and OFL fonts:
`partii assets search --q "pirate ship" --kind model --limit 10`, `partii assets get <id>`,
`partii assets credits`. Rooms (jams) load them with `loadAsset("<id>")` and lock them with
`partii assets add <id>` / `partii assets check`. Never ship art, music or maps taken from another game.

## Feedback: bugs, features, new examples

Something broke, is missing, or no example fits: file it. Agents are expected to.

- `gh` signed in (`gh auth status`): `gh issue create -R PartiiGames/partii-examples --label <bug|enhancement|example-request> --title "..." --body-file issue.md`,
  with the body laid out like the matching form in `.github/ISSUE_TEMPLATE/`.
- No `gh`: `partii feedback send --kind bug|feature --title "..." --details "..." --source agent`
  (as a signed-in player: `partii player login --provider email --email ... --code ... --save`).

Include: what you did (commands), what you expected, what happened (the JSON error with `code` and
`hint`), the example id and its `copied from` sha, staging or production. Never include tokens.
Details and templates: [references/feedback.md](references/feedback.md).
