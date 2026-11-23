# Known traps on Partii

Collected from nine game teams' answers and Partii's own docs. The ones that cost the most were
silent: nothing errored, something just didn't happen. Each example's TRAPS.md has its own list.

## Silent failures

- **Analytics events dropped without an error.** The reply is `200 {accepted, dropped}`. A bad name,
  one bad prop key, a nested value, `null`, `NaN`, a string over 200 or props over 1 KB drops the
  whole event. Validate before sending (06's `checkEvent`) and alert on `dropped > 0`.
  Full rules: drop-rules.md.
- **Fields blanked, not refused:** an analytics `session` with characters outside `[A-Za-z0-9_-]` or
  over 64; `version`/`build` with a space (`"1.2 beta"`) or over 32; `platform` over 16. The event is
  kept with an empty value, so your breakdowns show a blank row.
- **`useDefineForClassFields: true`** (the TS default for ES2022+ targets and for `tsc --init`):
  `body!: Phaser.Physics.Arcade.Body` becomes a field reset to `undefined` after the base class set it.
  Physics stops; no error. Keep it `false`.
- **Leaderboard: a worse score's meta is discarded.** Only the best's meta is kept.
- **Boards are created higher-is-better on the first submit.** Flip lower-is-better before any submit.
- **Godot 3 → 4:** unknown properties in `.tscn` load as defaults with no warning (particles,
  `playback_speed`, `loop`, `expand`): partii-godot TRAPS.md has the table.

## Accounts

- Sign in **with the guest's token**, or the guest's progress stays behind on the guest.
- Every sign-in, merge and sign-out answers a **new player token**: keep it.
- Forget a saved token only on 401/403; offline or 5xx keeps it (else a new guest, "lost" progress).
- The device id is the guest: same id, same player. 8–64 of `[A-Za-z0-9_-]` (Partii refuses others).
- Sign-out moves the device to a new guest; `playersGuest` with the same device id then gives that
  guest, not the account.
- A real account is never merged into another: `409 identity_in_use` with `error.other`.
- Staging returns email codes in the reply; production emails them. Don't build on `code`.
- Rate limits: email codes 3 per address / 15 min and 10 per network / hour; new guests 300 per
  network per hour.
- Players already signed in on partii.games or in the Partii app: use `autoSignIn` before showing a form.

## Saves

- No save yet = 404. Not an error.
- Always send `base_rev`; on `409 conflict` merge `theirs` and save at `theirs.rev`. Never re-send the stale copy.
- Guests: 256 KB per save (`403 account_needed`, reason `save_size`); accounts 2 MB.
- Slot names `^[A-Za-z0-9._-]{1,64}$`.

## Buying

- **A game never spends Pops.** Only the SDK's `buy()` (Partii's sheet, the player confirms there).
  `POST .../items/<item>/buy` with a game key is `403 confirm_on_partii` and raises an incident on
  Partii; don't call it, not even in a test. Buying for a player without permission = store removal
  and a developer ban.
- Call `buy()` from a tap (popups); handle `popup_blocked` with a button to `url`.
- Unlock only what `playersItems` lists; `verified: false` means the sheet's account wasn't this player.
- Guests see prices; the sheet asks them for an account. Under $3 is Pops only.

## Builds, keys, hosting

- Only `pk_...` keys in games. Never `dt_`, `pt_` or secrets in code, commits, logs or messages.
- Separate staging and production keys and builds; a production build must refuse a staging API.
- Staging site: `<game>-staging.partii.games`; production `<game>.partii.games`.
- Threaded wasm needs `partii web deploy --isolated`; the Partii iPhone app frame is NOT
  cross-origin isolated, so Godot web exports need Thread Support off.
- Inside the Partii app your page is a full-bleed frame: `env(safe-area-inset-*)` is unreliable
  there; use `?safe=` and `partii:insets` (`onSafeArea`).
- The app shows a loading card until your frame's `load`; a big wasm download should post
  `partii:loading` early and `partii:ready` on the first frame (else "Couldn't start" at 8 s).

## Copying code

- Import anything that talks to Partii (auth, saves, buy, leaderboards, rooms): copies drift silently
  when Partii changes. Copy game code, and stamp it `copied from <repo>@<sha> <path>`.
- `node get-sdk.mjs --check` tells you when Partii's web SDK changed.

## Tests

- Headless only, staging only, a hard timeout on every test and a no-progress watchdog.
- Don't hammer refused endpoints or rate-limited ones in loops (they alert Partii's on-call).
- Clean up test analytics with `partii analytics forget-device <game> <device>` when it matters.
