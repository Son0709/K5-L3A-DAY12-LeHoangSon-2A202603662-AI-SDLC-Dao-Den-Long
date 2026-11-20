import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn } from "./helpers.ts";

const L1_NEAR = { id: "L1", pos: [0, 0, 2] };
const press = (tick = 0) => [
  { tick, interact: true },
  { tick: tick + 1, interact: false },
];

test("mote within pickup_radius (1.1 m) is picked: event, carried, score", () => {
  const r = sim({ scenario: scn({ motes: [[0, 0, 1.1]] }), ticks: 5 });
  const e = r.ev("mote_picked");
  assert.equal(e.length, 1);
  assert.equal(e[0].tick, 1);
  assert.deepEqual(e[0].data, { carried: 1 });
  assert.equal(r.end.score, 10);
});

test("pickup boundary: exactly 1.2 m is picked (<=), 1.3 m is not", () => {
  assert.equal(sim({ scenario: scn({ motes: [[0, 0, 1.2]] }), ticks: 5 }).ev("mote_picked").length, 1);
  const far = sim({ scenario: scn({ motes: [[0, 0, 1.3]] }), ticks: 5, every: 1 });
  assert.equal(far.ev("mote_picked").length, 0);
  assert.equal(far.snapAt(5).motes_active, 1);
});

test("picking a mote reduces motes_active", () => {
  const r = sim({ scenario: scn({ motes: [[0, 0, 1], [20, 0, 0]] }), ticks: 5, every: 1 });
  assert.equal(r.snapAt(0).motes_active, 2);
  assert.equal(r.snapAt(5).motes_active, 1);
});

test("carry_capacity 10: full hands do not pick up", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, motes: [[0, 0, 0.5]] }), ticks: 5, every: 1 });
  assert.equal(r.ev("mote_picked").length, 0);
  assert.equal(r.snapAt(5).player.carried, 10);
  assert.equal(r.snapAt(5).motes_active, 1);
});

test("picking up while walking happens when entering the radius", () => {
  const r = sim({
    scenario: scn({ motes: [[0, 0, 5]] }),
    frames: [{ tick: 0, move: [0, 1] }],
    ticks: 60,
  });
  const e = r.ev("mote_picked");
  assert.equal(e.length, 1);
  assert.ok(e[0].tick >= 37 && e[0].tick <= 40, `picked at ${e[0].tick}`);
});

test("deposit full cost lights the lantern: deposit, lantern_lit, +100, carried left over", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [L1_NEAR] }), frames: press(), ticks: 5, every: 1 });
  assert.deepEqual(r.ev("deposit").map((e) => e.data), [{ lantern_id: "L1", amount: 8, deposited: 8 }]);
  assert.deepEqual(r.ev("lantern_lit").map((e) => e.data), [{ lantern_id: "L1" }]);
  assert.equal(r.ev("deposit")[0].tick, 1);
  const order = r.events.map((e) => e.name);
  assert.ok(order.indexOf("deposit") < order.indexOf("lantern_lit"));
  assert.equal(r.snapAt(5).player.carried, 2);
  assert.equal(r.snapAt(5).lanterns.find((l: { id: string }) => l.id === "L1").lit, true);
  assert.equal(r.end.score, 100);
});

test("partial deposit: amount = carried, lantern stays dark", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [L1_NEAR] }), frames: press(), ticks: 5, every: 1 });
  assert.deepEqual(r.ev("deposit").map((e) => e.data), [{ lantern_id: "L1", amount: 5, deposited: 5 }]);
  assert.equal(r.ev("lantern_lit").length, 0);
  assert.equal(r.snapAt(5).player.carried, 0);
  const l1 = r.snapAt(5).lanterns.find((l: { id: string }) => l.id === "L1");
  assert.equal(l1.deposited, 5);
  assert.equal(l1.lit, false);
});

test("deposit only tops up what is missing (cost - deposited)", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ ...L1_NEAR, deposited: 5 }] }),
    frames: press(),
    ticks: 5,
    every: 1,
  });
  assert.deepEqual(r.ev("deposit").map((e) => e.data), [{ lantern_id: "L1", amount: 3, deposited: 8 }]);
  assert.equal(r.ev("lantern_lit").length, 1);
  assert.equal(r.snapAt(5).player.carried, 2);
});

test("interact boundary: 2.5 m works, 2.6 m does not", () => {
  const ok = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: "L1", pos: [0, 0, 2.5] }] }), frames: press(), ticks: 3 });
  assert.equal(ok.ev("deposit").length, 1);
  const far = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 4 }, lanterns: [{ id: "L1", pos: [0, 0, 2.6] }] }), frames: press(), ticks: 3 });
  assert.equal(far.ev("deposit").length, 0);
});

test("no interact press means no deposit", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [L1_NEAR] }), ticks: 30 });
  assert.equal(r.ev("deposit").length, 0);
});

test("interact with empty hands produces no event", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 0 }, lanterns: [L1_NEAR] }), frames: press(), ticks: 5 });
  assert.equal(r.ev("deposit").length, 0);
});

test("already lit lantern accepts nothing", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ ...L1_NEAR, lit: true }] }), frames: press(), ticks: 5, every: 1 });
  assert.equal(r.ev("deposit").length, 0);
  assert.equal(r.snapAt(5).player.carried, 5);
});

test("lighting the last lantern wins: game_over all_lit, end state won, bonus score", () => {
  const lit = ["L1", "L2", "L3", "L4"].map((id) => ({ id, pos: [30, 0, 30], lit: true }));
  const r = sim({
    scenario: scn({
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      lanterns: [...lit, { id: "L5", pos: [0, 0, 2], deposited: 0 }],
      time_left_s: 100,
    }),
    frames: press(),
    ticks: 600,
  });
  assert.deepEqual(r.ev("game_over").map((e) => e.data), [{ result: "won", reason: "all_lit" }]);
  assert.equal(r.ev("game_over")[0].tick, 1);
  assert.equal(r.end.state, "won");
  assert.equal(r.end.ticks, 1, "game stops when it ends");
  // 100 (lantern) + 99 whole seconds left + 3 flames * 50
  assert.equal(r.end.score, 100 + 99 + 150);
  const order = r.events.map((e) => e.name);
  assert.deepEqual(order, ["deposit", "lantern_lit", "game_over"]);
});

test("running out of time loses with reason dawn at tick 60 (time_left_s 1)", () => {
  const r = sim({ scenario: scn({ time_left_s: 1 }), ticks: 600 });
  assert.deepEqual(r.ev("game_over").map((e) => e.data), [{ result: "lost", reason: "dawn" }]);
  assert.equal(r.ev("game_over")[0].tick, 60);
  assert.equal(r.end.state, "lost");
  assert.equal(r.end.ticks, 60);
  assert.equal(r.end.score, 0, "no time/flame bonus when losing");
});

test("game_over is emitted exactly once", () => {
  const r = sim({ scenario: scn({ time_left_s: 0.5 }), ticks: 600 });
  assert.equal(r.ev("game_over").length, 1);
});
