import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn, near } from "./helpers.ts";

const press = (tick: number, key: string) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];

// ---------------------------------------------------------------- snapshot / contract shape
test("snapshot tick 0 has the v1.1 shape (default scenario, Night 1)", () => {
  const s0 = sim({ ticks: 5 }).snapAt(0);
  assert.equal(s0.night, 1);
  assert.equal(s0.state, "playing");
  assert.equal(s0.sim_tick, 0);
  assert.equal(s0.time_left_s, 240); // v1.2 (Ticket-03): Night 1 is 240 s, was 300 s
  assert.equal(s0.score, 0);
  assert.deepEqual(s0.wind, { active: false, dir_deg: 0 });
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.deepEqual(s0.player.vel, [0, 0, 0]);
  assert.equal(s0.player.flames, 3);
  assert.equal(s0.player.carried, 0);
  assert.equal(s0.player.grounded, true);
  assert.equal(s0.player.invuln, false);
  for (const k of ["dash_cd_s", "pulse_cd_s", "charm_s"]) assert.equal(s0.player[k], 0, k);
  assert.ok(Array.isArray(s0.drifters) && Array.isArray(s0.charms) && Array.isArray(s0.motes) && Array.isArray(s0.shades));
  assert.equal(s0.shades.length, 0, "no shades before tick 300");
});

test("Night 1 standard map: lanterns at the ticket coordinates", () => {
  const ls = sim({ ticks: 1 }).snapAt(0).lanterns;
  assert.deepEqual(ls.map((l: { id: string }) => l.id), ["L1", "L2", "L3", "L4", "L5"]);
  assert.deepEqual(ls.map((l: { pos: number[] }) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
});

test("20 motes at game start, on 20 distinct spawn points (r=12 or r=33)", () => {
  const m = sim({ seed: 3, ticks: 1 }).snapAt(0).motes as { pos: number[]; kind: string; ttl_s: number | null }[];
  assert.equal(m.length, 20);
  const keys = new Set(m.map((x) => x.pos.join(",")));
  assert.equal(keys.size, 20, "distinct points");
  for (const x of m) {
    const r = Math.hypot(x.pos[0], x.pos[2]);
    assert.ok(Math.abs(r - 12) < 0.01 || Math.abs(r - 33) < 0.01, `radius ${r}`);
    assert.equal(x.kind, "random");
    assert.equal(x.ttl_s, null);
  }
});

test("--ticks N runs exactly N steps; snapshots every 10 from 0; sim_tick == tick", () => {
  const r = sim({ scenario: scn(), ticks: 35 });
  assert.deepEqual([r.end.type, r.end.ticks, r.end.state], ["end", 35, "playing"]);
  const ticks = r.snaps.map((s) => s.tick);
  for (const t of [0, 10, 20, 30]) assert.ok(ticks.includes(t));
  for (const s of r.snaps) assert.equal(s.sim_tick, s.tick);
});

test("time_left_s = duration - sim_tick/60; scenario overrides duration", () => {
  const r = sim({ scenario: scn(), ticks: 121, every: 60 });
  near(r.snapAt(60).time_left_s, 239, 0.001); // v1.2 (Ticket-03): Night 1 lasts 240 s, was 300 s
  const o = sim({ scenario: scn({ time_left_s: 50 }), ticks: 61, every: 60 });
  assert.equal(o.snapAt(0).time_left_s, 50);
  near(o.snapAt(60).time_left_s, 49, 0.001);
});

test("scenario setup emits no events and no score; unknown lantern ids are ignored", () => {
  const r = sim({ scenario: scn({ lanterns: [{ id: "L1", lit: true }, { id: "L9", pos: [1, 0, 1] }] }), ticks: 5 });
  assert.equal(r.events.length, 0);
  assert.equal(r.end.score, 0);
  assert.equal(r.snapAt(0).lanterns.length, 5);
  assert.equal(r.snapAt(0).lanterns[0].lit, true);
});

test("scenario player fields are applied (pos, carried, flames, timers)", () => {
  const p = sim({ scenario: scn({ player: { pos: [3, 0, 4], carried: 4, flames: 2, invuln_ticks: 30, dash_cd_ticks: 60, pulse_cd_ticks: 120, charm_ticks: 300 } }), ticks: 1 }).snapAt(0).player;
  assert.deepEqual(p.pos, [3, 0, 4]);
  assert.equal(p.carried, 4);
  assert.equal(p.flames, 2);
  assert.equal(p.invuln, true);
  assert.deepEqual([p.dash_cd_s, p.pulse_cd_s, p.charm_s], [1, 2, 5]);
});

// ---------------------------------------------------------------- movement (A1: accel 60 m/s^2 -> 6 m/s in 6 ticks)
test("accelerates to 6 m/s in 6 ticks; 60 ticks cover 5.75 m", () => {
  const r = sim({ scenario: scn(), frames: [{ tick: 0, move: [0, 1] }], ticks: 61, every: 1 });
  near(r.snapAt(3).player.vel[2], 3, 0.001);
  near(r.snapAt(6).player.vel[2], 6, 0.001);
  near(r.snapAt(60).player.pos[2], 5.75, 0.01);
});

test("stops within 6 ticks after releasing the stick", () => {
  const r = sim({ scenario: scn(), frames: [{ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] }], ticks: 50, every: 1 });
  near(r.snapAt(30).player.vel[2], 6, 0.001);
  near(r.snapAt(36).player.vel[2], 0, 0.001);
  const z36 = r.snapAt(36).player.pos[2], z49 = r.snapAt(49).player.pos[2];
  assert.equal(z36, z49, "no drift once stopped");
});

test("camera yaw 90 maps move [0,1] onto +X; diagonal is normalised", () => {
  const y = sim({ scenario: scn(), frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 61, every: 60 }).snapAt(60).player.pos;
  near(y[0], 5.75, 0.01); near(y[2], 0, 0.01);
  const d = sim({ scenario: scn(), frames: [{ tick: 0, move: [1, 1] }], ticks: 61, every: 60 }).snapAt(60).player.pos;
  near(d[0], 5.75 / Math.SQRT2, 0.01); near(d[2], 5.75 / Math.SQRT2, 0.01);
});

test("frame fields absent keep their previous value", () => {
  const r = sim({ scenario: scn(), frames: [{ tick: 0, move: [0, 1] }, { tick: 30, interact: false }], ticks: 61, every: 60 });
  near(r.snapAt(60).player.pos[2], 5.75, 0.01);
});

// ---------------------------------------------------------------- jump
test("jump: peak about 1.17 m, airborne then lands, held key fires once, no double jump", () => {
  const r = sim({ scenario: scn(), frames: [{ tick: 0, jump: true }], ticks: 200, every: 1 });
  const ys = r.snaps.map((s) => s.player.pos[1] as number);
  assert.ok(Math.max(...ys) > 1.1 && Math.max(...ys) < 1.25, `peak ${Math.max(...ys)}`);
  assert.equal(r.snapAt(10).player.grounded, false);
  near(r.snapAt(100).player.pos[1], 0, 1e-6, "landed, not re-jumping while key held");
  assert.equal(r.snapAt(100).player.grounded, true);
  const dbl = sim({ scenario: scn(), frames: [...press(0, "jump"), ...press(10, "jump")], ticks: 100, every: 1 });
  assert.ok(Math.max(...dbl.snaps.map((s) => s.player.pos[1] as number)) < 1.25, "second press in the air is ignored");
});

// ---------------------------------------------------------------- dash (14 m/s, 12 ticks, 90 tick cooldown)
test("dash covers 2.8 m in 12 ticks, along the move direction, and emits a dash event", () => {
  const r = sim({ scenario: scn(), frames: [{ tick: 0, move: [1, 0], dash: true }, { tick: 1, dash: false }], ticks: 20, every: 1 });
  assert.deepEqual(r.ev("dash").map((e) => [e.tick, e.data]), [[1, {}]]);
  near(r.snapAt(12).player.pos[0], 2.8, 0.01);
  near(r.snapAt(12).player.vel[0], 14, 0.01);
  near(r.snapAt(1).player.dash_cd_s, 1.5, 0.001);
});

test("dash with no input follows the facing direction (+Z at start)", () => {
  const r = sim({ scenario: scn(), frames: press(0, "dash"), ticks: 15, every: 1 });
  near(r.snapAt(12).player.pos[2], 2.8, 0.01);
  near(r.snapAt(12).player.pos[0], 0, 0.001);
});

test("dash cooldown 1.5 s counted from the start: press at 60 ignored, press at 95 works", () => {
  const r = sim({ scenario: scn(), frames: [...press(0, "dash"), ...press(60, "dash"), ...press(95, "dash")], ticks: 120 });
  assert.deepEqual(r.ev("dash").map((e) => e.tick), [1, 96]);
});

test("a dash in the air keeps the altitude", () => {
  const r = sim({ scenario: scn(), frames: [...press(0, "jump"), ...press(5, "dash")], ticks: 25, every: 1 });
  const y6 = r.snapAt(6).player.pos[1], y17 = r.snapAt(17).player.pos[1];
  assert.ok(y6 > 0);
  assert.equal(y6, y17);
});

// ---------------------------------------------------------------- falling off the island (Y < -10)
test("walking off the rim: one fall hit, all motes lost, respawn after 60 ticks at the start, invulnerable", () => {
  const r = sim({
    scenario: scn({ player: { pos: [39, 0, 0], carried: 5, flames: 3 } }),
    frames: [{ tick: 0, move: [1, 0] }, { tick: 20, move: [0, 0] }],
    ticks: 260, every: 1,
  });
  const falls = r.events.filter((e) => e.name === "player_hit" && e.data.by === "fall");
  assert.equal(falls.length, 1, "exactly once");
  assert.deepEqual(falls[0].data, { by: "fall", flames: 2, dropped: 0, lost: 5 });
  const T0 = falls[0].tick;
  assert.equal(r.snapAt(T0).player.carried, 0);
  const back = r.snapAt(T0 + 61).player;
  near(back.pos[0], 0, 0.01); near(back.pos[2], 0, 0.01);
  assert.equal(back.invuln, true);
  assert.equal(back.flames, 2);
  assert.equal(r.ev("game_over").length, 0);
});

test("free fall from y=0 crosses Y < -10 at exactly tick 60 (g=-20, 60 Hz)", () => {
  const r = sim({ scenario: scn({ player: { pos: [60, 0, 0], carried: 2 } }), ticks: 100, every: 1 });
  const fall = r.events.find((e) => e.name === "player_hit")!;
  assert.equal(fall.tick, 60);
  assert.equal(fall.data.lost, 2);
  assert.ok(r.snapAt(59).player.pos[1] > -10 && r.snapAt(60).player.pos[1] < -10);
});

test("fall ignores invulnerability", () => {
  const r = sim({ scenario: scn({ player: { pos: [39, 0, 0], invuln_ticks: 5000 } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 200 });
  assert.equal(r.events.filter((e) => e.data?.by === "fall").length, 1);
});

test("last flame lost to a fall: lost/no_flames at once, no respawn", () => {
  const r = sim({ scenario: scn({ player: { pos: [39, 0, 0], flames: 1 } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 400 });
  const fall = r.events.find((e) => e.name === "player_hit")!;
  assert.deepEqual(r.ev("game_over").map((e) => [e.tick, e.data]), [[fall.tick, { result: "lost", reason: "no_flames" }]]);
  assert.equal(r.end.state, "lost");
  assert.equal(r.end.ticks, fall.tick);
});

// ---------------------------------------------------------------- pause (A12)
test("pause freezes sim_tick, time and movement; tick keeps counting; snapshot says paused", () => {
  const r = sim({
    scenario: scn(),
    frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 50, pause: true }, { tick: 51, pause: false }],
    ticks: 100, every: 1,
  });
  assert.deepEqual(r.events.filter((e) => e.name === "paused" || e.name === "resumed").map((e) => [e.name, e.tick]), [["paused", 11], ["resumed", 51]]);
  assert.equal(r.snapAt(10).state, "playing");
  assert.equal(r.snapAt(11).state, "paused");
  assert.equal(r.snapAt(30).state, "paused");
  assert.equal(r.snapAt(30).sim_tick, 10);
  assert.deepEqual(r.snapAt(11).player.pos, r.snapAt(50).player.pos);
  assert.equal(r.snapAt(11).time_left_s, r.snapAt(50).time_left_s);
  assert.equal(r.snapAt(51).state, "playing");
  assert.equal(r.snapAt(51).sim_tick, 11);
  assert.equal(r.end.ticks, 100);
});

// ---------------------------------------------------------------- win / lose rules and score
// REMOVED in v1.2 (Ticket-03, ADR-0001): "last lantern: all_lit wins ... score with floor(s) x 2". The early win on all_lit and the time
// bonus no longer exist. The dawn rule is tested in tests/v12-fuel.test.ts.

test("out of time without enough lanterns lit: lost/dawn", () => {
  const r = sim({ scenario: scn({ time_left_s: 1 }), ticks: 1000 });
  assert.deepEqual(r.ev("game_over").map((e) => [e.tick, e.data]), [[60, { result: "lost", reason: "dawn" }]]);
  assert.equal(r.end.score, 0);
});

test("no flames always loses, even if every lantern is lit", () => {
  const lit = ["L1", "L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const r = sim({ scenario: scn({ lanterns: lit, player: { pos: [0, 0, 0], flames: 0 } }), ticks: 10 });
  assert.deepEqual(r.ev("game_over").map((e) => e.data), [{ result: "lost", reason: "no_flames" }]);
});

// ---------------------------------------------------------------- scheduled spawns
test("motes: +1 at ticks 240, 480... while below 30; none at 30", () => {
  const r = sim({ scenario: { random_shades: false, shades: [], player: { pos: [0, 0, 0] } }, ticks: 500, every: 10 });
  assert.equal(r.snapAt(230).motes_active, 20);
  assert.equal(r.snapAt(240).motes_active, 21);
  assert.equal(r.snapAt(470).motes_active, 21);
  assert.equal(r.snapAt(480).motes_active, 22);
  const full = Array.from({ length: 30 }, (_, i) => [30 + (i % 5), 0, 10 + Math.floor(i / 5)]);
  const f = sim({ scenario: { random_shades: false, shades: [], motes: full, player: { pos: [0, 0, 0] } }, ticks: 500, every: 10 });
  assert.equal(f.snapAt(480).motes_active, 30, "cap 30");
});

test("random_motes false: nothing is scheduled", () => {
  const r = sim({ scenario: scn(), ticks: 500, every: 10 });
  assert.equal(r.snapAt(480).motes_active, 0);
});

test("shades: 2 at tick 300, then 1 every 480 ticks; ids S1..; spawning for 60 ticks then wander", () => {
  const r = sim({ scenario: { random_motes: false, motes: [], player: { pos: [0, 0, 0] } }, ticks: 800, every: 10 });
  assert.deepEqual(r.ev("shade_spawned").map((e) => [e.tick, e.data.id]), [[300, "S1"], [300, "S2"], [780, "S3"]]);
  assert.equal(r.snapAt(290).shades.length, 0);
  assert.equal(r.snapAt(300).shades.length, 2);
  assert.equal(r.snapAt(350).shades[0].state, "spawning");
  assert.equal(r.snapAt(360).shades[0].state, "wander");
});

test("shades spawn on the 12 points at r=37, at least 15 m from the player", () => {
  const r = sim({ scenario: { random_motes: false, motes: [], player: { pos: [37, 0, 0] } }, ticks: 790, every: 10 });
  const sh = r.snapAt(300).shades as { pos: number[] }[];
  assert.equal(sh.length, 2);
  for (const s of sh) {
    near(Math.hypot(s.pos[0], s.pos[2]), 37, 0.01);
    assert.ok(Math.hypot(s.pos[0] - 37, s.pos[2]) >= 15 - 0.01, "too close to the player");
  }
});
