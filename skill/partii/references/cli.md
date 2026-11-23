# The partii CLI

Made for agents: every capability, non-interactive, one JSON document per command.
`partii help --json` lists every command with its arguments; `partii <group> <command> --help` for one.

## Install, sign in, pick a world

```sh
curl -fsSL https://partii.games/install.sh | sh          # macOS, Linux
irm https://partii.games/install.ps1 | iex               # Windows (PowerShell)
partii --version

export PARTII_API=https://api-staging.partii.games       # staging (no mail: login answers with the code)
partii login --email you@example.com
partii login --email you@example.com --code 123456      # saves API + token to ~/.config/partii/cli.json
partii whoami                                           # who, trusted?, limits
```

| Variable | What |
|---|---|
| `PARTII_API` | `https://api.partii.games` (production, default) or `https://api-staging.partii.games` |
| `PARTII_TOKEN` | developer token (CI). Never in a game, a commit or a log |
| `PARTII_KEY` | a publishable key `pk_...` (games ship it) |
| `PARTII_PLAYER_TOKEN` | a player's token, for player commands in tests |

Local everything: `partii dev up` then `PARTII_API=http://127.0.0.1:8787` (fake store and logins).

## Project, key, game

```sh
partii projects put mystudio --name "My Studio"          # ids: lowercase letters and digits
partii keys create mystudio --key-id web                 # key.key = pk_mystudio_web_...
partii games put my-game --project mystudio --title "My Game" --platforms '["web"]'
partii games publish my-game                             # new developers: review first (games get my-game → review)
```

Game ids: 1–40 of lowercase letters, digits, dashes. Every `put`/`create` is safe to repeat; add
`--dry-run` to see a change first. Do it once on staging and once on production (separate keys).

## Host a web game

```sh
partii web deploy my-game ./dist          # https://my-game.partii.games (staging: my-game-staging.partii.games)
partii web deploy my-game ./dist --spa    # client-side routes
partii web deploy my-game ./dist --isolated   # threaded wasm (COOP/COEP)
partii web list my-game ; partii web activate my-game <deploy> ; partii web take-down my-game
```

`index.html` at the top; dotfiles skipped; HTML revalidated each load, other files cached ~1 minute.

## Players, saves, scores, items (for tests and support)

```sh
partii player guest --device-id test-device-0001                       # a guest and its token
partii player email-start --email a@example.com                        # staging returns the code
partii player login --provider email --email a@example.com --code 123456 --save
partii saves get my-game progress ; partii saves history my-game progress
partii leaderboards get my-game score --period daily --limit 10
partii leaderboards config my-game laptime --higher-is-better false    # before anyone submits
partii leaderboards remove my-game score <player>                      # a cheater
partii items put my-game gold-skin --field name="Gold skin" --field price_cents=99 --field kind=unlock
partii items list my-game
partii test players create --name tester                               # developer token: a test player + token
```

## Read what players did

```sh
partii analytics summary my-game                                   # DAU, sessions, retention, platform/version/country
partii analytics events my-game                                    # every event name, counts
partii analytics events my-game --name level_complete --by mission # a funnel
partii analytics forget-device my-game <device>                    # your own test machines
partii errors list my-game ; partii errors get my-game <fingerprint> ; partii errors mark my-game <fp> --status fixed
```

## Assets (free, CC0 / OFL)

```sh
partii assets search --q "pirate ship" --kind model --limit 10
partii assets get kenney/pirate-kit/ship-pirate-large
partii assets add <id> ; partii assets check        # in a room (jam) folder: keeps assets.lock in step
partii assets credits
```

## More

`partii builds upload` (launcher builds), `partii games cover|background|icon`, `partii notes`,
`partii achievements`, `partii secrets set` (stdin: `--value -`), `partii servers` (hosted wasm servers),
`partii lobbies`, `partii roles`/`members` (teams). The developer guide: https://partii.games/docs/GUIDE.md.

Errors: `{"ok": false, "error": {"code", "message", "hint"}}`; the hint says what to do. Exit 1 = Partii
said no, 2 = a bad command line.
