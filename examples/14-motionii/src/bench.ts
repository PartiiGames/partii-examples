// ?bench: the deterministic run partii-runtime keeps in its corpus (correctness and speed, every run). A fixed command
// script from the seed, generations back to back (no wall clock, frame timing or window size in the motion), and a
// hash of every model output. Console: MOTIONII_READY / MOTIONII_FAIL, MOTIONII_GEN per generation, MOTIONII_DONE
// (also window.__motionii). Params: ?gens=N (300), ?seed=S (1), ?headless=1.
//
// GPUs round differently (Metal, Vulkan, Dawn), and each generation feeds the next, so the hash is exact only per
// adapter (expected.json keeps one per adapter). Across adapters, `tol` replays the first 30 generations from a
// recorded reference (bench/ref30.bin: inputs and outputs) one by one, and checks each against it: the same token
// counts and a median rotation error under 0.24 degrees.
import { Character, type Command, type Runtime } from "./motionii";

const log = (tag: string, o: object) => console.log(`${tag} ${JSON.stringify(o)}`);

let dispatches = 0; // every compute dispatch the page makes (the runtime's are all of them)
const enc = (globalThis as unknown as { GPUComputePassEncoder?: { prototype: Record<string, (...a: unknown[]) => unknown> } }).GPUComputePassEncoder;
if (enc) { const o = enc.prototype.dispatchWorkgroups; enc.prototype.dispatchWorkgroups = function (this: unknown, ...a: unknown[]) { dispatches++; return o.apply(this, a); }; }

function mulberry32(s: number) {
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Two FNV-1a 32 lanes over the raw float bits: a 64-bit hex hash. */
function hasher() {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x9e3779b9;
  return {
    add(x: Float32Array) { const u = new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
      for (let i = 0; i < u.length; i++) { a = Math.imul(a ^ u[i], 0x01000193); b = Math.imul(b ^ u[i], 0x01000193) ^ (b >>> 13); } },
    hex: () => (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0"),
  };
}

export async function runBench(rt: Runtime, gens: number, seed: number, ref: ArrayBuffer | null) {
  log("MOTIONII_READY", { adapter: rt.adapter, limits: rt.limits });
  const c = new Character(rt), rnd = mulberry32(seed), h = hasher(), toks: number[] = [];
  let cmd: Command = { speed: 0, heading: 0 };
  const t0 = performance.now();
  for (let g = 0; g < gens; g++) {
    if (g % 6 === 0) { const r = rnd(); cmd = r < 0.2 ? { speed: 0, heading: 0 } : { speed: r < 0.6 ? 1.4 : 4.0, heading: (rnd() * 2 - 1) * Math.PI }; }
    const d0 = dispatches, s = await c.step(cmd);
    if (!s) throw new Error("bench: a generation was dropped");
    h.add(s.out); toks.push(s.tokens);
    log("MOTIONII_GEN", { g, gen_ms: Math.round(s.ms * 10) / 10, dispatch: dispatches - d0, read_ms: Math.round(rt.model.last_timing?.()[2] ?? -1) });
  }
  const total_ms = Math.round(performance.now() - t0);
  const done = { gens, seed, hash: h.hex(), tokens: toks.join(""), total_ms, adapter: rt.adapter, tol: ref ? await tolerance(rt, ref) : null };
  (window as unknown as { __motionii: object }).__motionii = done;
  log("MOTIONII_DONE", done);
}

// ref30.bin: per generation, the model's 7 inputs (encode's order and sizes) then its output (64*366 + 1 floats)
const SIZES = [40, 8, 32, 8, 8 * 267, 8, 11], OUT = 64 * 366 + 1, INT = [1, 3, 5, 6];
async function tolerance(rt: Runtime, ref: ArrayBuffer) {
  const per = SIZES.reduce((a, b) => a + b, 0) + OUT, n = Math.min(30, Math.floor(ref.byteLength / 4 / per));
  const f = new Float32Array(ref), i32 = new Int32Array(ref), errs: number[] = [];
  let same = 0;
  for (let g = 0; g < n; g++) {
    let o = g * per;
    const inputs = SIZES.map((s, k) => { const v = INT.includes(k) ? i32.slice(o, o + s) : f.slice(o, o + s); o += s; return v; });
    const want = f.subarray(o, o + OUT), got = await rt.model.generate(...inputs);
    if (got[OUT - 1] === want[OUT - 1]) same++;
    errs.push(meanRotDeg(got, want, want[OUT - 1] * 4));
  }
  const med = [...errs].sort((a, b) => a - b)[n >> 1] ?? 0;
  return { gens: n, tokens_equal: same, median_rot_deg: +med.toFixed(4), ok: same === n && med <= 0.24 };
}
/** Mean angle (degrees) between the two outputs' joint rotations over the first `frames` frames. */
function meanRotDeg(a: Float32Array, b: Float32Array, frames: number) {
  let s = 0, k = 0;
  for (let fr = 0; fr < frames; fr++) for (let j = 0; j < 30; j++) {
    const o = fr * 366 + 5 + 29 * 3 + j * 6, A = rot6(a, o), B = rot6(b, o);
    const tr = A[0] * B[0] + A[1] * B[1] + A[2] * B[2] + A[3] * B[3] + A[4] * B[4] + A[5] * B[5] + A[6] * B[6] + A[7] * B[7] + A[8] * B[8];
    s += Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180 / Math.PI; k++;
  }
  return k ? s / k : 0;
}
function rot6(p: Float32Array, o: number) { // the model's 6D rotation -> 3 orthonormal columns
  const n = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l); };
  const x = n([p[o], p[o + 1], p[o + 2]]), b = [p[o + 3], p[o + 4], p[o + 5]];
  const z = n([x[1] * b[2] - x[2] * b[1], x[2] * b[0] - x[0] * b[2], x[0] * b[1] - x[1] * b[0]]);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [...x, ...y, ...z];
}

/** ?record=1 (once, on the reference adapter): the first 30 generations' inputs and outputs, for bench/ref30.bin. */
export async function recordRef(rt: Runtime, seed: number): Promise<string> {
  const c = new Character(rt), rnd = mulberry32(seed), parts: ArrayBuffer[] = [];
  const gen = rt.model.generate.bind(rt.model);
  rt.model.generate = async (...inputs) => { const out = await gen(...inputs); for (const x of [...inputs, out]) parts.push(x.slice().buffer as ArrayBuffer); return out; };
  let cmd: Command = { speed: 0, heading: 0 };
  for (let g = 0; g < 30; g++) {
    if (g % 6 === 0) { const r = rnd(); cmd = r < 0.2 ? { speed: 0, heading: 0 } : { speed: r < 0.6 ? 1.4 : 4.0, heading: (rnd() * 2 - 1) * Math.PI }; }
    await c.step(cmd);
  }
  rt.model.generate = gen;
  const all = new Uint8Array(parts.reduce((a, p) => a + p.byteLength, 0)); let o = 0;
  for (const p of parts) { all.set(new Uint8Array(p), o); o += p.byteLength; }
  let s = ""; for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode(...all.subarray(i, i + 0x8000));
  return btoa(s);
}
