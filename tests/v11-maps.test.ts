import { test } from "node:test";
import assert from "node:assert/strict";
import { runSim, InputError } from "../src/sim/run.ts";
import { sim, scn, near } from "./helpers.ts";

const N2 = { night: 2 };
const N3 = { night: 3 };
const press = (tick: number, key: string) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];

test("--night accepts 1, 2, 3 and rejects anything else with InputError (exit 2)", () => {
  for (const n of [0, 4]) assert.throws(() => runSim({ seed: 1, night: n, ticks: 1 }), InputError);
  for (const n of [1, 2, 3]) assert.equal(runSim({ seed: 1, night: n, ticks: 1 })[0].night, n);
});

// ================================================================ Night 2: Đảo Cau
test("Night 2 snapshot: 270 s, 6 lanterns at the standard coordinates, start (0,0,0), charm C1", () => {
  const s0 = sim({ ...N2, ticks: 1 }).snapAt(0);
  assert.equal(s0.night, 2);
  assert.equal(s0.time_left_s, 270); // v1.2: was 330 s
  assert.deepEqual(s0.lanterns.map((l: { id: string; pos: number[] }) => [l.id, ...l.pos]),
    [["L1", 0, 0, 20], ["L2", 17, 0, -10], ["L3", -17, 0, -10], ["L4", 70, 0, 20], ["L5", 87, 0, -10], ["L6", 53, 0, -10]]);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  assert.deepEqual(s0.charms, [{ id: "C1", available: true, respawn_s: 0 }]);
});

test("Night 2 motes: 20 of the 24 spawn points (4 at r=10 and 8 at r=22 on each island)", () => {
  const m = sim({ ...N2, seed: 5, ticks: 1 }).snapAt(0).motes as { pos: number[] }[];
  assert.equal(m.length, 20);
  assert.equal(new Set(m.map((x) => x.pos.join(","))).size, 20);
  let onA = 0, onB = 0;
  for (const x of m) {
    const dA = Math.hypot(x.pos[0], x.pos[2]), dB = Math.hypot(x.pos[0] - 70, x.pos[2]);
    const [d, isA] = dA < dB ? [dA, true] : [dB, false];
    assert.ok(Math.abs(d - 10) < 0.01 || Math.abs(d - 22) < 0.01, `radius ${d}`);
    if (isA) onA++; else onB++;
  }
  assert.ok(onA >= 8 && onB >= 8, `both islands are stocked (${onA}/${onB})`);
});

test("Night 2 shades: 2 at tick 300, then every 420 ticks, on the r=26 points of each island", () => {
  const r = sim({ ...N2, scenario: { random_motes: false, motes: [], player: { pos: [0, 0, 0] } }, ticks: 1200, every: 10 });
  assert.deepEqual(r.ev("shade_spawned").map((e) => e.tick), [300, 300, 720, 1140]);
  for (const s of r.snapAt(300).shades as { pos: number[] }[]) {
    const d = Math.min(Math.hypot(s.pos[0], s.pos[2]), Math.hypot(s.pos[0] - 70, s.pos[2]));
    near(d, 26, 0.01);
  }
});

test("the bamboo bridge carries the player across without a rail", () => {
  const r = sim({ ...N2, scenario: scn({ player: { pos: [27, 0, 0] } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 90, every: 10 });
  const p = r.snapAt(90).player;
  assert.ok(p.pos[0] > 34 && p.pos[0] < 44, `x ${p.pos[0]}`);
  assert.equal(p.pos[1], 0);
  assert.equal(r.events.filter((e) => e.name === "player_hit").length, 0);
});

test("stepping off the bridge (|z| > 2) or into the gap makes the player fall", () => {
  const r = sim({ ...N2, scenario: scn({ player: { pos: [35, 0, 1.5] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 200 });
  assert.equal(r.events.filter((e) => e.name === "player_hit" && e.data.by === "fall").length, 1);
});

test("jump pads launch Mây across the gap and land inside the other island", () => {
  for (const [from, island] of [[[20, 0, 18], 70], [[50, 0, -18], 0]] as const) {
    const r = sim({ ...N2, scenario: scn({ player: { pos: [...from] } }), frames: [{ tick: 0, move: [island ? -1 : 1, 0] }], ticks: 160, every: 1 });
    const v1 = r.snapAt(1).player;
    near(Math.hypot(v1.vel[0], v1.vel[2]), 24, 0.01, "24 m/s horizontal");
    assert.ok(v1.vel[1] > 13, "launched upwards");
    const landed = r.snaps.find((s) => s.tick > 5 && s.player.grounded);
    assert.ok(landed, "must land");
    assert.ok(landed!.tick >= 78 && landed!.tick <= 92, `flight lasted ${landed!.tick} ticks`);
    const [x, y, z] = landed!.player.pos;
    assert.ok(Math.hypot(x - island, z) <= 28, `landed at (${x}, ${z}) outside the destination island`);
    assert.equal(y, 0);
    assert.equal(r.events.filter((e) => e.name === "player_hit").length, 0, "no fall");
  }
});

// ================================================================ Night 3: Đảo Chuông
test("Night 3 snapshot: 300 s, 7 lanterns (with heights), start (0,0,-30), charms C1 and C2", () => {
  const s0 = sim({ ...N3, ticks: 1 }).snapAt(0);
  assert.equal(s0.night, 3);
  assert.equal(s0.time_left_s, 300); // v1.2: was 360 s
  assert.deepEqual(s0.lanterns.map((l: { id: string; pos: number[] }) => [l.id, ...l.pos]),
    [["L1", 0, 6, 6], ["L2", 18, 3, 10], ["L3", -18, 3, 10], ["L4", 35, 0, -10], ["L5", -35, 0, -10], ["L6", 20, 0, -35], ["L7", -20, 0, -35]]);
  assert.deepEqual(s0.player.pos, [0, 0, -30]);
  assert.deepEqual(s0.charms.map((c: { id: string }) => c.id), ["C1", "C2"]);
});

test("Night 3 motes: 20 of 30 points; tier 0 at r=34, tier 1 at r=18 (y=3), tier 2 at r=5 (y=6)", () => {
  const m = sim({ ...N3, seed: 4, ticks: 1 }).snapAt(0).motes as { pos: number[] }[];
  assert.equal(m.length, 20);
  for (const x of m) {
    const r = Math.hypot(x.pos[0], x.pos[2]);
    const want = x.pos[1] === 0 ? 34 : x.pos[1] === 3 ? 18 : x.pos[1] === 6 ? 5 : NaN;
    near(r, want, 0.01, `mote at height ${x.pos[1]}`);
    if (x.pos[1] === 3) assert.ok(x.pos[2] > 0, "tier-1 points are on the z > 0 half");
  }
});

test("a tier wall stops the player on the lower level (no climbing)", () => {
  const r = sim({ ...N3, scenario: scn({ player: { pos: [0, 0, 10] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 80, every: 1 });
  const p = r.snapAt(80).player;
  assert.ok(p.pos[2] <= 12.001 && p.pos[2] > 11, `stopped at the wall, z ${p.pos[2]}`);
  assert.equal(p.pos[1], 0);
  assert.equal(p.grounded, true);
});

test("walking off the edge of tier 1 drops to tier 0 without a fall penalty", () => {
  const r = sim({ ...N3, scenario: scn({ player: { pos: [0, 3, 22] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 100, every: 1 });
  const p = r.snapAt(100).player;
  assert.equal(p.pos[1], 0);
  assert.ok(p.pos[2] > 24);
  assert.equal(p.grounded, true);
  assert.equal(r.events.filter((e) => e.name === "player_hit").length, 0);
});

test("a ramp (3 m wide, 30 degrees) leads from tier 0 up to tier 1", () => {
  const a = (30 * Math.PI) / 180;
  const r = sim({
    ...N3, scenario: scn({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }),
    frames: [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }], ticks: 100, every: 1,
  });
  const ys = r.snaps.map((s) => s.player.pos[1] as number);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1] - 1e-9, "climbs monotonically");
  near(r.snapAt(100).player.pos[1], 3, 1e-6);
  assert.equal(r.snapAt(100).player.grounded, true);
});

test("the ramp is only 3 m wide: a path 2 m off its axis hits the tier wall instead", () => {
  const a = (30 * Math.PI) / 180, ux = Math.cos(a), uz = Math.sin(a);
  const start = [31 * ux + 2 * -uz, 0, 31 * uz + 2 * ux]; // outside the ramp zone, 2 m beside its axis
  const r = sim({ ...N3, scenario: scn({ player: { pos: start } }), frames: [{ tick: 0, move: [-ux, -uz] }], ticks: 150, every: 1 });
  const end = r.snapAt(150).player;
  assert.equal(end.pos[1], 0, "never climbs");
  const rr = Math.hypot(end.pos[0], end.pos[2]);
  assert.ok(rr >= 23.99 && rr <= 24.3, `stopped by the tier-1 wall at r=24, got ${rr}`);
});

test("tier 2 is a disc of radius 8; tier 1 exists only for z > 0", () => {
  const stay = sim({ ...N3, scenario: scn({ player: { pos: [0, 6, 7.5] } }), ticks: 20, every: 20 }).snapAt(20).player;
  assert.deepEqual([stay.pos[1], stay.grounded], [6, true]);
  const drop = sim({ ...N3, scenario: scn({ player: { pos: [0, 6, 8.5] } }), ticks: 60, every: 60 }).snapAt(60).player;
  assert.equal(drop.pos[1], 0, "r=8.5 is past the tier-2 edge: Mây falls to tier 0");
  const on = sim({ ...N3, scenario: scn({ player: { pos: [18, 3, 0.5] } }), ticks: 20, every: 20 }).snapAt(20).player;
  assert.equal(on.pos[1], 3);
  const off = sim({ ...N3, scenario: scn({ player: { pos: [18, 3, -0.5] } }), ticks: 40, every: 40 }).snapAt(40).player;
  assert.equal(off.pos[1], 0, "z < 0 is tier 0");
});

test("pad trigger radius is 1 m (0.9 launches, 1.2 does not)", () => {
  const v = (z: number) => sim({ ...N3, scenario: scn({ player: { pos: [0, 3, z] } }), ticks: 2, every: 1 }).snapAt(1).player.vel;
  near(v(13.9)[2], -8, 0.01);
  near(v(14.2)[2], 0, 0.01);
});

test("the pad at (0,3,13) throws Mây onto tier 2 (Y=6)", () => {
  const r = sim({ ...N3, scenario: scn({ player: { pos: [0, 3, 13] } }), ticks: 150, every: 1 });
  const v1 = r.snapAt(1).player;
  near(v1.vel[2], -8, 0.01); near(v1.vel[0], 0, 0.01); near(v1.vel[1], 12, 0.01);
  const landed = r.snaps.find((s) => s.tick > 5 && s.player.grounded)!;
  assert.equal(landed.player.pos[1], 6);
  assert.ok(Math.hypot(landed.player.pos[0], landed.player.pos[2]) <= 8);
  assert.ok(landed.tick >= 40 && landed.tick <= 70, `lands after ${landed.tick} ticks`);
  assert.equal(r.events.filter((e) => e.name === "player_hit").length, 0);
});

test("the bell tower (r=2) blocks the player on tier 2", () => {
  const r = sim({ ...N3, scenario: scn({ player: { pos: [0, 6, 5] } }), frames: [{ tick: 0, move: [0, -1] }], ticks: 120, every: 1 });
  const p = r.snapAt(120).player;
  assert.ok(Math.hypot(p.pos[0], p.pos[2]) >= 1.99, `inside the tower: ${p.pos}`);
  assert.equal(p.pos[1], 6);
});

test("Night 3 shades: 4.5 m/s, spawn every 360 ticks from tick 300", () => {
  const ch = sim({ ...N3, scenario: scn({ player: { pos: [0, 0, -30] }, shades: [{ id: "S1", pos: [10, 0, -30] }] }), ticks: 61, every: 60 });
  near(ch.snapAt(60).shades[0].pos[0], 10 - 4.5, 0.01);
  const sp = sim({ ...N3, scenario: { random_motes: false, motes: [], player: { pos: [0, 0, -30] } }, ticks: 1100 });
  assert.deepEqual(sp.ev("shade_spawned").map((e) => e.tick), [300, 300, 660, 1020]);
});

// ---------------------------------------------------------------- strong wind (A20)
test("Night 3 wind: warning from tick 1680, blows 1800..2099 at 2 m/s in the announced direction", () => {
  const r = sim({ ...N3, scenario: scn({ player: { pos: [0, 0, -20] } }), ticks: 2200, every: 10 });
  assert.equal(r.snapAt(1670).wind.active, false);
  assert.equal(r.snapAt(1670).wind.dir_deg, 0, "no direction announced yet");
  const warn = r.snapAt(1690).wind;
  assert.equal(warn.active, false);
  assert.ok(warn.dir_deg > 0 && warn.dir_deg < 360, "direction announced during the warning");
  assert.deepEqual(r.snapAt(1790).player.pos, [0, 0, -20], "no push before the wind blows");
  assert.equal(r.snapAt(1800).wind.active, true);
  assert.equal(r.snapAt(2090).wind.active, true);
  assert.equal(r.snapAt(2100).wind.active, false);
  const a = r.snapAt(1800).player.pos, b = r.snapAt(2100).player.pos;
  const dx = b[0] - a[0], dz = b[2] - a[2];
  near(Math.hypot(dx, dz), (299 * 2) / 60, 0.02, "299 more pushes of 2 m/s");
  const ang = ((Math.atan2(dz, dx) * 180) / Math.PI + 360) % 360;
  const diff = Math.abs(((ang - warn.dir_deg + 540) % 360) - 180);
  assert.ok(diff < 0.5, `pushed towards ${ang}, announced ${warn.dir_deg}`);
});

test("wind is deterministic per seed; wind_enabled false and Nights 1 and 2 have none", () => {
  const dir = (seed: number) => sim({ ...N3, seed, scenario: scn({ player: { pos: [0, 0, -20] } }), ticks: 1700, every: 10 }).snapAt(1690).wind.dir_deg;
  assert.equal(dir(11), dir(11));
  assert.notEqual(dir(11), dir(12));
  for (const o of [{ ...N3, scenario: scn({ wind_enabled: false, player: { pos: [0, 0, -20] } }) }, { scenario: scn() }, { ...N2, scenario: scn() }]) {
    const r = sim({ ...o, ticks: 2000, every: 100 });
    assert.ok(r.snaps.every((s) => !s.wind.active));
    assert.deepEqual(r.snapAt(2000).player.pos, r.snapAt(0).player.pos);
  }
});

test("wind cannot push Mây through a wall", () => {
  // on tier 2 next to the tower: wind from any direction still leaves Mây outside r=2 and at y=6
  const r = sim({ ...N3, scenario: scn({ player: { pos: [0, 6, 3] } }), ticks: 2200, every: 100 });
  for (const s of r.snaps) assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) >= 1.99);
});
