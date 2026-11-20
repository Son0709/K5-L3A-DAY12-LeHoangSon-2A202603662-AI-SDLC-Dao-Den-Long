import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn, near } from "./helpers.ts";

const press = (tick: number, key = "interact") => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const lamp = (id: string, pos: number[], extra = {}) => ({ id, pos, ...extra });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (snapLine: Record<string, any>, id: string): Record<string, any> => snapLine.lanterns.find((l: { id: string }) => l.id === id);

// Note on timing: fuel burns in step 2, BEFORE the player interacts (step 5). A lantern that starts the tick at 55 is at 54.98 when the
// player refuels it. Expected values below are derived by hand with that order.

// ================================================================ the lantern model
test("snapshot: every lantern has fuel, ever_lit, relit_count; the player has capacity", () => {
  const s0 = sim({ ticks: 1 }).snapAt(0);
  for (const l of s0.lanterns) assert.deepEqual([l.lit, l.fuel, l.ever_lit, l.relit_count], [false, 0, false, 0], l.id);
  assert.equal(s0.player.capacity, 10);
});

test("durations are 240 / 270 / 300 s", () => {
  assert.deepEqual([1, 2, 3].map((n) => sim({ night: n, ticks: 1, scenario: n === 3 ? scn({ player: { pos: [0, 0, -30] } }) : undefined }).snapAt(0).time_left_s), [240, 270, 300]);
});

test("a lantern set lit by the scenario defaults to fuel 100 and ever_lit; no event, no score", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L1", lit: true }] }), ticks: 3 });
  const l1 = L(r.snapAt(0), "L1");
  assert.deepEqual([l1.lit, l1.fuel, l1.ever_lit, l1.relit_count], [true, 100, true, 0]);
  assert.equal(r.events.length, 0);
  assert.equal(r.end.score, 0);
  assert.equal(r.snapAt(0).player.capacity, 10, "scenario lights do not count as successful lights");
});

test("scenario fuel, ever_lit and successful_lights are honoured", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L1", lit: true, fuel: 50.5 }, { id: "L2", ever_lit: true }], player: { pos: [0, 0, 0], successful_lights: 3 } }), ticks: 1 });
  assert.equal(L(r.snapAt(0), "L1").fuel, 50.5);
  assert.deepEqual([L(r.snapAt(0), "L2").lit, L(r.snapAt(0), "L2").ever_lit], [false, true]);
  assert.equal(r.snapAt(0).player.capacity, 16);
});

test("a lit lantern burns 1 fuel per second (1/60 per tick), reported with one decimal", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L1", lit: true }] }), ticks: 601, every: 60 });
  assert.equal(L(r.snapAt(60), "L1").fuel, 99);
  assert.equal(L(r.snapAt(120), "L1").fuel, 98);
  assert.equal(L(r.snapAt(600), "L1").fuel, 90);
  const one = sim({ scenario: scn({ lanterns: [{ id: "L1", lit: true }] }), ticks: 12, every: 1 });
  assert.equal(L(one.snapAt(6), "L1").fuel, 99.9);
});

test("fuel <= 0: the lantern goes out right after the burn, emits lantern_out, keeps ever_lit", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L1", lit: true, fuel: 0.05 }] }), ticks: 6, every: 1 }); // 3 units of 1/60
  assert.equal(L(r.snapAt(2), "L1").lit, true);
  assert.deepEqual(r.ev("lantern_out").map((e) => [e.tick, e.data]), [[3, { lantern_id: "L1" }]]);
  const l1 = L(r.snapAt(3), "L1");
  assert.deepEqual([l1.lit, l1.fuel, l1.deposited, l1.ever_lit], [false, 0, 0, true]);
});

// ================================================================ refuel
test("refuel: used = min(carried, ceil(missing / 10)); fuel +10 per mote; 5 points per mote; event refuel", () => {
  const mk = (carried: number) => sim({ scenario: scn({ player: { pos: [0, 0, 0], carried }, lanterns: [lamp("L1", [0, 0, 1], { lit: true, fuel: 55 })] }), frames: press(0), ticks: 3, every: 1 });
  const full = mk(10); // 54.98 -> missing 45.02 -> ceil(4.5) = 5 motes -> back to 100
  assert.deepEqual(full.ev("refuel").map((e) => [e.tick, e.data]), [[1, { lantern_id: "L1", amount: 5, fuel: 100 }]]);
  assert.equal(full.snapAt(1).player.carried, 5);
  assert.equal(full.end.score, 25);
  const part = mk(2); // only 2 motes: 54.98 + 20 = 74.98
  assert.deepEqual(part.ev("refuel").map((e) => e.data), [{ lantern_id: "L1", amount: 2, fuel: 75 }]);
  assert.equal(part.snapAt(1).player.carried, 0);
  assert.equal(part.end.score, 10);
  assert.equal(part.ev("deposit").length, 0, "feeding a lit lantern is a refuel, not a deposit");
  assert.equal(part.ev("lantern_lit").length, 0);
});

test("refuel with empty hands, or out of reach, does nothing", () => {
  const empty = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 0 }, lanterns: [lamp("L1", [0, 0, 1], { lit: true, fuel: 55 })] }), frames: press(0), ticks: 3 });
  assert.equal(empty.ev("refuel").length, 0);
  const far = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [lamp("L1", [0, 0, 2.1], { lit: true, fuel: 55 })] }), frames: press(0), ticks: 3 });
  assert.equal(far.ev("refuel").length, 0);
});

test("interaction picks the nearest lantern that can receive (dark or not full), ties to the smaller id", () => {
  const two = (a: object, b: object) => sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", ...a }, { id: "L2", ...b }] }), frames: press(0), ticks: 3,
  });
  const r1 = two({ pos: [1, 0, 0], lit: true, fuel: 60 }, { pos: [-1, 0, 0], lit: true, fuel: 60 });
  assert.equal(r1.ev("refuel")[0].data.lantern_id, "L1", "tie -> L1");
  const r2 = two({ pos: [1.5, 0, 0], lit: true, fuel: 60 }, { pos: [-1, 0, 0] });
  assert.equal(r2.ev("deposit")[0].data.lantern_id, "L2", "the nearer, dark lantern wins over a lit one");
});

// ================================================================ light and relight
test("first light costs 10 (+100 and 5 per mote); relight costs 5 (+40 and 5 per mote); relight_count", () => {
  const first = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [lamp("L1", [0, 0, 1])] }), frames: press(0), ticks: 3, every: 1 });
  assert.deepEqual(first.events.map((e) => [e.name, e.data]), [["deposit", { lantern_id: "L1", amount: 10, deposited: 10 }], ["lantern_lit", { lantern_id: "L1", relight: false }]]);
  assert.equal(first.end.score, 10 * 5 + 100);
  const l1 = L(first.snapAt(1), "L1");
  assert.deepEqual([l1.lit, l1.fuel, l1.ever_lit, l1.relit_count], [true, 100, true, 0]);

  const again = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [lamp("L1", [0, 0, 1], { ever_lit: true })] }), frames: press(0), ticks: 3, every: 1 });
  assert.deepEqual(again.events.map((e) => [e.name, e.data]), [["deposit", { lantern_id: "L1", amount: 5, deposited: 5 }], ["lantern_lit", { lantern_id: "L1", relight: true }]]);
  assert.equal(again.end.score, 5 * 5 + 40);
  const r1 = L(again.snapAt(1), "L1");
  assert.deepEqual([r1.lit, r1.fuel, r1.relit_count], [true, 100, 1]);

  const part = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [lamp("L1", [0, 0, 1], { ever_lit: true })] }), frames: press(0), ticks: 3 });
  assert.equal(part.ev("lantern_lit").length, 0, "3 of 5: still dark");
});

test("a lantern that burns out and is relit in the same tick: out, deposit, lantern_lit (relight)", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [lamp("L1", [0, 0, 1], { lit: true, fuel: 1 / 60 })] }), frames: press(0), ticks: 3 });
  assert.deepEqual(r.events.map((e) => e.name), ["lantern_out", "deposit", "lantern_lit"]);
  assert.equal(r.ev("lantern_lit")[0].data.relight, true);
  assert.equal(r.ev("deposit")[0].data.amount, 5, "only 5 are needed because it was lit before");
});

// ================================================================ capacity = 10 + 2 x successful lights, max 20
test("capacity grows with successful lights (first lights and relights, not refuels), capped at 20", () => {
  const cap = (n: number) => sim({ scenario: scn({ player: { pos: [0, 0, 0], successful_lights: n } }), ticks: 1 }).snapAt(0).player.capacity;
  assert.deepEqual([0, 1, 3, 5, 8].map(cap), [10, 12, 16, 20, 20]);
  const lit = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [lamp("L1", [0, 0, 1])] }), frames: press(0), ticks: 3, every: 1 });
  assert.equal(lit.snapAt(1).player.capacity, 12);
  const refuel = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [lamp("L1", [0, 0, 1], { lit: true, fuel: 40 })] }), frames: press(0), ticks: 3, every: 1 });
  assert.equal(refuel.snapAt(1).player.capacity, 10, "a refuel is not a successful light");
});

test("pickup respects the capacity", () => {
  const base = { player: { pos: [0, 0, 0], carried: 10, successful_lights: 2 }, motes: [[0, 0, 0.5], [0, 0, -0.5], [0.5, 0, 0], [-0.5, 0, 0], [0.3, 0, 0.3]] };
  const r = sim({ scenario: scn(base), ticks: 3, every: 1 });
  assert.equal(r.snapAt(3).player.carried, 14, "capacity 14");
  assert.equal(r.snapAt(3).motes_active, 1);
});

// ================================================================ winning: survive to dawn with enough lanterns
test("no early win: every lantern lit does not end the night", () => {
  const all = ["L1", "L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const r = sim({ scenario: scn({ lanterns: all }), ticks: 200 });
  assert.equal(r.ev("game_over").length, 0);
  assert.equal(r.end.state, "playing");
});

test("dawn with >= ceil(0.6 x total) lanterns lit wins (dawn_survived); score 50 + floor(fuel) per lantern + 50 per flame", () => {
  const lit = (n: number) => ["L1", "L2", "L3", "L4", "L5"].map((id, i) => ({ id, lit: i < n }));
  const win = sim({ scenario: scn({ lanterns: lit(3), time_left_s: 1 }), ticks: 600 });
  assert.deepEqual(win.ev("game_over").map((e) => [e.tick, e.data]), [[60, { result: "won", reason: "dawn_survived" }]]);
  assert.equal(win.end.state, "won");
  assert.equal(win.end.ticks, 60);
  assert.equal(win.end.score, 3 * (50 + 99) + 3 * 50, "fuel is 99.0 after 60 ticks");
  const lose = sim({ scenario: scn({ lanterns: lit(2), time_left_s: 1 }), ticks: 600 });
  assert.deepEqual(lose.ev("game_over").map((e) => e.data), [{ result: "lost", reason: "dawn" }]);
  assert.equal(lose.end.score, 0);
});

test("the threshold is 3/5, 4/6 and 5/7 on Nights 1, 2 and 3", () => {
  const verdict = (night: number, total: number, lit: number) => {
    const lanterns = Array.from({ length: total }, (_, i) => ({ id: `L${i + 1}`, lit: i < lit }));
    const sc = scn({ lanterns, time_left_s: 0.5, ...(night === 3 ? { player: { pos: [0, 0, -30] } } : {}) });
    return sim({ night, scenario: sc, ticks: 100 }).end.state;
  };
  assert.deepEqual([verdict(1, 5, 3), verdict(1, 5, 2)], ["won", "lost"]);
  assert.deepEqual([verdict(2, 6, 4), verdict(2, 6, 3)], ["won", "lost"]);
  assert.deepEqual([verdict(3, 7, 5), verdict(3, 7, 4)], ["won", "lost"]);
});

test("a lantern that burns out on the way to dawn no longer counts", () => {
  // 3 lit, one of them with 0.5 fuel (30 ticks); dawn at tick 60 -> only 2 are lit at the end
  const lanterns = [{ id: "L1", lit: true }, { id: "L2", lit: true }, { id: "L3", lit: true, fuel: 0.5 }];
  const r = sim({ scenario: scn({ lanterns, time_left_s: 1 }), ticks: 200 });
  assert.equal(r.ev("lantern_out")[0].tick, 30);
  assert.deepEqual(r.ev("game_over").map((e) => e.data), [{ result: "lost", reason: "dawn" }]);
});

test("no flames beats everything, even with every lantern lit on the dawn tick", () => {
  const all = ["L1", "L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const r = sim({ scenario: scn({ lanterns: all, player: { pos: [0, 0, 0], flames: 0 }, time_left_s: 1 / 60 }), ticks: 10 });
  assert.deepEqual(r.ev("game_over").map((e) => e.data), [{ result: "lost", reason: "no_flames" }]);
});

test("Tỏa Sáng score is unchanged for ordinary shades (+5) and the time bonus is gone", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }] }), frames: press(0, "pulse"), ticks: 3 });
  assert.equal(r.end.score, 5);
});
