// Claude Code `Stop` hook: refuse to let the agent finish while typecheck or tests are red.
// Exit 2 blocks the stop and feeds stderr back to the agent; exit 0 lets it finish.
// Loop guard: if the hook already blocked once in this turn (stop_hook_active), let it through.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let active = false;
try {
  const text = readFileSync(0, "utf8").replace(/^﻿/, "").trim(); // tolerate a BOM (Windows PowerShell pipes add one)
  const input = JSON.parse(text || "{}");
  active = input.stop_hook_active === true;
} catch { /* no stdin payload: run the gate */ }
if (active) process.exit(0);

const steps: [string, string[]][] = [
  ["typecheck", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  ["unit tests", ["--test", "tests/**/*.test.ts"]],
];
for (const [name, args] of steps) {
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.status !== 0) {
    const tail = (r.stdout + r.stderr).split("\n").filter((l) => /✖|error|fail|not ok/i.test(l)).slice(0, 12).join("\n");
    process.stderr.write(`stop-gate: ${name} is failing, so the work is not finished. Fix it (do not weaken or skip tests) and try again.\n${tail}\n`);
    process.exit(2);
  }
}
process.exit(0);
