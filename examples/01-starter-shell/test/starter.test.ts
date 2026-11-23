// The starter shell against Partii staging: a guest signs in (and stays the same player), the
// analytics session is accepted with nothing dropped, a script error is reported, and the tsconfig
// keeps useDefineForClassFields off. Run: npm test
import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";
import { createAnalytics } from "../src/analytics";
import { installErrorReporting } from "../src/errors";
import { createPartii, envConfig, memoryKV } from "../src/partii";

const cfg = envConfig();
const store = memoryKV();
const partii = createPartii(cfg, store);

describe("starter shell on staging", () => {
  it("talks to staging, never production, in tests", () => {
    expect(cfg.api).toMatch(/staging/);
  });

  it("signs in as this device's guest, and the same device stays the same player", async () => {
    const p = await partii.ensurePlayer("Starter test");
    expect(p.id).toMatch(/^p_/);
    expect(p.guest).toBe(true);
    // A second launch on the same device: the saved token is reused.
    const again = createPartii(cfg, store);
    expect((await again.ensurePlayer()).id).toBe(p.id);
    // The token lost (storage cleared, token expired): the device id still lands on the same player.
    const noToken = memoryKV();
    noToken.set(`${cfg.game}.partii.device`, partii.deviceId());
    expect((await createPartii(cfg, noToken).ensurePlayer()).id).toBe(p.id);
  });

  const target = new EventTarget();
  const refused: string[] = [];
  const analytics = createAnalytics({ partii, version: "0.1.0", build: "test", target, onRefused: (n, r) => refused.push(`${n}: ${r}`) });
  afterAll(() => analytics.stop());

  it("sends a session: session_start, a run, session_end; the server keeps all of it", async () => {
    analytics.track("run_start", {});
    analytics.track("run_end", { score: 12, secs: 3.5, cause: "lava" });
    await analytics.flush();
    expect(analytics.stats.failedCalls).toBe(0);
    expect(analytics.stats.droppedByServer).toBe(0);
    expect(analytics.stats.accepted).toBe(3);
    expect(refused).toEqual([]);
  });

  it("reports a script error and gets its group back", async () => {
    const reporter = installErrorReporting({ partii, version: "0.1.0", session: analytics.session, target: new EventTarget() });
    const groups = await reporter.report("starter test error: boom", "Error: boom\n    at drawFrame (main.ts:40:3)");
    reporter.stop();
    expect(groups).toHaveLength(1);
    expect(groups![0]).toMatch(/^[0-9a-f]{24}$/);
  });
});

describe("tsconfig", () => {
  it("keeps useDefineForClassFields false", () => {
    const text = readFileSync(new URL("../tsconfig.json", import.meta.url), "utf8");
    const parsed = ts.parseConfigFileTextToJson("tsconfig.json", text);
    expect(parsed.config.compilerOptions.useDefineForClassFields).toBe(false);
  });

  it("shows why: with it on, a declared field wipes what the base class set", () => {
    const source = `
      class Base { body: any; constructor() { this.init(); } init() {} }
      class Player extends Base { body!: { ok: boolean }; init() { this.body = { ok: true }; } }
      export const body = new Player().body;`;
    const run = (useDefine: boolean) => {
      const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, useDefineForClassFields: useDefine } }).outputText;
      const mod = { exports: {} as { body?: unknown } };
      new Function("module", "exports", js)(mod, mod.exports);
      return mod.exports.body;
    };
    expect(run(false)).toEqual({ ok: true });
    expect(run(true)).toBeUndefined(); // the physics body is gone, and nothing said so
  });
});
