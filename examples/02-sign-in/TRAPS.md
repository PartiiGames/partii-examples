# Traps: sign in

- **Sign in WITH the guest's token (tested).** `playersLogin` with the guest's token upgrades it in
  place (or merges it into the account it already had). Without the token it signs in fresh, and
  the guest's saves, scores and items stay behind on the guest.
- **Keep the new `player_token`.** Every sign-in, merge and sign-out answers a new token. Keep using
  the old one and you're still the old player.
- **The code only comes back on staging.** Staging has no mail and answers `{sent: false, code}`.
  Production emails it. Never build a flow that reads `code` from the answer.
- **Codes are limited:** 3 per address per 15 minutes and 10 per network per hour (429). A test that
  asks for codes in a loop locks itself out; this test asks for 2.
- **Sign-out moves the device to a NEW guest (tested).** `playersGuest` with the same device id then
  gives that new guest, not the account. Only signing in again returns to the account.
- **A real account is never merged.** If this player already has an email and the code is for a
  different account, the answer is `409 identity_in_use` with `error.other`, and nothing changes. Ask
  the player which one they want.
- **`guest` is "every provider is device".** Steam or Game Center players are not guests but also
  have no email: check `providers`, not just `guest`.
- **Input goes in a modal, info in a toast** (Partii's UI rule): don't put the code field inline in the HUD.
