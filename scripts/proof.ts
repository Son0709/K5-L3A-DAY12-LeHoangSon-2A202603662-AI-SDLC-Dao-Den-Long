// Generates docs/proof/phase-1 evidence by running the real headless CLI as a black box.
// Expected values below are derived by hand from docs/notes/assumptions.md, NOT copied from output.
// Usage: npm run proof   (exits 1 if any check fails)
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Guard: this generator encodes Phase 1 (Contract v1.0) numbers and overwrites docs/proof/phase-1,
// which must stay identical to the `phase-1` tag. Never run it against the v1.1 rules.
const contractVersion = JSON.parse(readFileSync("game.contract.json", "utf8")).contract_version;
if (contractVersion !== "1.0") {
  console.error(`proof-phase1: game.contract.json is v${contractVersion}; this script is only valid at tag phase-1 (v1.0). Refusing to overwrite Phase 1 evidence.`);
  process.exit(2);
}

const ROOT = "docs/proof/phase-1";
mkdirSync(`${ROOT}/scenarios`, { recursive: true });
mkdirSync(`${ROOT}/runs`, { recursive: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Line = Record<string, any>;
interface Run { id: string; cmd: string; status: number | null; stderr: string; lines: Line[]; hash: string; raw: string }
interface Check { id: string; req: string; desc: string; pass: boolean; detail: string }

const checks: Check[] = [];
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function check(id: string, req: string, desc: string, pass: boolean, detail = "") {
  checks.push({ id, req, desc, pass, detail: pass ? "" : detail });
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const writeJson = (path: string, obj: unknown) => { writeFileSync(path, JSON.stringify(obj, null, 2) + "\n"); return path; };

function headless(id: string, o: { seed: number; ticks: number; scenario?: unknown; inputs?: unknown; every?: number; rawInputs?: string }): Run {
  const args = ["--seed", String(o.seed), "--night", "1", "--ticks", String(o.ticks), "--out", `${ROOT}/runs/${id}.jsonl`];
  if (o.every) args.push("--snapshot-every", String(o.every));
  if (o.scenario) args.push("--scenario", writeJson(`${ROOT}/scenarios/${id}.scenario.json`, o.scenario));
  if (o.inputs) args.push("--inputs", writeJson(`${ROOT}/scenarios/${id}.inputs.json`, o.inputs));
  if (o.rawInputs !== undefined) { writeFileSync(`${ROOT}/scenarios/${id}.inputs.json`, o.rawInputs); args.push("--inputs", `${ROOT}/scenarios/${id}.inputs.json`); }
  const r = spawnSync(process.execPath, ["src/headless/cli.ts", ...args], { encoding: "utf8" });
  let raw = "";
  try { raw = readFileSync(`${ROOT}/runs/${id}.jsonl`, "utf8"); } catch { /* no output on error exit */ }
  const lines = raw.trim() ? raw.trim().split("\n").map((l) => JSON.parse(l) as Line) : [];
  return { id, cmd: "node src/headless/cli.ts " + args.join(" "), status: r.status, stderr: r.stderr, lines, hash: sha(raw), raw };
}
const events = (r: Run, name: string) => r.lines.filter((l) => l.type === "event" && l.name === name);
const snap = (r: Run, t: number) => r.lines.find((l) => l.type === "snapshot" && l.tick === t) as Line;
const end = (r: Run) => r.lines[r.lines.length - 1];
const runs: Run[] = [];
const go = (...a: Parameters<typeof headless>) => { const r = headless(...a); runs.push(r); return r; };

const EMPTY = { random_motes: false, random_shades: false, motes: [], shades: [] };

// ---------------------------------------------------------------- C1 full mini-playthrough: pick 8 motes, deposit, win
{
  const motes = [2, 3, 4, 5, 6, 7, 8, 9].map((z) => [0, 0, z]);
  const r = go("c1-win", {
    seed: 1, ticks: 400, every: 10,
    scenario: {
      ...EMPTY, motes,
      lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }, { id: "L3", lit: true }, { id: "L4", lit: true }, { id: "L5", pos: [0, 0, 12] }],
    },
    inputs: { frames: [{ tick: 0, move: [0, 1] }, { tick: 100, move: [0, 0], interact: true }, { tick: 101, interact: false }] },
  });
  const picks = events(r, "mote_picked");
  check("C1.a", "R3", "walking +Z picks all 8 motes in order (carried 1..8)", eq(picks.map((e) => e.data.carried), [1, 2, 3, 4, 5, 6, 7, 8]), JSON.stringify(picks.map((e) => e.data)));
  check("C1.b", "R4", "interact at 2 m deposits 8 into L5 then lights it (deposit before lantern_lit)",
    eq(events(r, "deposit").map((e) => e.data), [{ lantern_id: "L5", amount: 8, deposited: 8 }]) && eq(events(r, "lantern_lit").map((e) => e.data), [{ lantern_id: "L5" }]) && events(r, "deposit")[0].tick === events(r, "lantern_lit")[0].tick);
  check("C1.c", "R8", "all lit => game_over won/all_lit, end.state won, run stops at tick 101", eq(events(r, "game_over").map((e) => e.data), [{ result: "won", reason: "all_lit" }]) && end(r).state === "won" && end(r).ticks === 101, JSON.stringify(end(r)));
  // 8 motes*10 + 1 lantern*100 + floor(300-101/60)=298 s + 3 flames*50
  check("C1.d", "R14", "score = 80 (motes) + 100 (lantern) + 298 (s left) + 150 (flames) = 628", end(r).score === 628, `got ${end(r).score}`);
  check("C1.e", "R1", "first line is snapshot tick 0, last line is end", r.lines[0].type === "snapshot" && r.lines[0].tick === 0 && end(r).type === "end");
}

// ---------------------------------------------------------------- C2 shade hits until no_flames
{
  const r = go("c2-lose", {
    seed: 1, ticks: 600, every: 10,
    scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 10, flames: 3 }, shades: [{ id: "S1", pos: [3, 0, 0] }] },
  });
  const h = events(r, "player_hit");
  check("C2.a", "R6", "3 hits: flames 2,1,0 and dropped floor(carried*0.5) = 5,2,1", eq(h.map((e) => [e.data.flames, e.data.dropped]), [[2, 5], [1, 2], [0, 1]]), JSON.stringify(h.map((e) => e.data)));
  const gap = h.length > 1 ? h[1].tick - h[0].tick : -1;
  check("C2.b", "R6", "invulnerable 1.5 s (90 ticks) between hits", gap >= 90 && gap <= 95, `gap ${gap}`);
  check("C2.c", "R6", "game_over lost/no_flames right after the 3rd hit, score 0 (no bonus on loss)", eq(events(r, "game_over").map((e) => e.data), [{ result: "lost", reason: "no_flames" }]) && end(r).state === "lost" && end(r).score === 0 && end(r).ticks === h[2]?.tick, JSON.stringify(end(r)));
}

// ---------------------------------------------------------------- C3 pulse
{
  const r = go("c3-pulse", {
    seed: 1, ticks: 250, every: 10,
    scenario: { ...EMPTY, player: { pos: [0, 0, 0], carried: 5 }, shades: [{ id: "S1", pos: [4, 0, 0] }, { id: "S2", pos: [20, 0, 0] }] },
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
  });
  const p = events(r, "pulse");
  check("C3.a", "R5", "pulse at tick 1 stuns only S1 (4 m in radius 6), not S2 (20 m)", p.length === 1 && p[0].tick === 1 && eq(p[0].data, { stunned_ids: ["S1"] }), JSON.stringify(p));
  const s10 = snap(r, 10);
  const s1 = s10.shades.find((s: Line) => s.id === "S1");
  check("C3.b", "R5", "cost 2 (carried 5 -> 3); S1 pushed 3 m away (x 4 -> 7) and stunned", s10.player.carried === 3 && s1.state === "stunned" && Math.abs(s1.pos[0] - 7) < 0.01, JSON.stringify({ c: s10.player.carried, s1 }));
  check("C3.c", "R5", "stun lasts 3 s: stunned at tick 100, chasing again at tick 200", snap(r, 100).shades[0].state === "stunned" && snap(r, 200).shades[0].state === "chase");
  check("C3.d", "R14", "score is 25 (one stun)", end(r).score === 25, `got ${end(r).score}`);
}

// ---------------------------------------------------------------- C4 dawn
{
  const r = go("c4-dawn", { seed: 1, ticks: 1000, scenario: { ...EMPTY, time_left_s: 1 } });
  check("C4", "R7", "time runs out => game_over lost/dawn at tick 60, run stops at 60", eq(events(r, "game_over").map((e) => [e.tick, e.data]), [[60, { result: "lost", reason: "dawn" }]]) && end(r).ticks === 60 && end(r).state === "lost", JSON.stringify(end(r)));
}

// ---------------------------------------------------------------- C5 safe radius
{
  const r = go("c5-safe", {
    seed: 1, ticks: 600, every: 1,
    scenario: { ...EMPTY, lanterns: [{ id: "L1", pos: [0, 0, 10], lit: true }], shades: [{ id: "S1", pos: [0, 0, 20] }] },
  });
  const ds = r.lines.filter((l) => l.type === "snapshot").map((s) => Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 10));
  const min = Math.min(...ds);
  check("C5", "R9", "shade approaches lit lantern but never closer than safe_radius 5 (min over 600 ticks)", min >= 4.999 && min <= 5.01 && events(r, "player_hit").length === 0, `min distance ${min}`);
}

// ---------------------------------------------------------------- C6 determinism + rounding
{
  const scenario = { random_shades: true };
  const inputs = { frames: [{ tick: 0, move: [0, 1] }, { tick: 90, move: [1, 0], cam_yaw_deg: 45 }, { tick: 180, move: [-1, -1], interact: true }, { tick: 181, interact: false, pulse: true }, { tick: 182, pulse: false }] };
  const a = go("c6-det-a", { seed: 42, ticks: 1500, scenario, inputs });
  const b = go("c6-det-b", { seed: 42, ticks: 1500, scenario, inputs });
  const c = go("c6-det-other-seed", { seed: 43, ticks: 1500, scenario, inputs });
  check("C6.a", "R10", `same seed/scenario/inputs twice => byte-identical (sha256 ${a.hash.slice(0, 12)}...)`, a.hash === b.hash && a.raw.length > 0);
  check("C6.b", "R10", "different seed => different output", a.hash !== c.hash);
  check("C6.c", "R12", "no coordinate has more than 3 decimals", !/\d\.\d{4,}/.test(a.raw));
  check("C6.d", "R1", "snapshots every 10 ticks from 0 (default)", eq(a.lines.filter((l) => l.type === "snapshot").slice(0, 4).map((s) => s.tick), [0, 10, 20, 30]));
}

// ---------------------------------------------------------------- C7 exit codes
{
  const good = go("c7-ok", { seed: 1, ticks: 10 });
  const bad1 = go("c7-bad-json", { seed: 1, ticks: 10, rawInputs: "{oops" });
  const bad2 = go("c7-bad-order", { seed: 1, ticks: 10, inputs: { frames: [{ tick: 9 }, { tick: 3 }] } });
  const noArgs = spawnSync(process.execPath, ["src/headless/cli.ts", "--seed", "1"], { encoding: "utf8" });
  check("C7.a", "R11", "valid run exits 0", good.status === 0, `status ${good.status}`);
  check("C7.b", "R11", "invalid JSON inputs exits 2 with a message on stderr", bad1.status === 2 && bad1.stderr.length > 0, `status ${bad1.status}`);
  check("C7.c", "R11", "non-increasing frame ticks exits 2", bad2.status === 2, `status ${bad2.status}`);
  check("C7.d", "R11", "missing required args exits non-zero", noArgs.status !== 0 && noArgs.status !== null);
}

// ---------------------------------------------------------------- unit test suite
const t = spawnSync(process.execPath, ["--test", "--test-reporter=spec", "tests/**/*.test.ts"], { encoding: "utf8" });
const report = t.stdout + t.stderr;
writeFileSync(`${ROOT}/test-report.txt`, report);
const num = (k: string) => Number(new RegExp(`ℹ ${k} (\\d+)`).exec(report)?.[1] ?? NaN);
const suite = { tests: num("tests"), pass: num("pass"), fail: num("fail") };
check("UT", "all", `unit test suite: ${suite.pass}/${suite.tests} pass`, suite.fail === 0 && suite.tests > 0 && suite.pass === suite.tests, report.slice(-400));

// ---------------------------------------------------------------- write RESULTS.md
const sh = (c: string) => { try { return execSync(c, { encoding: "utf8" }).trim(); } catch { return "unknown"; } };
const commit = sh("git rev-parse --short HEAD");
const dirty = sh("git status --porcelain -- src game.contract.json tests scripts") ? " (+uncommitted changes in code)" : "";
const failed = checks.filter((c) => !c.pass);
const md = [
  "# Phase 1 — Kết quả bằng chứng (sinh tự động)",
  "",
  "> File này do `npm run proof` sinh ra từ lần chạy thật của CLI headless. Không sửa tay.",
  "> Giá trị mong đợi nằm trong `scripts/proof.ts` và được tính tay từ `docs/notes/assumptions.md`.",
  "",
  `- Code commit khi chạy: \`${commit}\`${dirty}`,
  `- Node ${process.version}, ${process.platform} ${process.arch}`,
  `- Unit tests: ${suite.pass}/${suite.tests} đạt (chi tiết: \`test-report.txt\`)`,
  `- Kiểm tra end-to-end: ${checks.length - failed.length}/${checks.length} đạt`,
  "",
  "| ID | Yêu cầu | Điều được kiểm tra | Kết quả |",
  "|---|---|---|---|",
  ...checks.map((c) => `| ${c.id} | ${c.req} | ${c.desc} | ${c.pass ? "ĐẠT" : "**TRƯỢT** " + c.detail.replace(/\|/g, "/").replace(/\n/g, " ")} |`),
  "",
  "## Lệnh tái lập từng lần chạy",
  "",
  ...runs.map((r) => `- \`${r.id}\` (exit ${r.status}, sha256 ${r.hash.slice(0, 12)}): \`${r.cmd}\``),
  "",
].join("\n");
writeFileSync(`${ROOT}/RESULTS.md`, md);

console.log(`proof: ${checks.length - failed.length}/${checks.length} checks passed; unit tests ${suite.pass}/${suite.tests}`);
for (const f of failed) console.log(`  FAIL ${f.id}: ${f.desc}\n       ${f.detail}`);
process.exit(failed.length ? 1 : 0);
