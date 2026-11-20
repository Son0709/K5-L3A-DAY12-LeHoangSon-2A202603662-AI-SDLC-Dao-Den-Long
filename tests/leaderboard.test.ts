import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addEntry, cleanName, compareEntries, isoWithOffset, normalizeList, parseEntry, type Entry } from "../src/leaderboard.ts";
import { leaderboardHandler, loadEntries, saveEntries } from "../server/leaderboard-api.ts";
import { startServer } from "../server/static.ts";

const mk = (name: string, score: number, at = "2026-11-20T10:00:00+07:00", nights_won = 1, seed = 1): Entry => ({ name, score, nights_won, achieved_at: at, seed });

// ================================================================ names
test("name: 3-12 characters of [A-Za-z0-9_]", () => {
  for (const ok of ["abc", "Son_07", "abcdefghijkl", "A1_b2", "___"]) assert.equal(cleanName(ok), ok, ok);
  for (const bad of ["ab", "", "abcdefghijklm", "has space", "tên!", "a-b-c", "x.y.z", "<b>", "a\nb", 42, null, undefined]) assert.equal(cleanName(bad), null, String(bad));
});

test("name: Vietnamese letters with diacritics are accepted (bonus), counted after NFC normalisation", () => {
  assert.equal(cleanName("Nguyễn_An"), "Nguyễn_An");
  assert.equal(cleanName("Đặng_Văn"), "Đặng_Văn");
  assert.equal(cleanName("Trần"), "Trần");
  const decomposed = "Trần"; // ầ as 'a' + circumflex + grave: 6 code points, 4 characters after NFC
  assert.equal(cleanName(decomposed), decomposed.normalize("NFC"));
  assert.equal(cleanName("你好你好你"), null, "other scripts are not accepted");
});

// ================================================================ entries
test("entry: score, nights_won, seed and achieved_at (ISO 8601 with a timezone) are validated", () => {
  const ok = { name: "Mây_01", score: 1234, nights_won: 2, seed: 99, achieved_at: "2026-11-20T15:30:00+07:00" };
  assert.deepEqual(parseEntry(ok).entry, ok);
  for (const patch of [{ name: "x" }, { score: -1 }, { score: 1.5 }, { score: "9" }, { nights_won: 4 }, { nights_won: -1 }, { seed: 1.5 },
    { achieved_at: "2026-11-20 15:30" }, { achieved_at: "2026-11-20T15:30:00" }, { achieved_at: "yesterday" }]) {
    assert.ok(parseEntry({ ...ok, ...patch }).error, JSON.stringify(patch));
  }
  assert.ok(parseEntry("nope").error);
  assert.match(parseEntry({ ...ok, achieved_at: undefined }).entry!.achieved_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, "defaults to now with an offset");
});

test("isoWithOffset: ISO 8601 with the local offset, and it is the current time", () => {
  const s = isoWithOffset();
  assert.match(s, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.ok(Math.abs(Date.parse(s) - Date.now()) < 2000);
  assert.equal(isoWithOffset(new Date(2026, 10, 20, 15, 30, 5)).slice(0, 19), "2026-11-20T15:30:05");
});

// ================================================================ ranking
test("ranking: highest score first; equal scores: the one achieved first ranks higher (across timezones)", () => {
  const list = [mk("low", 100), mk("high", 300), mk("mid", 200)].sort(compareEntries);
  assert.deepEqual(list.map((e) => e.name), ["high", "mid", "low"]);
  // A is 03:00Z, B is 04:00Z, although B's text sorts first: A achieved it earlier
  const a = mk("A_early", 500, "2026-11-20T10:00:00+07:00"), b = mk("B_late", 500, "2026-11-20T04:00:00+00:00");
  assert.deepEqual([b, a].sort(compareEntries).map((e) => e.name), ["A_early", "B_late"]);
  assert.deepEqual([a, b].sort(compareEntries).map((e) => e.name), ["A_early", "B_late"]);
});

test("ranking: only the top 10 are kept; adding reports the rank, or null when it does not make the list", () => {
  let list: Entry[] = [];
  for (let i = 1; i <= 10; i++) list = addEntry(list, mk(`player${i}`, i * 100, `2026-11-20T10:${String(i).padStart(2, "0")}:00+07:00`)).entries;
  assert.equal(list.length, 10);
  assert.equal(list[0].name, "player10");
  const better = addEntry(list, mk("newbest", 5000));
  assert.equal(better.rank, 1);
  assert.equal(better.entries.length, 10);
  assert.ok(!better.entries.some((e) => e.name === "player1"), "the lowest entry dropped off");
  const worse = addEntry(list, mk("tooLow", 50));
  assert.equal(worse.rank, null);
  assert.equal(worse.entries.length, 10);
  const tie = addEntry(list, mk("tied", 100, "2030-01-01T00:00:00+00:00")); // ties player1 (100) but achieved later: ranks below it and drops
  assert.equal(tie.rank, null);
});

test("normalizeList drops invalid rows, sorts and caps the list", () => {
  const rows = [mk("good_one", 10), { name: "x", score: 5 }, mk("best_one", 99), "garbage", null];
  assert.deepEqual(normalizeList({ entries: rows }).map((e) => e.name), ["best_one", "good_one"]);
  assert.deepEqual(normalizeList("not a list"), []);
});

// ================================================================ the HTTP API and the disk file
const tmp = () => join(mkdtempSync(join(tmpdir(), "ddl-lb-")), "leaderboard.json");
const post = (url: string, body: unknown) => fetch(`${url}api/leaderboard`, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("API: POST saves an entry and returns the rank; GET returns the sorted list; bad input is rejected", async () => {
  const file = tmp();
  const srv = await startServer("dist", 0, [leaderboardHandler(file)]);
  try {
    assert.deepEqual(await (await fetch(`${srv.url}api/leaderboard`)).json(), { entries: [] });
    const r1 = await (await post(srv.url, { name: "Alice", score: 300, nights_won: 2, seed: 5, achieved_at: "2026-11-20T10:00:00+07:00" })).json();
    assert.equal(r1.rank, 1);
    const r2 = await (await post(srv.url, { name: "Bob_2", score: 500, nights_won: 3, seed: 6, achieved_at: "2026-11-20T11:00:00+07:00" })).json();
    assert.equal(r2.rank, 1);
    const list = (await (await fetch(`${srv.url}api/leaderboard`)).json()).entries;
    assert.deepEqual(list.map((e: Entry) => e.name), ["Bob_2", "Alice"]);
    assert.equal((await post(srv.url, { name: "x", score: 1, nights_won: 0, seed: 1 })).status, 400, "name too short");
    assert.equal((await post(srv.url, "{broken")).status, 400, "invalid JSON");
    assert.equal((await post(srv.url, "x".repeat(5000))).status, 413, "body too large");
    assert.equal((await fetch(`${srv.url}api/leaderboard`, { method: "DELETE" })).status, 405);
    assert.equal(loadEntries(file).length, 2, "rejected requests stored nothing");
  } finally { await srv.close(); }
});

test("persistence: the scores are still there after the server (the game) is stopped and started again", async () => {
  const file = tmp();
  const first = await startServer("dist", 0, [leaderboardHandler(file)]);
  await post(first.url, { name: "Persist", score: 777, nights_won: 3, seed: 3, achieved_at: "2026-11-20T09:00:00+07:00" });
  await first.close();
  const second = await startServer("dist", 0, [leaderboardHandler(file)]);
  try {
    const list = (await (await fetch(`${second.url}api/leaderboard`)).json()).entries;
    assert.deepEqual(list.map((e: Entry) => [e.name, e.score, e.nights_won, e.seed]), [["Persist", 777, 3, 3]]);
    assert.ok(list[0].achieved_at.startsWith("2026-11-20T09:00:00+07:00"), "achieved_at keeps its timezone");
  } finally { await second.close(); }
});

test("a corrupt or missing data file is treated as an empty leaderboard", () => {
  const file = tmp();
  assert.deepEqual(loadEntries(file), []);
  writeFileSync(file, "{not json");
  assert.deepEqual(loadEntries(file), []);
  saveEntries([mk("recover", 1)], file);
  assert.equal(loadEntries(file)[0].name, "recover");
});

// ================================================================ the export command
const exportRun = (dataDir: string, out: string) =>
  spawnSync(process.execPath, ["scripts/run.ts", "--export-leaderboard", out], { encoding: "utf8", env: { ...process.env, DDL_DATA_DIR: dataDir } });

test("run_cmd --export-leaderboard writes {entries} in rank order and exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "ddl-exp-"));
  const entries = [mk("third", 100, "2026-11-20T10:00:00+07:00"), mk("first", 900), mk("second_a", 500, "2026-11-20T08:00:00+07:00"), mk("second_b", 500, "2026-11-20T09:00:00+07:00")];
  saveEntries(entries.sort(compareEntries), join(dir, "leaderboard.json"));
  const out = join(dir, "out.json");
  const r = exportRun(dir, out);
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(readFileSync(out, "utf8"));
  assert.deepEqual(Object.keys(json), ["entries"]);
  assert.deepEqual(json.entries.map((e: Entry) => e.name), ["first", "second_a", "second_b", "third"]);
  for (const e of json.entries) assert.deepEqual(Object.keys(e).sort(), ["achieved_at", "name", "nights_won", "score", "seed"]);
});

test("run_cmd --export-leaderboard with no stored scores gives an empty list; a missing file name is an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "ddl-exp-"));
  const out = join(dir, "empty.json");
  assert.equal(exportRun(dir, out).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), { entries: [] });
  assert.notEqual(spawnSync(process.execPath, ["scripts/run.ts", "--export-leaderboard"], { encoding: "utf8" }).status, 0);
});
