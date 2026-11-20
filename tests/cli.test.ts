import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "src/headless/cli.ts";
const dir = mkdtempSync(join(tmpdir(), "ddl-cli-"));
const file = (name: string, body: string) => {
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
};
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

test("output is JSONL: snapshots from tick 0, last line is the end record", () => {
  const out = join(dir, "a.jsonl");
  const r = run("--seed", "1", "--night", "1", "--ticks", "100", "--out", out);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[0].type, "snapshot");
  assert.equal(lines[0].tick, 0);
  const last = lines[lines.length - 1];
  assert.equal(last.type, "end");
  assert.equal(last.ticks, 100);
  assert.ok(["playing", "won", "lost"].includes(last.state));
  assert.equal(typeof last.score, "number");
});

test("coordinates are rounded to 3 decimals", () => {
  const out = join(dir, "r.jsonl");
  const inputs = file("in-r.json", JSON.stringify({ frames: [{ tick: 0, move: [1, 1], cam_yaw_deg: 33 }] }));
  const r = run("--seed", "9", "--night", "1", "--ticks", "200", "--inputs", inputs, "--out", out);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!/\d\.\d{4,}/.test(readFileSync(out, "utf8")), "found a number with more than 3 decimals");
});

test("two CLI runs with the same arguments are byte-identical", () => {
  const sc = file("sc.json", JSON.stringify({ random_shades: true }));
  const inputs = file("in.json", JSON.stringify({ frames: [{ tick: 0, move: [0, 1] }, { tick: 300, pulse: true }, { tick: 301, pulse: false }] }));
  const a = join(dir, "d1.jsonl");
  const b = join(dir, "d2.jsonl");
  for (const o of [a, b]) {
    const r = run("--seed", "123", "--night", "1", "--scenario", sc, "--inputs", inputs, "--ticks", "1200", "--out", o);
    assert.equal(r.status, 0, r.stderr);
  }
  assert.equal(readFileSync(a, "utf8"), readFileSync(b, "utf8"));
});

test("stops early when the game ends and still exits 0", () => {
  const sc = file("dawn.json", JSON.stringify({ random_motes: false, random_shades: false, time_left_s: 1 }));
  const out = join(dir, "dawn.jsonl");
  const r = run("--seed", "1", "--night", "1", "--scenario", sc, "--ticks", "5000", "--out", out);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const last = lines[lines.length - 1];
  assert.deepEqual([last.type, last.ticks, last.state], ["end", 60, "lost"]);
});

test("malformed inputs => exit 2 with message on stderr", () => {
  const out = join(dir, "bad.jsonl");
  for (const [name, body] of [
    ["not-json.json", "{oops"],
    ["no-frames.json", JSON.stringify({ nope: 1 })],
    ["same-tick.json", JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] })],
    ["backwards.json", JSON.stringify({ frames: [{ tick: 9 }, { tick: 3 }] })],
    ["move-range.json", JSON.stringify({ frames: [{ tick: 0, move: [2, 0] }] })],
  ] as const) {
    const r = run("--seed", "1", "--night", "1", "--ticks", "10", "--inputs", file(name, body), "--out", out);
    assert.equal(r.status, 2, `${name}: expected exit 2, got ${r.status}`);
    assert.ok(r.stderr.length > 0, `${name}: expected a stderr message`);
  }
});

test("malformed scenario => exit 2", () => {
  const out = join(dir, "bad2.jsonl");
  for (const [name, body] of [
    ["sc-not-json.json", "[[["],
    ["sc-lanterns.json", JSON.stringify({ lanterns: "L1" })],
    ["sc-motes.json", JSON.stringify({ motes: [["a", "b", "c"]] })],
  ] as const) {
    const r = run("--seed", "1", "--night", "1", "--ticks", "10", "--scenario", file(name, body), "--out", out);
    assert.equal(r.status, 2, `${name}: expected exit 2, got ${r.status}`);
  }
});

test("missing required arguments => non-zero exit", () => {
  assert.notEqual(run("--seed", "1").status, 0);
});
