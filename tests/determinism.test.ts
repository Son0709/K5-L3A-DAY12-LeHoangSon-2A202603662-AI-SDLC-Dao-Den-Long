import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn } from "./helpers.ts";

const wander = [
  { tick: 0, move: [0, 1] },
  { tick: 90, move: [1, 0], cam_yaw_deg: 45 },
  { tick: 180, move: [-1, -1], interact: true },
  { tick: 181, interact: false, pulse: true, dash: true },
  { tick: 182, pulse: false, dash: false },
];

test("same seed + scenario + inputs => identical output (default random scenario)", () => {
  const a = sim({ seed: 42, frames: wander, ticks: 2000 });
  const b = sim({ seed: 42, frames: wander, ticks: 2000 });
  assert.equal(JSON.stringify(a.lines), JSON.stringify(b.lines));
});

test("different seeds give different random motes", () => {
  const a = sim({ seed: 1, ticks: 1 }).snapAt(0);
  const b = sim({ seed: 2, ticks: 1 }).snapAt(0);
  assert.notDeepEqual(a.motes, b.motes);
  assert.equal(a.motes.length, 20);
});

test("random shades: spawn schedule and ids are deterministic", () => {
  const sc = { random_motes: false, motes: [], player: { pos: [0, 0, 0] } };
  const a = sim({ seed: 3, scenario: sc, ticks: 800 });
  const b = sim({ seed: 3, scenario: sc, ticks: 800 });
  assert.deepEqual(a.ev("shade_spawned").map((e) => [e.tick, e.data.id]), [[300, "S1"], [300, "S2"], [780, "S3"]]);
  assert.equal(JSON.stringify(a.lines), JSON.stringify(b.lines));
});

test("random_shades false: nothing spawns", () => {
  const r = sim({ scenario: scn(), ticks: 2000 });
  assert.equal(r.ev("shade_spawned").length, 0);
});

test("a whole 5-minute night headless stays fast (<= 30 s required; this is a smoke check)", () => {
  const t0 = Date.now();
  const r = sim({ seed: 7, frames: wander, ticks: 18000 });
  assert.ok(r.end.ticks > 0);
  assert.ok(Date.now() - t0 < 30_000, "headless night should take well under 30 s");
});
