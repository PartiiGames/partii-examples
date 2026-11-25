// Motionii against Partii staging: the hosted runtime release is complete (licence and notice beside the weights,
// every file matching SHA256SUMS), and in a headless browser with WebGPU the page loads it and runs 30 generations
// whose outputs match the reference run within 0.24° with the same token counts. Run: npm test
// Needs a browser with WebGPU: `npx playwright install chromium` once. Hard caps: 30 s per call, 10 min in all.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";
import { createPartii, envConfig, memoryKV } from "../src/partii";

// the runtime on the API this test runs against (staging: the test asserts it below)
const BASE = `${envConfig().api.replace(/\/+$/, "")}/_partii/motionii/0.1.0/`;
const expected = JSON.parse(readFileSync("bench/expected.json", "utf8"));

describe("motionii on staging", () => {
  it("talks to staging, and signs in as a guest", async () => {
    const cfg = envConfig();
    expect(cfg.api).toMatch(/staging/);
    expect((await createPartii(cfg, memoryKV()).ensurePlayer("Motionii test")).guest).toBe(true);
  });

  it("the runtime release: licence and notice beside the weights, every small file matches SHA256SUMS", async () => {
    const sums = (await (await fetch(BASE + "SHA256SUMS")).text()).trim().split("\n").map((l) => l.split(/\s+/));
    const files = sums.map(([, f]) => f);
    for (const f of ["model/LICENSE-NVIDIA-Open-Model-Agreement.txt", "model/NOTICE.txt", "CREDITS.txt", "wasm/motionii_web_bg.wasm"]) expect(files).toContain(f);
    for (const [sha, f] of sums) {
      if (f.endsWith(".shards")) continue; // 226 MB: the browser test below loads it
      const b = Buffer.from(await (await fetch(BASE + f)).arrayBuffer());
      expect(createHash("sha256").update(b).digest("hex"), f).toBe(sha);
    }
    expect(await (await fetch(BASE + "model/NOTICE.txt")).text()).toMatch(/NVIDIA Open Model Agreement/);
  });

  it("runs 30 generations in a headless browser, matching the reference within 0.24°", { timeout: 600_000 }, async () => {
    execFileSync("npx", ["vite", "build", "--mode", "staging", "--logLevel", "error"], { stdio: "inherit" });
    const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };
    const srv = createServer((req, res) => {
      const p = new URL(req.url ?? "/", "http://x").pathname, f = join("dist", p === "/" ? "index.html" : p);
      let body: Buffer; try { body = readFileSync(f); } catch { return void res.writeHead(404).end(); } // read first, then answer
      res.writeHead(200, { "Content-Type": types[extname(f)] ?? "application/octet-stream" }).end(body);
    });
    // with a host, listen() binds asynchronously: wait for it before reading the port
    await new Promise<void>((ok, fail) => { srv.once("error", fail); srv.listen(0, "127.0.0.1", () => ok()); });
    const port = (srv.address() as { port: number }).port;
    let tick: ReturnType<typeof setInterval> | undefined;
    const browser = await chromium.launch({ channel: "chromium", args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan", "--ignore-gpu-blocklist"] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const lines: string[] = [];
      const errors: string[] = []; // page errors and failed requests: the run must have none
      page.on("console", (m) => { if (m.text().startsWith("MOTIONII_")) { lines.push(m.text()); console.log(m.text().slice(0, 160)); } });
      page.on("pageerror", (e) => errors.push(`pageerror ${e.message.slice(0, 300)}`));
      page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
      await page.goto(`http://127.0.0.1:${port}/?bench&gens=30&headless=1`);
      // progress for watchdogs (the 226 MB download takes minutes): the page's status line every 15 s
      tick = setInterval(() => page.textContent("#status").then((t) => console.log(`status: ${t}`), () => {}), 15_000);
      await page.waitForFunction(() => (window as unknown as { __motionii?: object }).__motionii || document.body.textContent?.includes("can't run"), null, { timeout: 540_000 });
      const fail = lines.find((l) => l.startsWith("MOTIONII_FAIL"));
      expect(fail, fail).toBeUndefined();
      const done = JSON.parse(lines.find((l) => l.startsWith("MOTIONII_DONE"))!.slice(14));
      expect(lines.filter((l) => l.startsWith("MOTIONII_GEN"))).toHaveLength(30);
      expect(done.tol.ok, JSON.stringify(done.tol)).toBe(true);
      expect(errors, errors.join("\n")).toEqual([]);
      const want = expected.hashes[done.adapter]?.["30"];
      if (want) expect(done.hash).toBe(want); // a new adapter passes on tol; add its hashes to bench/expected.json
      else console.log(`new adapter ${done.adapter}: hash ${done.hash} (tol ok)`);
    } finally { clearInterval(tick); await browser.close(); srv.close(); }
  });
});
