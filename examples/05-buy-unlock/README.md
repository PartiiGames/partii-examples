# 05 · Buy and unlock (Pops)

Sell an item for Pops and unlock it. The game calls the SDK's `buy()` from a tap; Partii shows
its own buy sheet (over the game inside Partii, else a popup), the player confirms there, and the
game learns the result from Partii. What the player owns always comes from `playersItems`.
A game can never spend a player's Pops itself. Use it for skins, levels, "full game" unlocks and
consumables (a count, used with `playersItemsUse`).

## Run it

```sh
npm install
npm test      # against Partii staging, headless
npm run dev   # the page: an unlock button
```

Staging has the item `gold-skin` (99 Pops, unlock) on the `partii-examples` game. Your own:
`partii items put <game> <item> --field name="Gold skin" --field price_cents=99 --field kind=unlock`.

`npm test` proves against staging: the price (guests may read it), a new player owns nothing, a fresh
purchase id is unknown (`none`), the sheet's address. The sheet needs a person, so the buy's answer
comes from a stand-in for Partii's page that speaks the SDK's own messages; the SDK's `buy()` still
asks staging how the purchase ended. Cancelled stays locked; "bought" with no record at Partii stays
locked; listed by Partii unlocks.

`PARTII_CHECK_DIRECT_BUY=1 npm test` also proves a direct POST to the item's buy endpoint is refused
(`403 confirm_on_partii`). It's off by default: each refused call raises an incident at Partii.

| File | What |
|---|---|
| `src/unlock.ts` | `createUnlocks(partii)` → `refresh()`, `owns(item)`, `unlock(item)`; `priceOf(partii, item)` |

The rules (Pops price, under $3 is Pops only, guests sign up on the sheet): Partii's BUYING.md.
Read [TRAPS.md](TRAPS.md).
