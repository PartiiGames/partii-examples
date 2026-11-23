// Cloud saves on Partii staging: a new player has nothing (not an error), save and load round-trip,
// two devices writing the same slot merge instead of overwriting, and the limits answer as documented.
// Run: npm test
import { PartiiError } from "@partii/sdk";
import { describe, expect, it } from "vitest";
import { createPartii, envConfig, memoryKV } from "../src/partii";
import { createSaves, mergeObjects } from "../src/saves";

const cfg = envConfig();
const phone = createPartii(cfg, memoryKV());

describe("saves on staging", () => {
  it("is staging", () => expect(cfg.api).toMatch(/staging/));

  const slot = "progress";
  const phoneSaves = createSaves(phone, slot, mergeObjects);

  it("a new player has no save: data null, rev 0", async () => {
    expect(await phoneSaves.load()).toEqual({ data: null, rev: 0 });
  });

  it("saves and loads", async () => {
    const s = await phoneSaves.save({ level: 2, coins: 10 });
    expect(s.rev).toBe(1);
    expect((await phoneSaves.load()).data).toEqual({ level: 2, coins: 10 });
  });

  it("two devices: the later save merges with the earlier one instead of overwriting it", async () => {
    // The same player on a laptop (same token), which loaded rev 1 too.
    const laptop = createPartii(cfg, memoryKV());
    laptop.rememberToken(phone.token()!);
    const laptopSaves = createSaves(laptop, slot, mergeObjects);
    await laptopSaves.load();
    await laptopSaves.save({ level: 2, coins: 10, hat: "red" }); // rev 2
    // The phone still thinks rev 1: its save conflicts, merges theirs in and lands as rev 3.
    const s = await phoneSaves.save({ level: 3, coins: 25 });
    expect(s.rev).toBe(3);
    expect(s.data).toEqual({ level: 3, coins: 25, hat: "red" });
    expect((await laptopSaves.load()).data).toEqual({ level: 3, coins: 25, hat: "red" });
  });

  it("a guest's save over 256 KB is refused: account_needed (save_size)", async () => {
    const big = createSaves(phone, "big", mergeObjects);
    const err = await big.save({ blob: "x".repeat(260 * 1024) }).catch((e) => e);
    expect(err).toBeInstanceOf(PartiiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("account_needed");
    expect(err.body.error.reason).toBe("save_size");
  });

  it("refuses a bad slot name before calling Partii", () => {
    expect(() => createSaves(phone, "my save", mergeObjects)).toThrow(/slot/);
  });

  it("keeps the old revisions (savesHistory)", async () => {
    const h = (await phone.api.savesHistory(cfg.game, slot)) as { current: number; revisions: { rev: number }[] };
    expect(h.current).toBe(3);
    expect(h.revisions.map((r) => r.rev)).toEqual([3, 2, 1]);
  });
});
