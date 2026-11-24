// Motionii: NVIDIA MotionBricks (a motion-generation model) animating a character live in the browser, on WebGPU,
// through the runtime Partii hosts. The model takes the last 4 poses and a target, and returns ~1-2 s of 30 Hz motion.
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/14-motionii/src/motionii.ts

/** The runtime's address, in one place: a versioned folder on Partii's hosting, never changed once published. */
export const MOTIONII_BASE = import.meta.env.VITE_MOTIONII_BASE ?? "https://api-staging.partii.games/_partii/motionii/0.1.0/";
const MODEL = "model/soma_int8-be4b3d633437"; // 226 MB of int8 weights: streamed once, then the browser's cache

export type Mat = number[]; // 3x3, row-major
export interface Frame { P: number[][]; R: Mat[]; C: number[] } // 30 joint positions (m), rotations, 4 foot contacts
type Tensor = Float32Array | Int32Array;
interface Align { at: number[]; ar: Mat }
export interface Soma {
  JOINTS: string[]; PARENTS: number[]; MIN_TOK: number; MAX_TOK: number;
  encode(ctx: Frame[], tgt: Frame[], allowed: number[]): { inputs: Tensor[]; align: Align };
  decode(pred: Float32Array, tokens: number, align: Align): Frame[];
  placeH(pose: Frame, x: number, z: number, h: number): Frame[];
  headingFromHips(r: number[], l: number[]): number;
  rotY(a: number): Mat; mul3(a: Mat, b: Mat): Mat; apply(a: Mat, v: number[]): number[];
}
export interface Model {
  /** One generation. NOT reentrant: await each before the next. Returns the model's output; its last value is the token count. */
  generate(...inputs: Tensor[]): Promise<Float32Array>;
  last_timing?(): Float64Array; // [forward (CPU), drain, readback] ms of the last generation
  set_drain_probe?(on: boolean): void;
}
interface Gait { v: number; P: number[][][]; R: Mat[][] }
export interface Runtime { model: Model; soma: Soma; poses: Record<string, Frame>; gaits: Gait[]; adapter: string; limits: Record<string, number> }

interface GpuAdapter { info?: { vendor?: string; architecture?: string }; limits: Record<string, number>; features: Set<string> }
interface Gpu { requestAdapter(o?: object): Promise<GpuAdapter | null> }

/** Can this device run it? WebGPU and an adapter. (Speed is measured by the first generations: see warmUp.) */
export async function capability(): Promise<{ ok: true; adapter: string; limits: Record<string, number> } | { ok: false; why: string }> {
  const gpu = (navigator as unknown as { gpu?: Gpu }).gpu;
  if (!gpu) return { ok: false, why: "no WebGPU in this browser" };
  const a = await gpu.requestAdapter({ powerPreference: "high-performance" }).catch(() => null);
  if (!a) return { ok: false, why: "no WebGPU adapter" };
  const limits = { maxBufferSize: a.limits.maxBufferSize, maxStorageBufferBindingSize: a.limits.maxStorageBufferBindingSize };
  return { ok: true, adapter: `${a.info?.vendor || "?"}/${a.info?.architecture || "?"}`, limits };
}

/** Load the runtime, the helpers and the weights from Partii's hosting. onProgress(bytes, total) while the weights stream. */
export async function loadRuntime(onProgress: (got: number, total: number) => void, base = MOTIONII_BASE): Promise<Runtime> {
  const cap = await capability();
  if (!cap.ok) throw new Error(cap.why);
  const at = (p: string) => new URL(p, new URL(base, location.href)).href;
  const wasm = await import(/* @vite-ignore */ at("wasm/motionii_web.js"));
  await wasm.default({ module_or_path: at("wasm/motionii_web_bg.wasm") });
  const { loadMotion } = await import(/* @vite-ignore */ at("motion/load.js"));
  const soma = (await import(/* @vite-ignore */ at("motion/soma.js"))) as Soma;
  const poses = (await (await fetch(at("motion/poses.json"))).json()).poses;
  const gaits = (await (await fetch(at("motion/gaits.json"))).json()).gaits;
  const model = (await loadMotion(wasm.Motion, at(MODEL), onProgress, { syncEach: true })) as Model;
  model.set_drain_probe?.(false); // one readback per generation, not two
  return { model, soma, poses, gaits, adapter: cap.adapter, limits: cap.limits };
}

/** One generation per token count (6..16): each compiles its own GPU pipelines. Do it behind the loading bar, or
 *  the first seconds of play stutter (an iPhone: 4.3 s for the first generation, 24 fps for ~30 s). */
export async function warmUp(rt: Runtime, onStep: (i: number, n: number) => void): Promise<number[]> {
  const c = new Character(rt), ms: number[] = [];
  for (let k = rt.soma.MIN_TOK; k <= rt.soma.MAX_TOK; k++) {
    const t = performance.now();
    await c.raw(rt.soma.placeH(rt.poses.stand, 0, 0, 0), [k]);
    ms.push(Math.round(performance.now() - t)); onStep(ms.length, rt.soma.MAX_TOK - rt.soma.MIN_TOK + 1);
  }
  return ms;
}

/** What the player wants: a speed (m/s; 0 = stop) and a heading (radians, 0 = +z). */
export interface Command { speed: number; heading: number }
export interface Step { frames: Frame[]; tokens: number; ms: number; out: Float32Array }

const XF = 3; // frames crossfaded from the old motion into the new one at every seam
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** One character: its pose history (the model's input), steering, and the seam blend between generations. */
export class Character {
  hist: Frame[] = [];
  v = 0; // speed now (m/s)
  h = 0; // heading now
  private tail: Frame[] | null = null; // the last generation's frames past the ones kept
  private epoch = 0;
  private keptLast = 20;
  private RI: number; private LI: number;
  constructor(private rt: Runtime, x = 0, z = 0) {
    const st = rt.soma.placeH(rt.poses.stand, x, z, 0)[0];
    for (let i = 0; i < 4; i++) this.hist.push({ ...st, C: [1, 1, 1, 1] });
    this.RI = rt.soma.JOINTS.indexOf("RightLeg"); this.LI = rt.soma.JOINTS.indexOf("LeftLeg");
  }

  /** The model call alone. */
  async raw(tgt: Frame[], tokens: number[]): Promise<{ out: Float32Array; tokens: number; align: Align }> {
    const { inputs, align } = this.rt.soma.encode(this.hist.slice(-4), tgt, tokens);
    const out = await this.rt.model.generate(...inputs);
    return { out, tokens: out[out.length - 1], align };
  }

  /** Plan toward the command, generate, keep the start, blend the seam. null: a rollback() came in meanwhile (replan). */
  async step(cmd: Command): Promise<Step | null> {
    const { soma, poses, gaits } = this.rt, l = this.hist[this.hist.length - 1];
    const hx = l.P[0][0], hz = l.P[0][2], facing = soma.headingFromHips(l.P[this.RI], l.P[this.LI]), dt = this.keptLast / 30;
    if (this.v < 0.3) this.h = facing;
    const want = cmd.speed < 0.3 ? this.h : cmd.heading;
    const maxTurn = this.v < 0.5 ? 1.0 : Math.min(Math.max(this.v, 1) / 1.5, 6 / this.v) * dt; // corner like a person
    this.h = wrap(this.h + Math.max(-maxTurn, Math.min(maxTurn, wrap(want - this.h))));
    const rate = Math.max(cmd.speed, this.v, 1) / 1.2;
    this.v += Math.max(-rate * dt, Math.min(rate * dt, cmd.speed - this.v));
    let tgt: Frame[], tokens: number[], early = 0, keep = 16;
    if (this.v < 0.3) { tgt = soma.placeH(poses.stand, hx, hz, this.h); tokens = [10]; }
    else { // a real gait window ~1 s of travel ahead; the model picks 8-14 tokens; the last 10 frames are dropped
      const ah = Math.min(this.v, 2.5);
      tgt = this.gait(hx + Math.sin(this.h) * ah, hz + Math.cos(this.h) * ah, this.v * 0.97);
      tokens = [8, 9, 10, 11, 12, 13, 14]; early = 10;
    }
    const ep = this.epoch, t = performance.now();
    const r = await this.raw(tgt, tokens);
    if (ep !== this.epoch) return null;
    const frames = soma.decode(r.out.subarray(0, r.out.length - 1), r.tokens, r.align);
    const k = Math.max(1, Math.min(early ? frames.length - 1 - early : keep, frames.length - 1));
    const fresh = frames.slice(1, 1 + k);
    if (this.tail) for (let i = 0; i < Math.min(XF, this.tail.length, fresh.length); i++) fresh[i] = blend(this.tail[i], fresh[i], (i + 1) / (XF + 1));
    this.tail = frames.slice(1 + k);
    this.hist.push(...fresh);
    if (this.hist.length > 256) this.hist.splice(0, this.hist.length - 256);
    this.keptLast = k;
    return { frames: fresh, tokens: r.tokens, ms: performance.now() - t, out: r.out };
  }

  /** A new command: forget the last `drop` generated frames (not yet shown), so the next generation starts from the
   *  frame that will be playing then. The dropped frames become the crossfade tail: no pop. */
  rollback(drop: number): boolean {
    this.epoch++;
    if (drop <= 0 || this.hist.length - drop < 4) return false;
    this.tail = this.hist.splice(this.hist.length - drop);
    return true;
  }

  private gait(x: number, z: number, v: number): Frame[] {
    const { soma, gaits } = this.rt;
    let g = gaits[0];
    for (const c of gaits) if (Math.abs(Math.log(c.v / v)) < Math.abs(Math.log(g.v / v))) g = c;
    const s = v / g.v, Ry = soma.rotY(this.h), r0 = g.P[0][0];
    return g.P.map((fr, i) => {
      const dx = (s - 1) * (fr[0][0] - r0[0]), dz = (s - 1) * (fr[0][2] - r0[2]);
      return { P: fr.map((p) => { const w = soma.apply(Ry, [p[0] + dx, p[1], p[2] + dz]); return [w[0] + x, w[1], w[2] + z]; }), R: g.R[i].map((m) => soma.mul3(Ry, m)), C: [1, 1, 1, 1] };
    });
  }
}

function blend(a: Frame, b: Frame, w: number): Frame {
  const P = b.P.map((p, j) => p.map((v, k) => a.P[j][k] + (v - a.P[j][k]) * w));
  const R = b.R.map((m, j) => ortho(m.map((v, k) => a.R[j][k] + (v - a.R[j][k]) * w)));
  return { ...b, P, R };
}
function ortho(m: Mat): Mat { // Gram-Schmidt on the columns, so a blended rotation stays a rotation
  const n = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l); };
  const x = n([m[0], m[3], m[6]]), c = [m[1], m[4], m[7]], d = x[0] * c[0] + x[1] * c[1] + x[2] * c[2];
  const y = n([c[0] - d * x[0], c[1] - d * x[1], c[2] - d * x[2]]);
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}
