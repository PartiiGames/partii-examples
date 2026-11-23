# 04 · Leaderboard

Submit a score once per run, then show the player's rank and the top 10. Partii keeps each
player's best for today, this week and all time (UTC; weeks start Monday); a worse run counts as a
play. Boards appear on the first submit, higher-is-better (for times, run
`partii leaderboards config <game> <board> --higher-is-better false` before anyone submits).
Use it for any score, distance or time board. Guests count; their scores join the account they sign in to.

## Run it

```sh
npm install
npm test      # against Partii staging, headless
npm run dev   # the page: play a run, see the board
```

`npm test` proves: a run's score is sent once even if game over shows twice; the best is kept and
a worse run only adds a play; the top 10 is sorted and has my rank; nested meta is a 400.

| File | What |
|---|---|
| `src/leaderboard.ts` | `createLeaderboard(partii, board)` → `runEnded(runId, score, meta)`, `top(period, limit)`; `resetsIn()` |

Read [TRAPS.md](TRAPS.md).
