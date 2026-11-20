// Generates docs/proof/phase-2 evidence by running the real headless CLI as a black box (Contract v1.1).
// Expected values are derived by hand from docs/notes/phase2-spec.md and the ticket, NOT copied from output.
// Usage: npm run proof   (exits 1 if any check fails)
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";

const contractVersion = JSON.parse(readFileSync("game.contract.json", "utf8")).contract_version;
if (contractVersion !== "1.1") {
  console.error(`proof (phase 2): game.contract.json is v${contractVersion}; this script is for Contract v1.1.`);
  process.exit(2);
}

const ROOT = "docs/proof/phase-2";
mkdirSync(`${ROOT}/scenarios`, { recursive: true });
mkdirSync(`${ROOT}/runs`, { recursive: true });
mkdirSync("out", { recursive: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Line = Record<string, any>;
interface Run { id: string; cmd: string; status: number | null; stderr: string; lines: Line[]; hash: string; raw: string; ms: number }
interface Check { id: string; req: string; desc: string; pass: boolean; detail: string }

const checks: Check[] = [];
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const approx = (a: number, b: number, e = 0.02) => Math.abs(a - b) <= e;
const check = (id: string, req: string, desc: string, pass: boolean, detail = "") => checks.push({ id, req, desc, pass, detail: pass ? "" : detail });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const writeJson = (path: string, obj: unknown) => { writeFileSync(path, JSON.stringify(obj, null, 2) + "\n"); return path; };

interface Opts { seed?: number; night?: number; ticks: number; scenario?: unknown; inputs?: unknown; every?: number; rawInputs?: string; big?: boolean }
const runs: Run[] = [];
function go(id: string, o: Opts): Run {
  const outFile = o.big ? `out/${id}.jsonl` : `${ROOT}/runs/${id}.jsonl`;
  const args = ["--seed", String(o.seed ?? 1), "--night", String(o.night ?? 1), "--ticks", String(o.ticks), "--out", outFile, "--snapshot-every", String(o.every ?? 10)];
  if (o.scenario) args.push("--scenario", writeJson(`${ROOT}/scenarios/${id}.scenario.json`, o.scenario));
  if (o.inputs) args.push("--inputs", writeJson(`${ROOT}/scenarios/${id}.inputs.json`, o.inputs));
  if (o.rawInputs !== undefined) { writeFileSync(`${ROOT}/scenarios/${id}.inputs.json`, o.rawInputs); args.push("--inputs", `${ROOT}/scenarios/${id}.inputs.json`); }
  const t0 = performance.now();
  const r = spawnSync(process.execPath, ["src/headless/cli.ts", ...args], { encoding: "utf8" });
  const ms = performance.now() - t0;
  let raw = "";
  try { raw = readFileSync(outFile, "utf8"); } catch { /* no output on error exit */ }
  const lines = o.big ? [] : raw.trim() ? raw.trim().split("\n").map((l) => JSON.parse(l) as Line) : [];
  const run = { id, cmd: "node src/headless/cli.ts " + args.join(" "), status: r.status, stderr: r.stderr, lines, hash: sha(raw), raw: o.big ? "" : raw, ms };
  if (o.big) (run as Run & { size: number }).size = statSync(outFile).size;
  runs.push(run);
  return run;
}
const ev = (r: Run, name: string) => r.lines.filter((l) => l.type === "event" && l.name === name);
const snap = (r: Run, t: number) => r.lines.find((l) => l.type === "snapshot" && l.tick === t) as Line;
const end = (r: Run) => r.lines[r.lines.length - 1];
const press = (tick: number, key: string) => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const EMPTY = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], drifters: [] };
const at = (pos: number[], extra: object = {}) => ({ ...EMPTY, player: { pos, ...extra } });
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// =============================================================== A. Phase 1 behaviour re-run with the standard numbers (regression)
{
  const motes = Array.from({ length: 10 }, (_, i) => [0, 0, 2 + i]);
  const lit = ["L1", "L2", "L3", "L4"].map((id) => ({ id, lit: true }));
  const r = go("a1-win", {
    ticks: 400, scenario: { ...EMPTY, motes, lanterns: [...lit, { id: "L5", pos: [0, 0, 14] }] },
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 130, move: [0, 0] }, { tick: 140, interact: true }, { tick: 141, interact: false }] },
  });
  check("A1.a", "AC-MOTE", "walking +Z picks 10 motes (carried 1..10)", eq(ev(r, "mote_picked").map((e) => e.data.carried), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
  check("A1.b", "AC-LANTERN", "interact deposits 10 then lights L5 (deposit before lantern_lit)", eq(ev(r, "deposit").map((e) => e.data), [{ lantern_id: "L5", amount: 10, deposited: 10 }]) && ev(r, "lantern_lit").length === 1);
  check("A1.c", "AC-END", "all lit => won/all_lit at tick 141, run stops there", eq(ev(r, "game_over").map((e) => [e.tick, e.data]), [[141, { result: "won", reason: "all_lit" }]]) && end(r).ticks === 141 && end(r).state === "won", JSON.stringify(end(r)));
  // 10 motes x10 + lantern 100 + floor((18000-141)/60)=297 s x2 + 3 flames x50
  check("A1.d", "AC-END", "score = 100 + 100 + 297x2 + 150 = 944", end(r).score === 100 + 100 + 297 * 2 + 150, `got ${end(r).score}`);
}
{
  const r = go("a2-lose", { ticks: 400, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 10 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] } });
  const h = ev(r, "player_hit");
  check("A2.a", "AC-SHADE", "hits at ticks 1, 91, 181 (invulnerable 90 ticks); flames 2,1,0; dropped 5,2,1", eq(h.map((e) => e.tick), [1, 91, 181]) && eq(h.map((e) => [e.data.flames, e.data.dropped]), [[2, 5], [1, 2], [0, 1]]), JSON.stringify(h.map((e) => [e.tick, e.data])));
  check("A2.b", "AC-END", "lost/no_flames at the 3rd hit, no bonus score", eq(ev(r, "game_over").map((e) => [e.tick, e.data]), [[181, { result: "lost", reason: "no_flames" }]]) && end(r).score === 0, JSON.stringify(end(r)));
}
{
  const r = go("a3-pulse", { ticks: 130, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }, { id: "S2", pos: [20, 0, 0] }] }, inputs: { frames: press(0, "pulse") } });
  check("A3.a", "AC-PULSE", "pulse hits only S1 (4 m), costs 3 (5 -> 2), cooldown 3 s, +5 score", eq(ev(r, "pulse")[0]?.data, { stunned_ids: ["S1"] }) && snap(r, 1).player.carried === 2 && approx(snap(r, 1).player.pulse_cd_s, 3, 0.001) && end(r).score === 5);
  const s = (t: number) => snap(r, t).shades.find((x: Line) => x.id === "S1");
  check("A3.b", "AC-PULSE", "pushed 4 m in 15 ticks (x 4 -> 8), stunned through tick 120, chasing again at 121", approx(s(15).pos[0], 8, 0.01) && approx(s(100).pos[0], 8, 0.01) && s(120).state === "stunned" && s(121).state === "chase");
}
{
  const r = go("a4-dawn", { ticks: 1000, scenario: { ...EMPTY, time_left_s: 1 } });
  check("A4", "AC-END", "time out with lanterns dark => lost/dawn at tick 60", eq(ev(r, "game_over").map((e) => [e.tick, e.data]), [[60, { result: "lost", reason: "dawn" }]]) && end(r).ticks === 60, JSON.stringify(end(r)));
}
{
  const r = go("a5-safe", { ticks: 400, every: 1, scenario: { ...EMPTY, lanterns: [{ id: "L1", pos: [0, 0, 8], lit: true }], shades: [{ id: "S1", pos: [0, 0, 16], state: "chase" }] } });
  const ds = r.lines.filter((l) => l.type === "snapshot").map((s) => dist(s.shades[0].pos, [0, 0, 8]));
  const min = Math.min(...ds);
  check("A5", "AC-SAFE", "shade approaches a lit lantern but never closer than 6 m", min >= 5.998 && min <= 6.01 && ev(r, "player_hit").length === 0, `min ${min}`);
}

// =============================================================== B. Part 1: physics, dash, fall, pause, schedules
{
  const r = go("b1-move", { ticks: 70, every: 1, scenario: at([0, 0, 0]), inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0] }] } });
  check("B1.a", "AC-MOVE", "accelerates 1 m/s per tick: 6 m/s at tick 6; 60 ticks cover 5.75 m", approx(snap(r, 6).player.vel[2], 6, 0.001) && approx(snap(r, 60).player.pos[2], 5.75, 0.01));
  check("B1.b", "AC-MOVE", "stops within 6 ticks after releasing the stick", approx(snap(r, 66).player.vel[2], 0, 0.001));
}
{
  const r = go("b2-jump", { ticks: 100, every: 1, scenario: at([0, 0, 0]), inputs: { frames: [{ tick: 0, jump: true }] } });
  const peak = Math.max(...r.lines.filter((l) => l.type === "snapshot").map((s) => s.player.pos[1]));
  check("B2", "AC-JUMP", "jump peak about 1.17 m (v=7, g=-20); lands; held key does not re-jump", peak > 1.1 && peak < 1.25 && snap(r, 100).player.pos[1] === 0 && snap(r, 100).player.grounded === true, `peak ${peak}`);
}
{
  const r = go("b3-dash", { ticks: 130, every: 1, scenario: at([0, 0, 0]), inputs: { frames: [...press(0, "dash"), ...press(60, "dash"), ...press(95, "dash")] } });
  check("B3.a", "AC-DASH", "dash covers 2.8 m (14 m/s x 12 ticks), cooldown 90 ticks from the start: events at 1 and 96 only", approx(snap(r, 12).player.pos[2], 2.8, 0.01) && eq(ev(r, "dash").map((e) => e.tick), [1, 96]));
}
{
  const r = go("b4-fall", { ticks: 120, every: 1, scenario: at([60, 0, 0], { carried: 2 }) });
  const f = ev(r, "player_hit")[0];
  check("B4.a", "AC-FALL", "free fall crosses Y < -10 at tick 60: one fall hit, all motes lost", f?.tick === 60 && eq(f.data, { by: "fall", flames: 2, dropped: 0, lost: 2 }), JSON.stringify(f));
  const rim = go("b4-rim", { ticks: 260, every: 1, scenario: at([39, 0, 0], { carried: 5 }), inputs: { frames: [{ tick: 0, move: [1, 0] }, { tick: 20, move: [0, 0] }] } });
  const T0 = ev(rim, "player_hit")[0]?.tick;
  const back = snap(rim, T0 + 61).player;
  check("B4.b", "AC-FALL", "walking off the rim: respawn after 60 ticks at the start, invulnerable, still 2 flames", approx(back.pos[0], 0, 0.01) && approx(back.pos[2], 0, 0.01) && back.invuln === true && back.flames === 2);
}
{
  const r = go("b5-pause", { ticks: 100, every: 1, scenario: at([0, 0, 0]), inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 50, pause: true }, { tick: 51, pause: false }] } });
  check("B5", "AC-PAUSE", "paused/resumed events at 11/51; sim_tick, time and position frozen in between; state paused", eq([...ev(r, "paused"), ...ev(r, "resumed")].map((e) => [e.name, e.tick]), [["paused", 11], ["resumed", 51]]) && snap(r, 30).state === "paused" && snap(r, 30).sim_tick === 10 && eq(snap(r, 11).player.pos, snap(r, 50).player.pos) && snap(r, 51).sim_tick === 11 && end(r).ticks === 100);
}
{
  const r = go("b6-schedule", { ticks: 800, scenario: { player: { pos: [0, 0, 0] }, random_drifters: false } });
  check("B6.a", "AC-MOTE", "20 motes at start; 21 at tick 240; 22 at tick 480", snap(r, 0).motes_active === 20 && snap(r, 230).motes_active === 20 && snap(r, 240).motes_active === 21 && snap(r, 480).motes_active === 22);
  check("B6.b", "AC-SHADE", "shades: 2 at tick 300 (S1, S2), 1 at tick 780 (S3); spawning for 60 ticks then wander", eq(ev(r, "shade_spawned").map((e) => [e.tick, e.data.id]), [[300, "S1"], [300, "S2"], [780, "S3"]]) && snap(r, 350).shades[0].state === "spawning");
}

// =============================================================== C. Contract v1.1 shape and the three maps
{
  const names = ["1", "2", "3"].map((n) => go(`c1-night${n}`, { night: Number(n), ticks: 20, scenario: n === "3" ? { player: { pos: [0, 0, -30] } } : undefined }));
  const s = names.map((r) => snap(r, 0));
  check("C1.a", "AC-CONTRACT-1.1", "snapshot has night, wind, player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}, motes.{kind,ttl_s}, drifters, charms", s.every((x, i) => x.night === i + 1 && "wind" in x && ["vel", "grounded", "invuln", "dash_cd_s", "pulse_cd_s", "charm_s"].every((k) => k in x.player) && x.motes.every((m: Line) => "kind" in m && "ttl_s" in m) && Array.isArray(x.drifters) && Array.isArray(x.charms)));
  check("C1.b", "AC-NIGHTS", "durations 300/330/360 s; lantern counts 5/6/7", eq(s.map((x) => x.time_left_s), [300, 330, 360]) && eq(s.map((x) => x.lanterns.length), [5, 6, 7]));
  check("C1.c", "AC-CONTRACT-1.1", "night_start {night} is emitted once at tick 1", names.every((r, i) => eq(ev(r, "night_start").map((e) => [e.tick, e.data]), [[1, { night: i + 1 }]])));
  check("C1.d", "AC-NIGHTS", "Night 1 L2 = (23.8,0,7.7); Night 2 L4 = (70,0,20); Night 3 L1 = (0,6,6)", eq(s[0].lanterns[1].pos, [23.8, 0, 7.7]) && eq(s[1].lanterns[3].pos, [70, 0, 20]) && eq(s[2].lanterns[0].pos, [0, 6, 6]));
}
{
  const a = go("c2-pad-a", { night: 2, ticks: 160, every: 1, scenario: at([20, 0, 18]) });
  const b = go("c2-pad-b", { night: 2, ticks: 160, every: 1, scenario: at([50, 0, -18]) });
  const land = (r: Run) => r.lines.find((l) => l.type === "snapshot" && l.tick > 5 && l.player.grounded) as Line;
  const la = land(a), lb = land(b);
  check("C2.a", "AC-NIGHTS", "Night 2 pads: launched at 24 m/s horizontal; land inside the other island after 78-92 ticks, no fall", approx(Math.hypot(snap(a, 1).player.vel[0], snap(a, 1).player.vel[2]), 24, 0.01) && la.tick >= 78 && la.tick <= 92 && dist(la.player.pos, [70, 0, 0]) <= 28 && dist(lb.player.pos, [0, 0, 0]) <= 28 && ev(a, "player_hit").length === 0 && ev(b, "player_hit").length === 0, `${la?.tick} ${la?.player.pos}`);
  const br = go("c2-bridge", { night: 2, ticks: 90, every: 10, scenario: at([27, 0, 0]), inputs: { frames: [{ tick: 0, move: [1, 0] }] } });
  const gap = go("c2-gap", { night: 2, ticks: 200, scenario: at([35, 0, 1.5]), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  check("C2.b", "AC-NIGHTS", "bridge is walkable; stepping off its side (|z| > 2) makes Mây fall", ev(br, "player_hit").length === 0 && snap(br, 90).player.pos[0] > 34 && ev(gap, "player_hit").filter((e) => e.data.by === "fall").length === 1);
}
{
  const wall = go("c3-wall", { night: 3, ticks: 80, every: 80, scenario: at([0, 0, 10]), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  const a30 = (30 * Math.PI) / 180;
  const ramp = go("c3-ramp", { night: 3, ticks: 100, every: 100, scenario: at([31 * Math.cos(a30), 0, 31 * Math.sin(a30)]), inputs: { frames: [{ tick: 0, move: [-Math.cos(a30), -Math.sin(a30)] }] } });
  const pad = go("c3-pad", { night: 3, ticks: 150, every: 1, scenario: at([0, 3, 13]) });
  const tower = go("c3-tower", { night: 3, ticks: 120, every: 120, scenario: at([0, 6, 5]), inputs: { frames: [{ tick: 0, move: [0, -1] }] } });
  const padLand = pad.lines.find((l) => l.type === "snapshot" && l.tick > 5 && l.player.grounded) as Line;
  check("C3.a", "AC-NIGHTS", "tier wall stops Mây at z = 12 (no climbing); a ramp leads up to tier 1 (y = 3)", snap(wall, 80).player.pos[2] <= 12.001 && snap(wall, 80).player.pos[1] === 0 && approx(snap(ramp, 100).player.pos[1], 3, 1e-6));
  check("C3.b", "AC-NIGHTS", "pad at (0,3,13) lands Mây on tier 2 (y = 6); the bell tower (r = 2) blocks", padLand.player.pos[1] === 6 && Math.hypot(padLand.player.pos[0], padLand.player.pos[2]) <= 8 && Math.hypot(snap(tower, 120).player.pos[0], snap(tower, 120).player.pos[2]) >= 1.99);
  const w = go("c3-wind", { night: 3, ticks: 2200, every: 10, scenario: at([0, 0, -20]) });
  const warn = snap(w, 1690).wind;
  const p1 = snap(w, 1800).player.pos, p2 = snap(w, 2100).player.pos;
  const ang = ((Math.atan2(p2[2] - p1[2], p2[0] - p1[0]) * 180) / Math.PI + 360) % 360;
  check("C3.c", "AC-NIGHTS", "wind: announced from tick 1680, blows 1800-2099 at 2 m/s towards the announced direction", snap(w, 1670).wind.active === false && warn.active === false && warn.dir_deg > 0 && snap(w, 1800).wind.active === true && snap(w, 2100).wind.active === false && approx(dist(p1, p2), (299 * 2) / 60, 0.02) && Math.abs(((ang - warn.dir_deg + 540) % 360) - 180) < 0.5);
  const sh = go("c3-shades", { night: 3, ticks: 61, every: 60, scenario: { ...EMPTY, player: { pos: [0, 0, -30] }, shades: [{ id: "S1", pos: [10, 0, -30] }] } });
  check("C3.d", "AC-SHADE", "Night 3 shades chase at 4.5 m/s", approx(snap(sh, 60).shades[0].pos[0], 5.5, 0.01));
}

// =============================================================== D. Part 3: drifters and charm
{
  const sp = go("d1-spawn", { night: 2, ticks: 3700, every: 10, scenario: { random_motes: false, motes: [], random_shades: false, shades: [], player: { pos: [0, 0, 0] } } });
  check("D1.a", "AC-DRIFT", "drifters spawn at 1200 (D1) and 2400 (D2); a third is not spawned while two live", snap(sp, 1190).drifters.length === 0 && eq(snap(sp, 1200).drifters.map((d: Line) => d.id), ["D1"]) && eq(snap(sp, 3600).drifters.map((d: Line) => d.id), ["D1", "D2"]));
  const st = go("d1-steal", { night: 2, ticks: 250, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, drifters: [{ id: "D1", pos: [1, 0, 0] }] } });
  check("D1.b", "AC-DRIFT", "chase + contact: steals 3 (5 -> 2) once, no flame lost; flees and vanishes at tick 241; loot is gone", eq(ev(st, "drifter_steal").map((e) => [e.tick, e.data]), [[1, { drifter_id: "D1", amount: 3, carried: 2 }]]) && ev(st, "player_hit").length === 0 && snap(st, 240).drifters.length === 1 && snap(st, 241).drifters.length === 0 && snap(st, 250).motes_active === 0);
  const pl = go("d1-pulse", { night: 2, ticks: 130, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 4 }, drifters: [{ id: "D1", pos: [4, 0, 0], state: "flee", stolen: 3 }] }, inputs: { frames: press(0, "pulse") } });
  check("D1.c", "AC-DRIFT", "pulse on a fleeing thief drops 3 motes on the spot; it vanishes at tick 120", eq(ev(pl, "drifter_drop").map((e) => e.data), [{ drifter_id: "D1", amount: 3 }]) && snap(pl, 1).motes.length === 3 && snap(pl, 119).drifters.length === 1 && snap(pl, 120).drifters.length === 0);
  const pc = go("d1-pulse-chase", { night: 2, ticks: 40, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 8 }, drifters: [{ id: "D1", pos: [4, 0, 0], state: "chase" }] }, inputs: { frames: press(0, "pulse") } });
  check("D1.d", "AC-DRIFT", "pulse on a chasing drifter: it flees without stealing", snap(pc, 1).drifters[0].state === "flee" && ev(pc, "drifter_steal").length === 0);
}
{
  const c = go("d2-charm", { night: 2, ticks: 330, every: 1, scenario: at([35, 0, 0]), inputs: { frames: [] } });
  check("D2.a", "AC-CHARM", "pickup at (35,0,0): charm_picked, charm_s = 10, respawn in 45 s", eq(ev(c, "charm_picked").map((e) => [e.tick, e.data]), [[1, { charm_id: "C1", charm_ticks: 600 }]]) && snap(c, 1).player.charm_s === 10 && eq(snap(c, 1).charms, [{ id: "C1", available: false, respawn_s: 45 }]));
  const sp = go("d2-speed", { ticks: 330, every: 1, scenario: at([0, 0, 0], { charm_ticks: 300 }), inputs: { frames: [{ tick: 0, move: [0, 1] }] } });
  check("D2.b", "AC-CHARM", "speed 7.2 m/s while the charm lasts, 6 m/s after", approx(snap(sp, 20).player.vel[2], 7.2, 0.001) && approx(snap(sp, 320).player.vel[2], 6, 0.001));
  const dd = go("d2-dash", { ticks: 40, every: 1, scenario: at([0, 0, 0], { charm_ticks: 600 }), inputs: { frames: [...press(0, "dash"), ...press(5, "dash"), ...press(20, "dash")] } });
  check("D2.c", "AC-CHARM", "dash without cooldown (events at 1 and 21; the press at 5 during the dash is ignored)", eq(ev(dd, "dash").map((e) => e.tick), [1, 21]));
}

// =============================================================== E. Determinism per night, exit codes
{
  const inputs = { frames: [{ tick: 0, move: [0, 1] }, { tick: 90, move: [1, 0], cam_yaw_deg: 45 }, { tick: 180, move: [-1, -1], interact: true }, { tick: 181, interact: false, pulse: true, dash: true }, { tick: 182, pulse: false, dash: false }] };
  for (const night of [1, 2, 3]) {
    const sc = night === 3 ? { player: { pos: [0, 0, -30], flames: 99 } } : { player: { flames: 99 } };
    const a = go(`e1-n${night}-a`, { night, seed: 42, ticks: 3000, every: 100, scenario: sc, inputs });
    const b = go(`e1-n${night}-b`, { night, seed: 42, ticks: 3000, every: 100, scenario: sc, inputs });
    const c = go(`e1-n${night}-c`, { night, seed: 43, ticks: 3000, every: 100, scenario: sc, inputs });
    check(`E1.${night}`, "AC-CONTRACT-1.1", `Night ${night}: same seed twice => byte-identical (sha256 ${a.hash.slice(0, 12)}...); other seed differs; 3-decimal rounding`, a.hash === b.hash && a.raw.length > 0 && a.hash !== c.hash && !/\d\.\d{4,}/.test(a.raw));
  }
  const bad4 = go("e2-night4", { night: 4, ticks: 10 });
  const badJson = go("e2-bad-json", { ticks: 10, rawInputs: "{oops" });
  const badOrder = go("e2-bad-order", { ticks: 10, inputs: { frames: [{ tick: 9 }, { tick: 3 }] } });
  const ok = go("e2-ok", { ticks: 10 });
  check("E2", "AC-CONTRACT-1.1", "exit codes: ok 0; --night 4 -> 2; invalid JSON -> 2; non-increasing ticks -> 2", ok.status === 0 && bad4.status === 2 && badJson.status === 2 && badOrder.status === 2, `${ok.status}/${bad4.status}/${badJson.status}/${badOrder.status}`);
}

// =============================================================== F. Performance: a full night, headless
const perf: { night: number; ms: number; size: number; ticks: number }[] = [];
for (const night of [1, 2, 3]) {
  // worst case: 99 flames so the run is never cut short, 400 s on the clock, every random system active
  const r = go(`f1-full-night${night}`, { night, ticks: 21600, every: 10, big: true, scenario: { player: night === 3 ? { pos: [0, 0, -30], flames: 99 } : { flames: 99 }, time_left_s: 400 } }) as Run & { size: number };
  perf.push({ night, ms: Math.round(r.ms), size: r.size, ticks: 21600 });
}
check("F1", "AC-PERF", `a full night (21,600 ticks, worst case) runs headless in <= 30 s: ${perf.map((p) => `N${p.night} ${(p.ms / 1000).toFixed(2)} s`).join(", ")}`, perf.every((p) => p.ms <= 30_000 && p.size > 0));

// =============================================================== unit test suite
const t = spawnSync(process.execPath, ["--test", "--test-reporter=spec", "tests/**/*.test.ts"], { encoding: "utf8" });
const report = t.stdout + t.stderr;
writeFileSync(`${ROOT}/test-report.txt`, report);
const num = (k: string) => Number(new RegExp(`ℹ ${k} (\\d+)`).exec(report)?.[1] ?? NaN);
const suite = { tests: num("tests"), pass: num("pass"), fail: num("fail") };
check("UT", "all", `unit test suite: ${suite.pass}/${suite.tests} pass`, suite.fail === 0 && suite.tests > 0 && suite.pass === suite.tests, report.slice(-400));

// =============================================================== RESULTS.md
const sh = (c: string) => { try { return execSync(c, { encoding: "utf8" }).trim(); } catch { return "unknown"; } };
const commit = sh("git rev-parse --short HEAD");
const dirty = sh("git status --porcelain -- src game.contract.json tests scripts") ? " (+uncommitted changes in code)" : "";
const failed = checks.filter((c) => !c.pass);
const cpu = os.cpus()[0]?.model.trim() ?? "unknown";
const md = [
  "# Phase 2 — Kết quả bằng chứng (sinh tự động)",
  "",
  "> File này do `npm run proof` sinh ra từ lần chạy thật của CLI headless. Không sửa tay.",
  "> Giá trị mong đợi nằm trong `scripts/proof2.ts`, tính tay từ `docs/notes/phase2-spec.md` và ticket.",
  "",
  `- Code commit khi chạy: \`${commit}\`${dirty}`,
  `- Máy: ${cpu}, ${os.cpus().length} luồng, ${(os.totalmem() / 2 ** 30).toFixed(0)} GB RAM, ${process.platform} ${process.arch}, Node ${process.version}`,
  `- Unit tests: ${suite.pass}/${suite.tests} đạt (chi tiết: \`test-report.txt\`)`,
  `- Kiểm tra end-to-end: ${checks.length - failed.length}/${checks.length} đạt`,
  "",
  "| ID | Yêu cầu | Điều được kiểm tra | Kết quả |",
  "|---|---|---|---|",
  ...checks.map((c) => `| ${c.id} | ${c.req} | ${c.desc} | ${c.pass ? "ĐẠT" : "**TRƯỢT** " + c.detail.replace(/\|/g, "/").replace(/\n/g, " ")} |`),
  "",
  "## Hiệu năng headless: một Đêm đầy đủ (21.600 tick, trường hợp xấu nhất)",
  "",
  "Đo bằng thời gian chạy CLI thật (gồm khởi động Node và ghi file). Ngưỡng của ticket: <= 30 giây.",
  "",
  "| Đêm | Thời gian | Kích thước output |",
  "|---|---:|---:|",
  ...perf.map((p) => `| ${p.night} | ${(p.ms / 1000).toFixed(2)} s | ${(p.size / 1e6).toFixed(1)} MB |`),
  "",
  "## Lệnh tái lập từng lần chạy",
  "",
  ...runs.map((r) => `- \`${r.id}\` (exit ${r.status}, sha256 ${r.hash.slice(0, 12)}): \`${r.cmd}\``),
  "",
].join("\n");
writeFileSync(`${ROOT}/RESULTS.md`, md);

console.log(`proof: ${checks.length - failed.length}/${checks.length} checks passed; unit tests ${suite.pass}/${suite.tests}; full nights ${perf.map((p) => (p.ms / 1000).toFixed(2) + "s").join("/")}`);
for (const f of failed) console.log(`  FAIL ${f.id}: ${f.desc}\n       ${f.detail}`);
process.exit(failed.length ? 1 : 0);
