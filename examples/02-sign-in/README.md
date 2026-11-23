# 02 · Sign in (guest → account)

Every player starts as a guest. When they want to keep progress everywhere (or buy, or build),
they add an email with a 6-digit code, and the guest becomes the account: same player id, same
saves, scores and items. Also: sign out (the device becomes a new guest) and sign back in.
Use it for your account screen. Players on partii.games are often signed in already: see
"Sign in automatically" in Partii's GUIDE.md (`autoSignIn`) before showing a form at all.

## Run it

```sh
npm install
npm test      # against Partii staging, headless
npm run dev   # the page: a sign-in modal
```

`npm test` proves: a guest with a save signs in and keeps its id and save; sign-out gives a new
guest with no save; a wrong code changes nothing; signing in again returns to the account and its save.

| File | What |
|---|---|
| `src/signin.ts` | `startEmail`, `finishEmail` (upgrade or merge), `signOut` |
| `src/partii.ts` | Same as every example |

Read [TRAPS.md](TRAPS.md).
