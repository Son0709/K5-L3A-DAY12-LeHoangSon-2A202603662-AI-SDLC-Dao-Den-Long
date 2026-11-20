import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn, near } from "./helpers.ts";

test("snapshot tick 0 reflects initial state (default scenario)", () => {
  const r = sim({ ticks: 20 });
  const s0 = r.snapAt(0);
  assert.equal(s0.sim_tick, 0);
  assert.equal(s0.state, "playing");
  assert.equal(s0.time_left_s, 300);
  assert.equal(s0.score, 0);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.equal(s0.player.flames, 3);
  assert.equal(s0.player.carried, 0);
  assert.equal(s0.lanterns.length, 5);
  assert.equal(s0.motes_active, 60);
  assert.equal(s0.shades.length, 2);
});

test("lanterns L1..L5 on a 25 m ring, L1 at (0,0,25)", () => {
  const ls = sim({ ticks: 1 }).snapAt(0).lanterns;
  assert.deepEqual(ls.map((l: { id: string }) => l.id), ["L1", "L2", "L3", "L4", "L5"]);
  assert.deepEqual(ls[0].pos, [0, 0, 25]);
  for (const l of ls) {
    near(Math.hypot(l.pos[0], l.pos[2]), 25, 0.002, l.id);
    assert.equal(l.lit, false);
    assert.equal(l.deposited, 0);
  }
});

test("--ticks N runs exactly N steps; end line is last", () => {
  const r = sim({ scenario: scn(), ticks: 25 });
  assert.equal(r.end.type, "end");
  assert.equal(r.end.ticks, 25);
  assert.equal(r.end.state, "playing");
  assert.equal(r.end.score, 0);
});

test("snapshots every 10 ticks by default, starting at 0; sim_tick == tick", () => {
  const r = sim({ scenario: scn(), ticks: 35 });
  const ticks = r.snaps.map((s) => s.tick);
  for (const t of [0, 10, 20, 30]) assert.ok(ticks.includes(t), `missing snapshot ${t}`);
  assert.ok(!ticks.includes(5));
  for (const s of r.snaps) assert.equal(s.sim_tick, s.tick);
});

test("--snapshot-every is honoured", () => {
  const r = sim({ scenario: scn(), ticks: 11, every: 5 });
  const ticks = r.snaps.map((s) => s.tick);
  for (const t of [0, 5, 10]) assert.ok(ticks.includes(t), `missing snapshot ${t}`);
  assert.ok(!ticks.includes(1));
});

test("time_left_s = duration - steps/60", () => {
  const r = sim({ scenario: scn(), ticks: 121, every: 60 });
  near(r.snapAt(60).time_left_s, 299, 0.001);
  near(r.snapAt(120).time_left_s, 298, 0.001);
});

test("scenario time_left_s overrides the default", () => {
  const r = sim({ scenario: scn({ time_left_s: 50 }), ticks: 61, every: 60 });
  assert.equal(r.snapAt(0).time_left_s, 50);
  near(r.snapAt(60).time_left_s, 49, 0.001);
});

test("no inputs: player stands still", () => {
  const r = sim({ scenario: scn(), ticks: 61, every: 60 });
  assert.deepEqual(r.snapAt(60).player.pos, [0, 0, 0]);
});

test("move [0,1] for 60 ticks goes 6 m along +Z", () => {
  const r = sim({ scenario: scn(), frames: [{ tick: 0, move: [0, 1] }], ticks: 61, every: 60 });
  const p = r.snapAt(60).player.pos;
  near(p[0], 0);
  near(p[2], 6);
});

// Contract: each move component is in [-1, 1]; a vector longer than 1 (e.g. [1,1]) is normalised.
test("move vector longer than 1 is normalised (diagonal is not faster)", () => {
  const d = sim({ scenario: scn(), frames: [{ tick: 0, move: [1, 1] }], ticks: 61, every: 60 });
  near(d.snapAt(60).player.pos[0], 6 / Math.SQRT2, 0.003);
  near(d.snapAt(60).player.pos[2], 6 / Math.SQRT2, 0.003);
});

test("cam_yaw_deg 90 rotates move [0,1] onto +X", () => {
  const r = sim({
    scenario: scn(),
    frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }],
    ticks: 61,
    every: 60,
  });
  const p = r.snapAt(60).player.pos;
  near(p[0], 6);
  near(p[2], 0);
});

test("frame fields absent keep their previous value", () => {
  const r = sim({
    scenario: scn(),
    frames: [
      { tick: 0, move: [0, 1] },
      { tick: 30, interact: false },
    ],
    ticks: 61,
    every: 60,
  });
  near(r.snapAt(60).player.pos[2], 6); // still moving after a frame that only touches interact
});

test("move can be stopped by a later frame", () => {
  const r = sim({
    scenario: scn(),
    frames: [
      { tick: 0, move: [0, 1] },
      { tick: 30, move: [0, 0] },
    ],
    ticks: 61,
    every: 60,
  });
  near(r.snapAt(60).player.pos[2], 3);
});

test("island rim blocks the player (radius 40, no falling)", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 39] } }),
    frames: [{ tick: 0, move: [0, 1] }],
    ticks: 120,
    every: 10,
  });
  for (const s of r.snaps) {
    const [x, , z] = s.player.pos;
    assert.ok(Math.hypot(x, z) <= 40.001, `outside island at tick ${s.tick}`);
  }
  assert.equal(r.ev("player_hit").length, 0);
});

test("jump leaves the ground, lands, and fires once per press (edge-triggered)", () => {
  const r = sim({ scenario: scn(), frames: [{ tick: 0, jump: true }], ticks: 301, every: 1 });
  const ys = r.snaps.map((s) => s.player.pos[1] as number);
  assert.ok(Math.max(...ys) > 0.5, "should rise");
  assert.ok(Math.max(...ys) < 3, "jump should be modest");
  near(r.snapAt(200).player.pos[1], 0, 0.001, "landed by tick 200 and did not re-jump");
  near(r.snapAt(300).player.pos[1], 0, 0.001, "held jump must not repeat");
});

test("jump does not change horizontal XZ distance rules (pickup uses XZ only)", () => {
  const r = sim({
    scenario: scn({ motes: [[0, 0, 1.0]] }),
    frames: [{ tick: 0, jump: true }],
    ticks: 5,
  });
  assert.equal(r.ev("mote_picked").length, 1);
});

test("scenario setup emits no events and no score (pre-lit lantern)", () => {
  const r = sim({
    scenario: scn({ lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true }] }),
    ticks: 5,
  });
  assert.equal(r.events.length, 0);
  assert.equal(r.end.score, 0);
  assert.equal(r.snapAt(0).lanterns[0].lit, true);
});

test("scenario lanterns update by id; unmentioned lanterns keep defaults", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L3", pos: [7, 0, 8] }] }), ticks: 1 });
  const ls = r.snapAt(0).lanterns;
  assert.deepEqual(ls.find((l: { id: string }) => l.id === "L3").pos, [7, 0, 8]);
  assert.deepEqual(ls.find((l: { id: string }) => l.id === "L1").pos, [0, 0, 25]);
  assert.equal(ls.length, 5);
});

test("scenario player carried/flames/pos are applied", () => {
  const r = sim({
    scenario: scn({ player: { pos: [3, 0, 4], carried: 4, flames: 2 } }),
    ticks: 1,
  });
  const p = r.snapAt(0).player;
  assert.deepEqual(p.pos, [3, 0, 4]);
  assert.equal(p.carried, 4);
  assert.equal(p.flames, 2);
});
