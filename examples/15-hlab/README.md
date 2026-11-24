# 15 · hlab humanoid

One hlab humanoid on the page's own three.js 0.170, walking around with WASD:
idle, walk and run (Shift) crossfaded from in-place clips, the root moved at each clip's own speed
so the feet don't slide, the body turning toward its heading, and a follow camera. Partii's content
profile is built into hlab: every character is an adult, clothed and shod. Plus this device's guest
and one analytics event (`humanoid_spawned`).

## Run it

```sh
npm install
npm test      # headless Chromium against Partii staging, ~25 s (90 s cap)
npm run dev   # the page: WASD, Shift to run (?seed=N someone else, ?tier=phone)
```

`npm test` proves: the page builds the humanoid from the pinned hlab URL on one three; it is an
adult with a top, trousers and shoes; W walks, Shift+W runs and letting go stands (by the clips'
weights), and the root moves forward; a guest signs in and the spawn event is accepted, 0
dropped; the import map pins exact versions.

| File | What |
|---|---|
| `index.html` | The import map: three 0.170.0 and the hlab release. The only place their URLs live. |
| `src/libs.ts` | three and hlab from that map (never bundled), and hlab's types. |
| `src/controller.ts` | `new Controller(humanoid).bind(window)`, then `update(dt)` each frame. |
| `src/main.ts` | The scene, the humanoid, the camera, Partii. |

**Licence:** the example code is MIT; hlab is a separately licensed Partii product, loaded by URL
and never copied into this repo. Read [TRAPS.md](TRAPS.md).
