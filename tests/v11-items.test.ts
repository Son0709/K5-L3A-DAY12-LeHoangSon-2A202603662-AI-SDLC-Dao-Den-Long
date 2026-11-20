import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn } from "./helpers.ts";

const press = (tick = 0, key = "interact") => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const L1 = (pos: number[], extra = {}) => ({ id: "L1", pos, ...extra });

// ---------------------------------------------------------------- pickup (XZ <= 1.0, height diff <= 1.5, capacity 10)
test("pickup radius 1.0: 1.0 m picked (<=), 1.1 m not; event and carried", () => {
  const near1 = sim({ scenario: scn({ motes: [[0, 0, 1.0]] }), ticks: 5 });
  assert.deepEqual(near1.ev("mote_picked").map((e) => [e.tick, e.data]), [[1, { carried: 1 }]]);
  assert.equal(near1.end.score, 0, "score comes from depositing, not picking up");
  assert.equal(sim({ scenario: scn({ motes: [[0, 0, 1.1]] }), ticks: 5 }).ev("mote_picked").length, 0);
});

test("pickup height rule: |foot - mote ground| <= 1.5", () => {
  assert.equal(sim({ scenario: scn({ motes: [[0, 1.5, 0.5]] }), ticks: 3 }).ev("mote_picked").length, 1);
  assert.equal(sim({ scenario: scn({ motes: [[0, 1.6, 0.5]] }), ticks: 3 }).ev("mote_picked").length, 0);
});

test("capacity 10: full hands do not pick up", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, motes: [[0, 0, 0.5]] }), ticks: 5, every: 1 });
  assert.equal(r.ev("mote_picked").length, 0);
  assert.equal(r.snapAt(5).motes_active, 1);
});

// ---------------------------------------------------------------- lanterns (cost 10, radius 2.0)
test("full deposit: deposit then lantern_lit; score 10 per mote deposited + 100 per lantern", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [L1([0, 0, 1])] }), frames: press(), ticks: 5, every: 1 });
  assert.deepEqual(r.events.map((e) => [e.name, e.tick]), [["deposit", 1], ["lantern_lit", 1]]);
  assert.deepEqual(r.ev("deposit")[0].data, { lantern_id: "L1", amount: 10, deposited: 10 });
  assert.equal(r.end.score, 10 * 10 + 100);
  assert.equal(r.snapAt(5).player.carried, 0);
});

test("partial deposit keeps progress; top-up deposits only what is missing", () => {
  const part = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [L1([0, 0, 1])] }), frames: press(), ticks: 5, every: 1 });
  assert.deepEqual(part.ev("deposit")[0].data, { lantern_id: "L1", amount: 4, deposited: 4 });
  assert.equal(part.ev("lantern_lit").length, 0);
  assert.equal(part.end.score, 40);
  assert.equal(part.snapAt(5).lanterns[0].deposited, 4);
  const top = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 8 }, lanterns: [L1([0, 0, 1], { deposited: 6 })] }), frames: press(), ticks: 5, every: 1 });
  assert.deepEqual(top.ev("deposit")[0].data, { lantern_id: "L1", amount: 4, deposited: 10 });
  assert.equal(top.snapAt(5).player.carried, 4);
  assert.equal(top.ev("lantern_lit").length, 1);
});

test("interact radius 2.0: 2.0 m works, 2.1 m does not", () => {
  const mk = (z: number) => sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [L1([0, 0, z])] }), frames: press(), ticks: 3 });
  assert.equal(mk(2.0).ev("deposit").length, 1);
  assert.equal(mk(2.1).ev("deposit").length, 0);
});

test("one press feeds the nearest unlit lantern; equal distance picks the smaller id", () => {
  const two = (a: number[], b: number[], extra = {}) => sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", pos: a, ...extra }, { id: "L2", pos: b }] }),
    frames: press(), ticks: 3,
  });
  assert.equal(two([1.5, 0, 0], [1, 0, 0]).ev("deposit")[0].data.lantern_id, "L2", "L2 is nearer");
  assert.equal(two([1, 0, 0], [-1, 0, 0]).ev("deposit")[0].data.lantern_id, "L1", "tie goes to the smaller id");
  assert.equal(two([0.5, 0, 0], [1.5, 0, 0], { lit: true }).ev("deposit")[0].data.lantern_id, "L2", "lit lanterns are skipped");
});

test("no press, empty hands, or an already lit lantern: no deposit event", () => {
  const base = { player: { pos: [0, 0, 0], carried: 5 }, lanterns: [L1([0, 0, 1])] };
  assert.equal(sim({ scenario: scn(base), ticks: 30 }).ev("deposit").length, 0);
  assert.equal(sim({ scenario: scn({ ...base, player: { pos: [0, 0, 0], carried: 0 } }), frames: press(), ticks: 3 }).ev("deposit").length, 0);
  assert.equal(sim({ scenario: scn({ ...base, lanterns: [L1([0, 0, 1], { lit: true })] }), frames: press(), ticks: 3 }).ev("deposit").length, 0);
});
