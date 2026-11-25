// The page: load the runtime behind a progress bar, then a character you steer with WASD / arrows (Shift runs,
// Space stops) or by tapping where to go. One generation at a time keeps ~1 generation of motion queued; a new
// command cuts the queue so the reaction comes after one generation, not after the queued motion.
import { runBench, recordRef } from "./bench";
import { installErrorReporting } from "./errors";
import { Character, loadRuntime, warmUp, MOTIONII_BASE, type Command, type Frame } from "./motionii";
import { createPartii, errorMessage } from "./partii";
import { draw, lerp } from "./view";

const q = new URLSearchParams(location.search), BENCH = q.has("bench");
const status = document.querySelector<HTMLElement>("#status")!;
const canvas = document.querySelector<HTMLCanvasElement>("#game")!, ctx = canvas.getContext("2d")!;
const say = (t: string) => (status.textContent = t);

// Partii (not in ?bench: the corpus run talks to nothing but its own folder)
const partii = BENCH ? null : createPartii();
if (partii) {
  installErrorReporting({ partii, version: "0.1.0" });
  partii.ensurePlayer().catch((e) => console.warn("offline:", errorMessage(e)));
}

async function start() {
  const rt = await loadRuntime((got, total) => say(`Downloading the motion model… ${(got / 1e6) | 0} / ${(total / 1e6) | 0} MB`));
  if (BENCH) {
    if (q.has("record")) { (window as unknown as { __ref: string }).__ref = await recordRef(rt, +(q.get("seed") ?? 1)); say("recorded"); return; }
    const ref = await fetch(new URL("bench/ref30.bin", new URL(MOTIONII_BASE, location.href))).then((r) => (r.ok ? r.arrayBuffer() : null), () => null);
    say("Benchmark running…");
    return runBench(rt, +(q.get("gens") ?? 300), +(q.get("seed") ?? 1), ref);
  }
  const warm = await warmUp(rt, (i, n) => say(`Preparing the motion model… ${i} / ${n}`));
  play(rt, warm);
}

function play(rt: Awaited<ReturnType<typeof loadRuntime>>, warm: number[]) {
  const me = new Character(rt), queue: Frame[] = [], times: number[] = [warm[warm.length - 1]];
  const cmd: Command = { speed: 0, heading: 0 }, keys = new Set<string>();
  let busy = false, clock = 0, prev = me.hist[me.hist.length - 1], cur = prev, last = performance.now(), target: number[] | null = null;
  const est = () => [...times].sort((a, b) => a - b)[times.length >> 1]; // median of the last few generations
  const queueTarget = () => Math.ceil((est() * 1.15) / (1000 / 30)) + 1; // frames that cover the next generation

  // a new command: keep only the frames that cover the next generation; the model replans from there
  function command(c: Partial<Command>) {
    Object.assign(cmd, c);
    const keep = Math.max(2, queueTarget()), drop = queue.length - keep;
    if (me.rollback(drop)) queue.splice(keep);
  }
  const fromKeys = () => {
    const f = +(keys.has("KeyW") || keys.has("ArrowUp")) - +(keys.has("KeyS") || keys.has("ArrowDown"));
    const s = +(keys.has("KeyA") || keys.has("ArrowLeft")) - +(keys.has("KeyD") || keys.has("ArrowRight"));
    target = null;
    command(f || s ? { speed: keys.has("ShiftLeft") || keys.has("ShiftRight") ? 4.0 : 1.4, heading: Math.atan2(-s, -f) } : { speed: 0 });
  };
  addEventListener("keydown", (e) => { if (e.repeat) return; keys.add(e.code); if (e.code === "Space") { keys.clear(); target = null; command({ speed: 0 }); } else fromKeys(); });
  addEventListener("keyup", (e) => { keys.delete(e.code); fromKeys(); });
  canvas.addEventListener("pointerup", (e) => { // tap: walk there (the view is centred on him, ~6 m across)
    const k = Math.min(innerWidth, innerHeight) / 6, h = cur.P[0];
    target = [h[0] + (e.clientX - innerWidth / 2) / k, h[2] + (e.clientY - innerHeight * 0.62) / (k * 0.35)];
  });

  async function generate() {
    busy = true;
    try {
      if (target) { const h = cur.P[0], d = Math.hypot(target[0] - h[0], target[1] - h[2]);
        Object.assign(cmd, d < 0.6 ? { speed: 0 } : { speed: 1.4, heading: Math.atan2(target[0] - h[0], target[1] - h[2]) }); if (d < 0.6) target = null; }
      const s = await me.step(cmd);
      if (s) { queue.push(...s.frames); times.push(s.ms); if (times.length > 5) times.shift(); }
    } finally { busy = false; }
  }

  function tick(now: number) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    clock += dt * 30;
    while (clock >= 1 && queue.length) { prev = cur; cur = queue.shift()!; clock -= 1; }
    if (clock >= 1) clock = 0; // nothing queued: hold the pose (the device is slower than real time)
    if (!busy && queue.length < Math.max(18, queueTarget())) generate().catch((e) => say(`Motion stopped: ${errorMessage(e)}`));
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== innerWidth * dpr) { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, lerp(prev, cur, Math.min(1, clock)), rt.soma.PARENTS, innerWidth, innerHeight);
    requestAnimationFrame(tick);
  }
  say(`WASD / arrows to walk, Shift to run, Space to stop, or tap. A generation takes ~${Math.round(est())} ms here.`);
  requestAnimationFrame(tick);
}

start().catch((e) => {
  if (BENCH) console.log(`MOTIONII_FAIL ${JSON.stringify({ why: errorMessage(e) })}`);
  say(`This device can't run the motion model: ${errorMessage(e)}`);
});
