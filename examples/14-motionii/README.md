# 14 · Motionii: a character moved by a motion model

A character driven live by NVIDIA MotionBricks running in the browser on WebGPU, through the runtime Partii hosts
(`/_partii/motionii/0.1.0/`: runtime, 226 MB of weights, NVIDIA's licence). WASD / arrows walk, Shift runs, Space
stops, a tap walks there; a new command replans from the frame playing now. `npm test` proves it against staging:
the runtime loads, 30 generations run, their outputs match the reference within 0.24°. Read [TRAPS.md](TRAPS.md).

| File | What |
|---|---|
| `src/motionii.ts` | `loadRuntime`, `capability`, `warmUp`, `Character` (`step(command)`, `rollback(n)`): copy this |
| `src/main.ts` | the page: progress bar, one generation at a time, the queue cut on a new command, 30 Hz playback |
| `src/view.ts` | capsule-skeleton drawing on a 2D canvas: replace it with your engine |
| `src/bench.ts` | `?bench`: the deterministic run partii-runtime keeps in its corpus (see `bench/BENCH.md`) |

## Needs WebGPU
The model runs on the GPU through WebGPU: current Chrome and Edge on desktop and Android, and Safari 26 on Mac and iPhone.
Where WebGPU or an adapter is missing (older phones and browsers, some Linux setups), `capability()` says why, and the page
shows "This device can't run the motion model: no WebGPU in this browser" and stops. A real game should use baked clips
there instead. The download is 226 MB the first time, then the browser's cache.

## Staging and production
The runtime comes from the API the build points at (`VITE_PARTII_API`, so `${api}/_partii/motionii/0.1.0/`). `npm run dev`,
`npm run build` and `npm test` use staging (`.env.staging`). For `npm run build:prod`, copy `.env.production.example` to
`.env.production` and fill in your game. `VITE_MOTIONII_BASE` overrides the runtime's address (the `?bench` folder uses it).

The motion model's weights are NVIDIA's, under the NVIDIA Open Model Agreement (with the runtime, next to the
weights): credit "NVIDIA MotionBricks" where you credit things, and say it isn't made or endorsed by NVIDIA.
