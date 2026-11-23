#!/usr/bin/env node
// The library's own checks (no network): every index.json row points at a folder with a README.md,
// a TRAPS.md and a test; the shared files are identical in every web example; no secret slipped in.
// Run: node tools/check.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8"));
const ids = new Set();
for (const ex of index.examples) {
  for (const k of ["id", "title", "tags", "when", "language", "engine", "path", "status"]) if (!(k in ex)) problems.push(`index.json ${ex.id ?? "?"}: missing ${k}`);
  if (ids.has(ex.id)) problems.push(`index.json: duplicate id ${ex.id}`);
  ids.add(ex.id);
  if (ex.status === "placeholder") continue;
  const dir = join(root, ex.path);
  if (!existsSync(dir)) {
    problems.push(`${ex.id}: ${ex.path} missing`);
    continue;
  }
  for (const f of ["README.md", "TRAPS.md"]) if (!existsSync(join(dir, f))) problems.push(`${ex.id}: no ${f}`);
  if (!ex.test) problems.push(`${ex.id}: index.json has no test command`);
}

const SHARED = { "get-sdk.mjs": "tools/get-sdk.mjs", "src/partii.ts": "examples/01-starter-shell/src/partii.ts", "vite.config.ts": "examples/01-starter-shell/vite.config.ts", "tsconfig.json": "examples/01-starter-shell/tsconfig.json" };
for (const name of readdirSync(join(root, "examples"))) {
  const dir = join(root, "examples", name);
  if (!existsSync(join(dir, "package.json"))) continue;
  for (const [f, canon] of Object.entries(SHARED)) {
    if (readFileSync(join(dir, f), "utf8") !== readFileSync(join(root, canon), "utf8")) problems.push(`${name}/${f} differs from ${canon}`);
  }
  if (!existsSync(join(dir, "test")) || !readdirSync(join(dir, "test")).some((f) => f.endsWith(".test.ts"))) problems.push(`${name}: no test/*.test.ts`);
}
const a1 = join(root, "examples/01-starter-shell/src/analytics.ts");
if (readFileSync(a1, "utf8") !== readFileSync(join(root, "examples/06-analytics/src/analytics.ts"), "utf8")) problems.push("01 and 06 analytics.ts differ");

// Secrets: only publishable keys (pk_) may appear. Developer (dt_), player (pt_) and Stripe keys never.
const SECRET = /\b(dt_[A-Za-z0-9._-]{12,}|pt_[A-Za-z0-9._-]{20,}|sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,})/;
const walk = (d) => {
  for (const n of readdirSync(d)) {
    if (["node_modules", ".git", "partii-sdk", "dist", "dist-prod"].includes(n)) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (statSync(p).size < 2_000_000 && SECRET.test(readFileSync(p, "utf8"))) problems.push(`possible secret in ${p.slice(root.length + 1)}`);
  }
};
walk(root);

if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join("\n"));
  process.exit(1);
}
console.log(`ok: ${index.examples.length} examples in index.json; shared files identical; no secrets`);
