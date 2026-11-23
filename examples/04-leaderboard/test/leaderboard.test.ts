// Leaderboards on Partii staging: one submit per run, the best is kept (a worse run only counts as a
// play), the top 10 is sorted, and bad meta is refused. Run: npm test
import { PartiiError } from "@partii/sdk";
import { describe, expect, it } from "vitest";
import { createLeaderboard, resetsIn } from "../src/leaderboard";
import { createPartii, envConfig, memoryKV } from "../src/partii";

const cfg = envConfig();
const partii = createPartii(cfg, memoryKV());
const board = createLeaderboard(partii, "examples-score");

describe("leaderboard on staging", () => {
  it("is staging", () => expect(cfg.api).toMatch(/staging/));

  it("submits a run's score once, however often game over is shown", async () => {
    const best = await board.runEnded("run-1", 4200, { secs: 81.5, cause: "lava" });
    expect(best?.all.improved).toBe(true);
    expect(best?.daily.score).toBe(4200);
    expect(best?.daily.rank).toBeGreaterThanOrEqual(1);
    expect(await board.runEnded("run-1", 4200)).toBeNull(); // the same run again: not sent
  });

  it("keeps the best: a worse run counts as a play but doesn't replace it", async () => {
    const best = await board.runEnded("run-2", 1000);
    expect(best?.all.improved).toBe(false);
    expect(best?.all.score).toBe(4200);
    expect(best?.all.plays).toBe(2);
  });

  it("reads the top 10 and my rank", async () => {
    const b = await board.top("daily", 10);
    expect(b.entries.length).toBeLessThanOrEqual(10);
    const scores = b.entries.map((e) => e.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(b.me?.score).toBe(4200);
    expect(b.me?.rank).toBeGreaterThanOrEqual(1);
    if (b.me!.rank! <= 10) expect(b.entries.some((e) => e.player_id === partii.player()!.id)).toBe(true);
    expect(resetsIn(b.resets_at)).toMatch(/^Resets in/);
  });

  it("refuses nested meta with 400 (the score is not kept)", async () => {
    const err = await board.runEnded("run-3", 5000, { where: { x: 1 } } as never).catch((e) => e);
    expect(err).toBeInstanceOf(PartiiError);
    expect(err.status).toBe(400);
    expect((await board.top("all", 1)).me?.score).toBe(4200);
  });

  it("refuses a bad board name before calling Partii", () => {
    expect(() => createLeaderboard(partii, "High Score")).toThrow(/board/);
  });
});
