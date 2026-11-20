// Drives the built client in real Chrome like a player and saves screenshots as evidence (docs/proof/phase-2/screens).
// Also checks that settings persist across a page reload. Usage: npm run screens   (needs Chrome)
import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const PORT = 4198;
const OUT = "docs/proof/phase-2/screens";
const vite = "node_modules/vite/bin/vite.js";
const chrome = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!chrome) { console.error("screens: no Chrome found; set CHROME_PATH"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

execSync(`${JSON.stringify(process.execPath)} ${vite} build`, { stdio: "ignore" });
const server = spawn(process.execPath, [vite, "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 200)); }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1280, height: 720 }, args: ["--window-size=1280,720"] });
const results: string[] = [];
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const shot = async (name: string) => { await page.screenshot({ path: `${OUT}/${name}.png` }); results.push(`saved ${name}.png`); };
  const hold = async (key: string, ms: number) => { await page.keyboard.down(key as never); await sleep(ms); await page.keyboard.up(key as never); };
  const text = (sel: string) => page.$eval(sel, (e) => (e as HTMLElement).innerText).catch(() => "");

  // menu -> intro -> play
  await page.goto(url, { waitUntil: "load" });
  await sleep(800); await shot("01-menu");
  await page.keyboard.press("Enter"); await sleep(500); await shot("02-intro-night1");
  await page.keyboard.press("Space"); await sleep(1500);
  await hold("KeyW", 900); await hold("KeyD", 400); await sleep(300);
  await shot("03-night1-play");
  results.push(`HUD night 1: clock "${await text("#clock")}", lanterns "${await text("#lanternCount")}", motes "${await text("#moteBar")}"`);

  // pause menu and settings
  await page.keyboard.press("Escape"); await sleep(400);
  const c1 = await text("#clock"); await sleep(2200); const c2 = await text("#clock");
  results.push(`pause freezes the clock: ${c1} -> ${c2} after 2.2 s (${c1 === c2 ? "frozen" : "NOT FROZEN"})`);
  await shot("04-pause");
  await page.click("[data-act=settings]"); await sleep(300);
  await page.$eval("#vol", (el) => { (el as HTMLInputElement).value = "25"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.$eval("#sens", (el) => { (el as HTMLInputElement).value = "140"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await shot("05-settings");
  await page.reload({ waitUntil: "load" }); await sleep(500);
  const saved = await page.evaluate(() => localStorage.getItem("ddl.settings.v1"));
  results.push(`settings after reload: ${saved} (expected volume 0.25, sensitivity 1.4)`);

  // Night 2 and Night 3 (skip the menu with #playN)
  for (const n of [2, 3]) {
    await page.goto(`${url}#play${n}`, { waitUntil: "load" }); await page.reload({ waitUntil: "load" });
    await sleep(1800); await hold("KeyW", 700); await sleep(400);
    await shot(`0${n + 4}-night${n}-play`);
    results.push(`HUD night ${n}: clock "${await text("#clock")}", lanterns "${await text("#lanternCount")}"`);
  }

  // Night 2: walk to the charm at (35,0,0) (A = screen-left = +X with the default camera) and pick it up
  await page.goto(`${url}#play2`, { waitUntil: "load" }); await page.reload({ waitUntil: "load" });
  await sleep(1200); await hold("KeyA", 6200); await sleep(300);
  await shot("09-night2-charm");
  results.push(`charm badge visible: ${await page.$eval("#charmBadge", (e) => getComputedStyle(e).display)}, text "${await text("#charmBadge")}"`);

  // Night 3: wait for the wind warning (tick 1680 = 28 s)
  await page.goto(`${url}#play3`, { waitUntil: "load" }); await page.reload({ waitUntil: "load" });
  await sleep(29500);
  await shot("10-night3-wind-warning");
  results.push(`wind banner: "${await text("#windBanner")}"`);
  await sleep(2600);
  await shot("11-night3-wind-blowing");
  results.push(`wind banner: "${await text("#windBanner")}"`);

  // losing screen: walk off the island three times (each fall costs a flame) and check the lose card appears
  await page.goto(`${url}#play`, { waitUntil: "load" }); await page.reload({ waitUntil: "load" });
  await sleep(1000);
  for (let i = 0; i < 3; i++) { await hold("KeyW", 7500); await sleep(2800); } // W = forward, far past the 40 m rim
  await sleep(500);
  await shot("08-result-lose");
  results.push(`after three falls the overlay says: "${(await text("#card")).replace(/\n+/g, " | ").slice(0, 120)}"`);
  await page.click("[data-act=retry]"); await sleep(800);
  results.push(`after "Chơi lại Đêm": clock "${await text("#clock")}", flames "${await page.$$eval(".flame:not(.off)", (e) => e.length)}"`);
  results.push(`browser errors during the whole run: ${errors.length}${errors.length ? " -> " + errors.slice(0, 3).join(" | ") : ""}`);
} finally {
  await browser.close();
  server.kill();
}
console.log(results.join("\n"));
