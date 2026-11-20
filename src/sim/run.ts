// Public API of the simulation core. Pure: no DOM, no three.js, no Date, no Math.random.
import { InputError } from "./errors.ts";
import { parseInputs, parseScenario } from "./parse.ts";
import { simulate, type OutLine } from "./sim.ts";

export { InputError };
export type { OutLine };
export type JsonObj = Record<string, unknown>;

export interface RunOptions {
  seed: number;
  night: number;
  scenario?: JsonObj;
  inputs?: { frames: JsonObj[] };
  ticks: number;
  snapshotEvery?: number; // default 10
}

/** Runs the simulation and returns output lines (snapshot / event / end), coordinates rounded to 3 decimals. */
export function runSim(opts: RunOptions): OutLine[] {
  if (opts.night !== 1) throw new Error(`unsupported night: ${opts.night} (only night 1 exists)`);
  if (!Number.isInteger(opts.ticks) || opts.ticks < 0) throw new InputError("ticks must be a non-negative integer");
  const every = opts.snapshotEvery ?? 10;
  if (!Number.isInteger(every) || every < 1) throw new InputError("snapshot-every must be a positive integer");
  const scenario = parseScenario(opts.scenario);
  const frames = parseInputs(opts.inputs);
  return simulate(scenario, frames, opts.seed, opts.ticks, every);
}
