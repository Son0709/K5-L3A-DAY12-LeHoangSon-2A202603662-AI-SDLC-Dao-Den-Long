import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn, near } from "./helpers.ts";

const N2 = { night: 2 };
const press = (tick: number, key: string) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const dr = (pos: number[], extra = {}) => ({ id: "D1", pos, ...extra });
const arena = (carried: number, drifters: object[], extra = {}) =>
  scn({ player: { pos: [0, 0, 0], carried }, random_drifters: false, drifters, ...extra });
const quiet = { random_motes: false, motes: [], random_shades: false, shades: [], player: { pos: [0, 0, 0] } };

// ================================================================ night_start
test("night_start {night} is emitted once at tick 1; scenario setup itself emits nothing", () => {
  for (const night of [1, 2, 3]) {
    const r = sim({ night, scenario: night === 3 ? scn({ player: { pos: [0, 0, -30] } }) : scn(), ticks: 30 });
    assert.deepEqual(r.lines.filter((l) => l.type === "event").map((e) => [e.name, e.tick, e.data]), [["night_start", 1, { night }]]);
  }
});

// ================================================================ drifters (Gió Lạc)
test("drifters spawn at ticks 1200, 2400... (max 2) on Nights 2 and 3 only", () => {
  const r = sim({ ...N2, scenario: quiet, ticks: 3700, every: 10 });
  assert.equal(r.snapAt(1190).drifters.length, 0);
  const d1 = r.snapAt(1200).drifters;
  assert.deepEqual(d1.map((d: { id: string; state: string; stolen: number }) => [d.id, d.state, d.stolen]), [["D1", "idle", 0]]);
  near(Math.min(Math.hypot(d1[0].pos[0], d1[0].pos[2]), Math.hypot(d1[0].pos[0] - 70, d1[0].pos[2])), 26, 0.01, "on a fog point of the island rim");
  assert.deepEqual(r.snapAt(2400).drifters.map((d: { id: string }) => d.id), ["D1", "D2"]);
  assert.deepEqual(r.snapAt(3600).drifters.map((d: { id: string }) => d.id), ["D1", "D2"], "a third one is not spawned while two are alive");
  assert.equal(sim({ scenario: quiet, ticks: 1300, every: 100 }).snapAt(1300 - 100).drifters.length, 0, "none on Night 1");
  assert.equal(sim({ ...N2, scenario: { ...quiet, random_drifters: false }, ticks: 1300, every: 100 }).snapAt(1200).drifters.length, 0, "random_drifters false");
});

test("an idle drifter drifts at 2 m/s", () => {
  const r = sim({ ...N2, scenario: arena(0, [dr([30, 0, 30])]), ticks: 61, every: 60 });
  const a = r.snapAt(0).drifters[0].pos, b = r.snapAt(60).drifters[0].pos;
  near(Math.hypot(b[0] - a[0], b[2] - a[2]), 2, 0.01);
  assert.equal(r.snapAt(60).drifters[0].state, "idle");
});

test("idle -> chase only when Mây carries >= 5 and is within 15 m; the condition is rechecked every tick", () => {
  const st = (carried: number, pos: number[], extra = {}) => sim({ ...N2, scenario: arena(carried, [dr(pos, extra)]), ticks: 2, every: 1 }).snapAt(1).drifters[0].state;
  assert.equal(st(5, [10, 0, 0]), "chase");
  assert.equal(st(5, [15, 0, 0]), "chase", "15 m counts");
  assert.equal(st(5, [15.1, 0, 0]), "idle");
  assert.equal(st(4, [10, 0, 0]), "idle", "needs 5 motes");
  assert.equal(st(4, [10, 0, 0], { state: "chase" }), "idle", "a chasing drifter whose condition is lost goes back to idle");
});

test("a chasing drifter flies at 7 m/s", () => {
  const r = sim({ ...N2, scenario: arena(5, [dr([14, 0, 0])]), ticks: 31, every: 30 });
  near(r.snapAt(30).drifters[0].pos[0], 14 - 3.5, 0.01);
});

test("contact (XZ <= 1.2): steals min(3, carried), once, then flees; no flame lost", () => {
  const r = sim({ ...N2, scenario: arena(5, [dr([1, 0, 0])]), ticks: 100, every: 1 });
  assert.deepEqual(r.ev("drifter_steal").map((e) => [e.tick, e.data]), [[1, { drifter_id: "D1", amount: 3, carried: 2 }]]);
  const s1 = r.snapAt(1);
  assert.equal(s1.player.carried, 2);
  assert.equal(s1.player.flames, 3);
  assert.deepEqual([s1.drifters[0].state, s1.drifters[0].stolen], ["flee", 3]);
  assert.equal(r.ev("player_hit").length, 0);
});

test("steal range is 1.2 m", () => {
  const tick = (x: number) => sim({ ...N2, scenario: arena(5, [dr([x, 0, 0])]), ticks: 10 }).ev("drifter_steal")[0]?.tick;
  assert.equal(tick(1.3), 1, "after its first move it is at 1.18 m");
  assert.equal(tick(1.4), 2, "1.28 m after the first move, 1.17 m after the second");
});

test("only a chasing drifter steals: an idle one touching a light carrier does nothing", () => {
  const r = sim({ ...N2, scenario: arena(3, [dr([0.5, 0, 0])]), ticks: 20 });
  assert.equal(r.ev("drifter_steal").length, 0);
});

test("invulnerability and a lit lantern's safe zone do not stop a drifter", () => {
  const r = sim({
    ...N2,
    scenario: arena(6, [dr([10, 0, 0], { state: "chase" })], { player: { pos: [0, 0, 0], carried: 6, invuln_ticks: 500 }, lanterns: [{ id: "L1", pos: [5, 0, 0], lit: true }] }),
    ticks: 150,
  });
  assert.equal(r.ev("drifter_steal").length, 1);
});

test("the thief flees at 7 m/s for 240 ticks, then vanishes with the loot", () => {
  const r = sim({ ...N2, scenario: arena(5, [dr([1, 0, 0])]), ticks: 250, every: 1 });
  const dist = (t: number) => Math.hypot(r.snapAt(t).drifters[0].pos[0], r.snapAt(t).drifters[0].pos[2]);
  near(dist(61) - dist(1), 7, 0.05, "7 m/s away from Mây");
  assert.equal(r.snapAt(240).drifters.length, 1);
  assert.equal(r.snapAt(241).drifters.length, 0);
  assert.equal(r.snapAt(250).motes_active, 0, "the stolen motes are gone, not dropped");
});

test("Pulse on a chasing drifter makes it flee without stealing (no score, not in stunned_ids)", () => {
  const r = sim({ ...N2, scenario: arena(8, [dr([4, 0, 0], { state: "chase" })]), frames: press(0, "pulse"), ticks: 40, every: 1 });
  assert.deepEqual(r.ev("pulse")[0].data, { stunned_ids: [] });
  assert.deepEqual([r.snapAt(1).drifters[0].state, r.snapAt(1).drifters[0].stolen], ["flee", 0]);
  assert.equal(r.ev("drifter_steal").length, 0);
  assert.equal(r.end.score, 0);
});

test("Pulse on a fleeing thief drops all its loot on the spot; it vanishes 120 ticks later", () => {
  const r = sim({ ...N2, scenario: arena(4, [dr([4, 0, 0], { state: "flee", stolen: 3 })]), frames: press(0, "pulse"), ticks: 130, every: 1 });
  assert.deepEqual(r.ev("drifter_drop").map((e) => [e.tick, e.data]), [[1, { drifter_id: "D1", amount: 3 }]]);
  const dropped = r.snapAt(1).motes;
  assert.equal(dropped.length, 3);
  for (const m of dropped) { assert.equal(m.kind, "dropped"); assert.equal(m.ttl_s, 8); near(m.pos[0], 4, 0.001); near(m.pos[2], 0, 0.001); }
  assert.equal(r.snapAt(1).drifters[0].stolen, 0);
  assert.equal(r.snapAt(119).drifters.length, 1);
  assert.equal(r.snapAt(120).drifters.length, 0);
});

test("Pulse only affects drifters within 5 m (3D), and leaves idle ones alone", () => {
  const far = sim({ ...N2, scenario: arena(4, [dr([6, 0, 0], { state: "flee", stolen: 3 })]), frames: press(0, "pulse"), ticks: 3 });
  assert.equal(far.ev("drifter_drop").length, 0);
  const idle = sim({ ...N2, scenario: arena(4, [dr([4, 0, 0])]), frames: press(0, "pulse"), ticks: 3, every: 1 });
  assert.equal(idle.snapAt(1).drifters[0].state, "idle");
});

// ================================================================ charm (Bùa Gió)
test("picking up the charm: event, 600 ticks (10 s), the charm waits 2700 ticks to reappear", () => {
  const r = sim({ ...N2, scenario: scn({ player: { pos: [35, 0, 0] } }), ticks: 3, every: 1 });
  assert.deepEqual(r.ev("charm_picked").map((e) => [e.tick, e.data]), [[1, { charm_id: "C1", charm_ticks: 600 }]]);
  assert.equal(r.snapAt(1).player.charm_s, 10);
  assert.deepEqual(r.snapAt(1).charms, [{ id: "C1", available: false, respawn_s: 45 }]);
});

test("charm positions: Night 2 (35,0,0); Night 3 (30,0,25) and (-30,0,25)", () => {
  const pick = (night: number, pos: number[]) => sim({ night, scenario: scn({ player: { pos } }), ticks: 3 }).ev("charm_picked").map((e) => e.data.charm_id);
  assert.deepEqual(pick(2, [35, 0, 0]), ["C1"]);
  assert.deepEqual(pick(3, [30, 0, 25]), ["C1"]);
  assert.deepEqual(pick(3, [-30, 0, 25]), ["C2"]);
  assert.deepEqual(sim({ ticks: 1 }).snapAt(0).charms, [], "no charm on Night 1");
});

test("charm: run speed 7.2 m/s while active, 6 m/s after", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], charm_ticks: 300 } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 330, every: 1 });
  near(r.snapAt(20).player.vel[2], 7.2, 0.001);
  near(r.snapAt(299).player.vel[2], 7.2, 0.001);
  near(r.snapAt(320).player.vel[2], 6, 0.001);
  near(r.snapAt(100).player.charm_s, (300 - 100) / 60, 0.001); // rounded to 3 decimals in the output
});

test("charm: dash has no cooldown (press again right after the dash; presses during a dash are ignored)", () => {
  const frames = [...press(0, "dash"), ...press(5, "dash"), ...press(20, "dash")];
  const withCharm = sim({ scenario: scn({ player: { pos: [0, 0, 0], charm_ticks: 600 } }), frames, ticks: 40, every: 1 });
  assert.deepEqual(withCharm.ev("dash").map((e) => e.tick), [1, 21]);
  near(withCharm.snapAt(12).player.pos[2], 2.8, 0.01, "still 14 m/s for 12 ticks");
  assert.deepEqual(sim({ scenario: scn(), frames, ticks: 40 }).ev("dash").map((e) => e.tick), [1], "without the charm the 1.5 s cooldown blocks it");
  const running = sim({ scenario: scn({ player: { pos: [0, 0, 0], charm_ticks: 600, dash_cd_ticks: 80 } }), frames: press(0, "dash"), ticks: 3 });
  assert.deepEqual(running.ev("dash").map((e) => e.tick), [1], "a cooldown already running is ignored while the charm lasts");
});

test("a dash made under the charm leaves no cooldown behind when the charm ends", () => {
  const r = sim({ scenario: scn({ player: { pos: [0, 0, 0], charm_ticks: 15 } }), frames: [...press(0, "dash"), ...press(30, "dash")], ticks: 40, every: 1 });
  assert.equal(r.snapAt(1).player.dash_cd_s, 0, "the cooldown stays at 0 while the charm lasts");
  assert.deepEqual(r.ev("dash").map((e) => e.tick), [1, 31], "the charm is over by tick 15, yet the second dash is allowed");
});

test("charm respawn: available again exactly when its timer runs out", () => {
  const r = sim({ ...N2, scenario: scn({ charms: [{ id: "C1", available: false, respawn_s: 1 }] }), ticks: 61, every: 1 });
  assert.equal(r.snapAt(59).charms[0].available, false);
  assert.equal(r.snapAt(60).charms[0].available, true);
  assert.equal(r.snapAt(60).charms[0].respawn_s, 0);
});

test("picking the charm again refreshes it to 600 ticks", () => {
  const r = sim({ ...N2, scenario: scn({ player: { pos: [35, 0, 0], charm_ticks: 100 } }), ticks: 3, every: 1 });
  assert.equal(r.snapAt(1).player.charm_s, 10);
});
