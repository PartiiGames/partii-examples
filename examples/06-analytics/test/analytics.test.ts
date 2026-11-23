// Analytics on Partii staging: a session is accepted whole, every drop rule is enforced by the server
// AND caught by checkEvent() first, the closing-page beacon path works, and bad batches are 400s.
// Run: npm test
import { PartiiError } from "@partii/sdk";
import { afterAll, describe, expect, it } from "vitest";
import { checkEvent, createAnalytics, LIMITS } from "../src/analytics";
import { createPartii, envConfig, memoryKV } from "../src/partii";

const cfg = envConfig();
const partii = createPartii(cfg, memoryKV());
const ingest = (body: Record<string, unknown>) => partii.api.analyticsIngest(cfg.game, body) as Promise<{ accepted: number; dropped: number }>;
const base = () => ({ device: partii.deviceId(), platform: "web", version: "1.0.0" });

// Events Partii drops without an error, each with the reason checkEvent gives.
const DROPPED: [string, Record<string, unknown>][] = [
  ["LevelComplete", {}], // uppercase name
  ["level-complete", {}], // a dash in the name
  ["1st_run", {}], // starts with a digit
  ["e".repeat(49), {}], // name over 48
  ["shot", { "hit-pos": 1 }], // dash in a prop key
  ["shot", { "hit.pos": 1 }], // dot in a prop key
  ["shot", { pos: { x: 1, y: 2 } }], // nested object
  ["shot", { hits: [1, 2] }], // array
  ["shot", { target: null }], // null
  ["shot", { dist: Number.NaN }], // NaN
  ["shot", { note: "x".repeat(201) }], // string over 200
  ["shot", Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, "y".repeat(40)]))], // props over 1 KB
];

describe("analytics on staging", () => {
  it("is staging, signed in as a guest (events then carry the player)", async () => {
    expect(cfg.api).toMatch(/staging/);
    await partii.ensurePlayer("Analytics test");
  });

  it("checkEvent refuses exactly what the server drops", async () => {
    for (const [name, props] of DROPPED) expect(checkEvent(name, props), `${name} ${JSON.stringify(props).slice(0, 60)}`).not.toBeNull();
    const ok: [string, Record<string, unknown>][] = [["level_complete", { mission: 12, secs: 81.5, won: true, map: "caves" }], ["ui.open", {}], ["a", { A_b9: "" }]];
    for (const [name, props] of ok) expect(checkEvent(name, props)).toBeNull();
    // Send them all raw: the server keeps the good ones and drops the rest, with NO error.
    const events = [...DROPPED, ...ok].map(([name, props]) => ({ name, props, at: Date.now(), session: "check_drop_rules" }));
    const r = await ingest({ ...base(), events });
    expect(r).toEqual({ ok: true, accepted: ok.length, dropped: DROPPED.length });
  });

  const target = new EventTarget();
  const refused: string[] = [];
  const a = createAnalytics({ partii, version: "1.0.0", build: "test", target, intervalMs: 60_000, onRefused: (n, r) => refused.push(`${n}: ${r}`) });
  afterAll(() => a.stop());

  it("a session: refused events never leave the game; the rest are all accepted", async () => {
    expect(a.track("run_start", {})).toBe(true);
    expect(a.track("Run End", { score: 3 })).toBe(false); // caught here, with a reason
    expect(a.track("run_end", { score: 3, secs: 12.5, cause: "lava" })).toBe(true);
    await a.flush();
    expect(refused).toHaveLength(1);
    expect(a.stats).toMatchObject({ accepted: 3, droppedByServer: 0, droppedHere: 1, failedCalls: 0 });
  });

  it("pagehide: session_end goes out as a beacon (key in the address, token in the body, text/plain)", async () => {
    const sent: { url: string; body: string; status: number; reply: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const res = await realFetch(url, init);
      const reply = await res.clone().text();
      sent.push({ url, body: String(init.body), status: res.status, reply });
      return res;
    }) as typeof fetch;
    try {
      target.dispatchEvent(new Event("pagehide"));
      for (let i = 0; i < 100 && !sent.length; i++) await new Promise((r) => setTimeout(r, 50));
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toContain("?key=pk_");
    const body = JSON.parse(sent[0].body);
    expect(body.events.map((e: { name: string }) => e.name)).toEqual(["session_end"]);
    expect(body.events[0].props.secs).toBeGreaterThanOrEqual(0);
    expect(body.player_token).toBe(partii.token());
    expect(body.player_token).toMatch(/^pt_/);
    expect(sent[0].status).toBe(200);
    expect(JSON.parse(sent[0].reply)).toMatchObject({ accepted: 1, dropped: 0 });
    expect(a.track("after_end")).toBe(false); // the session is over
  });

  it("refuses the whole batch (400, not a silent drop) for a bad device id or over 100 events", async () => {
    for (const device of ["short", "d".repeat(65), "has spaces in it"]) {
      const err = await ingest({ ...base(), device, events: [{ name: "x" }] }).catch((e) => e);
      expect(err).toBeInstanceOf(PartiiError);
      expect(err.status).toBe(400);
    }
    const many = Array.from({ length: LIMITS.eventsPerCall + 1 }, () => ({ name: "x" }));
    await expect(ingest({ ...base(), events: many })).rejects.toMatchObject({ status: 400 });
  });
});
