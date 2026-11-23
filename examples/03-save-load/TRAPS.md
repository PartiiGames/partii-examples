# Traps: save and load

- **No save is a 404, not an error (tested).** A new player's `savesGet` throws status 404. Treat it
  as `data: null` (the browser console still logs "Failed to load resource": harmless).
- **Always send `base_rev` (tested).** Leave it out and it means 0: the second save of a slot is a
  409 conflict. Send the rev you loaded or last saved.
- **On a conflict, never re-send your stale copy.** Merge `theirs.data` into yours and save with
  `base_rev = theirs.rev`. Writing yours again blindly deletes the other device's progress.
- **Guests: 256 KB per save; accounts: 2 MB (tested).** Over that, a guest gets
  `403 account_needed` with `reason: "save_size"`: offer an account ("keeps the same player"), with
  "Not now".
- **Slot names are 1–64 of `[A-Za-z0-9._-]`.** `"my save"` is a 400.
- **Sizes are JSON text length.** Big arrays of floats grow fast; round them.
- **Bought items don't belong in a save.** A save is the player's own data; anything paid comes from
  `playersItems` (05), which they can't edit.
- **Jam games' saves are written by the game's server** (`403 server_writes`). This example is for
  games with their own client saves.
- **Save on meaningful moments** (level end, settings change), not every frame: each save is a request.
