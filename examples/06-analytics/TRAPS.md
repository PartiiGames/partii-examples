# Traps: analytics

- **Bad events vanish (tested).** The reply is `200 {accepted, dropped}`: a misnamed event or one bad
  prop drops the WHOLE event with no error. Rocket to Heaven lost events this way before anyone noticed. Check every
  event with `checkEvent()` (it warns), and watch `dropped` in the reply (`stats.droppedByServer`).
- **One bad prop kills the event, not just the prop.** `{x: 1, pos: {x, y}}` → nothing is recorded.
  Flatten: `{pos_x, pos_y}`.
- **Dashes and dots are fine in names only:** `ui.open` is a valid event name, `hit.pos` is not a valid prop key.
- **`null` is not a value.** `cause: lastHit?.name ?? null` drops the event; use `""` or leave the key out.
- **`version: "1.2 beta"` is blanked, not refused:** your version breakdown shows an empty row. Use `1.2.0-beta`.
- **A device id over 64 characters is a 400 for every batch, forever.** Some code allows 80; Partii
  allows 8–64 of `[A-Za-z0-9_-]`. A 400 batch is dropped here (re-sending it would fail forever).
- **Session ids with other characters are blanked:** a UUID with dashes is fine, a base64 one with `+/=` is not.
- **`session_end {secs}` is how sessions get a length.** Without it, length is first-to-last event. A
  session may end more than once (hidden, then closed): the largest `secs` wins.
- **A closing page can't wait for `fetch` (tested).** On `pagehide`, use `navigator.sendBeacon`: it
  can't set headers, so the key goes in `?key=` and the player token in the body as `player_token`;
  send `text/plain` (no CORS preflight). Partii reads the body as JSON either way.
- **Batch.** 100 events per call, 60 calls a minute per device (429). Every 30 s plus on hide is far
  under it. A per-event POST is not.
- **Respect the player's switch:** if your game has "Share anonymous stats" off, don't create the tracker.
