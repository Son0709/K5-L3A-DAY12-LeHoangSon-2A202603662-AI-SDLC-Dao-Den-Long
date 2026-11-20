import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const c = JSON.parse(readFileSync("game.contract.json", "utf8"));

test("game.contract.json is Contract v1.2 with all required keys", () => {
  assert.equal(c.contract_version, "1.2");
  for (const k of ["team", "build_cmd", "run_cmd", "headless_cmd"]) assert.ok(typeof c[k] === "string" && c[k].length > 0, k);
  const keys = [
    "player_speed", "carry_capacity", "lantern_cost", "lantern_count_night1", "pickup_radius", "interact_radius",
    "pulse_cost", "pulse_radius", "night1_duration_s", "night2_duration_s", "night3_duration_s", "flames", "invuln_s",
    "hit_drop_ratio", "pulse_stun_s", "pulse_push_m", "pulse_cooldown_s", "safe_radius", "shade_speed",
    "shade_hit_radius", "fall_enabled", "dash_speed", "dash_duration_s", "dash_cooldown_s", "score",
    // new in v1.2 (Ticket-03)
    "fuel_max", "fuel_decay_per_s", "fuel_per_mote", "relight_cost", "win_ratio", "drain_per_s", "low_fuel_threshold", "capacity_max",
  ];
  for (const k of keys) assert.ok(k in c.tuning, `tuning.${k} missing`);
  for (const k of ["per_mote", "per_lantern", "per_relight", "per_stun", "per_stun_drain", "per_lantern_dawn", "per_flame_left"]) assert.ok(k in c.tuning.score, k);
});

test("tuning equals the Ticket-02 standard numbers plus the Ticket-03 fuel numbers", () => {
  const t = c.tuning;
  assert.deepEqual(
    [t.player_speed, t.carry_capacity, t.lantern_cost, t.lantern_count_night1, t.pickup_radius, t.interact_radius],
    [6, 10, 10, 5, 1.0, 2.0],
  );
  assert.deepEqual([t.pulse_cost, t.pulse_radius, t.pulse_cooldown_s, t.pulse_stun_s, t.pulse_push_m], [3, 5, 3, 2, 4]);
  assert.deepEqual([t.flames, t.invuln_s, t.hit_drop_ratio, t.safe_radius, t.shade_speed, t.shade_hit_radius], [3, 1.5, 0.5, 6, 4, 1]);
  assert.deepEqual([t.dash_speed, t.dash_duration_s, t.dash_cooldown_s, t.fall_enabled], [14, 0.2, 1.5, true]);
  // v1.2: nights shortened to 240 / 270 / 300 s
  assert.deepEqual([t.night1_duration_s, t.night2_duration_s, t.night3_duration_s], [240, 270, 300]);
  assert.deepEqual(
    [t.fuel_max, t.fuel_decay_per_s, t.fuel_per_mote, t.relight_cost, t.win_ratio, t.drain_per_s, t.low_fuel_threshold, t.capacity_max],
    [100, 1.0, 10, 5, 0.6, 5, 30, 20],
  );
  // v1.2: new score table (the old per_second_left time bonus is gone)
  assert.deepEqual(t.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lantern_dawn: 50, per_flame_left: 50 });
  assert.ok(!("per_second_left" in t.score));
});
