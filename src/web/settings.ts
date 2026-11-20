// Player settings, persisted in localStorage between sessions.
export interface Settings { volume: number; sensitivity: number } // volume 0..1, sensitivity 0.2..2 (camera drag multiplier)

const KEY = "ddl.settings.v1";
const DEFAULTS: Settings = { volume: 0.6, sensitivity: 1 };
const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { volume: clamp(raw.volume, 0, 1, DEFAULTS.volume), sensitivity: clamp(raw.sensitivity, 0.2, 2, DEFAULTS.sensitivity) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage may be blocked; settings then last for the session only */ }
}
