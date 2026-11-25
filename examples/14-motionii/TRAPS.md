# Traps: Motionii

Each of these failed silently for someone. The test catches the ones marked **(tested)**.

- **Never use NVIDIA's sample motions.** The MotionBricks repo's sample clips (the BONES BVH files and the G1 robot
  clips) are licensed for evaluation only: don't put them, or anything cut or converted from them, in a game, a
  demo or a repo. This example's target poses are built from the skeleton's rest pose, and its gait windows from
  the model's own generations.
- **The weights carry NVIDIA's licence.** Partii serves them with `LICENSE-NVIDIA-Open-Model-Agreement.txt` and
  `NOTICE.txt` beside them. Keep those with any copy, credit NVIDIA MotionBricks, and don't imply NVIDIA made or
  endorses your game.
- **One generation at a time.** `Model.generate` is not reentrant. Two characters share one model: queue their
  calls (await each), or the second call corrupts the first.
- **A published runtime folder never changes.** `/_partii/motionii/0.1.0/` stays as it is; a new runtime is a new
  version. Keep the address in one const (`MOTIONII_BASE`) so moving up is one line. (tested: the test loads it)
- **The first generations compile GPU pipelines.** Each token count (6..16) is its own set. Without `warmUp()`
  behind the loading bar, an iPhone took 4.3 s for the first generation and ran at 24 fps for ~30 s.
- **`read_ms` is mostly the GPU finishing, not the copy.** The model's output is tiny; the readback waits for the
  generation's GPU work. On a phone a generation is ~210 ms, so keep ~1 generation of motion queued, never less.
- **A command must cut the queue, or the reaction waits behind it.** Keeping ~1 s of motion queued made a phone
  answer a stop ~1.1 s late; cutting to one generation's worth (`rollback`) made it ~0.3 s. The cut frames are
  crossfaded into the new motion, so there's no pop.
- **Estimate generation time from a median, not an average.** The first (warm-up) generation is many times slower;
  an average carried it into a 4-second keep on the first command.
- **226 MB of weights.** Stream them (the runtime does, shard by shard) and let the browser cache them; never load
  them into one buffer. Phones without WebGPU, or too slow, need a fallback: baked clips or a still pose.
- **Stop when you're done.** A page that keeps generating after its scene ends keeps the GPU busy; an iPhone tab
  that did this for minutes was killed.
- **GPUs round differently.** The same inputs give slightly different outputs on Metal, Vulkan and Dawn, and each
  generation feeds the next: compare across devices with a tolerance, not a hash (`src/bench.ts`). (tested)
