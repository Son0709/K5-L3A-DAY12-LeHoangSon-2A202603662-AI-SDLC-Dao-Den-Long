import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const c = JSON.parse(readFileSync("game.contract.json", "utf8"));

test("game.contract.json has all Contract v1.0 keys", () => {
  assert.equal(c.contract_version, "1.0");
  for (const k of ["team", "build_cmd", "run_cmd", "headless_cmd"]) assert.ok(typeof c[k] === "string" && c[k].length > 0, k);
  const keys = [
    "player_speed", "carry_capacity", "lantern_cost", "lantern_count_night1", "pickup_radius",
    "interact_radius", "pulse_cost", "pulse_radius", "night1_duration_s", "flames", "invuln_s",
    "hit_drop_ratio", "pulse_stun_s", "pulse_push_m", "pulse_cooldown_s", "safe_radius",
    "shade_speed", "shade_hit_radius", "fall_enabled", "score",
  ];
  for (const k of keys) assert.ok(k in c.tuning, `tuning.${k} missing`);
  for (const k of ["per_mote", "per_lantern", "per_stun", "per_second_left", "per_flame_left"]) {
    assert.ok(k in c.tuning.score, `tuning.score.${k} missing`);
  }
  assert.equal(c.tuning.lantern_count_night1, 5);
});

test("tuning values match docs/notes/assumptions.md", () => {
  const t = c.tuning;
  assert.deepEqual(
    [t.player_speed, t.carry_capacity, t.lantern_cost, t.pickup_radius, t.interact_radius, t.pulse_cost, t.pulse_radius],
    [6, 10, 8, 1.2, 2.5, 2, 6],
  );
  assert.deepEqual(
    [t.night1_duration_s, t.flames, t.invuln_s, t.hit_drop_ratio, t.pulse_stun_s, t.pulse_push_m, t.pulse_cooldown_s],
    [300, 3, 1.5, 0.5, 3, 3, 4],
  );
  assert.deepEqual([t.safe_radius, t.shade_speed, t.shade_hit_radius, t.fall_enabled], [5, 4, 1, false]);
  assert.deepEqual(t.score, { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 1, per_flame_left: 50 });
});
