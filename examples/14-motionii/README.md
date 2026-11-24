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

The motion model's weights are NVIDIA's, under the NVIDIA Open Model Agreement (with the runtime, next to the
weights): credit "NVIDIA MotionBricks" where you credit things, and say it isn't made or endorsed by NVIDIA.
