import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "src/headless/cli.ts";

test("cli exits 0 and writes output file", () => {
  const dir = mkdtempSync(join(tmpdir(), "ddl-"));
  const out = join(dir, "run.jsonl");
  const r = spawnSync(process.execPath, [cli, "--seed", "1", "--night", "1", "--ticks", "10", "--out", out]);
  assert.equal(r.status, 0);
  assert.ok(readFileSync(out, "utf8").length > 0);
});

test("cli exits non-zero on missing args", () => {
  const r = spawnSync(process.execPath, [cli]);
  assert.notEqual(r.status, 0);
});
