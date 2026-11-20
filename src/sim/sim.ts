// Deterministic game rules (Contract v1.2). Pure: no DOM, no three.js, no Date, no Math.random.
// Per-tick order is mandated by Ticket-02 and extended by Ticket-03:
//  1 input/pause  2 counters (+ lantern burn and shade drain, then dead lanterns go out)  3 player move + fall
//  4 pickup  5 interact (light, relight, refuel)  6 safe zones  7 pulse  8 shades move  9 contact  10 spawns
//  11 win/lose (dawn rule)  12 snapshot (done by the caller)
// Step k reads the input of tick k and produces state k+1; events are stamped k+1.
import { mulberry32 } from "./rng.ts";
import type { Frame, ScenarioSpec } from "./parse.ts";
import { getMap } from "./maps.ts";
import {
  ACCEL, CHARM_RESPAWN_TICKS, CHARM_SPEED, CHARM_TICKS, DROP_MAX, DROP_MIN, DT, EPS, EXPEL_TICKS, FALL_Y, GRAVITY,
  HIT_DY, JUMP_V, MOTE_CAP, MOTE_INITIAL, MOTE_SPAWN_EVERY, MOTE_TTL, PICKUP_DY, PULSE_CENTER_DY, PUSH_TICKS,
  RECOIL_M, RECOIL_TICKS, RESPAWN_WAIT, SHADE_BASE_Y, SHADE_DETECT, SHADE_LOSE, SHADE_MIN_SPAWN_DIST, SHADE_SPAWN_TICKS,
  SHADE_WANDER_RETARGET, SHADE_WANDER_SPEED, STEP_DOWN, STEP_UP, T, sec,
  DRIFT_BASE_Y, DRIFT_DROP_FLEE_TICKS, DRIFT_EVERY, DRIFT_FLEE_TICKS, DRIFT_IDLE_SPEED, DRIFT_MAX, DRIFT_MIN_CARRIED,
  DRIFT_NEAR, DRIFT_SPEED, DRIFT_STEAL, DRIFT_STEAL_R, DRAIN_RANGE,
} from "./tuning.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OutLine = Record<string, any>;

export interface InputState {
  mx: number; mz: number; yaw: number;
  jump: boolean; interact: boolean; pulse: boolean; dash: boolean; pause: boolean;
}
export const NO_INPUT: InputState = { mx: 0, mz: 0, yaw: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

interface Mote { id: string; x: number; y: number; z: number; kind: "random" | "dropped"; ttl: number | null }
// fuelU is fuel in integer units of 1/60 (one tick of burning = 1 unit), so nothing accumulates floating-point error
interface Lantern { id: string; x: number; y: number; z: number; lit: boolean; deposited: number; fuelU: number; everLit: boolean; relit: number }
interface Charm { id: string; x: number; y: number; z: number; available: boolean; respawn: number }
interface Shade {
  id: string; x: number; y: number; z: number; baseOff: number; mode: "wander" | "chase";
  stun: number; spawn: number; recoil: number; expel: number; expelFrom: number;
  pdx: number; pdz: number; push: number; rdx: number; rdz: number; wdx: number; wdz: number; wt: number;
  drain: boolean; drainTicks: number; target: string | null; // `drain`: standing next to a weak lantern, sucking its fuel
}

interface Drifter {
  id: string; x: number; y: number; z: number; baseOff: number; state: "idle" | "chase" | "flee";
  stolen: number; fleeLeft: number; wdx: number; wdz: number; wt: number;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0; // "+ 0" turns -0 into 0
const r1 = (v: number) => Math.round(v * 10) / 10 + 0;
const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const within = (d: number, r: number) => d <= r + EPS;
const idNum = (id: string) => Number(id.replace(/\D/g, "")) || 0;

export function createSim(sc: ScenarioSpec, seed: number, night: number, onEvent: (e: OutLine) => void) {
  const map = getMap(night);
  const rng = mulberry32(seed);
  const H = map.heightAt;
  const blockedByObstacle = (x: number, z: number) => map.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) <= o.r);

  // ------------------------------------------------------------------ player
  const P = {
    x: sc.player.pos?.[0] ?? map.start.x, y: sc.player.pos?.[1] ?? map.start.y, z: sc.player.pos?.[2] ?? map.start.z,
    vx: 0, vy: 0, vz: 0, grounded: false,
    fx: map.startFacing.x, fz: map.startFacing.z,
    flames: sc.player.flames ?? T.flames, carried: sc.player.carried ?? 0, sl: sc.player.successfulLights ?? 0,
    invuln: sc.player.invulnTicks ?? 0, dashT: 0, dashCd: sc.player.dashCdTicks ?? 0, dashDx: 0, dashDz: 0,
    pulseCd: sc.player.pulseCdTicks ?? 0, charm: sc.player.charmTicks ?? 0,
    launched: false, lvx: 0, lvz: 0, out: false, wait: 0,
  };
  P.grounded = P.y <= (H(P.x, P.z) ?? -Infinity) + 1e-6;

  const bench = sc.bench === true; // benchmark scene (client only): see ScenarioSpec.bench
  const timeTicks = Math.round((sc.timeLeft ?? map.duration) * 60);
  let simTick = 0;
  let tickCount = 0;
  let paused = false;
  let score = 0;
  let state: "playing" | "won" | "lost" = "playing";
  let prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };
  const left = () => timeTicks - simTick;

  // strong wind (A20): cycle c>=1 starts at tick 1800c, blows 300 ticks, warned 120 ticks before
  const WIND_PERIOD = 1800, WIND_WARN = 120, WIND_TICKS = 300, WIND_SPEED = 2;
  const windOn = sc.windEnabled ?? map.wind;
  let windDir = 0;
  let windActive = false;

  const emit = (tick: number, name: string, data: Record<string, unknown>) => onEvent({ type: "event", tick, name, data });

  // ------------------------------------------------------------------ lanterns
  const FUEL_MAX = T.fuel_max * 60, LOW_U = T.low_fuel_threshold * 60, MOTE_U = T.fuel_per_mote * 60;
  const BURN_U = T.fuel_decay_per_s, DRAIN_U = T.drain_per_s; // units per tick (a unit is 1/60 of fuel), so "per second" == "units per tick"
  const capacity = () => Math.min(T.capacity_max, T.carry_capacity + 2 * P.sl);
  const lanterns: Lantern[] = map.lanterns.map((l) => ({ ...l, lit: false, deposited: 0, fuelU: 0, everLit: false, relit: 0 }));
  for (const u of sc.lanterns) {
    const l = lanterns.find((x) => x.id === u.id);
    if (!l) continue; // unknown ids are ignored
    if (u.pos) [l.x, l.y, l.z] = u.pos;
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.lit !== undefined) l.lit = u.lit;
    l.fuelU = l.lit ? Math.min(FUEL_MAX, Math.max(0, Math.round((u.fuel ?? T.fuel_max) * 60))) : 0; // lit without fuel => full
    l.everLit = u.everLit ?? l.lit;
    if (u.relitCount !== undefined) l.relit = u.relitCount;
  }
  const isWeak = (l: Lantern) => l.lit && l.fuelU < LOW_U; // loses its safe zone and attracts draining shades
  const hasZone = (l: Lantern) => l.lit && l.fuelU >= LOW_U;

  // ------------------------------------------------------------------ motes
  const motes: Mote[] = [];
  let nextMote = 1;
  const addMote = (x: number, y: number, z: number, kind: Mote["kind"], ttl: number | null) => {
    motes.push({ id: `M${nextMote++}`, x, y, z, kind, ttl });
  };
  const shuffle = <A,>(a: A[]) => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  if (sc.motes) {
    for (const m of sc.motes) addMote(m.pos[0], m.pos[1], m.pos[2], m.kind ?? "random", m.kind === "dropped" ? sec(m.ttlS ?? MOTE_TTL / 60) : null);
  } else if (sc.randomMotes) {
    for (const p of shuffle([...map.motePoints]).slice(0, MOTE_INITIAL)) addMote(p.x, p.y, p.z, "random", null);
  }

  // ------------------------------------------------------------------ charms
  const charms: Charm[] = map.charms.map((c) => ({ ...c, available: true, respawn: 0 }));
  for (const u of sc.charms ?? []) {
    const c = charms.find((x) => x.id === u.id);
    if (!c) continue;
    if (u.pos) [c.x, c.y, c.z] = u.pos;
    if (u.available !== undefined) c.available = u.available;
    if (u.respawnS !== undefined) c.respawn = sec(u.respawnS);
  }

  // ------------------------------------------------------------------ shades
  const shades: Shade[] = [];
  let nextShade = 1;
  const takeShadeId = (preferred?: string) => {
    if (preferred && !shades.some((s) => s.id === preferred)) return preferred;
    while (shades.some((s) => s.id === `S${nextShade}`)) nextShade++;
    return `S${nextShade++}`;
  };
  const addShade = (x: number, y: number, z: number, id?: string, spawning = false): Shade => {
    const s: Shade = {
      id: takeShadeId(id), x, y, z, baseOff: y - (H(x, z) ?? 0), mode: "wander",
      stun: 0, spawn: spawning ? SHADE_SPAWN_TICKS : 0, recoil: 0, expel: 0, expelFrom: -1,
      pdx: 0, pdz: 0, push: 0, rdx: 0, rdz: 0, wdx: 0, wdz: 0, wt: 0, drain: false, drainTicks: 0, target: null,
    };
    shades.push(s);
    return s;
  };
  for (const u of sc.shades ?? []) {
    const s = addShade(u.pos[0], u.pos[1], u.pos[2], u.id);
    const n = u.stateTicksLeft;
    if (u.state === "stunned") s.stun = n ?? sec(T.pulse_stun_s);
    else if (u.state === "spawning") s.spawn = n ?? SHADE_SPAWN_TICKS;
    else if (u.state === "recoil") s.recoil = n ?? RECOIL_TICKS;
    else if (u.state === "chase") s.mode = "chase";
    else if (u.state === "drain") s.drain = true;
    if (u.targetLanternId) s.target = u.targetLanternId;
  }
  const shadeState = (s: Shade) => (s.stun > 0 ? "stunned" : s.spawn > 0 ? "spawning" : s.recoil > 0 || s.expel > 0 ? "recoil" : s.drain ? "drain" : s.mode);

  // ------------------------------------------------------------------ drifters (Gió Lạc)
  const drifters: Drifter[] = [];
  let nextDrifter = 1;
  const addDrifter = (x: number, y: number, z: number, id?: string, state: Drifter["state"] = "idle", stolen = 0) => {
    let did = id;
    if (!did || drifters.some((d) => d.id === did)) {
      while (drifters.some((d) => d.id === `D${nextDrifter}`)) nextDrifter++;
      did = `D${nextDrifter++}`;
    }
    drifters.push({ id: did, x, y, z, baseOff: y - (H(x, z) ?? 0), state, stolen, fleeLeft: state === "flee" ? DRIFT_FLEE_TICKS : 0, wdx: 0, wdz: 0, wt: 0 });
  };
  for (const u of sc.drifters ?? []) {
    addDrifter(u.pos[0], u.pos[1], u.pos[2], u.id, u.state === "chase" || u.state === "flee" ? u.state : "idle", u.stolen ?? 0);
  }

  // ------------------------------------------------------------------ helpers
  const respawnPlayer = () => {
    Object.assign(P, { x: map.start.x, y: map.start.y, z: map.start.z, vx: 0, vy: 0, vz: 0, grounded: true, launched: false, dashT: 0, invuln: sec(T.invuln_s), out: false, wait: 0 });
  };
  const finish = (result: "won" | "lost", reason: string, tick: number) => {
    state = result;
    if (result === "won") {
      // dawn bonus: every lantern still burning is worth 50 + floor(fuel); every flame 50; no time bonus any more
      for (const l of lanterns) if (l.lit) score += T.score.per_lantern_dawn + Math.floor(l.fuelU / 60);
      score += P.flames * T.score.per_flame_left;
    }
    emit(tick, "game_over", { result, reason });
  };

  // ------------------------------------------------------------------ step 3: player movement
  const movePlayer = (inp: InputState, jumpE: boolean, dashE: boolean, tick: number) => {
    const th = (inp.yaw * Math.PI) / 180;
    let wx = inp.mx * Math.cos(th) + inp.mz * Math.sin(th);
    let wz = -inp.mx * Math.sin(th) + inp.mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const wish = Math.hypot(wx, wz);
    if (wish > 1e-6) { P.fx = wx / wish; P.fz = wz / wish; }
    const speed = P.charm > 0 ? CHARM_SPEED : T.player_speed;

    if (dashE && P.dashT === 0 && (P.dashCd === 0 || P.charm > 0)) { // a charm ignores any running cooldown
      P.dashT = sec(T.dash_duration_s);
      P.dashCd = P.charm > 0 ? 0 : sec(T.dash_cooldown_s);
      P.dashDx = P.fx; P.dashDz = P.fz;
      emit(tick, "dash", {});
    }
    const dashing = P.dashT > 0;
    if (dashing) { P.vx = P.dashDx * T.dash_speed; P.vz = P.dashDz * T.dash_speed; P.dashT--; }
    else if (P.launched) { P.vx = P.lvx; P.vz = P.lvz; }
    else {
      const tx = wx * speed, tz = wz * speed;
      const dx = tx - P.vx, dz = tz - P.vz, dl = Math.hypot(dx, dz), md = ACCEL * DT;
      if (dl <= md) { P.vx = tx; P.vz = tz; } else { P.vx += (dx / dl) * md; P.vz += (dz / dl) * md; }
    }

    if (jumpE && P.grounded) { P.vy = JUMP_V; P.grounded = false; P.launched = false; }

    // horizontal move with wall / obstacle collision (axis-separated fallback)
    const canGo = (nx: number, nz: number) => {
      if (blockedByObstacle(nx, nz)) return false;
      const h = H(nx, nz);
      return h === null || h <= P.y + STEP_UP;
    };
    const nx = P.x + P.vx * DT, nz = P.z + P.vz * DT;
    if (canGo(nx, nz)) { P.x = nx; P.z = nz; }
    else if (canGo(nx, P.z)) P.x = nx;
    else if (canGo(P.x, nz)) P.z = nz;
    else { P.vx = 0; P.vz = 0; }
    if (windActive) {
      const wxd = Math.cos((windDir * Math.PI) / 180) * WIND_SPEED * DT, wzd = Math.sin((windDir * Math.PI) / 180) * WIND_SPEED * DT;
      if (canGo(P.x + wxd, P.z + wzd)) { P.x += wxd; P.z += wzd; }
    }

    // vertical
    let airborne = !P.grounded;
    if (!airborne) {
      const h = H(P.x, P.z);
      if (h !== null && P.y - h <= STEP_DOWN && h - P.y <= STEP_UP) { P.y = h; P.vy = 0; } else { airborne = true; P.vy = 0; }
    }
    if (airborne && !(dashing)) {
      P.vy -= GRAVITY * DT;
      const ny = P.y + P.vy * DT;
      const h = H(P.x, P.z);
      if (h !== null && P.vy <= 0 && ny <= h && P.y >= h - 0.5) { P.y = h; P.vy = 0; P.grounded = true; P.launched = false; }
      else { P.y = ny; P.grounded = false; }
    } else if (airborne) P.grounded = false;
    else P.grounded = true;

    // jump pads
    if (P.grounded && !P.launched) {
      for (const pad of map.pads) {
        if (within(dist(P.x, P.z, pad.x, pad.z), pad.r) && P.y <= pad.y + 0.3) {
          P.vy = pad.vy; P.lvx = pad.dx * pad.vh; P.lvz = pad.dz * pad.vh; P.launched = true; P.grounded = false;
          P.vx = P.lvx; P.vz = P.lvz; // the launch velocity is visible immediately, not one tick later
          break;
        }
      }
    }

    // falling off the island: happens exactly once, ignores invulnerability
    if (P.y < FALL_Y && !P.out) {
      const lost = P.carried;
      P.flames--; P.carried = 0; P.out = true; P.wait = RESPAWN_WAIT; P.vx = P.vy = P.vz = 0;
      emit(tick, "player_hit", { by: "fall", flames: P.flames, dropped: 0, lost });
    }
  };

  // ------------------------------------------------------------------ one step
  const advance = (k: number, inp: InputState): void => {
    if (state !== "playing") return;
    const tick = k + 1;
    tickCount = tick;
    const jumpE = inp.jump && !prev.jump, interactE = inp.interact && !prev.interact, pulseE = inp.pulse && !prev.pulse;
    const dashE = inp.dash && !prev.dash, pauseE = inp.pause && !prev.pause;
    prev = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse, dash: inp.dash, pause: inp.pause };

    // 1. input / pause
    if (pauseE) {
      if (!paused) { paused = true; emit(tick, "paused", {}); return; }
      paused = false; emit(tick, "resumed", {});
    } else if (paused) return;
    simTick++;
    if (simTick === 1) emit(tick, "night_start", { night: map.night });

    // 2. counters
    if (P.dashCd > 0) P.dashCd--;
    if (P.pulseCd > 0) P.pulseCd--;
    if (P.invuln > 0) P.invuln--;
    if (P.charm > 0) P.charm--;
    for (const s of shades) if (s.stun > 0) s.stun--;
    for (let i = motes.length - 1; i >= 0; i--) {
      const ttl = motes[i].ttl;
      if (ttl !== null) { motes[i].ttl = ttl - 1; if (ttl - 1 < 0) motes.splice(i, 1); }
    }
    for (const c of charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    if (windOn) {
      if (simTick >= WIND_PERIOD - WIND_WARN && (simTick + WIND_WARN) % WIND_PERIOD === 0) windDir = rng() * 360; // warning starts: pick the direction
      windActive = simTick >= WIND_PERIOD && simTick % WIND_PERIOD < WIND_TICKS;
    }
    if (P.out && P.flames > 0 && P.wait > 0 && --P.wait === 0) respawnPlayer();
    // lantern fuel: every lit lantern burns 1/s; each draining shade takes 5/s more; the dead ones go out right away
    if (!bench) for (const l of lanterns) if (l.lit) l.fuelU -= BURN_U;
    for (const s of shades) {
      if (!s.drain) continue;
      const l = lanterns.find((x) => x.id === s.target);
      if (!l || !l.lit) continue;
      l.fuelU -= DRAIN_U;
      if (++s.drainTicks % 60 === 0) emit(tick, "fuel_drain", { lantern_id: l.id, shade_id: s.id, fuel: r1(Math.max(0, l.fuelU) / 60) });
    }
    for (const l of lanterns) {
      if (l.lit && l.fuelU <= 0) { l.lit = false; l.fuelU = 0; l.deposited = 0; l.everLit = true; emit(tick, "lantern_out", { lantern_id: l.id }); }
    }

    // 3. player movement + fall
    if (!P.out) movePlayer(inp, jumpE, dashE, tick);

    // 4. pickup (motes, then charms)
    if (!P.out && !bench) {
      for (let i = 0; i < motes.length; ) {
        const m = motes[i];
        if (P.carried < capacity() && within(dist(P.x, P.z, m.x, m.z), T.pickup_radius) && Math.abs(P.y - m.y) <= PICKUP_DY + EPS) {
          motes.splice(i, 1);
          P.carried++;
          emit(tick, "mote_picked", { carried: P.carried });
        } else i++;
      }
      for (const c of charms) {
        if (c.available && within(dist(P.x, P.z, c.x, c.z), T.pickup_radius) && Math.abs(P.y - c.y) <= PICKUP_DY + EPS) {
          c.available = false; c.respawn = CHARM_RESPAWN_TICKS; P.charm = CHARM_TICKS;
          emit(tick, "charm_picked", { charm_id: c.id, charm_ticks: CHARM_TICKS });
        }
      }
    }

    // 5. interact: the nearest lantern that can receive (dark, or lit but not full); ties go to the smaller id
    const expelNow: number[] = []; // lanterns whose safe zone just appeared (lit, or refuelled up to >= 30)
    if (!P.out && interactE) {
      let best = -1, bestD = Infinity;
      lanterns.forEach((l, i) => {
        const d = dist(P.x, P.z, l.x, l.z);
        const receives = !l.lit || l.fuelU < FUEL_MAX;
        if (receives && within(d, T.interact_radius) && d < bestD - EPS) { best = i; bestD = d; }
      });
      if (best >= 0) {
        const l = lanterns[best];
        if (l.lit) {
          // refuel: used = min(carried, ceil((100 - fuel) / 10)); each mote is worth 10 fuel
          const used = Math.min(P.carried, Math.ceil((FUEL_MAX - l.fuelU) / MOTE_U));
          if (used > 0) {
            const before = l.fuelU;
            l.fuelU = Math.min(FUEL_MAX, l.fuelU + MOTE_U * used);
            P.carried -= used; score += used * T.score.per_mote;
            emit(tick, "refuel", { lantern_id: l.id, amount: used, fuel: r1(l.fuelU / 60) });
            if (before < LOW_U && l.fuelU >= LOW_U) expelNow.push(best);
          }
        } else {
          const cost = l.everLit ? T.relight_cost : T.lantern_cost; // a lantern that was lit before needs only 5
          const amount = Math.min(P.carried, cost - l.deposited);
          if (amount > 0) {
            P.carried -= amount; l.deposited += amount; score += amount * T.score.per_mote;
            emit(tick, "deposit", { lantern_id: l.id, amount, deposited: l.deposited });
            if (l.deposited >= cost) {
              const relight = l.everLit;
              l.lit = true; l.fuelU = FUEL_MAX; l.everLit = true; if (relight) l.relit++;
              P.sl++; score += relight ? T.score.per_relight : T.score.per_lantern;
              expelNow.push(best);
              emit(tick, "lantern_lit", { lantern_id: l.id, relight });
            }
          }
        }
      }
    }

    // 6. safe zones: shades inside a zone that just appeared are expelled (harmless) for up to 30 ticks;
    //    a shade that was draining a lantern that is now healthy stops draining
    for (const li of expelNow) {
      const l = lanterns[li];
      for (const s of shades) {
        if (s.drain && s.target === l.id && hasZone(l)) { s.drain = false; s.target = null; s.mode = "wander"; }
        if (dist(s.x, s.z, l.x, l.z) < T.safe_radius) { s.expel = EXPEL_TICKS; s.expelFrom = li; }
      }
    }

    // 7. pulse
    if (!P.out && pulseE && P.pulseCd === 0 && P.carried >= T.pulse_cost) {
      P.carried -= T.pulse_cost;
      P.pulseCd = sec(T.pulse_cooldown_s);
      const cy = P.y + PULSE_CENTER_DY;
      const ids: string[] = [];
      for (const s of shades) {
        const dx = s.x - P.x, dz = s.z - P.z, dy = s.y - cy;
        if (Math.hypot(dx, dy, dz) > T.pulse_radius + EPS) continue;
        const dh = Math.hypot(dx, dz);
        const ux = dh > 0 ? dx / dh : 1, uz = dh > 0 ? dz / dh : 0;
        s.stun = sec(T.pulse_stun_s);
        s.push = PUSH_TICKS; s.pdx = (ux * T.pulse_push_m) / PUSH_TICKS; s.pdz = (uz * T.pulse_push_m) / PUSH_TICKS;
        s.expel = 0; s.recoil = 0;
        score += s.drain ? T.score.per_stun_drain : T.score.per_stun; // 15 in total if it was draining, else 5
        if (s.drain) { s.drain = false; s.target = null; s.mode = "wander"; } // after the stun it is back to wander
        ids.push(s.id);
      }
      emit(tick, "pulse", { stunned_ids: ids });
      // drifters in range: a chasing one flees without stealing; a fleeing one drops its loot and vanishes after 120 ticks
      for (const d of drifters) {
        if (Math.hypot(d.x - P.x, d.y - cy, d.z - P.z) > T.pulse_radius + EPS) continue;
        if (d.state === "chase") { d.state = "flee"; d.fleeLeft = DRIFT_FLEE_TICKS; }
        else if (d.state === "flee" && d.stolen > 0) {
          const gy = H(d.x, d.z) ?? d.y - d.baseOff;
          for (let i = 0; i < d.stolen; i++) addMote(d.x, gy, d.z, "dropped", MOTE_TTL);
          emit(tick, "drifter_drop", { drifter_id: d.id, amount: d.stolen });
          d.stolen = 0; d.fleeLeft = DRIFT_DROP_FLEE_TICKS;
        }
      }
    }

    // 8. shades move
    const zones = lanterns.filter(hasZone); // only a lit lantern with fuel >= 30 keeps shades out
    // wander target: the nearest weak lit lantern (ties: smaller id), else the nearest dark one, else nothing
    const nearestTo = (s: Shade, list: Lantern[]) => list.reduce<Lantern | null>((b, l) => (b === null || dist(s.x, s.z, l.x, l.z) < dist(s.x, s.z, b.x, b.z) - EPS ? l : b), null);
    const pickTarget = (s: Shade): Lantern | null => {
      const forced = s.target ? lanterns.find((l) => l.id === s.target) : undefined;
      if (forced && isWeak(forced)) return forced;
      return nearestTo(s, lanterns.filter(isWeak)) ?? nearestTo(s, lanterns.filter((l) => !l.lit));
    };
    const keepOut = (s: Shade) => {
      for (const l of zones) {
        const d = dist(s.x, s.z, l.x, l.z);
        if (d < T.safe_radius) {
          const ux = d > 0 ? (s.x - l.x) / d : 1, uz = d > 0 ? (s.z - l.z) / d : 0;
          s.x = l.x + ux * T.safe_radius; s.z = l.z + uz * T.safe_radius;
        }
      }
    };
    const shift = (s: Shade, dx: number, dz: number) => {
      if (!blockedByObstacle(s.x + dx, s.z + dz)) { s.x += dx; s.z += dz; return true; }
      return false;
    };
    for (const s of shades) {
      if (s.stun > 0) {
        if (s.push > 0) { if (!shift(s, s.pdx, s.pdz)) s.push = 0; else s.push--; }
      } else if (s.spawn > 0) {
        s.spawn--;
      } else if (s.expel > 0) {
        const l = lanterns[s.expelFrom];
        const d = dist(s.x, s.z, l.x, l.z);
        const ux = d > 0 ? (s.x - l.x) / d : 1, uz = d > 0 ? (s.z - l.z) / d : 0;
        const step = Math.max(0, T.safe_radius - d) / s.expel;
        shift(s, ux * step, uz * step);
        s.expel--;
      } else if (s.recoil > 0) {
        if (s.rdx === 0 && s.rdz === 0) {
          const d = dist(s.x, s.z, P.x, P.z);
          s.rdx = d > 0 ? ((s.x - P.x) / d) * (RECOIL_M / RECOIL_TICKS) : RECOIL_M / RECOIL_TICKS; s.rdz = d > 0 ? ((s.z - P.z) / d) * (RECOIL_M / RECOIL_TICKS) : 0;
        }
        shift(s, s.rdx, s.rdz);
        s.recoil--;
        keepOut(s);
        if (s.recoil === 0) { s.rdx = 0; s.rdz = 0; }
      } else {
        const d = dist(s.x, s.z, P.x, P.z);
        if (s.drain) {
          // leave drain: Mây within 6 m -> chase; else lantern out / refuelled to >= 30 / more than 2 m away -> wander
          const dl = lanterns.find((l) => l.id === s.target);
          if (d <= T.safe_radius + EPS) { s.drain = false; s.target = null; s.mode = "chase"; }
          else if (!dl || !isWeak(dl) || dist(s.x, s.z, dl.x, dl.z) > DRAIN_RANGE + EPS) { s.drain = false; s.target = null; s.mode = "wander"; }
        }
        if (!s.drain) {
          if (s.mode === "wander" && !bench && d <= SHADE_DETECT + EPS) s.mode = "chase";
          else if (s.mode === "chase" && d > SHADE_LOSE) s.mode = "wander";
          if (s.mode === "chase") {
            if (d > 0) { const st = Math.min((map.shade.speed * DT), d); shift(s, ((P.x - s.x) / d) * st, ((P.z - s.z) / d) * st); }
          } else {
            const tl = pickTarget(s);
            if (tl) {
              const dl = dist(s.x, s.z, tl.x, tl.z);
              if (dl > DRAIN_RANGE + EPS) { const st = Math.min(map.shade.speed * DT, dl); shift(s, ((tl.x - s.x) / dl) * st, ((tl.z - s.z) / dl) * st); }
              if (isWeak(tl) && dist(s.x, s.z, tl.x, tl.z) <= DRAIN_RANGE + EPS) { s.drain = true; s.target = tl.id; s.drainTicks = 0; }
            } else {
              if (--s.wt <= 0) { const a = rng() * 2 * Math.PI; s.wdx = Math.cos(a); s.wdz = Math.sin(a); s.wt = SHADE_WANDER_RETARGET; }
              const wxs = s.wdx * SHADE_WANDER_SPEED * DT, wzs = s.wdz * SHADE_WANDER_SPEED * DT;
              if (H(s.x + wxs, s.z + wzs) === null) { s.wdx = -s.wdx; s.wdz = -s.wdz; } else shift(s, wxs, wzs);
            }
          }
          if (!s.drain) keepOut(s);
        }
      }
      const h = H(s.x, s.z);
      if (h !== null) s.y = h + s.baseOff;
    }

    // 8b. drifters move (they ignore terrain walls and safe zones)
    for (const d of [...drifters]) {
      const dxp = P.x - d.x, dzp = P.z - d.z, dd = Math.hypot(dxp, dzp);
      if (d.state !== "flee") d.state = !P.out && P.carried >= DRIFT_MIN_CARRIED && dd <= DRIFT_NEAR + EPS ? "chase" : "idle";
      const step = DRIFT_SPEED * DT;
      if (d.state === "chase") {
        if (dd > 0) { const s = Math.min(step, dd); d.x += (dxp / dd) * s; d.z += (dzp / dd) * s; }
      } else if (d.state === "flee") {
        d.x += (dd > 0 ? -dxp / dd : 1) * step; d.z += (dd > 0 ? -dzp / dd : 0) * step;
        if (--d.fleeLeft <= 0) { drifters.splice(drifters.indexOf(d), 1); continue; } // vanishes together with any loot
      } else {
        if (--d.wt <= 0) { const a = rng() * 2 * Math.PI; d.wdx = Math.cos(a); d.wdz = Math.sin(a); d.wt = SHADE_WANDER_RETARGET; }
        d.x += d.wdx * DRIFT_IDLE_SPEED * DT; d.z += d.wdz * DRIFT_IDLE_SPEED * DT;
      }
      const h = H(d.x, d.z);
      if (h !== null) d.y = h + d.baseOff;
    }

    // 9a. contact: a chasing drifter steals first (once per drifter); invulnerability does not stop it
    if (!P.out) {
      for (const d of [...drifters].sort((a, b) => idNum(a.id) - idNum(b.id))) {
        if (d.state !== "chase" || !within(dist(d.x, d.z, P.x, P.z), DRIFT_STEAL_R)) continue;
        const amount = Math.min(DRIFT_STEAL, P.carried);
        if (amount <= 0) continue;
        P.carried -= amount; d.stolen = amount; d.state = "flee"; d.fleeLeft = DRIFT_FLEE_TICKS;
        emit(tick, "drifter_steal", { drifter_id: d.id, amount, carried: P.carried });
      }
    }

    // 9b. contact: shades hit in ascending id order, at most one flame lost per tick
    if (!P.out && !bench && P.invuln === 0) {
      const order = [...shades].sort((a, b) => idNum(a.id) - idNum(b.id));
      for (const s of order) {
        if (s.stun > 0 || s.spawn > 0 || s.recoil > 0 || s.expel > 0) continue;
        if (!within(dist(s.x, s.z, P.x, P.z), T.shade_hit_radius) || Math.abs(P.y - s.y) > HIT_DY + EPS) continue;
        const dropped = Math.floor(P.carried * T.hit_drop_ratio);
        P.flames--; P.carried -= dropped; P.invuln = sec(T.invuln_s);
        for (let i = 0; i < dropped; i++) {
          let x = P.x, z = P.z, y = P.y;
          for (let t = 0; t < 8; t++) {
            const a = rng() * 2 * Math.PI, r = DROP_MIN + rng() * (DROP_MAX - DROP_MIN);
            const cx = P.x + r * Math.cos(a), cz = P.z + r * Math.sin(a);
            const h = H(cx, cz);
            if (h !== null) { x = cx; z = cz; y = h; break; }
          }
          addMote(x, y, z, "dropped", MOTE_TTL);
        }
        const d = dist(s.x, s.z, P.x, P.z);
        s.recoil = RECOIL_TICKS;
        s.rdx = d > 0 ? ((s.x - P.x) / d) * (RECOIL_M / RECOIL_TICKS) : RECOIL_M / RECOIL_TICKS;
        s.rdz = d > 0 ? ((s.z - P.z) / d) * (RECOIL_M / RECOIL_TICKS) : 0;
        emit(tick, "player_hit", { by: "shade", flames: P.flames, dropped });
        break;
      }
    }

    // 10. scheduled spawns (new entities can interact from the next tick)
    if (sc.randomMotes && simTick % MOTE_SPAWN_EVERY === 0 && motes.length < MOTE_CAP) {
      const free = map.motePoints.filter((p) => !motes.some((m) => dist(m.x, m.z, p.x, p.z) < 0.05));
      if (free.length) { const p = free[Math.floor(rng() * free.length)]; addMote(p.x, p.y, p.z, "random", null); }
    }
    if (sc.randomShades) {
      const sh = map.shade;
      const due = simTick === sh.firstTick ? sh.firstCount : simTick > sh.firstTick && (simTick - sh.firstTick) % sh.interval === 0 ? 1 : 0;
      for (let n = 0; n < due && shades.length < sh.max; n++) {
        const valid = map.shadePoints.filter((p) => dist(p.x, p.z, P.x, P.z) >= SHADE_MIN_SPAWN_DIST && !shades.some((s) => s.spawn > 0 && dist(s.x, s.z, p.x, p.z) < 0.05));
        if (!valid.length) continue;
        const p = valid[Math.floor(rng() * valid.length)];
        const s = addShade(p.x, (H(p.x, p.z) ?? 0) + SHADE_BASE_Y, p.z, undefined, true);
        emit(tick, "shade_spawned", { id: s.id });
      }
    }

    if (sc.randomDrifters && map.drifters && simTick % DRIFT_EVERY === 0 && drifters.length < DRIFT_MAX) {
      const p = map.shadePoints[Math.floor(rng() * map.shadePoints.length)];
      addDrifter(p.x, (H(p.x, p.z) ?? 0) + DRIFT_BASE_Y, p.z);
    }

    // 11. win / lose, after every update of the tick (dawn tick included): no flames always loses first;
    //     at dawn Mây wins if enough lanterns are still lit; there is no early win any more
    if (bench) return; // the benchmark scene never ends
    if (P.flames <= 0) finish("lost", "no_flames", tick);
    else if (left() <= 0) {
      const needed = Math.ceil(T.win_ratio * lanterns.length - EPS);
      if (lanterns.filter((l) => l.lit).length >= needed) finish("won", "dawn_survived", tick);
      else finish("lost", "dawn", tick);
    }
  };

  // ------------------------------------------------------------------ outputs
  const snapshot = (tick: number): OutLine => ({
    type: "snapshot", tick, sim_tick: simTick, state: paused && state === "playing" ? "paused" : state, night: map.night,
    time_left_s: r3(Math.max(0, left()) / 60), score,
    wind: { active: windActive, dir_deg: r3(windDir) },
    player: {
      pos: [r3(P.x), r3(P.y), r3(P.z)], vel: [r3(P.vx), r3(P.vy), r3(P.vz)], flames: P.flames, carried: P.carried, capacity: capacity(),
      grounded: P.grounded, invuln: P.invuln > 0, dash_cd_s: r3(P.dashCd / 60), pulse_cd_s: r3(P.pulseCd / 60), charm_s: r3(P.charm / 60),
    },
    lanterns: lanterns.map((l) => ({
      id: l.id, pos: [r3(l.x), r3(l.y), r3(l.z)], lit: l.lit, deposited: l.deposited,
      fuel: l.lit ? r1(l.fuelU / 60) : 0, ever_lit: l.everLit, relit_count: l.relit,
    })),
    shades: shades.map((s) => ({ id: s.id, pos: [r3(s.x), r3(s.y), r3(s.z)], state: shadeState(s), target_lantern_id: s.drain ? s.target : null })),
    motes_active: motes.length,
    motes: motes.map((m) => ({ id: m.id, pos: [r3(m.x), r3(m.y), r3(m.z)], kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / 60) })),
    drifters: drifters.map((d) => ({ id: d.id, pos: [r3(d.x), r3(d.y), r3(d.z)], state: d.state, stolen: d.stolen })),
    charms: charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / 60) })),
  });

  /** Live (unrounded) state for rendering and HUD. Read-only by convention. */
  const view = () => ({
    state, paused, score, steps: simTick, night: map.night,
    timeLeft: Math.max(0, left()) / 60,
    player: {
      x: P.x, y: P.y, z: P.z, flames: P.flames, carried: P.carried, capacity: capacity(), grounded: P.grounded, out: P.out,
      invulnLeft: P.invuln / 60, pulseCooldownLeft: P.pulseCd / 60, dashCooldownLeft: P.dashCd / 60, charmLeft: P.charm / 60,
      fx: P.fx, fz: P.fz,
    },
    lanterns: lanterns.map((l) => ({ id: l.id, x: l.x, y: l.y, z: l.z, lit: l.lit, deposited: l.deposited, fuel: l.lit ? l.fuelU / 60 : 0, everLit: l.everLit, relit: l.relit })),
    shades: shades.map((s) => ({ id: s.id, x: s.x, y: s.y, z: s.z, state: shadeState(s), stunned: s.stun > 0 })),
    motes, charms,
    drifters: drifters.map((d) => ({ id: d.id, x: d.x, y: d.y, z: d.z, state: d.state, stolen: d.stolen })),
    wind: { active: windActive, dirDeg: windDir, warning: windOn && !windActive && simTick >= WIND_PERIOD - WIND_WARN && (simTick + WIND_WARN) % WIND_PERIOD < WIND_WARN },
  });

  return {
    step: advance,
    snapshot,
    view,
    map,
    isPlaying: () => state === "playing",
    ticks: () => tickCount,
    result: () => ({ state, score }),
  };
}

/** Batch runner used by the headless CLI: replays input frames and returns JSONL lines. */
export function simulate(sc: ScenarioSpec, frames: Frame[], seed: number, night: number, ticks: number, every: number): OutLine[] {
  const lines: OutLine[] = [];
  const sim = createSim(sc, seed, night, (e) => lines.push(e));
  lines.push(sim.snapshot(0));

  const cur: InputState = { ...NO_INPUT };
  let fi = 0;
  for (let k = 0; k < ticks && sim.isPlaying(); k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.move) [cur.mx, cur.mz] = f.move;
      if (f.cam_yaw_deg !== undefined) cur.yaw = f.cam_yaw_deg;
      if (f.jump !== undefined) cur.jump = f.jump;
      if (f.interact !== undefined) cur.interact = f.interact;
      if (f.pulse !== undefined) cur.pulse = f.pulse;
      if (f.dash !== undefined) cur.dash = f.dash;
      if (f.pause !== undefined) cur.pause = f.pause;
    }
    sim.step(k, cur);
    if ((k + 1) % every === 0) lines.push(sim.snapshot(k + 1));
  }
  const r = sim.result();
  lines.push({ type: "end", ticks: sim.ticks(), state: r.state, score: r.score });
  return lines;
}
