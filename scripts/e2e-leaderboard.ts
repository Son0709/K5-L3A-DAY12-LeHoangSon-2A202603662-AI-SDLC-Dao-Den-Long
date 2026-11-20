// End-to-end check of the leaderboard in a real browser (Ticket-04 part 3). Usage: npm run e2e:leaderboard   (needs Chrome)
// Starts the real run_cmd server on a temporary data folder, plays like a user until losing (walks off the island three times),
// saves a score with a rejected and an accepted name, stops the server, starts it again and exports the leaderboard.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const PORT = 4197;
const OUT = "docs/proof/phase-4/screens";
const chrome = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!chrome) { console.error("e2e: no Chrome found; set CHROME_PATH"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const dataDir = mkdtempSync(join(tmpdir(), "ddl-e2e-"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const results: string[] = [];
let failures = 0;
const check = (ok: boolean, what: string) => { results.push(`${ok ? "PASS" : "FAIL"}  ${what}`); if (!ok) failures++; };

function startGame(): ChildProcess {
  return spawn(process.execPath, ["scripts/run.ts", "--no-open", "--port", String(PORT)], { env: { ...process.env, DDL_DATA_DIR: dataDir }, stdio: "ignore" });
}
async function waitUp() { for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) return; } catch { /* not yet */ } await sleep(250); } throw new Error("server did not start"); }

let server = startGame();
await waitUp();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1280, height: 720 } });
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const text = (sel: string) => page.$eval(sel, (e) => (e as HTMLElement).innerText).catch(() => "");
  const shot = (n: string) => page.screenshot({ path: `${OUT}/${n}.png` });
  const hold = async (k: string, ms: number) => { await page.keyboard.down(k as never); await sleep(ms); await page.keyboard.up(k as never); };

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
  await sleep(600);
  await page.click("[data-act=lb]"); await sleep(500);
  check((await text("#card")).includes("Chưa có điểm"), "the leaderboard is empty at first and says where scores are stored (disk)");
  check((await text("#card")).includes("data/leaderboard.json"), "the leaderboard screen says it is stored on disk");
  await shot("lb-1-empty");
  await page.click("[data-act=menu]"); await sleep(300);

  // play until losing: walk off the island three times
  await page.keyboard.press("Enter"); await sleep(400);   // new game -> intro
  await page.keyboard.press("Space"); await sleep(1200);  // start the night
  for (let i = 0; i < 3; i++) { await hold("KeyW", 7500); await sleep(2800); }
  await sleep(500);
  check((await text("#card")).includes("Đêm chưa kết thúc"), "losing shows the result card");
  check((await text("#card")).includes("Lưu điểm"), "the lose card offers to save the score");

  await page.click("[data-act=savescore]"); await sleep(300);
  check(await page.$("#nameInput") !== null, "the name form opens");
  // game keys must not fire while typing a name (R restarts a night, E interacts, Space advances)
  await page.$eval("#nameInput", (e) => { (e as HTMLInputElement).value = ""; });
  await page.type("#nameInput", "Rex Ro");
  check((await page.$eval("#nameInput", (e) => (e as HTMLInputElement).value)) === "Rex Ro" && await page.$("#nameInput") !== null, "typing R, E and Space into the name field does not trigger game keys");
  await page.click("[data-act=submitscore]"); await sleep(300);
  check((await text("#nameErr")).length > 5, "a name with a space is rejected with a message");
  await shot("lb-2-name-error");
  await page.$eval("#nameInput", (e) => { (e as HTMLInputElement).value = "ab"; });
  await page.click("[data-act=submitscore]"); await sleep(200);
  check((await text("#nameErr")).length > 5, "a 2-character name is rejected");
  await page.$eval("#nameInput", (e) => { (e as HTMLInputElement).value = "Nguyễn_An"; });
  await page.keyboard.press("Enter"); await sleep(800);                       // Enter submits
  const card = await text("#card");
  check(card.includes("Nguyễn_An") && card.includes("Bảng xếp hạng"), "a Vietnamese name with diacritics is accepted and shown on the leaderboard");
  await shot("lb-3-saved");
  check(errors.length === 0, `no browser errors (${errors.length})`);

  // stop the game completely, start it again, and read the scores back through the export command
  await browser.close();
  server.kill();
  await sleep(800);
  server = startGame();
  await waitUp();
  const api = await (await fetch(`http://localhost:${PORT}/api/leaderboard`)).json() as { entries: { name: string; score: number; nights_won: number; achieved_at: string; seed: number }[] };
  check(api.entries.length === 1 && api.entries[0].name === "Nguyễn_An", "after stopping and restarting the game the score is still there");
  check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(api.entries[0]?.achieved_at ?? ""), `achieved_at is ISO 8601 with a timezone (${api.entries[0]?.achieved_at})`);
  check(Number.isInteger(api.entries[0]?.seed) && api.entries[0].nights_won === 0, "the entry stores seed and nights_won (0: no night was won in this run)");
  const out = join(dataDir, "export.json");
  const ex = spawnSync(process.execPath, ["scripts/run.ts", "--export-leaderboard", out], { env: { ...process.env, DDL_DATA_DIR: dataDir }, encoding: "utf8" });
  const exported = JSON.parse(readFileSync(out, "utf8"));
  check(ex.status === 0 && exported.entries?.[0]?.name === "Nguyễn_An", "run_cmd --export-leaderboard writes the saved entry and exits 0");
} catch (e) {
  results.push(`ERROR ${(e as Error).message}`); failures++;
} finally {
  await browser.close().catch(() => undefined);
  server.kill();
}
console.log(results.join("\n"));
console.log(failures === 0 ? "e2e: all leaderboard checks passed" : `e2e: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
