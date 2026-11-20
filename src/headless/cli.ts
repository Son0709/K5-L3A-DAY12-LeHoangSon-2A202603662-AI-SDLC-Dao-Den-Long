// Headless CLI, Test Contract v1.0.
//   --seed <int> --night 1 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int>]
// Exit codes: 0 ok, 2 malformed scenario/inputs, 1 any other error (message on stderr).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { InputError, runSim, type JsonObj } from "../sim/run.ts";

const USAGE =
  "usage: --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] --ticks <int> --out <file.jsonl> [--snapshot-every <int>]";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function intArg(name: string, fallback?: number): number {
  const raw = arg(name);
  if (raw === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`missing --${name}\n${USAGE}`);
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`--${name} must be an integer, got "${raw}"`);
  return n;
}
function readJson(path: string, what: string): JsonObj {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    throw new Error(`cannot read ${what} file ${path}: ${(e as Error).message}`);
  }
  try {
    return JSON.parse(text) as JsonObj;
  } catch (e) {
    throw new InputError(`${what} file ${path} is not valid JSON: ${(e as Error).message}`);
  }
}

try {
  const seed = intArg("seed");
  const night = intArg("night", 1);
  const ticks = intArg("ticks");
  const every = intArg("snapshot-every", 10);
  const out = arg("out");
  if (!out) throw new Error(`missing --out\n${USAGE}`);
  const scPath = arg("scenario");
  const inPath = arg("inputs");

  const lines = runSim({
    seed,
    night,
    ticks,
    snapshotEvery: every,
    scenario: scPath ? readJson(scPath, "scenario") : undefined,
    inputs: inPath ? (readJson(inPath, "inputs") as { frames: JsonObj[] }) : undefined,
  });

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
} catch (e) {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exit(e instanceof InputError ? 2 : 1);
}
