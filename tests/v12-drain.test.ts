import { test } from "node:test";
import assert from "node:assert/strict";
import { sim, scn, near } from "./helpers.ts";

const press = (tick: number, key = "interact") => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const dist2 = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const FAR = { player: { pos: [0, 0, -30] } }; // far from any shade used below, so they stay in wander

// ================================================================ safe zone only with fuel >= 30
test("a lantern with fuel < 30 loses its safe zone; exactly 30 still keeps it", () => {
  const zoneAt1 = (fuel: number) => {
    // the lantern burns one unit before shades move, so 30 + 1/60 is exactly 30 when the shade is pushed
    const r = sim({
      scenario: scn({ lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel }], shades: [{ id: "S1", pos: [0, 0, 5.2], state: "chase" }] }),
      ticks: 2, every: 1,
    });
    return dist2(r.snapAt(1).shades[0].pos, [0, 0, 10]);
  };
  assert.ok(zoneAt1(30 + 1 / 60) >= 5.998, "fuel exactly 30 keeps the zone");
  assert.ok(zoneAt1(30) < 5.9, "fuel below 30 has no zone");
  assert.ok(zoneAt1(100) >= 5.998);
});

// ================================================================ wander picks a lantern
test("wander shades head for the weakest lit lantern even when a dark one is nearer", () => {
  const r = sim({
    scenario: scn({ ...FAR, lanterns: [{ id: "L1", pos: [-20, 0, 10], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [24, 0, 10] }] }),
    ticks: 61, every: 60,
  });
  near(r.snapAt(60).shades[0].pos[0], 24 - 4, 0.05, "walks -X at 4 m/s towards L1, not +X towards the dark L2 at (23.8,0,7.7)");
  assert.equal(r.snapAt(60).shades[0].state, "wander");
});

test("with two equally weak lanterns the smaller id is chosen", () => {
  const r = sim({
    scenario: scn({ ...FAR, lanterns: [{ id: "L1", pos: [10, 0, 0], lit: true, fuel: 20 }, { id: "L2", pos: [-10, 0, 0], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 20] }] }),
    ticks: 31, every: 30,
  });
  // from (0,0,20) towards L1 at (10,0,0): 2 m in 30 ticks, of which 2 x 10 / 22.4 = 0.89 m along +X (L2 would give a negative x)
  near(r.snapAt(30).shades[0].pos[0], 0.894, 0.02);
});

test("with no weak lantern a wander shade goes to the nearest dark lantern and stops within 2 m (no draining)", () => {
  const lit = ["L1", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const r = sim({ scenario: scn({ ...FAR, lanterns: lit, shades: [{ id: "S1", pos: [30, 0, 10] }] }), ticks: 200, every: 10 });
  const d = dist2(r.snapAt(200).shades[0].pos, [23.8, 0, 7.7]);
  assert.ok(d <= 2.001 && d > 1.5, `stopped ${d} m from the dark lantern`);
  assert.equal(r.ev("fuel_drain").length, 0);
  assert.equal(r.snapAt(200).shades[0].state, "wander");
});

// ================================================================ drain
test("within 2 m of a weak lit lantern a wander shade switches to drain and stands still", () => {
  const r = sim({ scenario: scn({ ...FAR, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 8.5] }] }), ticks: 80, every: 1 });
  assert.equal(r.snapAt(1).shades[0].state, "drain");
  assert.deepEqual(r.snapAt(1).shades[0].pos, r.snapAt(80).shades[0].pos);
});

test("drain takes 5 fuel/s on top of the burn of 1/s; fuel_drain is logged every 60 ticks", () => {
  const r = sim({ scenario: scn({ ...FAR, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 8.5] }] }), ticks: 130, every: 1 });
  // tick 1: burn only (the shade becomes draining in step 8); ticks 2..: 6 units per tick
  near(r.snapAt(60).lanterns[0].fuel, 20 - (1 + 59 * 6) / 60, 0.06);
  near(r.snapAt(120).lanterns[0].fuel, 20 - (1 + 119 * 6) / 60, 0.06);
  assert.deepEqual(r.ev("fuel_drain").map((e) => [e.tick, e.data.lantern_id, e.data.shade_id]), [[61, "L1", "S1"], [121, "L1", "S1"]]);
  near(r.ev("fuel_drain")[0].data.fuel, 14, 0.06);
});

test("several draining shades add up", () => {
  const one = (n: number) => {
    const shades = Array.from({ length: n }, (_, i) => ({ id: `S${i + 1}`, pos: [0, 0, 8.5 + i * 0.2], state: "drain", target_lantern_id: "L1" }));
    return sim({ scenario: scn({ ...FAR, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 25 }], shades }), ticks: 61, every: 60 }).snapAt(60).lanterns[0].fuel;
  };
  // the lantern must stay below 30 to be drainable; every tick costs 1 (burn) + 5 per shade
  near(25 - one(1), (60 * 6) / 60, 0.1);
  near(25 - one(2), (60 * 11) / 60, 0.1);
});

test("the drained lantern goes out; the shade then returns to wander", () => {
  const r = sim({ scenario: scn({ ...FAR, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 5 }], shades: [{ id: "S1", pos: [0, 0, 8.5] }] }), ticks: 80, every: 1 });
  assert.deepEqual(r.ev("lantern_out").map((e) => e.tick), [51]);
  assert.equal(r.snapAt(50).shades[0].state, "drain");
  assert.equal(r.snapAt(51).shades[0].state, "wander");
});

test("drain -> chase when Mây comes within 6 m (6.0 counts, 6.1 does not)", () => {
  const st = (z: number) => sim({ scenario: scn({ player: { pos: [0, 0, 0] }, lanterns: [{ id: "L1", pos: [0, 0, 7], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, z], state: "drain", target_lantern_id: "L1" }] }), ticks: 2, every: 1 }).snapAt(1).shades[0].state;
  assert.equal(st(6.0), "chase");
  assert.equal(st(6.1), "drain");
});

test("Tỏa Sáng on a draining shade: +15 in total, stunned, and it returns to wander afterwards (not drain)", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 6], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0.8, 5], state: "drain", target_lantern_id: "L1" }] }),
    frames: press(0, "pulse"), ticks: 200, every: 1,
  });
  assert.deepEqual(r.ev("pulse")[0].data, { stunned_ids: ["S1"] });
  assert.equal(r.end.score, 15);
  assert.equal(r.snapAt(1).shades[0].state, "stunned");
  assert.equal(r.snapAt(120).shades[0].state, "stunned");
  // after the stun it is in wander, which re-checks detection at once: Mây is 9 m away (< 12 m), so it chases; it is never `drain`
  assert.ok(["wander", "chase"].includes(r.snapAt(121).shades[0].state), r.snapAt(121).shades[0].state);
  // it walks back to the weak lantern after the stun and may drain again, but never while stunned (ticks 1..120)
  assert.ok(r.ev("fuel_drain").every((e) => e.tick > 121), "no drain while stunned");
});

test("refuelling a drained lantern to >= 30 frees it: the shade stops draining and is pushed out of the zone, harmless for up to 30 ticks", () => {
  const r = sim({
    scenario: scn({ player: { pos: [0, 0, 11.5], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0, 0, 9], state: "drain", target_lantern_id: "L1" }] }),
    frames: press(0), ticks: 45, every: 1,
  });
  assert.equal(r.ev("refuel")[0].data.fuel, 100);
  assert.equal(r.snapAt(1).shades[0].state, "recoil", "being expelled");
  assert.equal(r.ev("player_hit").length, 0);
  assert.ok(dist2(r.snapAt(31).shades[0].pos, [0, 0, 10]) >= 5.99, "outside the 6 m zone");
  assert.equal(r.ev("fuel_drain").length, 0);
});

// ================================================================ a weak lantern is a hole in the defence
test("a shade can walk into the zone of a weak lantern but not into a healthy one", () => {
  const reach = (fuel: number) => {
    const r = sim({ scenario: scn({ lanterns: [{ id: "L1", pos: [0, 0, 8], lit: true, fuel }], shades: [{ id: "S1", pos: [0, 0, 16], state: "chase" }] }), ticks: 400, every: 1 });
    return Math.min(...r.snaps.map((s) => dist2(s.shades[0].pos, [0, 0, 8])));
  };
  assert.ok(reach(100) >= 5.99, "healthy: kept out");
  assert.ok(reach(20) < 3, "weak: the shade gets in");
});
