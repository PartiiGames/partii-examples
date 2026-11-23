// Buy and unlock on Partii staging (item gold-skin, 99 Pops, on the partii-examples game).
// What runs against staging: the price, what the player holds, and a fresh purchase's status. The
// sheet itself needs a person (the player confirms on Partii), so the buy's answer comes from a
// stand-in for Partii's page around the game, sending the SDK's own messages; the SDK's buy() then
// asks staging how the purchase ended, exactly as in a real game. Run: npm test
//
// Not run by default: PARTII_CHECK_DIRECT_BUY=1 also proves a direct POST .../buy is refused with
// 403 confirm_on_partii. Each refused call raises an incident on staging, so leave it off.
import { buyUrl, newPurchaseId } from "@partii/sdk/buy";
import { afterEach, describe, expect, it } from "vitest";
import { createPartii, envConfig, memoryKV } from "../src/partii";
import { createUnlocks, priceOf } from "../src/unlock";

const cfg = envConfig();
const partii = createPartii(cfg, memoryKV());
const ITEM = "gold-skin";

/** A stand-in for Partii's page around the game: it answers the SDK's {partii: "jam", op: "buy"} message. */
function partiiPageAnswers(result: { ok: boolean; reason?: string }) {
  const listeners = new Set<(e: { data: unknown; source: unknown }) => void>();
  const parent = {
    postMessage(m: { partii?: string; op?: string; id?: string }) {
      if (m.partii !== "jam" || m.op !== "buy") return;
      const send = (data: unknown) => setTimeout(() => listeners.forEach((l) => l({ data, source: parent })), 5);
      send({ partii: "ui", op: "buy", id: m.id, phase: "open" });
      send({ partii: "ui", op: "buy", id: m.id, result });
    },
  };
  Object.assign(globalThis, {
    window: { parent },
    addEventListener: (_: string, l: (e: { data: unknown; source: unknown }) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: { data: unknown; source: unknown }) => void) => listeners.delete(l),
  });
}
afterEach(() => {
  for (const k of ["window", "addEventListener", "removeEventListener"]) delete (globalThis as Record<string, unknown>)[k];
});

describe("buy and unlock on staging", () => {
  it("is staging", () => expect(cfg.api).toMatch(/staging/));

  it("reads the price (a guest may): 99 Pops, Pops only under $3", async () => {
    const q = await priceOf(partii, ITEM);
    expect(q.item.name).toBe("Gold skin");
    expect(q.price_pops).toBe(99);
    expect(q.pops_only).toBe(true);
    expect(q.owned).toBe(false);
  });

  it("a new player owns nothing", async () => {
    const u = createUnlocks(partii);
    await u.refresh();
    expect(u.owns(ITEM)).toBe(false);
  });

  it("a fresh purchase id is unknown to Partii (status none)", async () => {
    const s = (await partii.api.playersBuyStatus(newPurchaseId())) as { status: string };
    expect(s.status).toBe("none");
  });

  it("the sheet's address for a staging game", () => {
    const url = buyUrl({ site: "https://staging.partii.games", game: cfg.game, item: ITEM, purchaseId: "pur_test123456" });
    expect(url).toBe(`https://staging.partii.games/buy/${cfg.game}/${ITEM}?purchase_id=pur_test123456`);
  });

  it("the player cancels on the sheet: still locked", async () => {
    partiiPageAnswers({ ok: false, reason: "cancelled" });
    const r = await createUnlocks(partii).unlock(ITEM);
    expect(r).toMatchObject({ ok: false, reason: "cancelled" });
  });

  it("the sheet says bought but Partii doesn't: NOT unlocked (Partii's word wins)", async () => {
    partiiPageAnswers({ ok: true });
    // The SDK's buy asks staging (playersBuyStatus): none → verified false. The game then checks playersItems.
    const r = await createUnlocks(partii).unlock(ITEM);
    expect(r).toMatchObject({ ok: false, reason: "not_confirmed" });
  });

  it("Partii lists the item after the buy: unlocked", async () => {
    // A real purchase needs a person on the sheet, and Partii has no test grant for items, so the
    // item list (playersItems) is the one answer stood in for here: empty before, the item after.
    let calls = 0;
    const realItems = partii.api.playersItems;
    partii.api.playersItems = (async () => {
      calls++;
      return calls === 1 ? { items: [] } : { items: [{ game: cfg.game, item: ITEM, name: "Gold skin", kind: "permanent", count: 1 }] };
    }) as typeof realItems;
    partiiPageAnswers({ ok: true });
    try {
      const u = createUnlocks(partii);
      expect(await u.unlock(ITEM)).toEqual({ ok: true, item: ITEM, already: false });
      expect(u.owns(ITEM)).toBe(true);
    } finally {
      partii.api.playersItems = realItems;
    }
  });

  it.runIf(process.env.PARTII_CHECK_DIRECT_BUY === "1")("a direct buy with the game's key is refused: confirm_on_partii", async () => {
    const acct = createPartii(cfg, memoryKV());
    await acct.ensurePlayer();
    const email = `partii-examples-${Date.now().toString(36)}@example.com`;
    const { code } = (await acct.api.playersEmailStart({ email })) as { code: string };
    const r = (await acct.api.playersLogin({ provider: "email", email, code })) as { player_token: string };
    acct.rememberToken(r.player_token);
    await expect(acct.api.storeItemBuy(cfg.game, ITEM, { purchase_id: newPurchaseId() })).rejects.toMatchObject({ status: 403, code: "confirm_on_partii" });
  });
});
