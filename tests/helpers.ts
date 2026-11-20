import assert from "node:assert/strict";
import { runSim, type JsonObj, type OutLine } from "../src/sim/run.ts";

/** Empty arena: no random entities, player at origin. */
export const BASE: JsonObj = {
  player: { pos: [0, 0, 0] },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
};

export function scn(over: JsonObj = {}): JsonObj {
  return { ...BASE, ...over };
}

export interface SimOpts {
  scenario?: JsonObj;
  frames?: JsonObj[];
  ticks: number;
  seed?: number;
  every?: number;
  night?: number;
}

export function sim(o: SimOpts) {
  const lines = runSim({
    seed: o.seed ?? 1,
    night: o.night ?? 1,
    scenario: o.scenario,
    inputs: o.frames ? { frames: o.frames } : undefined,
    ticks: o.ticks,
    snapshotEvery: o.every,
  });
  // `night_start` is a bookkeeping event; it is excluded here so rule tests can compare whole event lists.
  // Use `lines` to see it.
  const events = lines.filter((l) => l.type === "event" && l.name !== "night_start");
  const snaps = lines.filter((l) => l.type === "snapshot");
  return {
    lines,
    events,
    snaps,
    end: lines[lines.length - 1] as OutLine,
    ev: (name: string) => events.filter((e) => e.name === name),
    snapAt: (t: number) => snaps.find((s) => s.tick === t) as OutLine,
  };
}

export function near(actual: number, expected: number, eps = 0.002, msg = "") {
  assert.ok(Math.abs(actual - expected) <= eps, `${msg} expected ${expected} +-${eps}, got ${actual}`);
}
