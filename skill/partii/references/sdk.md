# Partii SDKs

## Web (TypeScript / JavaScript)

Published as source at `https://partii.games/docs/sdk-ts/`: `client.ts` (transport, errors),
`generated.ts` (one method per API operation, from Partii's OpenAPI), `buy.ts` (the buy sheet).
There is no npm package yet. The examples' `get-sdk.mjs` installs those files into `partii-sdk/`
(gitignored), records their sha256 in `partii-sdk/SDK.json`, and `--check` says when Partii changed
them. Import, never edit:

```ts
import { createClient, PartiiError, isAccountNeeded } from "@partii/sdk";
import { buy } from "@partii/sdk/buy";

const api = createClient({ base: "https://api-staging.partii.games", key: "pk_..." });
const g = await api.playersGuest({ device_id, display_name: "Player" });   // {player, player_token}
api.setPlayerToken(g.player_token);
await api.savesPut(game, "progress", { data, base_rev });
await api.leaderboardSubmit(game, "score", { score, meta });
await api.leaderboardGet(game, "score", { period: "daily", limit: 10 });
await api.analyticsIngest(game, { device, platform: "web", version, events });
await api.errorsIngest(game, { device, platform: "web", version, errors: [{ kind: "error", message, backtrace }] });
await api.playersItems({ game });                                            // what the player owns
const r = await buy(api, { game, item: "gold-skin" });                        // from a tap
```

- Every call resolves to Partii's JSON or throws `PartiiError {code, message, hint, status, body}`.
  `status 0` is network/timeout (15 s default). GETs retry 2× on network/5xx; POSTs never do.
- `403 account_needed` with `body.error.reason` (`buy`, `save_size`, `jam_start`, ...): offer an account
  ("keeps the same player"), with "Not now".
- Other helpers in Partii's repo docs (GUIDE.md): `autoSignIn` (players already signed in on
  partii.games or in the Partii app), `onSafeArea` (notch insets inside the Partii app),
  the loading card (`partii:loading` / `partii:ready` postMessage).
- Inside the Partii app the game runs full-bleed in a frame: read insets from `?safe=T,R,B,L` and
  `partii:insets` messages, not `env(safe-area-inset-*)` alone.

### A site game's key and API: `siteConfig` (`site.ts`)

A game hosted at `<game>.partii.games` ships one publishable key per address and lets the address
pick (`https://partii.games/docs/sdk-ts/site.ts`, no imports; GUIDE.md "Which key and API a site uses"):

```ts
import { siteConfig } from "@partii/sdk/site";
const cfg = siteConfig({
  "mygame.partii.games": "pk_mystudio_web_...",          // production key
  "mygame-staging.partii.games": "pk_mystudio_web_...",  // staging key
});
// {game, api, key, env, preview, host} | null (no key for this address: Partii stays off)
const api = cfg && createClient({ base: cfg.api, key: cfg.key });
```

- `<deploy>--mygame-staging.partii.games` (a deploy's preview_url) uses its site's key.
- API: `https://api-staging.partii.games` for addresses ending in `-staging.partii.games`, else production.
- On localhost only: `?partii=staging|prod`, or `?partii_key=…&partii_api=…` (what `partii test room` adds).
- Tests: `siteConfig(keys, {override: {api, key, game}})`, or `{location: {hostname, search}}`.

### Room events: `roomEvents` (`room-events.ts`)

A page is in its room before its world and handlers are ready; events heard in that gap are lost
unless held. Feed the engine's `poll()` (or raw protocol frames) from the start:

```ts
import { roomEvents } from "@partii/sdk/room-events";
const room = roomEvents();
setInterval(() => room.feed(engine.poll()), 4);
// later: everything held so far, oldest first, then new ones
room.on({ member_joined: (e) => admit(e.member), member_left: (e) => drop(e.mid), message: (e) => onPacket(e.from, e.bytes) });
room.members; room.knows(mid);   // the other members, live
```

Order: host `online` → `created` → per guest `member_joined` → `peer_connected`; a guest `online` →
`joined` (everyone so far in `room.members`, no `member_joined` for them). The engine drops a
datagram from a member it hasn't linked yet, so a joiner's first packets can vanish: repeat hello
until the host answers with the full state. GUIDE.md "Room events: order and shapes".

### Threads (SharedArrayBuffer)

`partii web deploy --isolated` isolates a site only as a top-level page (its own tab or window). In
a frame (partii.games, the phone apps, the desktop app's game window) it isn't isolated today.
Check any surface with https://partii.games/probe/threads.html, and keep a path without shared memory.

## Godot 4

https://github.com/PartiiGames/partii-godot (Godot Asset Library: "Partii"). Web exports, Godot 4.3+,
Compatibility renderer, **Thread Support off**. `Partii.configure(game, key, api)`, `sign_in()`,
`load_slot`/`save_slot`, `items()`/`owns()`/`buy()`/`unlock()`, `submit_score`/`leaderboard`,
`track`, `gravity()` (tilt), `set_playing`. Off the web every call falls back (local guest, `user://`
saves). Its TRAPS.md covers the Godot 3 → 4 properties that silently reset.

## Rust / Bevy

`partii-account = { git = "https://github.com/PartiiGames/partii-sdk" }`: `Account::start(AccountConfig{..})`
on a background thread: `ready()`, `player_id()`, `owns("full")`, `read_save`/`write_save` with a
merge fn, `buy`/`take_buy`, `track`, `report_error`, `install_panic_hook`, `end_session`.
`bevy_partii` and `partii-net` for rooms and P2P. See GUIDE.md sections 2, 3 and 8.

## Rooms (jams) and Lindii

Inside a Partii room, the room's runtime provides Partii for you (assets with `loadAsset(id)`,
saves written by the game's server, `shop.json` items). Follow the room's own `AGENTS.md` first; this
library's web examples are for games with their own site.

## The API

Every operation, its auth and fields: https://partii.games/docs/API.md (generated from
https://partii.games/docs/openapi.yaml). Auth: `key` = `X-Partii-Key: pk_...`; `player` = key plus
`Authorization: Bearer <player token>`; `developer` = `Authorization: Bearer <developer token>`.
