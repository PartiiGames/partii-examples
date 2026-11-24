// The page in headless Chromium against Partii staging: it builds the humanoid from the pinned hlab
// URL, clothed and adult; W walks, Shift+W runs, letting go stands (by the clips' weights, and the
// root moves forward); a guest signs in and the spawn event is accepted with nothing dropped. Plus:
// the import map pins exact versions. The whole file has a 90 s cap (a watchdog). Run: npm test
// HLAB_SHOT=walk.png npm test also saves a screenshot of the humanoid walking.
import { readFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const imports: Record<string, string> = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]).imports;
const HLAB = imports.hlab;

describe("the import map", () => {
  it("pins exact versions: three 0.170.0 for the page and hlab alike, and one hlab release", () => {
    expect(imports.three).toBe("https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js");
    expect(imports["three/addons/"]).toBe("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/");
    // An exact release (1.0.0 or 1.0.0-rc7.1), never "latest" or a range.
    expect(HLAB).toMatch(/^https:\/\/[a-z.-]+\.partii\.games\/_partii\/hlab\/\d+\.\d+\.\d+(-[a-z]+\d+(\.\d+)*)?\/hlab\.js$/);
    // The hlab URL lives in index.html only: moving to production is a one-line change.
    for (const f of ["main.ts", "libs.ts", "controller.ts"]) expect(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).not.toContain("/_partii/hlab/");
  });
});

// A hard cap for everything below: a hung browser or server can't hold the run.
const CAP_MS = 90_000;
const started = Date.now();
let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let page: Page;
const watchdog = setTimeout(() => {
  console.error(`[watchdog] over the ${CAP_MS / 1000} s cap: stopping`);
  void browser?.close();
  void server?.close();
  process.exit(1);
}, CAP_MS);
const left = (ms: number) => Math.max(1000, Math.min(ms, CAP_MS - 5000 - (Date.now() - started)));

type Weights = { idle: number; walk: number; run: number };
const state = () =>
  page.evaluate(() => {
    const { h, controller } = (window as any).__hlab;
    return { w: controller.weights() as Weights, x: h.scene.position.x as number, z: h.scene.position.z as number, yaw: h.scene.rotation.y as number };
  });
const until = (gait: keyof Weights) =>
  page.waitForFunction((g) => (window as any).__hlab?.controller.weights()[g] > 0.99, gait, { timeout: left(15_000), polling: 50 });

describe("one hlab humanoid on staging", () => {
  const requests: string[] = [];
  const problems: string[] = [];

  beforeAll(async () => {
    server = await createServer({ root: new URL("..", import.meta.url).pathname, mode: "staging", logLevel: "error", server: { port: 5175 } });
    await server.listen();
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => problems.push(e.message));
    await page.goto(`${server.resolvedUrls!.local[0]}?tier=game`);
    await page.waitForFunction(() => (window as any).__hlab, null, { timeout: left(70_000), polling: 200 });
  }, CAP_MS);

  afterAll(async () => {
    clearTimeout(watchdog);
    await browser?.close();
    await server?.close();
  });

  it("builds the humanoid from the pinned hlab URL, on the page's one three", async () => {
    expect(problems).toEqual([]);
    expect(requests).toContain(HLAB);
    expect(requests.filter((u) => /three(@|\/build\/)/.test(u) && /three\.module(\.min)?\.js$/.test(u))).toEqual([imports.three]);
    const got = await page.evaluate(() => {
      const { h } = (window as any).__hlab;
      let skinned = 0;
      h.scene.traverse((o: any) => (skinned += o.isSkinnedMesh ? 1 : 0));
      return { skinned, clips: h.animations.map((a: any) => a.name), tier: h.tier };
    });
    expect(got.skinned).toBeGreaterThan(0);
    expect(got.clips).toEqual(expect.arrayContaining(["idle", "walk", "run"]));
    expect(got.tier).toBe("game");
  });

  it("is an adult, clothed: a top and trousers on (the Partii content profile)", async () => {
    const spec = await page.evaluate(() => (window as any).__hlab.h.spec);
    expect(spec.body.age_years).toBeGreaterThanOrEqual(18);
    expect(spec.no_top ?? false).toBe(false);
    // Library garments by asset name (e.g. sweatshirt-crew, jeans-straight, sneaker-low), kit ones by piece.
    const worn = spec.clothing.map((g: { asset?: string; kit?: object }) => `${g.asset ?? ""} ${JSON.stringify(g.kit ?? "")}`).join(" | ");
    expect(worn).toMatch(/tee|shirt|sweat|hoodie|bomber|jacket|top|coat|suit/i);
    expect(worn).toMatch(/jeans|chino|trouser|pants|suit/i);
    expect(worn).toMatch(/sneaker|loafer|boot|shoe/i);
  });

  it("W walks, Shift+W runs, letting go stands: the clips' weights switch and the root moves forward", async () => {
    await page.click("canvas"); // focus, so the keys reach the page
    expect((await state()).w.idle).toBeGreaterThan(0.99);

    await page.keyboard.down("w");
    await until("walk");
    const a = await state();
    await page.waitForTimeout(800);
    const b = await state();
    expect(b.w.walk).toBeGreaterThan(0.99);
    expect(a.z - b.z).toBeGreaterThan(0.2); // W is away from the camera: -z
    expect(Math.abs(Math.cos(b.yaw) + 1)).toBeLessThan(0.05); // turned to face it

    await page.keyboard.down("Shift");
    await until("run");
    const c = await state();
    await page.waitForTimeout(800);
    const d = await state();
    expect(d.w.run).toBeGreaterThan(0.99);
    expect(c.z - d.z).toBeGreaterThan(0.2);

    await page.keyboard.up("w");
    await page.keyboard.up("Shift");
    await until("idle");
    const e = await state();
    await page.waitForTimeout(400);
    const f = await state();
    expect(Math.hypot(f.x - e.x, f.z - e.z)).toBeLessThan(0.01); // stands still

    if (process.env.HLAB_SHOT) {
      // A picture of it walking, side on (D walks to the right of the screen).
      await page.keyboard.down("d");
      await until("walk");
      await page.waitForTimeout(700);
      await page.screenshot({ path: process.env.HLAB_SHOT });
      await page.keyboard.up("d");
    }
  }, CAP_MS);

  it("signs in this device's guest and the spawn event is accepted, 0 dropped", async () => {
    const got = await page.evaluate(async () => {
      const { partii, analytics, sent } = (window as any).__hlab;
      await sent;
      return { player: partii.player(), stats: analytics.stats };
    });
    expect(got.player.id).toMatch(/^p_/);
    expect(got.player.guest).toBe(true);
    expect(got.stats).toMatchObject({ droppedHere: 0, droppedByServer: 0, failedCalls: 0 });
    expect(got.stats.accepted).toBeGreaterThanOrEqual(2); // session_start and humanoid_spawned
  });
});
