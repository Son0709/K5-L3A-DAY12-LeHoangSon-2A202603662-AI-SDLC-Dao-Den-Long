// run_cmd (Ticket-04): node scripts/run.ts [--port 5173] [--no-open] [--export-leaderboard out.json]
// Without options: builds the client if needed, serves it with the leaderboard API (scores are stored in data/leaderboard.json)
// and opens the game in the default browser.
// --export-leaderboard <file>: writes {"entries": [...]} (top 10, best first) from the stored leaderboard and exits with 0.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataFile, leaderboardHandler, loadEntries } from "../server/leaderboard-api.ts";
import { startServer } from "../server/static.ts";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };

if (process.argv.includes("--export-leaderboard")) {
  const out = arg("export-leaderboard");
  if (!out || out.startsWith("--")) { console.error("run: --export-leaderboard needs a file name"); process.exit(1); }
  mkdirSync(dirname(out) || ".", { recursive: true });
  writeFileSync(out, JSON.stringify({ entries: loadEntries() }, null, 2) + "\n");
  console.log(`run: wrote ${out} from ${dataFile()}`);
  process.exit(0);
}

if (!existsSync("dist/index.html")) {
  console.log("run: building the game (first run only)...");
  execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build"], { stdio: "inherit" });
}
const want = Number(arg("port") ?? "5173");
let server;
try { server = await startServer("dist", want, [leaderboardHandler()]); }
catch { server = await startServer("dist", 0, [leaderboardHandler()]); console.log(`run: port ${want} is busy, using ${server.port}`); }
console.log(`Dao Den Long is running at ${server.url}  (press Ctrl+C to stop)`);
console.log(`Leaderboard file: ${dataFile()}`);

if (!process.argv.includes("--no-open")) {
  const [cmd, args] = process.platform === "win32" ? ["cmd", ["/c", "start", "", server.url]] : process.platform === "darwin" ? ["open", [server.url]] : ["xdg-open", [server.url]];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => undefined).unref(); } catch { /* open the URL by hand */ }
}
