// Measures the frame rate of the built web client at 1280x720 in a real Chrome (via puppeteer-core).
// Usage: npm run fps        (builds the client, serves it, plays for 10 s, writes docs/proof/phase-2/fps.json)
// Requirement (ticket): >= 30 FPS on average at 1280x720.
import { execSync, spawn } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import puppeteer from "puppeteer-core";

const PORT = 4199;
const SECONDS = 10;
const vite = "node_modules/vite/bin/vite.js";

const candidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((p): p is string => !!p);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) { console.error("fps: no Chrome found; set CHROME_PATH"); process.exit(1); }

execSync(`${JSON.stringify(process.execPath)} ${vite} build`, { stdio: "ignore" });
const server = spawn(process.execPath, [vite, "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, defaultViewport: { width: 1280, height: 720 }, args: ["--window-size=1280,720"] });
try {
  const page = await browser.newPage();
  const perNight: Record<string, { average_fps: number; p95_frame_ms: number; worst_frame_ms: number }> = {};
  let renderer = "unknown";
  for (const night of [1, 2, 3]) {
  await page.goto(`${url}#play${night}`, { waitUntil: "load" });
  await page.reload({ waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 3000)); // warm-up
  renderer = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });
  const res = await page.evaluate((secs) => new Promise<{ frames: number; ms: number; worst: number; p95: number }>((resolve) => {
    const dts: number[] = [];
    const t0 = performance.now();
    let last = t0;
    const tick = (t: number) => {
      dts.push(t - last); last = t;
      if (t - t0 < secs * 1000) requestAnimationFrame(tick);
      else { const s = [...dts].sort((a, b) => a - b); resolve({ frames: dts.length, ms: t - t0, worst: s[s.length - 1], p95: s[Math.floor(s.length * 0.95)] }); }
    };
    requestAnimationFrame(tick);
  }), SECONDS);
  perNight[`night${night}`] = {
    average_fps: Math.round((res.frames / res.ms) * 1000 * 10) / 10,
    p95_frame_ms: Math.round(res.p95 * 10) / 10,
    worst_frame_ms: Math.round(res.worst * 10) / 10,
  };
  }
  const out = {
    ...perNight, seconds_per_night: SECONDS, viewport: "1280x720", browser: await browser.version(), gl_renderer: renderer,
    cpu: os.cpus()[0]?.model.trim(), cpu_threads: os.cpus().length, ram_gb: Math.round(os.totalmem() / 2 ** 30), os: `${process.platform} ${process.arch}`,
    scene: "web client as built, each Night from its start, player standing still", requirement: ">= 30 FPS average",
  };
  mkdirSync("docs/proof/phase-2", { recursive: true });
  writeFileSync("docs/proof/phase-2/fps.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = Object.values(perNight).every((n) => n.average_fps >= 30) ? 0 : 1;
} finally {
  await browser.close();
  server.kill();
}
