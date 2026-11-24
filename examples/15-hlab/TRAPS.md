# Traps: hlab humanoid

Each of these fails silently. The test catches the ones marked **(tested)**.

- **Two three.js on the page (tested).** hlab imports `"three"` through the page's import map. If
  your bundler also bundles three (or the map says another version), the page holds two copies:
  warnings at best, at worst materials and skinning that quietly draw wrong. Map `three` and
  `three/addons/` to the same exact 0.170.0 that hlab is built for, and load three from the map
  only (`src/libs.ts`: Vite must not see the import; `@types/three` gives the types).
- **The hlab URL is staging while hlab is a release candidate.** `1.0.0-rc7.1` is served from
  `api-staging.partii.games` only. Going to production is one line in `index.html`; a URL without
  an exact version (or `latest`) can change the character under a shipped game (tested: exact pins).
- **Crossfading without `reset()` (tested).** A faded-out `AnimationAction` ends disabled. Calling
  `fadeIn()` on it again leaves it at weight 0: the body freezes mid-stride, no error.
  `reset()` it first; walk ↔ run also carry the stride's phase over (`src/controller.ts`).
- **Root motion applied twice.** hlab's clips are in place: the walk's forward motion was taken out
  and written down as `motion.walk.speed` (m/s). Move the root by that, once. A clip with its own
  root motion (a Mixamo clip "with root motion"), plus your own move, walks at double speed and
  slides.
- **Moving at a speed of your choosing.** Any speed but the clip's makes the feet skate. During a
  crossfade move at the weighted blend of the clips' speeds, as the legs show.
- **Scaling the skeleton instead of the root.** Scale `humanoid.scene` (the root). Scaling a bone or
  the skinned mesh breaks the skinning and the clips (they set bone transforms every frame), and
  the speeds are for the built size: a root scaled by `s` walks `s` times faster (the controller
  reads `root.scale`).
- **The first frame before it is ready.** Await `createHumanoid` (it waits for the maps, up to 8 s
  each; one that never came is listed in `look.patched.timedOut`), call `look.settle()`, and
  `renderer.compileAsync()` before the first frame, or the first frames stall or show a grey body.
- **The phone tier and the download budget.** The default tier `auto` picks `phone` (8k triangles)
  on a small touch screen and `game` (15k) elsewhere; the first character costs a phone about 9 MB
  (inside Partii's 10 MB), and a sample character file is at most 6 MB. `hero` (about 100k
  triangles, 6–12 MB a character) is for desktops only: never on a phone.
- **The content profile is not a setting (tested).** It is compiled into hlab: every character is
  an adult, fully clothed and shod, whatever the spec asks. A spec that names no clothing gets an
  everyday outfit.
- **Keys stuck after alt-tab.** A key released while the page had no focus never sends `keyup`:
  clear the keys on `blur`, or the character walks on by itself.
- **Bad analytics events are dropped without an error.** See 06's TRAPS.md and `checkEvent()`.
