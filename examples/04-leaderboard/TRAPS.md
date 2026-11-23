# Traps: leaderboard

- **Once per run (tested).** Submit when the run ends, keyed by a run id. A game-over screen that
  renders twice, or a submit per frame, double-counts plays and hits the limit: 30 submits a minute
  per player per game (429).
- **The first submit decides the direction.** Boards start higher-is-better. For race times, set
  `--higher-is-better false` BEFORE anyone submits: bests kept before the flip were chosen the old way.
- **A worse score only counts as a play (tested),** and its `meta` is not kept: `meta` belongs to the best.
- **Meta is flat (tested):** keys `[A-Za-z0-9_]{1,40}`, values strings ≤ 200 chars, finite numbers or
  bools, 1 KB as JSON. Anything else is a 400 and the score is NOT recorded. Unlike analytics, this is
  loud: catch it.
- **Score must be finite** and |score| ≤ 1e15. `NaN` from a divide-by-zero is a 400.
- **Board names:** 1–40 of `a-z 0-9 _ -`, starting with a letter or digit. `"High Score"` is a 400.
- **`limit` is 1–100.** Default 10.
- **`me` needs the player token.** Reading with the key alone gives `me: null`.
- **Ties go to whoever got there first.** Ranks are 1 + players strictly ahead.
- **Daily and weekly boards are kept 60 days.** Show `resets_at` ("Resets in 5 h") rather than computing midnight yourself.
- **Cheaters:** `partii leaderboards remove <game> <board> <player>`. Deleted players drop off by themselves.
