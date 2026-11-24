// three and hlab, from the page's import map (index.html), never from npm. hlab imports "three"
// itself through that map: if Vite bundled its own three as well, the page would hold two copies
// and hlab's meshes would be drawn by a renderer from the other one. So the import() below goes
// through a variable: Vite leaves it to the browser, and the browser resolves it with the map.
// Only three's types come from npm (@types/three 0.170.0).
import type * as ThreeNS from "three";

const fromImportMap = <T>(specifier: string): Promise<T> => import(/* @vite-ignore */ specifier);

/** What a hlab character is (the header of hlab.js documents the whole API). */
export interface Humanoid {
  scene: ThreeNS.Group;
  animations: ThreeNS.AnimationClip[];
  /** What was built: the Partii profile has already made it an adult, clothed and shod. */
  spec: { body: { age_years: number; femininity: number; height_m: number }; clothing: { kind: string; asset?: string }[]; no_top?: boolean };
  /** Per clip, the root motion taken out of it: `speed` (m/s) for walk and run. */
  motion: Record<string, { speed?: number; turn_deg?: number }> | { name: string; speed?: number }[] | null;
  tier: string;
  generate_ms: number;
  look: { exposure: number; settle(): void; update(): void; patched: { timedOut?: unknown[] } } | null;
}

export interface Hlab {
  createHumanoid(spec: object, o?: { tier?: string; look?: boolean | object }): Promise<Humanoid>;
  setupHlabScene(renderer: ThreeNS.WebGLRenderer, scene: ThreeNS.Scene): Promise<{ setExposure(e: number): void; remove(): void }>;
}

export const THREE = await fromImportMap<typeof ThreeNS>("three");
export const hlab = await fromImportMap<Hlab>("hlab");
