# Traps: starter shell

Each of these failed silently for someone. The test catches the ones marked **(tested)**.

- **`useDefineForClassFields` true wipes declared fields (tested).** TS's default for ES2022+ targets
  turns `body!: Arcade.Body` into a real field set to `undefined` after the base constructor ran.
  Phaser physics bodies vanish; no error. Keep it `false` in tsconfig.
- **Forgetting the saved token on any error makes a new guest.** Only drop it on 401/403. Offline or a
  5xx keeps it, or the player's progress looks lost (`src/partii.ts`).
- **The device id is the guest.** Same id → same player, even with the token gone (tested). Clearing
  storage or a new id → a brand-new guest. Keep it 8–64 of `[A-Za-z0-9_-]`; anything else makes
  every analytics batch a 400.
- **Private browsing can throw on `localStorage`.** `browserKV()` falls back to memory.
- **A staging key in a production build.** `vite.config.ts` refuses a production build with no
  `pk_` key or a staging API. Staging sites are `<game>-staging.partii.games`.
- **Never put a developer token (`dt_...`) in a game.** Only the publishable key (`pk_...`) ships.
- **Resource errors aren't script errors.** A missing image fires `error` with no message; reporting
  it fills your error list with noise. `src/errors.ts` skips them.
- **An error loop.** A throw every frame would hit Partii's 30 error calls a minute per device and the
  first, useful report could be lost behind a 429. Report each message once per page, ≤10 a minute.
- **Bad analytics events are dropped without an error.** See 06's TRAPS.md and checkEvent().
- **Copied Partii client code drifts.** Import the SDK (`get-sdk.mjs`); copy only game code.
