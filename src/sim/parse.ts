import { InputError } from "./errors.ts";

export type Vec3 = [number, number, number];

export interface ScenarioSpec {
  player: { pos?: Vec3; carried?: number; flames?: number; invulnTicks?: number; dashCdTicks?: number; pulseCdTicks?: number; charmTicks?: number; successfulLights?: number };
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled?: boolean;
  motes?: { pos: Vec3; kind?: "random" | "dropped"; ttlS?: number }[];
  shades?: { id?: string; pos: Vec3; state?: string; stateTicksLeft?: number; targetLanternId?: string }[];
  drifters?: { id?: string; pos: Vec3; state?: string; stolen?: number }[];
  charms?: { id: string; pos?: Vec3; available?: boolean; respawnS?: number }[];
  lanterns: { id: string; pos?: Vec3; deposited?: number; lit?: boolean; fuel?: number; everLit?: boolean; relitCount?: number }[];
  timeLeft?: number;
  /**
   * Benchmark scene (client only, never read from a scenario file): no damage, pickups, fuel burn, shade detection,
   * spawns or end of night. Shades still wander as usual so the swarm keeps moving.
   */
  bench?: boolean;
}

export interface Frame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const fail = (msg: string): never => {
  throw new InputError(msg);
};
function num(v: unknown, path: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${path}: expected a finite number`);
  return v as number;
}
function bool(v: unknown, path: string): boolean {
  if (typeof v !== "boolean") fail(`${path}: expected a boolean`);
  return v as boolean;
}
function str(v: unknown, path: string): string {
  if (typeof v !== "string") fail(`${path}: expected a string`);
  return v as string;
}
function vec3(v: unknown, path: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3) fail(`${path}: expected [x, y, z]`);
  const a = v as unknown[];
  return [num(a[0], `${path}[0]`), num(a[1], `${path}[1]`), num(a[2], `${path}[2]`)];
}
function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(`${path}: expected an array`);
  return v as unknown[];
}
const item = (v: unknown, path: string): Obj => (isObj(v) ? v : fail(`${path}: expected an object`));

export function parseScenario(raw: unknown): ScenarioSpec {
  const sc: ScenarioSpec = { player: {}, randomMotes: true, randomShades: true, randomDrifters: true, lanterns: [] };
  if (raw === undefined) return sc;
  if (!isObj(raw)) return fail("scenario: expected a JSON object");

  if (raw.player !== undefined) {
    const p = item(raw.player, "player");
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, "player.pos");
    for (const [k, f] of [["carried", "carried"], ["flames", "flames"], ["invuln_ticks", "invulnTicks"], ["dash_cd_ticks", "dashCdTicks"], ["pulse_cd_ticks", "pulseCdTicks"], ["charm_ticks", "charmTicks"], ["successful_lights", "successfulLights"]] as const) {
      if (p[k] !== undefined) sc.player[f] = num(p[k], `player.${k}`);
    }
  }
  if (raw.random_motes !== undefined) sc.randomMotes = bool(raw.random_motes, "random_motes");
  if (raw.random_shades !== undefined) sc.randomShades = bool(raw.random_shades, "random_shades");
  if (raw.random_drifters !== undefined) sc.randomDrifters = bool(raw.random_drifters, "random_drifters");
  if (raw.wind_enabled !== undefined) sc.windEnabled = bool(raw.wind_enabled, "wind_enabled");
  if (raw.time_left_s !== undefined) sc.timeLeft = num(raw.time_left_s, "time_left_s");

  if (raw.motes !== undefined) {
    sc.motes = list(raw.motes, "motes").map((m, i) => {
      if (Array.isArray(m)) return { pos: vec3(m, `motes[${i}]`) };
      const o = item(m, `motes[${i}]`);
      const out: NonNullable<ScenarioSpec["motes"]>[number] = { pos: vec3(o.pos, `motes[${i}].pos`) };
      if (o.kind !== undefined) {
        if (o.kind !== "random" && o.kind !== "dropped") fail(`motes[${i}].kind: expected "random" or "dropped"`);
        out.kind = o.kind as "random" | "dropped";
      }
      if (o.ttl_s !== undefined) out.ttlS = num(o.ttl_s, `motes[${i}].ttl_s`);
      return out;
    });
  }
  if (raw.shades !== undefined) {
    sc.shades = list(raw.shades, "shades").map((s, i) => {
      const o = item(s, `shades[${i}]`);
      const out: NonNullable<ScenarioSpec["shades"]>[number] = { pos: vec3(o.pos, `shades[${i}].pos`) };
      if (o.id !== undefined) out.id = str(o.id, `shades[${i}].id`);
      if (o.state !== undefined) out.state = str(o.state, `shades[${i}].state`);
      if (o.state_ticks_left !== undefined) out.stateTicksLeft = num(o.state_ticks_left, `shades[${i}].state_ticks_left`);
      if (o.target_lantern_id !== undefined) out.targetLanternId = str(o.target_lantern_id, `shades[${i}].target_lantern_id`);
      return out;
    });
  }
  if (raw.drifters !== undefined) {
    sc.drifters = list(raw.drifters, "drifters").map((d, i) => {
      const o = item(d, `drifters[${i}]`);
      const out: NonNullable<ScenarioSpec["drifters"]>[number] = { pos: vec3(o.pos, `drifters[${i}].pos`) };
      if (o.id !== undefined) out.id = str(o.id, `drifters[${i}].id`);
      if (o.state !== undefined) out.state = str(o.state, `drifters[${i}].state`);
      if (o.stolen !== undefined) out.stolen = num(o.stolen, `drifters[${i}].stolen`);
      return out;
    });
  }
  if (raw.charms !== undefined) {
    sc.charms = list(raw.charms, "charms").map((c, i) => {
      const o = item(c, `charms[${i}]`);
      const out: NonNullable<ScenarioSpec["charms"]>[number] = { id: str(o.id, `charms[${i}].id`) };
      if (o.pos !== undefined) out.pos = vec3(o.pos, `charms[${i}].pos`);
      if (o.available !== undefined) out.available = bool(o.available, `charms[${i}].available`);
      if (o.respawn_s !== undefined) out.respawnS = num(o.respawn_s, `charms[${i}].respawn_s`);
      return out;
    });
  }
  if (raw.lanterns !== undefined) {
    sc.lanterns = list(raw.lanterns, "lanterns").map((l, i) => {
      const o = item(l, `lanterns[${i}]`);
      const out: ScenarioSpec["lanterns"][number] = { id: str(o.id, `lanterns[${i}].id`) };
      if (o.pos !== undefined) out.pos = vec3(o.pos, `lanterns[${i}].pos`);
      if (o.deposited !== undefined) out.deposited = num(o.deposited, `lanterns[${i}].deposited`);
      if (o.lit !== undefined) out.lit = bool(o.lit, `lanterns[${i}].lit`);
      if (o.fuel !== undefined) out.fuel = num(o.fuel, `lanterns[${i}].fuel`);
      if (o.ever_lit !== undefined) out.everLit = bool(o.ever_lit, `lanterns[${i}].ever_lit`);
      if (o.relit_count !== undefined) out.relitCount = num(o.relit_count, `lanterns[${i}].relit_count`);
      return out;
    });
  }
  return sc;
}

export function parseInputs(raw: unknown): Frame[] {
  if (raw === undefined) return [];
  if (!isObj(raw) || !Array.isArray(raw.frames)) return fail('inputs: expected {"frames": [...]}');
  const frames: Frame[] = [];
  let last = -1;
  (raw.frames as unknown[]).forEach((f, i) => {
    const o = item(f, `frames[${i}]`);
    const tick = num(o.tick, `frames[${i}].tick`);
    if (!Number.isInteger(tick) || tick < 0) fail(`frames[${i}].tick: expected a non-negative integer`);
    if (tick <= last) fail(`frames[${i}].tick: ticks must be strictly increasing`);
    last = tick;
    const fr: Frame = { tick };
    if (o.move !== undefined) {
      if (!Array.isArray(o.move) || o.move.length !== 2) fail(`frames[${i}].move: expected [x, z]`);
      const mv = o.move as unknown[];
      const x = num(mv[0], `frames[${i}].move[0]`);
      const z = num(mv[1], `frames[${i}].move[1]`);
      if (Math.abs(x) > 1 || Math.abs(z) > 1) fail(`frames[${i}].move: components must be within [-1, 1]`);
      fr.move = [x, z];
    }
    if (o.cam_yaw_deg !== undefined) fr.cam_yaw_deg = num(o.cam_yaw_deg, `frames[${i}].cam_yaw_deg`);
    for (const k of ["jump", "interact", "pulse", "dash", "pause"] as const) {
      if (o[k] !== undefined) fr[k] = bool(o[k], `frames[${i}].${k}`);
    }
    frames.push(fr);
  });
  return frames;
}
