# 06 · Analytics

Gameplay events with sessions: queue events, send them every 30 s and when the page hides,
`session_start` on load and `session_end {secs}` on `pagehide` (sent as a beacon, so it survives the
tab closing). Partii **silently drops** events that break its rules, so `checkEvent()` refuses them
here first, with a reason. Use it in every game; then `partii analytics summary <game>` and
`partii analytics events <game> --name level_complete --by mission` read it back.

## Run it

```sh
npm install
npm test      # against Partii staging, headless
npm run dev   # the page: a good event and a bad one
```

`npm test` proves: every drop rule is enforced by the server (sent raw, it answers `dropped: 12`, no
error) AND caught by `checkEvent()` first; a session is accepted whole; `pagehide` sends
`session_end` as a beacon (key in the address, player token in the body, `text/plain`) and Partii
accepts it; a bad device id or 101 events is a loud 400.

| File | What |
|---|---|
| `src/analytics.ts` | `createAnalytics({partii, version, build})` → `track`, `flush`, `end`; `checkEvent(name, props)` |

## The drop rules (what Partii throws away without an error)

| Rule | Dropped |
|---|---|
| Event name `^[a-z][a-z0-9_.]{0,47}$` | `LevelComplete`, `level-complete`, `1st_run`, 49+ chars |
| Prop keys `^[A-Za-z0-9_]{1,40}$` | `hit-pos`, `hit.pos`: the WHOLE event goes |
| Prop values: string ≤ 200 chars, finite number, bool | nested objects, arrays, `null`, `NaN`, long strings: the whole event |
| Props ≤ 1024 bytes as JSON | the whole event |
| `session`: ≤ 64 of `[A-Za-z0-9_-]` | kept, but the session id is blanked (no session length) |
| `version`/`build`: ≤ 32 of `[A-Za-z0-9._+-]`; `platform`: ≤ 16 of `[a-z0-9_-]` | kept, but blanked (`"1.2 beta"` → `""`) |
| `at` older than 7 days or > 5 min ahead | kept, with the server's time |

Refused loudly (400, the whole batch): device id not 8–64 of `[A-Za-z0-9_-]`; over 100 events;
`events` not an array. 429: over 60 calls a minute per device (1200 per network).
Full list: Partii's API.md, "What the server silently drops". Read [TRAPS.md](TRAPS.md).
