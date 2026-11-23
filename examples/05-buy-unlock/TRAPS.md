# Traps: buy and unlock

- **A game never buys for the player.** `POST /v1/store/games/<game>/items/<item>/buy` with the game's
  key answers `403 confirm_on_partii`, and every refused call raises an incident on Partii's side.
  Don't call it, don't "try it once", don't put it in a test loop. The only way is the SDK's `buy()`:
  the player confirms on Partii's sheet. (Partii's rule: a game buying for a player without permission,
  even once, means store removal and a developer ban.)
- **Call `buy()` from a tap.** Outside Partii's page it opens a popup; browsers block popups that
  aren't from a tap. `reason: "popup_blocked"` comes with `url`: show a button that opens it.
- **The sheet's message is not the truth (tested).** `verified: false` means the sheet said "bought"
  but Partii doesn't know the purchase for THIS player (the sheet was signed in as someone else).
  Unlock only what `playersItems` lists.
- **Refresh items at start, not just after a buy.** A purchase made on another device or in the
  browser only shows up when you ask `playersItems` again.
- **Guests can see prices, not pay.** `storeBuyQuote` works for a guest; paying needs an account and
  the sheet asks for one itself. Don't block the button for guests.
- **Under $3 is Pops only;** prices are in cents, 1 Pop = 1¢ (face value). Show `price_pops` from
  the quote, don't compute it.
- **Item ids:** 1–40 of `a-z 0-9 _ -`; `game` is reserved (it's the game itself, `/buy/<game>/game`).
- **No paid chance.** Loot boxes are refused (`400 paid_chance`).
- **Testing:** there's no test grant for items, so a real "bought" needs a person on the staging
  sheet (Stripe test cards for Pops packs). Stand in for Partii's page in automated tests (this test)
  rather than calling the buy endpoint.
- **Offline:** `playersItems` returns `signed` (prefix `pi_`), a copy you can trust offline for a week.
