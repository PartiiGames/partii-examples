#!/usr/bin/env node
// Installs Partii's TypeScript web SDK into ./partii-sdk/ (like `npm install`, not a copy you edit).
// Partii publishes it at https://partii.games/docs/sdk-ts/ (client.ts, generated.ts, buy.ts); there is
// no npm package yet. partii-sdk/ is gitignored: never commit it, never edit it. Import it as
// "@partii/sdk" (client) and "@partii/sdk/buy" (tsconfig paths + vite alias).
//
//   node get-sdk.mjs            fetch if missing (npm's pretest/predev/prebuild run this)
//   node get-sdk.mjs --update   fetch again (Partii changed the SDK)
//   node get-sdk.mjs --check    exit 1 when the published SDK differs from what's installed
//
// PARTII_SDK_URL points at another copy (staging: https://staging.partii.games/docs/sdk-ts/).
// Every example has this same file (partii-examples tools/check.mjs keeps them identical).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = (process.env.PARTII_SDK_URL ?? "https://partii.games/docs/sdk-ts/").replace(/\/?$/, "/");
const FILES = ["client.ts", "generated.ts", "buy.ts", "site.ts", "room-events.ts"];
const dir = join(dirname(fileURLToPath(import.meta.url)), "partii-sdk");
const stampFile = join(dir, "SDK.json");
const mode = process.argv[2] ?? "";
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function fetchOne(name) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await fetch(SOURCE + name, { signal: ctl.signal });
    const text = await res.text();
    // The site answers unknown paths with its HTML page and status 200: that is not the SDK.
    if (!res.ok || /^\s*<(!doctype|html)/i.test(text) || !/export /.test(text)) {
      throw new Error(`${SOURCE}${name} is not the SDK (status ${res.status}); is PARTII_SDK_URL right?`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const installed = existsSync(stampFile) ? JSON.parse(readFileSync(stampFile, "utf8")) : null;
if (mode === "" && installed && FILES.every((f) => existsSync(join(dir, f)))) process.exit(0);

const got = Object.fromEntries(await Promise.all(FILES.map(async (f) => [f, await fetchOne(f)])));
const files = Object.fromEntries(FILES.map((f) => [f, sha(got[f])]));

if (mode === "--check") {
  const changed = FILES.filter((f) => installed?.files?.[f] !== files[f]);
  if (changed.length) {
    console.error(`partii-sdk: the published SDK changed (${changed.join(", ")}). Run: node get-sdk.mjs --update, then npm test`);
    process.exit(1);
  }
  console.log("partii-sdk: up to date");
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
for (const f of FILES) writeFileSync(join(dir, f), got[f]);
writeFileSync(stampFile, JSON.stringify({ source: SOURCE, fetched_at: new Date().toISOString(), files }, null, 2) + "\n");
console.log(`partii-sdk: installed ${FILES.join(", ")} from ${SOURCE}`);
