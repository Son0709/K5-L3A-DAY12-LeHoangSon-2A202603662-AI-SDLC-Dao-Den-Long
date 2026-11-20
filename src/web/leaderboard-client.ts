// Leaderboard access from the browser. Scores go to the local server (data/leaderboard.json on disk). When the game is served
// without that server (a plain static host), they fall back to localStorage so the feature still works.
import { addEntry, normalizeList, type Entry } from "../leaderboard.ts";

const KEY = "ddl.leaderboard.v1";
export type Where = "disk" | "browser";

function loadLocal(): Entry[] {
  try { return normalizeList(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { return []; }
}

export async function fetchEntries(): Promise<{ entries: Entry[]; where: Where }> {
  try {
    const r = await fetch("api/leaderboard", { cache: "no-store" });
    if (r.ok) return { entries: normalizeList(await r.json()), where: "disk" };
  } catch { /* no local server: use the browser */ }
  return { entries: loadLocal(), where: "browser" };
}

export async function submitEntry(entry: Entry): Promise<{ entries: Entry[]; rank: number | null; where: Where }> {
  try {
    const r = await fetch("api/leaderboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) });
    if (r.ok) { const j = await r.json(); return { entries: normalizeList(j), rank: j.rank ?? null, where: "disk" }; }
  } catch { /* no local server: use the browser */ }
  const { entries, rank } = addEntry(loadLocal(), entry);
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* storage blocked: the score is shown but not kept */ }
  return { entries, rank, where: "browser" };
}
