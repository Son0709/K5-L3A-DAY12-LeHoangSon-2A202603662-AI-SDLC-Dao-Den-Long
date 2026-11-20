import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn, near } from "./helpers.ts";

const press = (tick: number, key = "pulse") => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const shade = (pos: number[], extra = {}) => ({ id: "S1", pos, ...extra });
const withPlayer = (carried: number, shades: object[], extra = {}) => scn({ player: { pos: [0, 0, 0], carried }, shades, ...extra });

// ---------------------------------------------------------------- AI states: wander / chase (detect 12 m, lose 18 m)
test("a shade within 12 m chases at 4 m/s", () => {
  const r = sim({ scenario: scn({ shades: [shade([10, 0, 0])] }), ticks: 61, every: 60 });
  const s = r.snapAt(60).shades[0];
  assert.equal(s.state, "chase");
  near(s.pos[0], 6, 0.01);
});

test("detection range: 12 m chases at once, 13 m keeps wandering", () => {
  assert.equal(sim({ scenario: scn({ shades: [shade([12, 0, 0])] }), ticks: 2, every: 1 }).snapAt(1).shades[0].state, "chase");
  assert.equal(sim({ scenario: scn({ shades: [shade([13, 0, 0])] }), ticks: 2, every: 1 }).snapAt(1).shades[0].state, "wander");
});

test("a chasing shade gives up beyond 18 m", () => {
  const r = sim({ scenario: scn({ shades: [shade([20, 0, 0], { state: "chase" })] }), ticks: 2, every: 1 });
  assert.equal(r.snapAt(1).shades[0].state, "wander");
});

test("scenario can place a shade in a given state with ticks left", () => {
  const r = sim({ scenario: scn({ shades: [shade([30, 0, 0], { state: "stunned", state_ticks_left: 50 })] }), ticks: 61, every: 1 });
  assert.equal(r.snapAt(10).shades[0].state, "stunned");
  assert.notEqual(r.snapAt(60).shades[0].state, "stunned");
});

// ---------------------------------------------------------------- contact, drop, recoil, invulnerability
test("hit: -1 flame, drops floor(carried/2) motes on a 1.5-2.5 m ring (480-tick life), invulnerable 90 ticks", () => {
  const r = sim({ scenario: withPlayer(10, [shade([0.5, 0, 0])]), ticks: 3, every: 1 });
  assert.deepEqual(r.ev("player_hit").map((e) => [e.tick, e.data]), [[1, { by: "shade", flames: 2, dropped: 5 }]]);
  const s1 = r.snapAt(1);
  assert.equal(s1.player.carried, 5);
  assert.equal(s1.player.flames, 2);
  assert.equal(s1.player.invuln, true);
  const dropped = s1.motes.filter((m: { kind: string }) => m.kind === "dropped");
  assert.equal(dropped.length, 5);
  for (const m of dropped) {
    const d = Math.hypot(m.pos[0], m.pos[2]);
    assert.ok(d >= 1.5 - 0.002 && d <= 2.5 + 0.002, `ring distance ${d}`);
    assert.equal(m.ttl_s, 8);
  }
  assert.equal(s1.shades[0].state, "recoil");
});

test("dropped motes expire: TTL counts down and the mote disappears", () => {
  const r = sim({ scenario: scn({ motes: [{ pos: [10, 0, 0], kind: "dropped", ttl_s: 1 }] }), ticks: 62, every: 1 });
  assert.equal(r.snapAt(0).motes[0].ttl_s, 1);
  assert.equal(r.snapAt(60).motes_active, 1);
  assert.equal(r.snapAt(61).motes_active, 0);
});

test("a dropped mote can be picked up again (next tick onwards)", () => {
  const r = sim({ scenario: scn({ motes: [{ pos: [0, 0, 0.5], kind: "dropped", ttl_s: 8 }] }), ticks: 3 });
  assert.deepEqual(r.ev("mote_picked").map((e) => e.tick), [1]);
});

test("recoil: the shade that hit is pushed back 2 m over 60 ticks, then acts again", () => {
  const r = sim({ scenario: withPlayer(0, [shade([0.5, 0, 0])]), ticks: 70, every: 1 });
  assert.equal(r.snapAt(60).shades[0].state, "recoil");
  assert.notEqual(r.snapAt(61).shades[0].state, "recoil");
  near(r.snapAt(61).shades[0].pos[0], 0.5 - 4 / 60 + 2, 0.01);
});

test("invulnerability 90 ticks: next hit comes at tick 91; three hits lose with no_flames", () => {
  const r = sim({ scenario: withPlayer(10, [shade([0.5, 0, 0])]), ticks: 400 });
  const h = r.ev("player_hit");
  assert.deepEqual(h.map((e) => e.tick), [1, 91, 181]);
  assert.deepEqual(h.map((e) => [e.data.flames, e.data.dropped]), [[2, 5], [1, 2], [0, 1]]);
  assert.deepEqual(r.ev("game_over").map((e) => [e.tick, e.data]), [[181, { result: "lost", reason: "no_flames" }]]);
  assert.equal(r.end.state, "lost");
  assert.equal(r.end.ticks, 181);
});

test("at most one flame lost per tick; the lowest id hits, a touching shade during invulnerability does nothing", () => {
  const two = [{ id: "S2", pos: [0.5, 0, 0] }, { id: "S1", pos: [0, 0, 0.5] }];
  const r = sim({ scenario: withPlayer(0, two), ticks: 5, every: 1 });
  assert.equal(r.ev("player_hit").length, 1);
  const st = Object.fromEntries(r.snapAt(1).shades.map((s: { id: string; state: string }) => [s.id, s.state]));
  assert.equal(st.S1, "recoil");
  assert.equal(st.S2, "chase", "no recoil for the shade that touched while invulnerable");
});

test("a stunned shade does not hurt", () => {
  const r = sim({ scenario: withPlayer(0, [shade([0.5, 0, 0], { state: "stunned", state_ticks_left: 100 })]), ticks: 90 });
  assert.equal(r.ev("player_hit").length, 0);
});

test("height rule: no contact when the height difference is above 1.5", () => {
  const hi = sim({ scenario: withPlayer(0, [shade([0.5, 1.6, 0])]), ticks: 5 });
  assert.equal(hi.ev("player_hit").length, 0);
  const lo = sim({ scenario: withPlayer(0, [shade([0.5, 1.5, 0])]), ticks: 5 });
  assert.equal(lo.ev("player_hit").length, 1);
});

// ---------------------------------------------------------------- pulse (3 motes, 5 m, 3 s cooldown, stun 120, push 4 m in 15 ticks)
test("pulse: cost 3, stun, +5, cooldown 3 s, shade pushed 4 m in 15 ticks and stays stunned 120 ticks", () => {
  const r = sim({ scenario: withPlayer(5, [shade([4, 0, 0])]), frames: press(0), ticks: 130, every: 1 });
  assert.deepEqual(r.ev("pulse").map((e) => [e.tick, e.data]), [[1, { stunned_ids: ["S1"] }]]);
  const s1 = r.snapAt(1);
  assert.equal(s1.player.carried, 2);
  near(s1.player.pulse_cd_s, 3, 0.001);
  assert.equal(r.end.score, 5);
  near(r.snapAt(15).shades[0].pos[0], 8, 0.01);
  near(r.snapAt(14).shades[0].pos[0], 8 - 4 / 15, 0.01);
  near(r.snapAt(100).shades[0].pos[0], 8, 0.01, "no more pushing after 15 ticks");
  assert.equal(r.snapAt(120).shades[0].state, "stunned");
  assert.equal(r.snapAt(121).shades[0].state, "chase");
});

test("pulse range is 3D from the player's feet + 0.8 m", () => {
  const hit = (pos: number[]) => sim({ scenario: withPlayer(5, [shade(pos)]), frames: press(0), ticks: 3 }).ev("pulse")[0].data.stunned_ids;
  assert.deepEqual(hit([4.9, 0, 0]), ["S1"]);
  assert.deepEqual(hit([5.0, 0, 0]), [], "sqrt(25 + 0.64) > 5");
  assert.deepEqual(hit([5.0, 0.8, 0]), ["S1"], "same height as the centre: exactly 5");
});

test("pulse needs 3 motes and respects the cooldown", () => {
  assert.equal(sim({ scenario: withPlayer(2, [shade([4, 0, 0])]), frames: press(0), ticks: 5 }).ev("pulse").length, 0);
  const r = sim({ scenario: withPlayer(10, []), frames: [...press(0), ...press(100), ...press(200)], ticks: 220 });
  assert.deepEqual(r.ev("pulse").map((e) => e.tick), [1, 201]);
});

test("already stunned shades are hit again: +5 each time, stun is refreshed to 120", () => {
  const two = [{ id: "S1", pos: [4, 0, 0] }, { id: "S2", pos: [0, 0, 3], state: "stunned", state_ticks_left: 50 }];
  const r = sim({ scenario: withPlayer(5, two), frames: press(0), ticks: 110, every: 1 });
  assert.deepEqual(r.ev("pulse")[0].data.stunned_ids, ["S1", "S2"]);
  assert.equal(r.end.score, 10);
  assert.equal(r.snapAt(100).shades.find((s: { id: string }) => s.id === "S2").state, "stunned", "would have ended at tick 50");
});

test("a shade exactly on the player is pushed along +X", () => {
  const r = sim({ scenario: withPlayer(5, [shade([0, 0, 0])]), frames: press(0), ticks: 20, every: 1 });
  near(r.snapAt(15).shades[0].pos[0], 4, 0.01);
  near(r.snapAt(15).shades[0].pos[2], 0, 0.01);
});

// ---------------------------------------------------------------- safe zone (6 m around lit lanterns)
test("a lit lantern keeps shades at 6 m or more (all snapshots)", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L1", pos: [0, 0, 8], lit: true }], shades: [shade([0, 0, 16], { state: "chase" })] }), ticks: 400, every: 1 });
  let closest = Infinity;
  for (const s of r.snaps) {
    const d = Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 8);
    closest = Math.min(closest, d);
    assert.ok(d >= 6 - 0.002, `inside the zone at tick ${s.tick}: ${d}`);
  }
  assert.ok(closest < 6.01, "the shade reaches the edge");
  assert.equal(r.ev("player_hit").length, 0);
});

test("an unlit lantern does not stop shades", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L1", pos: [0, 0, 8], lit: false }], shades: [shade([0, 0, 16], { state: "chase" })] }), ticks: 400 });
  assert.ok(r.ev("player_hit").length >= 1);
});

test("a shade inside the zone when the lantern is lit is pushed to the edge within 30 ticks, harmless meanwhile", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 2] }], shades: [shade([0, 0, 3.5], { state: "chase" })] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }], ticks: 45, every: 1,
  });
  assert.equal(r.ev("lantern_lit").length, 1);
  assert.equal(r.snapAt(1).shades[0].state, "recoil");
  const dist = (t: number) => Math.hypot(r.snapAt(t).shades[0].pos[0], r.snapAt(t).shades[0].pos[2] - 2);
  assert.ok(dist(25) < 5.9, "the push is spread over up to 30 ticks, not instant");
  const d31 = dist(31);
  near(d31, 6, 0.01, "at the zone edge by tick 31");
  assert.equal(r.ev("player_hit").length, 0);
});
