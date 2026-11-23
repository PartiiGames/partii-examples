#!/usr/bin/env node
// Runs every web example's test against Partii staging, one after another, each with a hard cap.
//   node tools/run-all.mjs                 all of them
//   node tools/run-all.mjs 03 04           only those (by number or folder name)
// Progress: one line per step ("RUN 03-save-load install", "PASS 03-save-load 14 s"). A step that
// prints nothing for 120 s is stopped (the no-progress watchdog), and so is one past its cap.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CAP_MS = { install: 5 * 60_000, test: 4 * 60_000 };
const QUIET_MS = 120_000;
const want = process.argv.slice(2);
const examples = readdirSync(join(root, "examples"))
  .filter((d) => existsSync(join(root, "examples", d, "package.json")))
  .filter((d) => !want.length || want.some((w) => d === w || d.startsWith(`${w}-`)))
  .sort();

function step(dir, label, cmd, args, capMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`RUN  ${label}`);
    const child = spawn(cmd, args, { cwd: dir, env: { ...process.env, CI: "1" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let lastOutput = Date.now();
    const onData = (b) => {
      out += b;
      lastOutput = Date.now();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const watchdog = setInterval(() => {
      const why = Date.now() - started > capMs ? `over its ${capMs / 1000} s cap` : Date.now() - lastOutput > QUIET_MS ? `silent for ${QUIET_MS / 1000} s` : null;
      if (why) {
        out += `\n[run-all] stopped: ${why}\n`;
        child.kill("SIGKILL");
      }
    }, 2000);
    child.on("close", (code) => {
      clearInterval(watchdog);
      resolve({ ok: code === 0, secs: Math.round((Date.now() - started) / 1000), out });
    });
  });
}

const results = [];
for (const name of examples) {
  const dir = join(root, "examples", name);
  const install = await step(dir, `${name} install`, "npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], CAP_MS.install);
  if (!install.ok) {
    console.log(install.out.slice(-3000));
    console.log(`FAIL ${name} install`);
    results.push([name, false]);
    continue;
  }
  const test = await step(dir, `${name} test`, "npm", ["test"], CAP_MS.test);
  if (!test.ok) console.log(test.out.slice(-6000));
  else console.log(test.out.split("\n").filter((l) => /Tests? +\d|passed|skipped/.test(l)).join("\n"));
  // Types too: the SDK is installed by now (pretest), so the example must compile against it.
  const types = await step(dir, `${name} typecheck`, "npx", ["tsc", "--noEmit"], CAP_MS.test);
  if (!types.ok) console.log(types.out.slice(-4000));
  const ok = test.ok && types.ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${name} test ${test.ok ? "ok" : "failed"} ${test.secs} s, typecheck ${types.ok ? "ok" : "failed"}`);
  results.push([name, ok]);
}
const failed = results.filter(([, ok]) => !ok);
console.log(`SUMMARY ${results.length - failed.length}/${results.length} passed${failed.length ? `; failed: ${failed.map(([n]) => n).join(", ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
