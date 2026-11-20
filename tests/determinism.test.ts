import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn } from "./helpers.ts";

const wander = [
  { tick: 0, move: [0, 1] },
  { tick: 90, move: [1, 0], cam_yaw_deg: 45 },
  { tick: 180, move: [-1, -1], interact: true },
  { tick: 181, interact: false, pulse: true },
  { tick: 182, pulse: false },
];

test("same seed + scenario + inputs => identical output (default random scenario)", () => {
  const a = sim({ seed: 42, frames: wander, ticks: 1500 });
  const b = sim({ seed: 42, frames: wander, ticks: 1500 });
  assert.equal(JSON.stringify(a.lines), JSON.stringify(b.lines));
});

test("different seeds give different random motes", () => {
  const a = sim({ seed: 1, ticks: 1 }).snapAt(0);
  const b = sim({ seed: 2, ticks: 1 }).snapAt(0);
  assert.notDeepEqual(a.motes, b.motes);
  assert.equal(a.motes.length, 60);
});

test("random motes are on the island", () => {
  const m = sim({ seed: 7, ticks: 1 }).snapAt(0).motes as { id: string; pos: number[] }[];
  for (const mote of m) {
    assert.ok(Math.hypot(mote.pos[0], mote.pos[2]) <= 40.001, `${mote.id} off island`);
    assert.equal(mote.pos[1], 0);
  }
  assert.equal(new Set(m.map((x) => x.id)).size, m.length, "unique ids");
});

test("random_shades: spawn every 10 s with deterministic ids", () => {
  const sc = scn({ random_shades: true, shades: [] });
  const a = sim({ seed: 3, scenario: sc, ticks: 700 });
  const b = sim({ seed: 3, scenario: sc, ticks: 700 });
  const sp = a.ev("shade_spawned");
  assert.ok(sp.length >= 1, "a shade should spawn by tick 700");
  assert.ok(sp[0].tick >= 600 && sp[0].tick <= 601, `first spawn at ${sp[0].tick}`);
  assert.match(sp[0].data.id, /^S\d+$/);
  assert.deepEqual(a.ev("shade_spawned"), b.ev("shade_spawned"));
});

test("default scenario starts with 2 random shades", () => {
  const s0 = sim({ seed: 5, ticks: 1 }).snapAt(0);
  assert.equal(s0.shades.length, 2);
  for (const sh of s0.shades) assert.ok(["chase", "stunned"].includes(sh.state) || typeof sh.state === "string");
});

test("random_shades false: nothing spawns", () => {
  const r = sim({ scenario: scn(), ticks: 2000 });
  assert.equal(r.ev("shade_spawned").length, 0);
  assert.equal(r.snapAt(2000 - (2000 % 10)).shades.length, 0);
});

test("random_motes false with motes [] means none", () => {
  assert.equal(sim({ scenario: scn(), ticks: 1 }).snapAt(0).motes_active, 0);
});
