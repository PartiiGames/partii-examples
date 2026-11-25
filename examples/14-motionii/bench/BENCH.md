# motionii-bench (partii-runtime corpus)

Serve this folder over http (own origin only; no SharedArrayBuffer needed) and open
`index.html?bench&gens=300&seed=1&headless=1` (or `gens=30` for a short run on software Vulkan).

Console: `MOTIONII_READY {adapter,limits}` or `MOTIONII_FAIL {why}`; `MOTIONII_GEN {g,gen_ms,dispatch,read_ms}` per
generation; `MOTIONII_DONE {gens,seed,hash,tokens,total_ms,adapter,tol}` at the end, also on `window.__motionii`.

Correctness: `hash` is exact per adapter (`expected.json` keeps one per adapter key and run length: GPUs round
differently and each generation feeds the next). `tol` replays the first 30 generations of a reference run
(`motionii/0.1.0/bench/ref30.bin`) and needs `tokens_equal` = 30 and `median_rot_deg` ≤ 0.24 on any adapter.
A new adapter passes on `tol`; record its hashes then.

## Adapters that passed tol (runtime 0.1.0)
| Adapter key | Browser, device | gens | hash | tol | date |
|---|---|---|---|---|---|
| apple/apple | headless WebKit, MacBook (Apple Silicon) | 30, 300 | 08abb8051333e51e, ed4f9a4e809cc905 | 30/30 | 2026-11-24 |
| apple/metal-3 | headless Chromium 159, same MacBook | 30 | 08abb8051333e51e | pass | 2026-11-25 |

Both rows are the same GPU. The example stays `draft` in index.json until a second GPU passes tol, for example an iPhone in
WebKit or a Vulkan box. Then it becomes `tested`.
