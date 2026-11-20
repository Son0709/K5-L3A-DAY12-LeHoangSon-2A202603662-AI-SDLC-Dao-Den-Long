// Deterministic game rules. Pure: no DOM, no three.js, no Date, no Math.random.
// Per-tick order (docs/notes/assumptions.md): input -> player move -> pickup -> interact ->
// pulse -> shades move -> hit -> spawn -> time. Step k reads input of tick k and emits events at tick k+1.
import { mulberry32 } from "./rng.ts";
import type { Frame, ScenarioSpec } from "./parse.ts";
import {
  DT, EPS, GRAVITY, INITIAL_SHADES, ISLAND_R, JUMP_V, MAX_SHADES, N_MOTES, RIM_SPAWN_R, RING_R,
  SHADE_Y, SPAWN_EVERY_TICKS, SPAWN_MIN_DIST, T,
} from "./tuning.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OutLine = Record<string, any>;

interface Lantern { id: string; x: number; y: number; z: number; lit: boolean; deposited: number }
interface Shade { id: string; x: number; z: number; stunned: boolean; stunUntil: number }
interface Mote { id: string; x: number; z: number }

const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0; // "+ 0" turns -0 into 0
const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
const within = (d: number, r: number) => d <= r + EPS;
const sec = (s: number) => Math.round(s * 60);

export interface InputState { mx: number; mz: number; yaw: number; jump: boolean; interact: boolean; pulse: boolean }

/** Stateful game. Shared by the headless runner (`simulate`) and the 3D client, so both use the same rules. */
export function createSim(sc: ScenarioSpec, seed: number, onEvent: (e: OutLine) => void) {
  const rng = mulberry32(seed);

  const player = {
    x: sc.player.pos?.[0] ?? 0, y: sc.player.pos?.[1] ?? 0, z: sc.player.pos?.[2] ?? 0,
    vy: 0,
    flames: sc.player.flames ?? T.flames,
    carried: sc.player.carried ?? 0,
    invulnUntil: 0,
    pulseReadyAt: 0,
  };
  const timeStart = sc.timeLeft ?? T.night1_duration_s;
  let score = 0;
  let state: "playing" | "won" | "lost" = "playing";
  let steps = 0;

  // ---- lanterns
  const lanterns: Lantern[] = [];
  for (let i = 0; i < T.lantern_count_night1; i++) {
    const a = (i * 2 * Math.PI) / T.lantern_count_night1;
    lanterns.push({ id: `L${i + 1}`, x: RING_R * Math.sin(a), y: 0, z: RING_R * Math.cos(a), lit: false, deposited: 0 });
  }
  for (const u of sc.lanterns) {
    const l = lanterns.find((x) => x.id === u.id);
    if (!l) continue; // unknown ids are ignored
    if (u.pos) [l.x, l.y, l.z] = u.pos;
    if (u.deposited !== undefined) l.deposited = u.deposited;
    if (u.lit !== undefined) l.lit = u.lit;
  }

  // ---- shades
  let nextShade = 1;
  const takeShadeId = (preferred?: string) => {
    if (preferred && !shades.some((s) => s.id === preferred)) return preferred;
    while (shades.some((s) => s.id === `S${nextShade}`)) nextShade++;
    return `S${nextShade++}`;
  };
  const shades: Shade[] = [];
  const rimPoint = () => {
    for (let i = 0; i < 12; i++) {
      const a = rng() * 2 * Math.PI;
      const x = RIM_SPAWN_R * Math.sin(a), z = RIM_SPAWN_R * Math.cos(a);
      if (dist(x, z, player.x, player.z) >= SPAWN_MIN_DIST) return { x, z };
    }
    const a = Math.atan2(player.x, player.z) + Math.PI;
    return { x: RIM_SPAWN_R * Math.sin(a), z: RIM_SPAWN_R * Math.cos(a) };
  };

  // ---- motes (random generation happens before shades so draws are in a fixed order)
  const motes: Mote[] = [];
  if (sc.motes) {
    sc.motes.forEach((m, i) => motes.push({ id: `M${i + 1}`, x: m.pos[0], z: m.pos[2] }));
  } else if (sc.randomMotes) {
    for (let i = 0; i < N_MOTES; i++) {
      let x = 0, z = 0;
      do {
        const rad = (ISLAND_R - 2) * Math.sqrt(rng());
        const a = rng() * 2 * Math.PI;
        x = rad * Math.sin(a);
        z = rad * Math.cos(a);
      } while (dist(x, z, 0, 0) < 3);
      motes.push({ id: `M${i + 1}`, x, z });
    }
  }

  if (sc.shades) {
    for (const s of sc.shades) shades.push({ id: takeShadeId(s.id), x: s.pos[0], z: s.pos[2], stunned: false, stunUntil: 0 });
  } else if (sc.randomShades) {
    for (let i = 0; i < INITIAL_SHADES; i++) {
      const p = rimPoint();
      shades.push({ id: takeShadeId(), x: p.x, z: p.z, stunned: false, stunUntil: 0 });
    }
  }

  // ---- helpers
  const emit = (tick: number, name: string, data: Record<string, unknown>) =>
    onEvent({ type: "event", tick, name, data });

  const clampIsland = (o: { x: number; z: number }) => {
    const d = Math.hypot(o.x, o.z);
    if (d > ISLAND_R) { o.x *= ISLAND_R / d; o.z *= ISLAND_R / d; }
  };
  const keepOutOfLight = (s: Shade) => {
    for (const l of lanterns) {
      if (!l.lit) continue;
      const d = dist(s.x, s.z, l.x, l.z);
      if (d < T.safe_radius) {
        const ux = d > 0 ? (s.x - l.x) / d : 1, uz = d > 0 ? (s.z - l.z) / d : 0;
        s.x = l.x + ux * T.safe_radius;
        s.z = l.z + uz * T.safe_radius;
      }
    }
  };
  const timeLeft = () => timeStart - steps / 60;
  const finish = (result: "won" | "lost", reason: string, tick: number) => {
    state = result;
    if (result === "won") {
      const secs = Math.floor(Math.max(0, timeLeft()) + EPS);
      score += secs * T.score.per_second_left + player.flames * T.score.per_flame_left;
    }
    emit(tick, "game_over", { result, reason });
  };

  const snapshot = (tick: number): OutLine => {
    return {
      type: "snapshot", tick, sim_tick: steps, state, time_left_s: r3(timeLeft()), score,
      player: { pos: [r3(player.x), r3(player.y), r3(player.z)], flames: player.flames, carried: player.carried },
      lanterns: lanterns.map((l) => ({ id: l.id, pos: [r3(l.x), r3(l.y), r3(l.z)], lit: l.lit, deposited: l.deposited })),
      shades: shades.map((s) => ({ id: s.id, pos: [r3(s.x), SHADE_Y, r3(s.z)], state: s.stunned ? "stunned" : "chase" })),
      motes_active: motes.length,
      motes: motes.map((m) => ({ id: m.id, pos: [r3(m.x), 0, r3(m.z)] })),
    };
  };

  // ---- one step: reads the input of tick k, produces state k+1 and events stamped k+1
  let prev = { jump: false, interact: false, pulse: false };

  const advance = (k: number, input: InputState): void => {
    const tick = k + 1;
    const jumpEdge = input.jump && !prev.jump;
    const interactEdge = input.interact && !prev.interact;
    const pulseEdge = input.pulse && !prev.pulse;
    prev = { jump: input.jump, interact: input.interact, pulse: input.pulse };

    // 1. player movement + jump
    {
      const th = (input.yaw * Math.PI) / 180;
      let dx = input.mx * Math.cos(th) + input.mz * Math.sin(th);
      let dz = -input.mx * Math.sin(th) + input.mz * Math.cos(th);
      const len = Math.hypot(dx, dz);
      if (len > 1) { dx /= len; dz /= len; }
      player.x += dx * T.player_speed * DT;
      player.z += dz * T.player_speed * DT;
      clampIsland(player);
      if (jumpEdge && player.y <= 0) player.vy = JUMP_V;
      if (player.y > 0 || player.vy > 0) {
        player.vy -= GRAVITY * DT;
        player.y += player.vy * DT;
        if (player.y <= 0) { player.y = 0; player.vy = 0; }
      }
    }

    // 2. pickup
    for (let i = 0; i < motes.length; ) {
      const m = motes[i];
      if (player.carried < T.carry_capacity && within(dist(player.x, player.z, m.x, m.z), T.pickup_radius)) {
        motes.splice(i, 1);
        player.carried++;
        score += T.score.per_mote;
        emit(tick, "mote_picked", { carried: player.carried });
      } else i++;
    }

    // 3. interact (deposit into the nearest unlit lantern in range)
    if (interactEdge) {
      let best: Lantern | undefined, bestD = Infinity;
      for (const l of lanterns) {
        const d = dist(player.x, player.z, l.x, l.z);
        if (!l.lit && within(d, T.interact_radius) && d < bestD) { best = l; bestD = d; }
      }
      if (best) {
        const amount = Math.min(player.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          player.carried -= amount;
          best.deposited += amount;
          emit(tick, "deposit", { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            score += T.score.per_lantern;
            emit(tick, "lantern_lit", { lantern_id: best.id });
          }
        }
      }
    }
    if (lanterns.every((l) => l.lit)) { steps = tick; finish("won", "all_lit", tick); return; }

    // 4. pulse
    if (pulseEdge && k >= player.pulseReadyAt && player.carried >= T.pulse_cost) {
      player.carried -= T.pulse_cost;
      player.pulseReadyAt = k + sec(T.pulse_cooldown_s);
      const ids: string[] = [];
      for (const s of shades) {
        const d = dist(s.x, s.z, player.x, player.z);
        if (!within(d, T.pulse_radius)) continue;
        const ux = d > 0 ? (s.x - player.x) / d : 1, uz = d > 0 ? (s.z - player.z) / d : 0;
        s.x += ux * T.pulse_push_m;
        s.z += uz * T.pulse_push_m;
        clampIsland(s);
        keepOutOfLight(s);
        if (!s.stunned) score += T.score.per_stun;
        s.stunned = true;
        s.stunUntil = k + sec(T.pulse_stun_s);
        ids.push(s.id);
      }
      emit(tick, "pulse", { stunned_ids: ids });
    }

    // 5. shades move
    for (const s of shades) {
      if (s.stunned && s.stunUntil <= k) s.stunned = false;
      if (s.stunned) continue;
      const d = dist(s.x, s.z, player.x, player.z);
      if (d > 0) {
        const step = Math.min(T.shade_speed * DT, d);
        s.x += ((player.x - s.x) / d) * step;
        s.z += ((player.z - s.z) / d) * step;
      }
      keepOutOfLight(s);
    }

    // 6. hit
    if (k >= player.invulnUntil) {
      for (const s of shades) {
        if (s.stunned || !within(dist(s.x, s.z, player.x, player.z), T.shade_hit_radius)) continue;
        const dropped = Math.floor(player.carried * T.hit_drop_ratio);
        player.flames--;
        player.carried -= dropped;
        player.invulnUntil = k + sec(T.invuln_s);
        emit(tick, "player_hit", { by: "shade", flames: player.flames, dropped });
        if (player.flames <= 0) { steps = tick; finish("lost", "no_flames", tick); }
        break;
      }
      if (state !== "playing") return;
    }

    // 7. spawn
    if (sc.randomShades && tick % SPAWN_EVERY_TICKS === 0 && shades.length < MAX_SHADES) {
      const p = rimPoint();
      const id = takeShadeId();
      shades.push({ id, x: p.x, z: p.z, stunned: false, stunUntil: 0 });
      emit(tick, "shade_spawned", { id });
    }

    // 8. time
    steps = tick;
    if (timeLeft() <= EPS) finish("lost", "dawn", tick);
  };

  /** Live (unrounded) state for rendering and HUD. Read-only by convention. */
  const view = () => ({
    state, score, steps,
    timeLeft: Math.max(0, timeLeft()),
    player: {
      x: player.x, y: player.y, z: player.z, flames: player.flames, carried: player.carried,
      invulnLeft: Math.max(0, player.invulnUntil - steps) / 60,
      pulseCooldownLeft: Math.max(0, player.pulseReadyAt - steps) / 60,
    },
    lanterns, shades, motes,
  });

  return {
    step: advance,
    snapshot,
    view,
    isPlaying: () => state === "playing",
    steps: () => steps,
    result: () => ({ state, score }),
  };
}

/** Batch runner used by the headless CLI: replays input frames and returns JSONL lines. */
export function simulate(sc: ScenarioSpec, frames: Frame[], seed: number, ticks: number, every: number): OutLine[] {
  const lines: OutLine[] = [];
  const sim = createSim(sc, seed, (e) => lines.push(e));
  lines.push(sim.snapshot(0));

  const cur: InputState = { mx: 0, mz: 0, yaw: 0, jump: false, interact: false, pulse: false };
  let fi = 0;
  for (let k = 0; k < ticks && sim.isPlaying(); k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.move) [cur.mx, cur.mz] = f.move;
      if (f.cam_yaw_deg !== undefined) cur.yaw = f.cam_yaw_deg;
      if (f.jump !== undefined) cur.jump = f.jump;
      if (f.interact !== undefined) cur.interact = f.interact;
      if (f.pulse !== undefined) cur.pulse = f.pulse;
    }
    sim.step(k, cur);
    if (!sim.isPlaying()) break;
    if ((k + 1) % every === 0) lines.push(sim.snapshot(k + 1));
  }
  const r = sim.result();
  lines.push({ type: "end", ticks: sim.steps(), state: r.state, score: r.score });
  return lines;
}
