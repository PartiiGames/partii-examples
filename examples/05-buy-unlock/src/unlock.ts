// Unlock an item with Pops. The game never spends Pops itself: it calls the SDK's buy(), which opens
// Partii's buy sheet (over the game inside Partii, else a popup), the player confirms THERE, and the
// answer comes from Partii (playersBuyStatus). What the player owns always comes from playersItems.
// A direct POST to the item's /buy endpoint with the game's key is refused (403 confirm_on_partii)
// and raises an incident on Partii's side: never call it.
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/05-buy-unlock/src/unlock.ts
import { buy as sdkBuy, type BuyOptions, type BuyResult } from "@partii/sdk/buy";
import type { PartiiClient } from "@partii/sdk";
import type { Partii } from "./partii";

export interface HeldItem {
  game: string;
  item: string;
  name: string;
  kind: string;
  count: number;
  retired?: boolean;
}

export type UnlockResult =
  | { ok: true; item: string; already: boolean }
  | { ok: false; item: string; reason: string; url?: string; message?: string };

export interface UnlockDeps {
  /** The SDK's buy (tests pass a stand-in for the sheet; the game never replaces it). */
  buy: (client: PartiiClient, o: BuyOptions) => Promise<BuyResult>;
}

export function createUnlocks(partii: Partii, deps: UnlockDeps = { buy: sdkBuy }) {
  const held = new Map<string, number>();

  /** What this player owns in this game, from Partii. Call at start and after every buy. */
  async function refresh(): Promise<Map<string, number>> {
    await partii.ensurePlayer();
    const r = (await partii.api.playersItems({ game: partii.cfg.game })) as { items: HeldItem[] };
    held.clear();
    for (const it of r.items) if (it.game === partii.cfg.game && !it.retired) held.set(it.item, it.count);
    return held;
  }

  const owns = (item: string) => (held.get(item) ?? 0) > 0;

  /**
   * Call from a tap (browsers block popups that aren't). Opens Partii's sheet; resolves when the
   * player has bought it or not. A guest is asked to make an account on the sheet: nothing to do here.
   */
  async function unlock(item: string): Promise<UnlockResult> {
    await refresh();
    if (owns(item)) return { ok: true, item, already: true };
    const r = await deps.buy(partii.api, { game: partii.cfg.game, item });
    if (!r.ok) {
      // popup_blocked: show a button that opens r.url (a tap). cancelled / timeout: nothing happened.
      return { ok: false, item, reason: r.reason, url: r.url, message: r.message };
    }
    // r.verified false: the sheet said "bought" but Partii doesn't know this purchase for THIS player
    // (the sheet was signed in as someone else). Either way, Partii's list decides.
    await refresh();
    return owns(item) ? { ok: true, item, already: false } : { ok: false, item, reason: "not_confirmed", message: "Partii doesn't show this item for this player" };
  }

  return { refresh, owns, unlock };
}

/** The price to show on the button, from Partii (guests may read it). */
export async function priceOf(partii: Partii, item: string) {
  await partii.ensurePlayer();
  return (await partii.api.storeBuyQuote(partii.cfg.game, item)) as { price_pops: number; price_cents: number; owned: boolean; pops_only: boolean; blocked: string | null; item: { name: string } };
}
