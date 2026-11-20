// Benchmark (Ticket-04, bench_cmd): node scripts/bench.ts --seed 42 --duration 30 --out bench.json
// Opens a 1280x720 browser window (not fullscreen, vsync disabled through Chrome flags), loads the standard benchmark
// scene (see startBench in src/web/main.ts), skips a 3 s warm-up, measures `--duration` s and writes bench.json.
// Needs Chrome, Edge or Chromium (set CHROME_PATH if it is somewhere unusual).
// Options: --headless (no window), --port <n>, --no-mem (skip the memory sampler), --diag (add CPU timings), --query "a=1&b=2".
// Reliability: if the page stops producing frames (for example Chrome pauses a covered window) the script brings the window to
// the front and, if that does not help, repeats the whole measurement headless instead of hanging.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { promisify } from "node:util";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { startServer } from "../server/static.ts";

const processStartMs = Date.now() - process.uptime() * 1000; // load_ms counts from the start of this process
const arg = (name: string, d?: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : d; };
const has = (name: string) => process.argv.includes(`--${name}`);
const seed = Number(arg("seed", "42")), duration = Number(arg("duration", "30")), out = arg("out", "bench.json")!;
if (!Number.isFinite(seed) || !Number.isFinite(duration) || duration <= 0) { console.error("bench: --seed and --duration must be numbers"); process.exit(1); }

const chromePath = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].find((p) => p && existsSync(p));
if (!chromePath) { console.error("bench: no Chrome, Edge or Chromium found; set CHROME_PATH"); process.exit(1); }

if (!existsSync("dist/index.html")) execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { stdio: "ignore" });
const server = await startServer("dist", Number(arg("port", "0")));

const run = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resident memory of the browser process tree (all its helper processes), in MB; null when the OS query fails. */
async function treeRssMb(pid: number): Promise<number | null> {
  try {
    if (process.platform === "win32") {
      const ps = `$all = Get-CimInstance Win32_Process; $ids = @(${pid}); do { $n = @($all | Where-Object { ($ids -contains $_.ParentProcessId) -and ($ids -notcontains $_.ProcessId) } | ForEach-Object { $_.ProcessId }); $ids += $n } while ($n.Count -gt 0); [int64](($all | Where-Object { $ids -contains $_.ProcessId } | Measure-Object WorkingSetSize -Sum).Sum)`;
      const { stdout } = await run("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { timeout: 20000 });
      const bytes = Number(stdout.trim());
      return Number.isFinite(bytes) && bytes > 0 ? bytes / 1048576 : null;
    }
    const { stdout } = await run("ps", ["-A", "-o", "pid=,ppid=,rss="], { timeout: 20000 });
    const rows = stdout.trim().split("\n").map((l) => l.trim().split(/\s+/).map(Number));
    const ids = new Set([pid]);
    for (let grew = true; grew; ) { grew = false; for (const [p, pp] of rows) if (ids.has(pp) && !ids.has(p)) { ids.add(p); grew = true; } }
    const kb = rows.filter(([p]) => ids.has(p)).reduce((a, r) => a + r[2], 0);
    return kb > 0 ? kb / 1024 : null;
  } catch { return null; }
}

/** "battery", "AC" or "unknown": a laptop on battery is throttled, so the number needs this context. */
function powerSource(): string {
  try {
    if (process.platform === "win32") {
      const s = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", "(Get-CimInstance Win32_Battery | Select-Object -First 1).BatteryStatus"], { encoding: "utf8", timeout: 15000 }).trim();
      if (s === "") return "AC (no battery)";
      return s === "1" ? "battery" : "AC";
    }
    if (process.platform === "darwin") return /AC Power/.test(execFileSync("pmset", ["-g", "batt"], { encoding: "utf8" })) ? "AC" : "battery";
    return "unknown";
  } catch { return "unknown"; }
}

class Stalled extends Error {}

/** Waits until `predicate` is true, failing with Stalled if the page's frame counter stops advancing. */
async function waitFor(page: Page, what: string, predicate: () => Promise<boolean>, totalMs: number) {
  const deadline = Date.now() + totalMs;
  let lastProgress = -1, lastChange = Date.now(), nudged = false;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    const progress = await page.evaluate(() => (window as unknown as { __bench_progress?: number }).__bench_progress ?? -1).catch(() => -1);
    if (progress !== lastProgress) { lastProgress = progress; lastChange = Date.now(); nudged = false; }
    const idle = Date.now() - lastChange;
    if (idle > 6000 && !nudged) { nudged = true; await page.bringToFront().catch(() => undefined); }
    if (idle > 15000) throw new Stalled(`no frames for ${Math.round(idle / 1000)} s while waiting for ${what}`);
    await sleep(500);
  }
  throw new Stalled(`timed out waiting for ${what}`);
}

async function measure(headless: boolean) {
  const browser: Browser = await puppeteer.launch({
    executablePath: chromePath, headless, protocolTimeout: 90000,
    defaultViewport: { width: 1280, height: 720 },
    args: ["--window-size=1280,720", "--disable-gpu-vsync", "--disable-frame-rate-limit", "--no-first-run", "--no-default-browser-check"],
  });
  try {
    // Is the frame rate really uncapped? An empty page that counts animation frames shows what the display allows.
    const probe = await browser.newPage();
    const probeFps = await probe.evaluate(() => new Promise<number>((done) => {
      let n = 0; const t0 = performance.now();
      const tick = (t: number) => { n++; if (t - t0 < 1500) requestAnimationFrame(tick); else done((1000 * n) / (t - t0)); };
      requestAnimationFrame(tick);
    }));
    await probe.close();

    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error(`bench: page error: ${e}`));
    page.on("console", (m) => { if (m.type() === "error") console.error(`bench: page console error: ${m.text()}`); });
    // Act as a focused, visible page even if another window covers this one, so Chrome does not throttle or pause the animation.
    await page.bringToFront().catch(() => undefined);
    await (await page.createCDPSession()).send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => undefined);
    const extraQuery = arg("query", "");
    await page.goto(`${server.url}?bench=1&seed=${seed}&duration=${duration}${extraQuery ? "&" + extraQuery : ""}`, { waitUntil: "load" });
    type Bench = { ready?: boolean; done?: boolean; first_frame_epoch_ms?: number } & Record<string, unknown>;
    const state = () => page.evaluate(() => (window as unknown as { __bench?: Bench }).__bench ?? {}) as Promise<Bench>;

    await waitFor(page, "the first frame", async () => (await state()).ready === true, 60000);
    const loadMs = Math.round(Number((await state()).first_frame_epoch_ms) - processStartMs);

    // sample the browser's memory while the measurement runs (each sample takes about a second, so not too often)
    const pid = browser.process()?.pid;
    const samples: number[] = [];
    let sampling = !has("no-mem");
    const sampler = (async () => {
      while (sampling && pid) {
        const m = await treeRssMb(pid);
        if (m !== null) samples.push(m);
        await sleep(4000);
      }
    })();

    try { await waitFor(page, "the end of the measurement", async () => (await state()).done === true, (duration + 60) * 1000); }
    finally { sampling = false; await sampler; }
    const r = await state();
    return { r, loadMs, probeFps, peak: samples.length ? Math.round(Math.max(...samples)) : null, version: await browser.version() };
  } finally {
    await browser.close();
  }
}

let exitCode = 0;
try {
  let headless = has("headless"), fellBack = false;
  let m: Awaited<ReturnType<typeof measure>>;
  try {
    m = await measure(headless);
  } catch (e) {
    if (headless) throw e; // already headless: nothing left to fall back to
    console.error(`bench: ${(e as Error).message}; repeating the measurement headless`);
    headless = true; fellBack = true;
    m = await measure(true);
  }
  const { r, loadMs, probeFps, peak, version } = m;
  const result = {
    contract_version: JSON.parse(readFileSync("game.contract.json", "utf8")).contract_version,
    avg_fps: Math.round(Number(r.avg_fps) * 10) / 10,
    p1_low_fps: Math.round(Number(r.p1_low_fps) * 10) / 10,
    frame_ms_p95: Math.round(Number(r.frame_ms_p95) * 10) / 10,
    frames: r.frames,
    load_ms: loadMs,
    peak_mem_mb: peak,
    // frames arrive faster than any vsync interval would allow, so vsync is not limiting them
    vsync_off: probeFps > 200 || Number(r.min_frame_ms) < 5,
    renderer: `three.js r${r.three} (WebGL) on ${version}; GPU: ${r.gl_renderer}`,
    os: `${os.type()} ${os.release()} ${os.arch()}, ${os.cpus()[0]?.model.trim()} (${os.cpus().length} threads), ${(os.totalmem() / 2 ** 30).toFixed(0)} GB RAM`,
    window: "1280x720, windowed" + (headless ? (fellBack ? " (headless fallback: the window run failed or stalled)" : " (headless)") : ""),
    power_source: powerSource(),
    vsync_probe_fps: Math.round(probeFps),
    min_frame_ms: Math.round(Number(r.min_frame_ms) * 10) / 10,
    peak_mem_note: peak === null ? "could not read the browser process memory on this OS (or --no-mem)" : "peak resident memory of the whole browser process tree, sampled every ~4 s during the measurement",
    ...(has("diag") ? { cpu_ms: r.cpu_ms } : {}),
  };
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
  const pass = result.avg_fps >= 60 && result.p1_low_fps >= 30 && result.load_ms <= 10000;
  console.log(pass ? "bench: thresholds met (avg >= 60, 1% low >= 30, load <= 10 s) on this machine" : "bench: BELOW the thresholds on this machine");
} catch (e) {
  console.error(`bench: failed: ${(e as Error).message}`);
  exitCode = 1;
} finally {
  await server.close();
}
process.exit(exitCode);
