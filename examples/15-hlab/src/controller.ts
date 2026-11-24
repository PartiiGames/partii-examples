// WASD on hlab's in-place clips: idle, walk and run crossfaded, the root moved here at the speed
// each clip was made for (so the feet don't slide), the body turning toward where it's heading.
// No DOM and no renderer in here (main.ts has those).
// Game code: copy it, and stamp the copy with
//   // copied from PartiiGames/partii-examples@<sha> examples/15-hlab/src/controller.ts
import type * as T from "three";
import { THREE, type Humanoid } from "./libs";

export const GAITS = ["idle", "walk", "run"] as const;
export type Gait = (typeof GAITS)[number];

export class Controller {
  readonly root: T.Object3D;
  readonly mixer: T.AnimationMixer;
  readonly actions: Record<Gait, T.AnimationAction>;
  /** Metres a second each clip's feet travel at the built height (idle: 0). */
  readonly speed: Record<Gait, number>;
  readonly keys = new Set<string>();
  gait: Gait = "idle";

  constructor(h: Humanoid, { fade = 0.25, turnRate = 10 } = {}) {
    this.fade = fade;
    this.turnRate = turnRate;
    this.root = h.scene;
    this.mixer = new THREE.AnimationMixer(h.scene);
    const clip = (name: Gait) => {
      const c = h.animations.find((a) => a.name === name);
      if (!c) throw new Error(`the humanoid has no "${name}" clip`);
      return this.mixer.clipAction(c);
    };
    this.actions = { idle: clip("idle"), walk: clip("walk"), run: clip("run") };
    // hlab's clips are in place: their root motion was taken out and written down per clip.
    // `motion` is an object by clip name, or a list of {name, speed} in some builds.
    const of = (name: string) => (Array.isArray(h.motion) ? h.motion.find((m) => m.name === name) : h.motion?.[name]) ?? {};
    this.speed = { idle: 0, walk: of("walk").speed || 1.4, run: of("run").speed || 4.2 };
    this.actions.idle.play();
  }

  readonly fade: number;
  readonly turnRate: number;

  bind(target: Window): this {
    target.addEventListener("keydown", (e) => this.keys.add(e.code));
    target.addEventListener("keyup", (e) => this.keys.delete(e.code));
    target.addEventListener("blur", () => this.keys.clear()); // or a key stays down forever
    return this;
  }

  /** Where the keys point, on the ground (W is away from the camera), or null. */
  heading(): { x: number; z: number } | null {
    const k = this.keys;
    const x = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    const z = (k.has("KeyS") ? 1 : 0) - (k.has("KeyW") ? 1 : 0);
    const len = Math.hypot(x, z);
    return len ? { x: x / len, z: z / len } : null;
  }

  private play(next: Gait) {
    if (next === this.gait) return;
    const from = this.actions[this.gait];
    const to = this.actions[next];
    // reset() is not optional: a faded-out action ends disabled, and fadeIn() alone leaves it at
    // weight 0 (the body freezes, no error). Walk <-> run keep the stride's phase, so the feet
    // carry on from where they were.
    const phase = this.gait !== "idle" && next !== "idle" ? from.time / from.getClip().duration : 0;
    to.reset();
    to.time = phase * to.getClip().duration;
    to.play();
    to.crossFadeFrom(from, this.fade, false);
    this.gait = next;
  }

  /** Each clip's weight right now (what the body is showing). */
  weights(): Record<Gait, number> {
    return { idle: this.actions.idle.getEffectiveWeight(), walk: this.actions.walk.getEffectiveWeight(), run: this.actions.run.getEffectiveWeight() };
  }

  update(dt: number) {
    const dir = this.heading();
    const running = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    this.play(!dir ? "idle" : running ? "run" : "walk");
    this.mixer.update(dt);
    if (dir) {
      // Turn toward the heading the short way round, smoothly (frame-rate independent).
      const want = Math.atan2(dir.x, dir.z);
      const turn = Math.atan2(Math.sin(want - this.root.rotation.y), Math.cos(want - this.root.rotation.y));
      this.root.rotation.y += turn * (1 - Math.exp(-this.turnRate * dt));
    }
    // The root moves by what the clips show: during a crossfade, the blend of their speeds. The
    // clips carry no root motion of their own, so this is the only place it is applied. Speeds
    // are for the built size: a scaled root walks scale times as far per step.
    const w = this.weights();
    const v = (w.walk * this.speed.walk + w.run * this.speed.run) * this.root.scale.y;
    this.root.position.x += Math.sin(this.root.rotation.y) * v * dt;
    this.root.position.z += Math.cos(this.root.rotation.y) * v * dt;
  }
}
