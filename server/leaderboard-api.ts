// Leaderboard storage on disk and its HTTP API. Used by scripts/run.ts (production) and the Vite dev server.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { addEntry, normalizeList, parseEntry, type Entry } from "../src/leaderboard.ts";
import type { Handler } from "./static.ts";

/** data/leaderboard.json, or $DDL_DATA_DIR/leaderboard.json. */
export const dataFile = () => join(process.env.DDL_DATA_DIR ?? "data", "leaderboard.json");

export function loadEntries(file = dataFile()): Entry[] {
  try { return existsSync(file) ? normalizeList(JSON.parse(readFileSync(file, "utf8"))) : []; } catch { return []; }
}

export function saveEntries(entries: Entry[], file = dataFile()) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + "\n");
  renameSync(tmp, file); // atomic replace, so a crash never leaves a half-written file
}

const send = (res: import("node:http").ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

/** GET /api/leaderboard -> {entries}; POST /api/leaderboard {name, score, nights_won, seed, achieved_at?} -> {entries, rank}. */
export function leaderboardHandler(file = dataFile()): Handler {
  return (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/leaderboard") return false;
    if (req.method === "GET") { send(res, 200, { entries: loadEntries(file) }); return true; }
    if (req.method !== "POST") { send(res, 405, { error: "method not allowed" }); return true; }
    return new Promise<boolean>((done) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size > 4096) { send(res, 413, { error: "body too large" }); req.destroy(); done(true); } else chunks.push(c);
      });
      req.on("end", () => {
        if (res.writableEnded) return;
        let raw: unknown;
        try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { send(res, 400, { error: "invalid JSON" }); done(true); return; }
        const parsed = parseEntry(raw);
        if (!parsed.entry) { send(res, 400, { error: parsed.error }); done(true); return; }
        const { entries, rank } = addEntry(loadEntries(file), parsed.entry);
        saveEntries(entries, file);
        send(res, 200, { entries, rank });
        done(true);
      });
    });
  };
}
