// Local leaderboard rules (Ticket-04 part 3). Pure and dependency-free: used by the Node server, the CLI export and the browser.
export interface Entry {
  name: string;
  score: number; // total score of the nights won in the run
  nights_won: number; // 0..3
  achieved_at: string; // ISO 8601 with a timezone, e.g. 2026-11-20T15:30:00+07:00
  seed: number;
}

export const MAX_ENTRIES = 10;
export const NAME_MIN = 3;
export const NAME_MAX = 12;

// 3-12 characters of [A-Za-z0-9_]. Vietnamese letters with diacritics are accepted too (the ticket says it is a bonus):
// any Latin-script letter, digit or underscore. The name is normalised (NFC) first so "ế" counts as one character.
const NAME_RE = /^[\p{Script=Latin}0-9_]+$/u;

/** Returns the normalised name if it is valid, otherwise null. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC");
  const length = [...name].length;
  return length >= NAME_MIN && length <= NAME_MAX && NAME_RE.test(name) ? name : null;
}

const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** The current time as ISO 8601 with the local UTC offset (not converted to UTC). */
export function isoWithOffset(d: Date = new Date()): string {
  const p = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

export function parseEntry(raw: unknown): { entry?: Entry; error?: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { error: "expected an object" };
  const o = raw as Record<string, unknown>;
  const name = cleanName(o.name);
  if (name === null) return { error: `name must be ${NAME_MIN}-${NAME_MAX} characters: letters, digits or _` };
  if (typeof o.score !== "number" || !Number.isInteger(o.score) || o.score < 0) return { error: "score must be a non-negative integer" };
  if (typeof o.nights_won !== "number" || !Number.isInteger(o.nights_won) || o.nights_won < 0 || o.nights_won > 3) return { error: "nights_won must be an integer from 0 to 3" };
  if (typeof o.seed !== "number" || !Number.isInteger(o.seed)) return { error: "seed must be an integer" };
  const at = o.achieved_at === undefined ? isoWithOffset() : o.achieved_at;
  if (typeof at !== "string" || !ISO_WITH_TZ.test(at) || Number.isNaN(Date.parse(at))) return { error: "achieved_at must be ISO 8601 with a timezone" };
  return { entry: { name, score: o.score, nights_won: o.nights_won, achieved_at: at, seed: o.seed } };
}

/** Higher score first; equal scores: the one achieved earlier ranks higher. */
export function compareEntries(a: Entry, b: Entry): number {
  return b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
}

/** Adds an entry, keeps the top 10 and reports its rank (1-based) or null if it did not make the list. */
export function addEntry(list: Entry[], entry: Entry): { entries: Entry[]; rank: number | null } {
  const sorted = [...list, entry].sort(compareEntries); // Array.prototype.sort is stable: exact ties keep insertion order
  const entries = sorted.slice(0, MAX_ENTRIES);
  const i = entries.indexOf(entry);
  return { entries, rank: i >= 0 ? i + 1 : null };
}

/** Cleans a list read from disk or localStorage: drops invalid rows, sorts and caps it. */
export function normalizeList(raw: unknown): Entry[] {
  const rows = Array.isArray(raw) ? raw : typeof raw === "object" && raw !== null && Array.isArray((raw as { entries?: unknown }).entries) ? (raw as { entries: unknown[] }).entries : [];
  const out: Entry[] = [];
  for (const r of rows) { const p = parseEntry(r); if (p.entry && (r as Record<string, unknown>).achieved_at !== undefined) out.push(p.entry); }
  return out.sort(compareEntries).slice(0, MAX_ENTRIES);
}
