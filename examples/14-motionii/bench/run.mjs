// Run the bench folder headless and print its MOTIONII_ lines (hard cap, stall watchdog).
//   node bench/run.mjs [dist-bench] [--gens 30] [--seed 1] [--browser chromium|webkit] [--record out.bin] [--cap 600]
// --serve-only: just serve the folder (open it yourself). --record: the reference run (?record=1): writes the first 30 generations' inputs and outputs (ref30.bin).
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium, webkit } from "playwright";

const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const dir = a[0] && !a[0].startsWith("--") ? a[0] : "dist-bench";
const gens = +opt("--gens", 30), seed = +opt("--seed", 1), record = opt("--record", null), cap = +opt("--cap", 600) * 1000;
const T = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".md": "text/plain" };
const srv = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const f = join(dir, p === "/" ? "index.html" : p);
  let body; try { body = readFileSync(f); } catch { return void res.writeHead(404).end(); }   // read first, then answer
  res.writeHead(200, { "Content-Type": T[extname(f)] ?? "application/octet-stream" }).end(body);
}).listen(0, "127.0.0.1");
await new Promise((r) => srv.on("listening", r));
if (a.includes("--serve-only")) { console.log(`serving ${dir} at http://127.0.0.1:${srv.address().port}/`); await new Promise(() => {}); }
const kind = opt("--browser", "chromium");
const browser = await (kind === "webkit" ? webkit : chromium).launch(kind === "webkit" ? {} : { channel: "chromium", args: ["--enable-unsafe-webgpu", "--ignore-gpu-blocklist"] });
let last = Date.now(), code = 1;
const stop = async (c, why) => { if (why) console.log(why); code = c; await browser.close().catch(() => {}); srv.close(); process.exit(code); };
setTimeout(() => stop(1, `CAP: no result in ${cap / 1000} s`), cap);
setInterval(() => { if (Date.now() - last > 180_000) stop(1, "STALL: no console line for 180 s"); }, 5000);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
let errs = 0; const err = (t) => { if (++errs <= 5) console.log(t.slice(0, 400)); else if (errs % 100 === 0) console.log(`(${errs} page errors so far)`); };
page.on("console", (m) => { last = Date.now(); const t = m.text();
  if (t.startsWith("MOTIONII_")) console.log(t); else if ((m.type() === "error" && !t.startsWith("Failed to load resource")) || /panicked at/.test(t)) err(`console ${t}`); // failed loads: counted with their URL below
  if (t.startsWith("MOTIONII_FAIL")) stop(1); });
page.on("pageerror", (e) => err(`pageerror ${e.message}`));
page.on("response", (r) => { if (r.status() >= 400) err(`console HTTP ${r.status()} ${r.url()}`); }); // which resource failed // a wasm trap repeats every generation: print the first few, then count
const port = srv.address().port;
await page.goto(`http://127.0.0.1:${port}/index.html?bench&headless=1&seed=${seed}&gens=${gens}${record ? "&record=1" : ""}`);
if (record) {
  const b64 = await page.waitForFunction(() => window.__ref, null, { timeout: cap, polling: 1000 }).then((h) => h.jsonValue());
  writeFileSync(record, Buffer.from(b64, "base64"));
  console.log(`recorded ${record} (${(Buffer.from(b64, "base64").length / 1e6).toFixed(2)} MB)`);
  await stop(0);
}
const done = await page.waitForFunction(() => window.__motionii, null, { timeout: cap, polling: 1000 }).then((h) => h.jsonValue());
if (errs) console.log(`${errs} page errors`);
await stop(!errs && (done.tol === null || done.tol.ok) ? 0 : 1);
