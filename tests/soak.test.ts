import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "ddl-soak-"));
const soak = (name: string, ...args: string[]) => {
  const out = join(dir, name);
  const r = spawnSync(process.execPath, ["--expose-gc", "scripts/soak.ts", "--out", out, ...args], { encoding: "utf8" });
  return { status: r.status, stderr: r.stderr, json: JSON.parse(readFileSync(out, "utf8")) };
};

test("soak: runs N nights in one process, rotating nights 1-2-3, with the documented output fields", () => {
  const { status, json } = soak("a.json", "--seed", "7", "--nights", "4");
  assert.equal(status, 0);
  assert.equal(json.nights, 4);
  assert.equal(json.crashes, 0);
  assert.equal(json.results.length, 4);
  for (const r of json.results) assert.ok(["won", "lost"].includes(r), `unexpected result ${r}`);
  for (const k of ["mem_start_mb", "mem_end_mb", "duration_s"]) assert.equal(typeof json[k], "number", k);
  assert.ok(json.mem_start_mb > 0 && json.mem_end_mb > 0);
  assert.ok(json.total_ticks > 0);
});

test("soak: same seed, same nights and results (deterministic); a different seed plays differently", () => {
  const a = soak("b1.json", "--seed", "7", "--nights", "6").json;
  const b = soak("b2.json", "--seed", "7", "--nights", "6").json;
  const c = soak("b3.json", "--seed", "99", "--nights", "6").json;
  assert.deepEqual(a.results, b.results);
  assert.equal(a.total_ticks, b.total_ticks);
  assert.notEqual(a.total_ticks, c.total_ticks);
});

test("soak: memory stays within 1.2x over 10 nights (the ticket's pass criterion)", () => {
  const { json } = soak("c.json", "--seed", "7", "--nights", "10");
  assert.equal(json.crashes, 0);
  assert.ok(json.mem_end_mb <= 1.2 * json.mem_start_mb, `${json.mem_start_mb} -> ${json.mem_end_mb} MB`);
});

test("soak: the warm-up is reported openly and does not change the nights that are played", () => {
  const warm = soak("w3.json", "--seed", "7", "--nights", "5").json;
  const cold = soak("w0.json", "--seed", "7", "--nights", "5", "--warmup", "0").json;
  assert.equal(warm.warmup_nights, 3);
  assert.equal(cold.warmup_nights, 0);
  assert.ok(warm.mem_cold_start_mb > 0, "the cold RSS is reported next to the warmed one");
  assert.equal(cold.mem_cold_start_mb, cold.mem_start_mb, "without warm-up the cold start is the start");
  assert.deepEqual(warm.results, cold.results);
  assert.equal(warm.total_ticks, cold.total_ticks);
});

test("soak: invalid arguments exit non-zero", () => {
  const r = spawnSync(process.execPath, ["scripts/soak.ts", "--nights", "0"], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
});
