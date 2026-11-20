// Generates docs/proof/phase-3 evidence by running the real headless CLI as a black box (Contract v1.2).
// Expected values are derived by hand from Ticket-03 and docs/notes/adr-0001-lantern-fuel.md, NOT copied from output.
// Usage: npm run proof   (exits 1 if any check fails)
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";

const contractVersion = JSON.parse(readFileSync("game.contract.json", "utf8")).contract_version;
if (contractVersion !== "1.2") {
  console.error(`proof (phase 3): game.contract.json is v${contractVersion}; this script is for Contract v1.2 (older phases: proof:phase1, proof:phase2).`);
  process.exit(2);
}

const ROOT = "docs/proof/phase-3";
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
const lamp = (s: Line, id: string) => s.lanterns.find((l: Line) => l.id === id) as Line;
const press = (tick: number, key = "interact") => [{ tick, [key]: true }, { tick: tick + 1, [key]: false }];
const EMPTY = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], drifters: [] };
const at = (pos: number[], extra: object = {}) => ({ ...EMPTY, player: { pos, ...extra } });
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const FAR = { player: { pos: [0, 0, -30] } };

// =============================================================== A. Lantern fuel model (Ticket-03 part 1)
{
  const r = go("a1-burn", { ticks: 601, every: 60, scenario: { ...EMPTY, lanterns: [{ id: "L1", lit: true }] } });
  check("A1.a", "AC-FUEL", "a scenario lantern with lit:true and no fuel starts at 100, ever_lit, no event, no score; it burns 1/s (99 at 60 ticks, 90 at 600)", eq([lamp(snap(r, 0), "L1").fuel, lamp(snap(r, 0), "L1").ever_lit], [100, true]) && lamp(snap(r, 60), "L1").fuel === 99 && lamp(snap(r, 600), "L1").fuel === 90 && ev(r, "lantern_out").length === 0 && end(r).score === 0);
  const out = go("a1-out", { ticks: 8, every: 1, scenario: { ...EMPTY, lanterns: [{ id: "L1", lit: true, fuel: 0.05 }] } });
  const l3 = lamp(snap(out, 3), "L1");
  check("A1.b", "AC-FUEL", "fuel 0.05 (3 units of 1/60) goes out at tick 3: lantern_out, fuel 0, deposited 0, ever_lit kept", eq(ev(out, "lantern_out").map((e) => [e.tick, e.data]), [[3, { lantern_id: "L1" }]]) && eq([l3.lit, l3.fuel, l3.deposited, l3.ever_lit], [false, 0, 0, true]));
}
{
  const mk = (id: string, carried: number) => go(id, { ticks: 3, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried }, lanterns: [{ id: "L1", pos: [0, 0, 1], lit: true, fuel: 55 }] }, inputs: { frames: press(0) } });
  const a = mk("a2-refuel-full", 10), b = mk("a2-refuel-part", 2);
  check("A2", "AC-FUEL", "refuel: 55 burns to 54.98 first, so 5 motes (ceil 4.5) refill it to 100 for 25 points; with 2 motes fuel is 75 for 10 points; event refuel, no deposit", eq(ev(a, "refuel").map((e) => e.data), [{ lantern_id: "L1", amount: 5, fuel: 100 }]) && snap(a, 1).player.carried === 5 && end(a).score === 25 && eq(ev(b, "refuel").map((e) => e.data), [{ lantern_id: "L1", amount: 2, fuel: 75 }]) && end(b).score === 10 && ev(b, "deposit").length === 0);
}
{
  const first = go("a3-first-light", { ticks: 3, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1] }] }, inputs: { frames: press(0) } });
  const again = go("a3-relight", { ticks: 3, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 1], ever_lit: true }] }, inputs: { frames: press(0) } });
  check("A3.a", "AC-LIGHT", "first light costs 10: deposit then lantern_lit relight:false; score 10x5 + 100 = 150; capacity 12", eq(first.lines.filter((l) => l.type === "event").map((e) => e.name), ["night_start", "deposit", "lantern_lit"]) && ev(first, "lantern_lit")[0].data.relight === false && end(first).score === 150 && snap(first, 1).player.capacity === 12);
  const rl = lamp(snap(again, 1), "L1");
  check("A3.b", "AC-LIGHT", "a lantern that was lit before costs only 5: relight:true; score 5x5 + 40 = 65; fuel back to 100; relit_count 1", ev(again, "lantern_lit")[0].data.relight === true && ev(again, "deposit")[0].data.amount === 5 && end(again).score === 65 && eq([rl.lit, rl.fuel, rl.relit_count], [true, 100, 1]));
  const same = go("a3-out-then-relight", { ticks: 3, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 1], lit: true, fuel: 1 / 60 }] }, inputs: { frames: press(0) } });
  check("A3.c", "AC-LIGHT", "step order: a lantern that burns out and is fed in the same tick gives lantern_out, deposit (5), lantern_lit (relight)", eq(same.lines.filter((l) => l.type === "event" && l.name !== "night_start").map((e) => e.name), ["lantern_out", "deposit", "lantern_lit"]) && ev(same, "deposit")[0].data.amount === 5);
}
{
  const cap = (n: number) => snap(go(`a4-cap-${n}`, { ticks: 1, scenario: at([0, 0, 0], { successful_lights: n }) }), 0).player.capacity;
  check("A4", "AC-CAPACITY", "capacity = min(20, 10 + 2 x successful_lights): 0->10, 1->12, 3->16, 5->20, 8->20", eq([0, 1, 3, 5, 8].map(cap), [10, 12, 16, 20, 20]));
}

// =============================================================== B. Shades drain lanterns (Ticket-03 part 2)
{
  const r = go("b1-drain", { ticks: 130, every: 1, scenario: { ...EMPTY, ...FAR, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 8.5] }] } });
  check("B1.a", "AC-DRAIN", "a wander shade within 2 m of a weak lit lantern switches to drain and stands still", snap(r, 1).shades[0].state === "drain" && eq(snap(r, 1).shades[0].pos, snap(r, 130).shades[0].pos));
  check("B1.b", "AC-DRAIN", "drain takes 5/s on top of the burn of 1/s (tick 1 burn only, then 6 units per tick): fuel 14.1 at tick 60", approx(lamp(snap(r, 60), "L1").fuel, 20 - (1 + 59 * 6) / 60, 0.06) && approx(lamp(snap(r, 120), "L1").fuel, 20 - (1 + 119 * 6) / 60, 0.06));
  check("B1.c", "AC-DRAIN", "fuel_drain is logged every 60 ticks of draining (ticks 61 and 121) with lantern, shade and fuel", eq(ev(r, "fuel_drain").map((e) => [e.tick, e.data.lantern_id, e.data.shade_id]), [[61, "L1", "S1"], [121, "L1", "S1"]]) && approx(ev(r, "fuel_drain")[0].data.fuel, 14, 0.06));
  const dead = go("b1-dead", { ticks: 80, every: 1, scenario: { ...EMPTY, ...FAR, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 5 }], shades: [{ id: "S1", pos: [0, 0, 8.5] }] } });
  check("B1.d", "AC-DRAIN", "a drained lantern goes out at tick 51; the shade returns to wander", eq(ev(dead, "lantern_out").map((e) => e.tick), [51]) && snap(dead, 50).shades[0].state === "drain" && snap(dead, 51).shades[0].state === "wander");
}
{
  const zone = (fuel: number) => dist(snap(go(`b2-zone-${fuel}`, { ticks: 2, every: 1, scenario: { ...EMPTY, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel }], shades: [{ id: "S1", pos: [0, 0, 5.2], state: "chase" }] } }), 1).shades[0].pos, [0, 0, 10]);
  check("B2", "AC-DRAIN", "the safe zone needs fuel >= 30: exactly 30 keeps it (shade pushed to 6 m), below 30 loses it", zone(30 + 1 / 60) >= 5.998 && zone(30) < 5.9 && zone(100) >= 5.998);
}
{
  const t1 = go("b3-weakest", { ticks: 61, every: 60, scenario: { ...EMPTY, ...FAR, lanterns: [{ id: "L1", pos: [-20, 0, 10], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [24, 0, 10] }] } });
  check("B3.a", "AC-DRAIN", "a wander shade heads for the weak lit lantern (L1, 44 m away at -X) rather than the nearer dark L2", approx(snap(t1, 60).shades[0].pos[0], 20, 0.05));
  const t2 = go("b3-tie", { ticks: 31, every: 30, scenario: { ...EMPTY, ...FAR, lanterns: [{ id: "L1", pos: [10, 0, 0], lit: true, fuel: 20 }, { id: "L2", pos: [-10, 0, 0], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, 20] }] } });
  check("B3.b", "AC-DRAIN", "two equally weak lanterns: the smaller id (L1, at +X) is chosen", approx(snap(t2, 30).shades[0].pos[0], 0.894, 0.02));
}
{
  const st = (z: number) => snap(go(`b4-chase-${z}`, { ticks: 2, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0] }, lanterns: [{ id: "L1", pos: [0, 0, 7], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0, z], state: "drain", target_lantern_id: "L1" }] } }), 1).shades[0].state;
  check("B4", "AC-DRAIN", "drain -> chase when Mây is within 6 m (6.0 chases, 6.1 keeps draining)", st(6.0) === "chase" && st(6.1) === "drain");
}
{
  const r = go("b5-pulse-drain", { ticks: 200, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: "L1", pos: [0, 0, 6], lit: true, fuel: 20 }], shades: [{ id: "S1", pos: [0, 0.8, 5], state: "drain", target_lantern_id: "L1" }] }, inputs: { frames: press(0, "pulse") } });
  check("B5", "AC-SCORE", "Tỏa Sáng on a draining shade scores 15 in total (not 5); it is stunned and stops draining while stunned", end(r).score === 15 && snap(r, 1).shades[0].state === "stunned" && snap(r, 120).shades[0].state === "stunned" && ev(r, "fuel_drain").every((e) => e.tick > 121));
  const ord = go("b5-pulse-normal", { ticks: 3, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }] }, inputs: { frames: press(0, "pulse") } });
  check("B5.b", "AC-SCORE", "Tỏa Sáng on an ordinary shade still scores 5", end(ord).score === 5);
}
{
  const r = go("b6-refuel-frees", { ticks: 45, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 11.5], carried: 10 }, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0, 0, 9], state: "drain", target_lantern_id: "L1" }] }, inputs: { frames: press(0) } });
  check("B6", "AC-DRAIN", "refuelling a drained lantern to >= 30 frees it: the shade is expelled (recoil, harmless) and is outside the 6 m zone by tick 31", ev(r, "refuel")[0].data.fuel === 100 && snap(r, 1).shades[0].state === "recoil" && ev(r, "player_hit").length === 0 && dist(snap(r, 31).shades[0].pos, [0, 0, 10]) >= 5.99 && ev(r, "fuel_drain").length === 0);
}

// =============================================================== C. Win at dawn (Ticket-03 part 3)
{
  const lit = (n: number) => ["L1", "L2", "L3", "L4", "L5"].map((id, i) => ({ id, lit: i < n }));
  const win = go("c1-dawn-win", { ticks: 600, scenario: { ...EMPTY, lanterns: lit(3), time_left_s: 1 } });
  check("C1.a", "AC-WIN", "3 of 5 lit at dawn wins: game_over won/dawn_survived at tick 60; score 3 x (50 + floor 99) + 3 flames x 50 = 597", eq(ev(win, "game_over").map((e) => [e.tick, e.data]), [[60, { result: "won", reason: "dawn_survived" }]]) && end(win).state === "won" && end(win).score === 3 * (50 + 99) + 150, JSON.stringify(end(win)));
  const lose = go("c1-dawn-lose", { ticks: 600, scenario: { ...EMPTY, lanterns: lit(2), time_left_s: 1 } });
  check("C1.b", "AC-WIN", "2 of 5 lit at dawn loses with reason dawn and no bonus", eq(ev(lose, "game_over").map((e) => e.data), [{ result: "lost", reason: "dawn" }]) && end(lose).score === 0);
  const verdict = (night: number, total: number, n: number) => end(go(`c2-n${night}-${n}of${total}`, { night, ticks: 100, scenario: { ...EMPTY, lanterns: Array.from({ length: total }, (_, i) => ({ id: `L${i + 1}`, lit: i < n })), time_left_s: 0.5, ...(night === 3 ? { player: { pos: [0, 0, -30] } } : {}) } })).state;
  check("C2", "AC-WIN", "thresholds ceil(0.6 x total): Night 1 needs 3/5, Night 2 needs 4/6, Night 3 needs 5/7", eq([verdict(1, 5, 3), verdict(1, 5, 2), verdict(2, 6, 4), verdict(2, 6, 3), verdict(3, 7, 5), verdict(3, 7, 4)], ["won", "lost", "won", "lost", "won", "lost"]));
  const early = go("c3-no-early-win", { ticks: 300, scenario: { ...EMPTY, lanterns: lit(5) } });
  check("C3.a", "AC-WIN", "no early win: all 5 lanterns lit does not end the night", ev(early, "game_over").length === 0 && end(early).state === "playing");
  const nf = go("c3-no-flames", { ticks: 10, scenario: { ...EMPTY, lanterns: lit(5), player: { pos: [0, 0, 0], flames: 0 }, time_left_s: 1 / 60 } });
  check("C3.b", "AC-WIN", "no flames beats everything: lost/no_flames even with 5 lit lanterns on the dawn tick", eq(ev(nf, "game_over").map((e) => e.data), [{ result: "lost", reason: "no_flames" }]));
  const burn = go("c3-burn-out", { ticks: 200, scenario: { ...EMPTY, lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }, { id: "L3", lit: true, fuel: 0.5 }], time_left_s: 1 } });
  check("C3.c", "AC-WIN", "a lantern that burns out before dawn no longer counts (3 lit at the start, 2 at dawn: lost)", ev(burn, "lantern_out")[0]?.tick === 30 && eq(ev(burn, "game_over").map((e) => e.data), [{ result: "lost", reason: "dawn" }]));
  const dur = [1, 2, 3].map((n) => snap(go(`c4-night${n}`, { night: n, ticks: 1, scenario: n === 3 ? { player: { pos: [0, 0, -30] } } : undefined }), 0).time_left_s);
  check("C4", "AC-WIN", "night durations are 240 / 270 / 300 s", eq(dur, [240, 270, 300]));
}

// =============================================================== D. Contract v1.2 shape
{
  const s0 = snap(go("d1-shape", { ticks: 2 }), 0);
  check("D1.a", "AC-CONTRACT-1.2", "snapshot: every lantern has fuel, ever_lit, relit_count (dark lantern: fuel 0); player has capacity", s0.lanterns.every((l: Line) => "fuel" in l && "ever_lit" in l && "relit_count" in l && l.fuel === 0) && s0.player.capacity === 10);
  const lit = snap(go("d1-default-fuel", { ticks: 1, scenario: { ...EMPTY, lanterns: [{ id: "L1", lit: true }] } }), 0);
  check("D1.b", "AC-CONTRACT-1.2", "scenario: lit:true without fuel means fuel 100 (and does not raise the capacity)", lamp(lit, "L1").fuel === 100 && lit.player.capacity === 10);
  const sc = go("d1-scenario", { ticks: 1, scenario: { ...EMPTY, lanterns: [{ id: "L1", lit: true, fuel: 50.5 }, { id: "L2", ever_lit: true }], player: { pos: [0, 0, 0], successful_lights: 3 } } });
  check("D1.c", "AC-CONTRACT-1.2", "scenario fields fuel, ever_lit and player.successful_lights are honoured (fuel 50.5, ever_lit on a dark lantern, capacity 16)", lamp(snap(sc, 0), "L1").fuel === 50.5 && lamp(snap(sc, 0), "L2").ever_lit === true && snap(sc, 0).player.capacity === 16);
}
{
  const inputs = { frames: [{ tick: 0, move: [0, 1] }, { tick: 90, move: [1, 0], cam_yaw_deg: 45 }, { tick: 180, move: [-1, -1], interact: true }, { tick: 181, interact: false, pulse: true, dash: true }, { tick: 182, pulse: false, dash: false }] };
  for (const night of [1, 2, 3]) {
    const sc = night === 3 ? { player: { pos: [0, 0, -30], flames: 99 } } : { player: { flames: 99 } };
    const a = go(`d2-n${night}-a`, { night, seed: 42, ticks: 3000, every: 100, scenario: sc, inputs });
    const b = go(`d2-n${night}-b`, { night, seed: 42, ticks: 3000, every: 100, scenario: sc, inputs });
    const c = go(`d2-n${night}-c`, { night, seed: 43, ticks: 3000, every: 100, scenario: sc, inputs });
    check(`D2.${night}`, "AC-CONTRACT-1.2", `Night ${night}: same seed twice => byte-identical (sha256 ${a.hash.slice(0, 12)}...); other seed differs; 3-decimal rounding`, a.hash === b.hash && a.raw.length > 0 && a.hash !== c.hash && !/\d\.\d{4,}/.test(a.raw));
  }
  const bad4 = go("d3-night4", { night: 4, ticks: 10 });
  const badJson = go("d3-bad-json", { ticks: 10, rawInputs: "{oops" });
  const ok = go("d3-ok", { ticks: 10 });
  check("D3", "AC-CONTRACT-1.2", "exit codes: ok 0; --night 4 -> 2; invalid JSON -> 2", ok.status === 0 && bad4.status === 2 && badJson.status === 2);
}

// =============================================================== R. Regression: Phase 1-2 behaviour that Ticket-03 did not replace
{
  const hit = go("r1-hits", { ticks: 400, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 10 }, shades: [{ id: "S1", pos: [0.5, 0, 0] }] } });
  const h = ev(hit, "player_hit");
  check("R1", "AC-SHADE", "contact: hits at ticks 1, 91, 181 (90-tick invulnerability); flames 2,1,0; drops 5,2,1; then lost/no_flames", eq(h.map((e) => e.tick), [1, 91, 181]) && eq(h.map((e) => [e.data.flames, e.data.dropped]), [[2, 5], [1, 2], [0, 1]]) && eq(ev(hit, "game_over").map((e) => e.data), [{ result: "lost", reason: "no_flames" }]));
  const pu = go("r2-pulse", { ticks: 130, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }, { id: "S2", pos: [20, 0, 0] }] }, inputs: { frames: press(0, "pulse") } });
  const s = (t: number) => snap(pu, t).shades.find((x: Line) => x.id === "S1");
  check("R2", "AC-PULSE", "Tỏa Sáng: stuns only the shade in range, costs 3, pushed 4 m in 15 ticks, stunned through tick 120", eq(ev(pu, "pulse")[0]?.data, { stunned_ids: ["S1"] }) && snap(pu, 1).player.carried === 2 && approx(s(15).pos[0], 8, 0.01) && s(120).state === "stunned");
  const mv = go("r3-move", { ticks: 70, every: 1, scenario: at([0, 0, 0]), inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0] }] } });
  check("R3.a", "AC-MOVE", "movement: 6 m/s reached at tick 6; 60 ticks cover 5.75 m; stops within 6 ticks", approx(snap(mv, 6).player.vel[2], 6, 0.001) && approx(snap(mv, 60).player.pos[2], 5.75, 0.01) && approx(snap(mv, 66).player.vel[2], 0, 0.001));
  const dash = go("r3-dash", { ticks: 130, every: 1, scenario: at([0, 0, 0]), inputs: { frames: [...press(0, "dash"), ...press(60, "dash"), ...press(95, "dash")] } });
  check("R3.b", "AC-DASH", "dash: 2.8 m in 12 ticks; 90-tick cooldown from the start (events at 1 and 96)", approx(snap(dash, 12).player.pos[2], 2.8, 0.01) && eq(ev(dash, "dash").map((e) => e.tick), [1, 96]));
  const fall = go("r3-fall", { ticks: 120, every: 1, scenario: at([60, 0, 0], { carried: 2 }) });
  check("R3.c", "AC-FALL", "falling off the island: Y < -10 at tick 60, one fall hit, all motes lost", ev(fall, "player_hit")[0]?.tick === 60 && eq(ev(fall, "player_hit")[0].data, { by: "fall", flames: 2, dropped: 0, lost: 2 }));
  const pa = go("r3-pause", { ticks: 100, every: 1, scenario: at([0, 0, 0]), inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 50, pause: true }, { tick: 51, pause: false }] } });
  check("R3.d", "AC-PAUSE", "pause: sim_tick, time and position frozen while paused (events at 11 / 51)", eq([...ev(pa, "paused"), ...ev(pa, "resumed")].map((e) => [e.name, e.tick]), [["paused", 11], ["resumed", 51]]) && snap(pa, 30).sim_tick === 10 && eq(snap(pa, 11).player.pos, snap(pa, 50).player.pos));
}
{
  const sp = go("r4-schedule", { ticks: 800, scenario: { player: { pos: [0, 0, 0] }, random_drifters: false } });
  check("R4", "AC-MOTE", "schedules: 20 motes at start, 21 at tick 240; shades 2 at tick 300 then 1 at 780; spawning for 60 ticks", snap(sp, 0).motes_active === 20 && snap(sp, 240).motes_active === 21 && eq(ev(sp, "shade_spawned").map((e) => [e.tick, e.data.id]), [[300, "S1"], [300, "S2"], [780, "S3"]]) && snap(sp, 350).shades[0].state === "spawning");
  const a = go("r5-pad-a", { night: 2, ticks: 160, every: 1, scenario: at([20, 0, 18]) });
  const land = a.lines.find((l) => l.type === "snapshot" && l.tick > 5 && l.player.grounded) as Line;
  check("R5.a", "AC-NIGHTS", "Night 2: the pad launches Mây at 24 m/s and she lands inside the other island after 78-92 ticks", approx(Math.hypot(snap(a, 1).player.vel[0], snap(a, 1).player.vel[2]), 24, 0.01) && land.tick >= 78 && land.tick <= 92 && dist(land.player.pos, [70, 0, 0]) <= 28);
  const w = go("r5-wind", { night: 3, ticks: 2200, every: 10, scenario: at([0, 0, -20]) });
  const p1 = snap(w, 1800).player.pos, p2 = snap(w, 2100).player.pos;
  check("R5.b", "AC-NIGHTS", "Night 3: wind announced from tick 1680, blows 1800-2099 at 2 m/s", snap(w, 1690).wind.active === false && snap(w, 1690).wind.dir_deg > 0 && snap(w, 1800).wind.active === true && snap(w, 2100).wind.active === false && approx(dist(p1, p2), (299 * 2) / 60, 0.02));
  const st = go("r6-steal", { night: 2, ticks: 250, every: 1, scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, drifters: [{ id: "D1", pos: [1, 0, 0] }] } });
  check("R6.a", "AC-DRIFT", "drifter: steals 3 of 5 on contact, once; flees and vanishes at tick 241", eq(ev(st, "drifter_steal").map((e) => [e.tick, e.data]), [[1, { drifter_id: "D1", amount: 3, carried: 2 }]]) && snap(st, 240).drifters.length === 1 && snap(st, 241).drifters.length === 0);
  const ch = go("r6-charm", { night: 2, ticks: 20, every: 1, scenario: at([35, 0, 0]) });
  check("R6.b", "AC-CHARM", "charm at (35,0,0): charm_picked at tick 1, charm_s = 10, respawn in 45 s", eq(ev(ch, "charm_picked").map((e) => e.data), [{ charm_id: "C1", charm_ticks: 600 }]) && snap(ch, 1).player.charm_s === 10 && snap(ch, 1).charms[0].respawn_s === 45);
}

// =============================================================== E. Performance: a full night, headless
const perf: { night: number; ms: number; size: number }[] = [];
for (const night of [1, 2, 3]) {
  // worst case: 99 flames so the run is never cut short, plenty of clock, every random system active
  const r = go(`e1-full-night${night}`, { night, ticks: 21600, every: 10, big: true, scenario: { player: night === 3 ? { pos: [0, 0, -30], flames: 99 } : { flames: 99 }, time_left_s: 400 } }) as Run & { size: number };
  perf.push({ night, ms: Math.round(r.ms), size: r.size });
}
check("E1", "AC-PERF", `a full night (21,600 ticks, worst case) runs headless in <= 30 s: ${perf.map((p) => `N${p.night} ${(p.ms / 1000).toFixed(2)} s`).join(", ")}`, perf.every((p) => p.ms <= 30_000 && p.size > 0));

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
  "# Phase 3 — Kết quả bằng chứng (sinh tự động)",
  "",
  "> File này do `npm run proof` sinh ra từ lần chạy thật của CLI headless. Không sửa tay.",
  "> Giá trị mong đợi nằm trong `scripts/proof3.ts`, tính tay từ Ticket-03 và `docs/notes/adr-0001-lantern-fuel.md`.",
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
