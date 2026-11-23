# What Partii drops, blanks or refuses

From Partii's edge source (`edge/src/api/analytics.ts`, `leaderboards.ts`, `saves.ts`, `limits.ts`).
The same list is in Partii's API.md, "What the server silently drops".

## Analytics events: `POST /v1/games/{game}/events` (`analyticsIngest`)

Dropped silently (the reply counts them in `dropped`; the rest of the batch is kept):

| Rule | Example that is dropped |
|---|---|
| `name` matches `^[a-z][a-z0-9_.]{0,47}$` | `LevelComplete`, `level-complete`, `1st`, a 49-char name |
| `props` is a flat object (or absent) | an array, a string |
| every prop key matches `^[A-Za-z0-9_]{1,40}$` | `hit-pos`, `hit.pos`, `""` (the whole event goes) |
| every value is a string ≤ 200 chars, a finite number or a bool | `null`, `[1]`, `{x:1}`, `NaN`, `Infinity`, a 201-char string |
| props ≤ 1024 bytes as JSON | many long values |

Kept, but blanked or changed:

| Field | Rule | Otherwise |
|---|---|---|
| `session` | ≤ 64 of `[A-Za-z0-9_-]` | `""`: the event counts for no session |
| `version`, `build` | ≤ 32 of `[A-Za-z0-9._+-]` | `""` |
| `platform` | ≤ 16 of `[a-z0-9_-]` | `""` |
| `owned` | `true` / `false` | unknown |
| `at` | within the last 7 days and ≤ 5 min ahead | the server's time |
| `session_end.props.secs` | a number ≥ 0 | the session's length is first-to-last event |

Refused (the whole batch): `device` not 8–64 of `[A-Za-z0-9_-]` (400); `events` not an array (400);
over 100 events (400); a key from another project (404); over 60 calls a minute per game and device or
1200 per network (429). Raw events are kept 90 days.

## Error reports: `POST /v1/games/{game}/errors` (`errorsIngest`)

Refused: `kind` not `panic|error|warning` (400), empty `message` (400), over 20 per call (400), 30 calls a
minute per device (429). Cut silently: `message` to 2000 chars, `backtrace` to 16 KB. Scrubbed before
storing: home folders → `~`, emails → `<email>`, tokens and long hex/base64 runs → placeholders (so
don't rely on ids in messages). `context` must be flat and ≤ 2 KB, else stored as `{}`. A custom
`fingerprint` must be 1–64 of `[A-Za-z0-9_-]`, else Partii computes one. 10 samples kept per group.

## Leaderboards (`leaderboardSubmit`, `leaderboardGet`)

Refused (400): board not `^[a-z0-9][a-z0-9_-]{0,39}$`; score not finite or |score| > 1e15; meta not a
flat object, a key not `^[A-Za-z0-9_]{1,40}$`, a value not a ≤ 200-char string / finite number / bool,
or meta over 1 KB; `limit` outside 1–100; `period` not `daily|weekly|all`. 429 over 30 submits a minute
per player per game. Silently: a worse score only adds a play (its meta is not kept); daily and weekly
scores are deleted after 60 days; deleted players disappear from boards.

## Saves (`savesPut`)

Refused: slot not `^[A-Za-z0-9._-]{1,64}$` (400); over 2 MB as JSON (400); a guest over 256 KB
(403 `account_needed`, reason `save_size`); `base_rev` not the current rev (409 `conflict` with
`theirs`). Only the last 20 revisions are kept.
