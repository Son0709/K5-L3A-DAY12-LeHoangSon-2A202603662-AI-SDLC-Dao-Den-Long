// Single source of truth for every tuning number: game.contract.json.
import contract from "../../game.contract.json" with { type: "json" };

export const T = contract.tuning;

// Geometry / physics constants that are not part of the contract (see docs/notes/assumptions.md).
export const DT = 1 / 60;
export const ISLAND_R = 40;
export const RING_R = 25;
export const RIM_SPAWN_R = 38;
export const N_MOTES = 60;
export const INITIAL_SHADES = 2;
export const SPAWN_EVERY_TICKS = 600; // 10 s
export const MAX_SHADES = 5;
export const SPAWN_MIN_DIST = 20;
export const SHADE_Y = 1;
export const GRAVITY = 20;
export const JUMP_V = Math.sqrt(2 * GRAVITY * 1.2); // ~1.2 m jump height
export const EPS = 1e-9;
