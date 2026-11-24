// Builds dist-bench/: the ?bench page as ONE static folder with the runtime inside it (own origin only, relative
// paths), the way partii-runtime's corpus serves it (games/motionii-bench/). The runtime comes from Partii's hosting
// (or MOTIONII_RELEASE=<local folder>) and is checked against its SHA256SUMS.
//   npm run bench            then serve dist-bench/ and open index.html?bench&gens=30
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const VERSION = "0.1.0";
const BASE = process.env.MOTIONII_BASE ?? `https://api-staging.partii.games/_partii/motionii/${VERSION}/`;
const out = "dist-bench", rt = join(out, "motionii", VERSION);
execFileSync("npx", ["vite", "build", "--mode", "staging", "--base", "./", "--outDir", out, "--emptyOutDir"], {
  stdio: "inherit", env: { ...process.env, VITE_MOTIONII_BASE: `./motionii/${VERSION}/` },
});
const get = async (f) => {
  if (process.env.MOTIONII_RELEASE) return readFileSync(join(process.env.MOTIONII_RELEASE, f));
  const r = await fetch(new URL(f, BASE));
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
};
const sums = (await get("SHA256SUMS")).toString().trim().split("\n").map((l) => l.split(/\s+/));
for (const [sha, f] of sums) {
  const b = await get(f);
  if (createHash("sha256").update(b).digest("hex") !== sha) throw new Error(`${f}: SHA256 mismatch`);
  mkdirSync(dirname(join(rt, f)), { recursive: true });
  writeFileSync(join(rt, f), b);
  console.log(`ok ${f} (${(b.length / 1e6).toFixed(1)} MB)`);
}
copyFileSync("bench/expected.json", join(out, "expected.json"));
writeFileSync(join(out, "BENCH.md"), readFileSync("bench/BENCH.md"));
console.log(`${out}/ is the corpus folder: serve it over http, open index.html?bench&gens=300 (or 30).`);

