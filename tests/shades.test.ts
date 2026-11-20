import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn, near } from "./helpers.ts";

const pulseAt = (tick: number) => [
  { tick, pulse: true },
  { tick: tick + 1, pulse: false },
];

// ---------- pulse ----------

test("pulse stuns shades in radius: event, cost, push, score, state", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }] }),
    frames: pulseAt(0),
    ticks: 5,
    every: 1,
  });
  const p = r.ev("pulse");
  assert.equal(p.length, 1);
  assert.equal(p[0].tick, 1);
  assert.deepEqual(p[0].data, { stunned_ids: ["S1"] });
  const s1 = r.snapAt(1);
  assert.equal(s1.player.carried, 3, "pulse_cost 2");
  const sh = s1.shades.find((s: { id: string }) => s.id === "S1");
  assert.equal(sh.state, "stunned");
  near(sh.pos[0], 7, 0.01, "pushed 3 m away from the player");
  near(sh.pos[2], 0, 0.01);
  assert.equal(r.end.score, 25, "per_stun");
});

test("pulse boundary: shade at 6 m is hit, 6.1 m is not (stunned_ids empty)", () => {
  const inR = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [6, 0, 0] }] }), frames: pulseAt(0), ticks: 3 });
  assert.deepEqual(inR.ev("pulse")[0].data, { stunned_ids: ["S1"] });
  const out = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [6.1, 0, 0] }] }), frames: pulseAt(0), ticks: 3 });
  assert.deepEqual(out.ev("pulse")[0].data, { stunned_ids: [] });
  assert.equal(out.end.score, 0);
});

test("pulse with fewer carried than pulse_cost does nothing (no event, no cost)", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 1 }, shades: [{ id: "S1", pos: [4, 0, 0] }] }),
    frames: pulseAt(0),
    ticks: 5,
    every: 1,
  });
  assert.equal(r.ev("pulse").length, 0);
  assert.equal(r.snapAt(5).player.carried, 1);
});

test("pulse cooldown 4 s: second press at tick 100 ignored, press at tick 300 works", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 10 } }),
    frames: [...pulseAt(0), ...pulseAt(100), ...pulseAt(300)],
    ticks: 320,
  });
  assert.deepEqual(r.ev("pulse").map((e) => e.tick), [1, 301]);
});

test("stun lasts 3 s then the shade chases again", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }] }),
    frames: pulseAt(0),
    ticks: 205,
    every: 5,
  });
  const st = (t: number) => r.snapAt(t).shades[0].state;
  assert.equal(st(100), "stunned");
  assert.equal(st(200), "chase");
});

test("a stunned shade stands still and does not hurt", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }] }),
    frames: pulseAt(0),
    ticks: 150,
    every: 50,
  });
  near(r.snapAt(50).shades[0].pos[0], 7, 0.01);
  near(r.snapAt(100).shades[0].pos[0], 7, 0.01);
  assert.equal(r.ev("player_hit").length, 0);
});

// ---------- chase ----------

test("shade chases at 4 m/s", () => {
  const r = sim({ scenario: scn({ shades: [{ id: "S1", pos: [10, 0, 0] }] }), ticks: 61, every: 60 });
  const sh = r.snapAt(60).shades[0];
  assert.equal(sh.state, "chase");
  near(sh.pos[0], 6, 0.01);
  near(sh.pos[2], 0, 0.01);
});

test("lit lantern keeps shades out of safe_radius 5 (all snapshots)", () => {
  const r = sim({
    scenario: scn({
      lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true }],
      shades: [{ id: "S1", pos: [0, 0, 20] }],
    }),
    ticks: 600,
    every: 1,
  });
  let closest = Infinity;
  for (const s of r.snaps) {
    const sh = s.shades[0];
    const d = Math.hypot(sh.pos[0] - 0, sh.pos[2] - 10);
    closest = Math.min(closest, d);
    assert.ok(d >= 5 - 0.002, `shade inside safe radius at tick ${s.tick}: ${d}`);
  }
  assert.ok(closest < 10, "shade should have advanced toward the lantern");
  assert.equal(r.ev("player_hit").length, 0);
});

test("an unlit lantern does not stop shades (assumption 9)", () => {
  const r = sim({
    scenario: scn({
      lanterns: [{ id: "L1", pos: [0, 0, 10], lit: false }],
      shades: [{ id: "S1", pos: [0, 0, 20] }],
    }),
    ticks: 600,
  });
  assert.ok(r.ev("player_hit").length >= 1);
});

// ---------- hits ----------

test("shade contact: flames -1, drops floor(carried * 0.5), event data", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 10, flames: 3 }, shades: [{ id: "S1", pos: [3, 0, 0] }] }),
    ticks: 60,
    every: 1,
  });
  const h = r.ev("player_hit");
  assert.equal(h.length, 1);
  assert.ok(h[0].tick >= 29 && h[0].tick <= 32, `hit at ${h[0].tick}`);
  assert.deepEqual(h[0].data, { by: "shade", flames: 2, dropped: 5 });
  assert.equal(r.snapAt(60).player.flames, 2);
  assert.equal(r.snapAt(60).player.carried, 5);
});

test("hit with empty hands drops 0", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 0, flames: 3 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] }),
    ticks: 3,
  });
  assert.deepEqual(r.ev("player_hit")[0].data, { by: "shade", flames: 2, dropped: 0 });
});

test("invulnerable 1.5 s after a hit; three hits lose with no_flames", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 10, flames: 3 }, shades: [{ id: "S1", pos: [3, 0, 0] }] }),
    ticks: 600,
  });
  const h = r.ev("player_hit");
  assert.equal(h.length, 3);
  const gap = h[1].tick - h[0].tick;
  assert.ok(gap >= 90 && gap <= 95, `gap between hits ${gap} ticks`);
  assert.deepEqual(h.map((e) => e.data.flames), [2, 1, 0]);
  assert.deepEqual(h.map((e) => e.data.dropped), [5, 2, 1]);
  const over = r.ev("game_over");
  assert.deepEqual(over.map((e) => e.data), [{ result: "lost", reason: "no_flames" }]);
  assert.equal(over[0].tick, h[2].tick);
  assert.equal(r.end.state, "lost");
  assert.equal(r.end.ticks, h[2].tick);
  const order = r.events.map((e) => e.name);
  assert.ok(order.lastIndexOf("player_hit") < order.indexOf("game_over"));
});

test("single flame: one hit loses immediately", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], flames: 1 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] }),
    ticks: 100,
  });
  assert.deepEqual(r.ev("player_hit")[0].data, { by: "shade", flames: 0, dropped: 0 });
  assert.deepEqual(r.ev("game_over")[0].data, { result: "lost", reason: "no_flames" });
  assert.equal(r.end.ticks, 1);
  assert.equal(r.end.score, 0);
});

test("the player cannot fall off the island (no 'fall' hits when fall_enabled is false)", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 39.5] } }),
    frames: [{ tick: 0, move: [0, 1] }],
    ticks: 300,
  });
  assert.equal(r.events.filter((e) => e.name === "player_hit" && e.data.by === "fall").length, 0);
});
