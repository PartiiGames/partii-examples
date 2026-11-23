// Leaderboards: submit ONCE per run (when the run ends), then show the player's rank and the top 10.
// Partii keeps each player's best for today, this week and all time (UTC; weeks start Monday).
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/04-leaderboard/src/leaderboard.ts
import type { Partii } from "./partii";

export type Period = "daily" | "weekly" | "all";
/** Board names: 1-40 of a-z, 0-9, _ and -, starting with a letter or digit. */
export const BOARD = /^[a-z0-9][a-z0-9_-]{0,39}$/;
/** Meta: a flat object (keys [A-Za-z0-9_]{1,40}; strings ≤ 200 chars, finite numbers, bools), 1 KB as JSON. */
export type Meta = Record<string, string | number | boolean>;

export interface Entry {
  rank: number;
  player_id: string;
  display_name: string;
  score: number;
  meta: Meta;
  achieved_at: number;
}

export interface Board {
  board: string;
  period: Period;
  higher_is_better: boolean;
  /** When this period's board starts over (ms), null for all time. */
  resets_at: number | null;
  players: number;
  total_plays: number;
  entries: Entry[];
  /** This player's best and rank (needs the player token; the SDK client sends it). */
  me: { score: number; rank: number | null; meta: Meta; achieved_at: number; plays: number } | null;
}

export interface Best {
  score: number;
  rank: number | null;
  plays: number;
  /** This run beat the player's previous best for the period. */
  improved: boolean;
}

export function createLeaderboard(partii: Partii, board: string) {
  if (!BOARD.test(board)) throw new Error(`board "${board}" must be 1-40 of a-z, 0-9, _ and -`);
  const submitted = new Set<string>();

  return {
    /**
     * The run is over: submit its score. `runId` makes it once per run, even if the game-over
     * screen is shown twice (a re-render, a resize): the second call returns null. Partii also
     * limits a player to 30 submits a minute (429), so a per-frame submit would start failing.
     */
    async runEnded(runId: string, score: number, meta: Meta = {}): Promise<Record<Period, Best> | null> {
      if (submitted.has(runId)) return null;
      if (!Number.isFinite(score)) throw new Error("score must be a finite number");
      submitted.add(runId);
      await partii.ensurePlayer();
      const r = (await partii.api.leaderboardSubmit(partii.cfg.game, board, { score, meta })) as { best: Record<Period, Best> };
      return r.best;
    },

    /** The top `limit` (1-100) and this player's own best and rank. */
    async top(period: Period = "daily", limit = 10): Promise<Board> {
      await partii.ensurePlayer();
      return (await partii.api.leaderboardGet(partii.cfg.game, board, { period, limit })) as Board;
    },
  };
}

/** "Resets in 5 h" for a daily or weekly board. */
export function resetsIn(resetsAt: number | null, now = Date.now()): string | null {
  if (resetsAt === null) return null;
  const mins = Math.max(0, Math.round((resetsAt - now) / 60_000));
  return mins >= 120 ? `Resets in ${Math.round(mins / 60)} h` : `Resets in ${mins} min`;
}
