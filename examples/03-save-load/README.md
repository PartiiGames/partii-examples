# 03 · Save and load

Cloud saves: named JSON slots per player and game, with a revision number. Load returns
`{data, rev}` (`null, 0` for a new player); save sends `base_rev`; when another device saved first,
Partii answers `409 conflict` with theirs, and this code merges and saves on top. The last 20
revisions are kept (`savesHistory`, `savesRestore`). Use it for progress, settings and unlocks the
player earned (items they bought come from 05, never from a save).

## Run it

```sh
npm install
npm test      # against Partii staging, headless
npm run dev   # the page: a coin counter saved to the cloud
```

`npm test` proves: a new player has no save; save/load round-trips; two devices writing the same
slot merge instead of overwriting; a guest's 260 KB save is refused with `account_needed`
(`save_size`); bad slot names are refused; history keeps every revision.

| File | What |
|---|---|
| `src/saves.ts` | `createSaves(partii, slot, merge)` → `load()`, `save(data)`; `mergeObjects` |

Write your own `merge` for real games (max of counters, union of unlocked levels, newest settings).
Read [TRAPS.md](TRAPS.md).
