// Single source of truth for contract numbers: game.contract.json (Ticket-02 standard values).
// Constants below are NOT in the contract; they are fixed by the ticket text or by docs/notes/phase2-spec.md.
import contract from "../../game.contract.json" with { type: "json" };

export const T = contract.tuning;

export const DT = 1 / 60;
export const EPS = 1e-9;
export const sec = (s: number) => Math.round(s * 60);

// physics (ticket Part 1)
export const JUMP_V = 7;
export const GRAVITY = 20;
export const ACCEL = 60; // 6 m/s reached in 0.1 s (assumption A1)
export const STEP_UP = 0.35; // walls higher than this block walking (A4)
export const STEP_DOWN = 0.35;
export const FALL_Y = -10;
export const RESPAWN_WAIT = 60;
export const CHARM_SPEED = 7.2;
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;

// motes
export const MOTE_INITIAL = 20;
export const MOTE_CAP = 30;
export const MOTE_SPAWN_EVERY = 240;
export const MOTE_TTL = 480;
export const PICKUP_DY = 1.5;
export const DROP_MIN = 1.5;
export const DROP_MAX = 2.5;

// shades
export const SHADE_FIRST_TICK = 300;
export const SHADE_FIRST_COUNT = 2;
export const SHADE_DETECT = 12;
export const SHADE_LOSE = 18;
export const SHADE_SPAWN_TICKS = 60; // `spawning` state length (A8)
export const SHADE_WANDER_SPEED = 2;
export const SHADE_WANDER_RETARGET = 90;
export const SHADE_MIN_SPAWN_DIST = 15;
export const RECOIL_M = 2;
export const RECOIL_TICKS = 60;
export const EXPEL_TICKS = 30;
export const HIT_DY = 1.5;
export const PUSH_TICKS = 15;
export const PULSE_CENTER_DY = 0.8;
export const SHADE_BASE_Y = 1; // default float height of a shade above ground (A15)

// legacy export used by the 3D client for the Night 1 island
export const ISLAND_R = 40;
