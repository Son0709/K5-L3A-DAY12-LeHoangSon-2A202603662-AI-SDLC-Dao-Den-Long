import { InputError } from "./errors.ts";

export type Vec3 = [number, number, number];

export interface ScenarioSpec {
  player: { pos?: Vec3; carried?: number; flames?: number };
  randomMotes: boolean;
  randomShades: boolean;
  motes?: { pos: Vec3 }[];
  shades?: { id?: string; pos: Vec3 }[];
  lanterns: { id: string; pos?: Vec3; deposited?: number; lit?: boolean }[];
  timeLeft?: number;
}

export interface Frame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
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
function vec3(v: unknown, path: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3) fail(`${path}: expected [x, y, z]`);
  const a = v as unknown[];
  return [num(a[0], `${path}[0]`), num(a[1], `${path}[1]`), num(a[2], `${path}[2]`)];
}

export function parseScenario(raw: unknown): ScenarioSpec {
  if (raw === undefined) return { player: {}, randomMotes: true, randomShades: true, lanterns: [] };
  if (!isObj(raw)) return fail("scenario: expected a JSON object");
  const sc: ScenarioSpec = { player: {}, randomMotes: true, randomShades: true, lanterns: [] };

  if (raw.player !== undefined) {
    if (!isObj(raw.player)) fail("scenario.player: expected an object");
    const p = raw.player as Obj;
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, "player.pos");
    if (p.carried !== undefined) sc.player.carried = num(p.carried, "player.carried");
    if (p.flames !== undefined) sc.player.flames = num(p.flames, "player.flames");
  }
  if (raw.random_motes !== undefined) sc.randomMotes = bool(raw.random_motes, "random_motes");
  if (raw.random_shades !== undefined) sc.randomShades = bool(raw.random_shades, "random_shades");
  if (raw.time_left_s !== undefined) sc.timeLeft = num(raw.time_left_s, "time_left_s");

  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) fail("motes: expected an array");
    sc.motes = (raw.motes as unknown[]).map((m, i) => ({
      pos: vec3(isObj(m) ? m.pos : m, `motes[${i}]`),
    }));
  }
  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) fail("shades: expected an array");
    sc.shades = (raw.shades as unknown[]).map((s, i) => {
      if (!isObj(s)) return fail(`shades[${i}]: expected an object`);
      const o = s as Obj;
      const out: { id?: string; pos: Vec3 } = { pos: vec3(o.pos, `shades[${i}].pos`) };
      if (o.id !== undefined) {
        if (typeof o.id !== "string") fail(`shades[${i}].id: expected a string`);
        out.id = o.id as string;
      }
      return out;
    });
  }
  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) fail("lanterns: expected an array");
    sc.lanterns = (raw.lanterns as unknown[]).map((l, i) => {
      if (!isObj(l)) return fail(`lanterns[${i}]: expected an object`);
      const o = l as Obj;
      if (typeof o.id !== "string") fail(`lanterns[${i}].id: expected a string`);
      const out: ScenarioSpec["lanterns"][number] = { id: o.id as string };
      if (o.pos !== undefined) out.pos = vec3(o.pos, `lanterns[${i}].pos`);
      if (o.deposited !== undefined) out.deposited = num(o.deposited, `lanterns[${i}].deposited`);
      if (o.lit !== undefined) out.lit = bool(o.lit, `lanterns[${i}].lit`);
      return out;
    });
  }
  return sc;
}

export function parseInputs(raw: unknown): Frame[] {
  if (raw === undefined) return [];
  if (!isObj(raw) || !Array.isArray(raw.frames)) return fail("inputs: expected {\"frames\": [...]}");
  const frames: Frame[] = [];
  let last = -1;
  (raw.frames as unknown[]).forEach((f, i) => {
    if (!isObj(f)) fail(`frames[${i}]: expected an object`);
    const o = f as Obj;
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
    for (const k of ["jump", "interact", "pulse", "dash"] as const) {
      if (o[k] !== undefined) fr[k] = bool(o[k], `frames[${i}].${k}`);
    }
    frames.push(fr);
  });
  return frames;
}
