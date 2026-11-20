// Standard maps (ticket Part 2). Angles: x = r cos(a), z = +r sin(a) (assumption A18).
import { T } from "./tuning.ts";

export interface Pad { x: number; y: number; z: number; r: number; vy: number; vh: number; dx: number; dz: number }
export interface Obstacle { x: number; z: number; r: number }
export interface Pt { x: number; y: number; z: number }

export interface MapDef {
  night: number;
  duration: number;
  start: Pt;
  startFacing: { x: number; z: number };
  lanterns: { id: string; x: number; y: number; z: number }[];
  motePoints: Pt[];
  shadePoints: { x: number; z: number }[];
  shade: { firstTick: number; firstCount: number; interval: number; max: number; speed: number };
  charms: { id: string; x: number; y: number; z: number }[];
  obstacles: Obstacle[];
  pads: Pad[];
  wind: boolean;
  /** Terrain top at (x,z), or null when there is nothing to stand on (cloud sea). */
  heightAt(x: number, z: number): number | null;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
export const polar = (r: number, deg: number, y = 0, cx = 0): Pt => ({ x: cx + r * Math.cos(rad(deg)), y, z: r * Math.sin(rad(deg)) });
const ring = (r: number, count: number, startDeg = 0, step = 360 / count, y = 0, cx = 0) =>
  Array.from({ length: count }, (_, i) => polar(r, startDeg + i * step, y, cx));
const lantern = (n: number, x: number, y: number, z: number) => ({ id: `L${n}`, x, y, z });
const toward = (from: { x: number; z: number }, to: { x: number; z: number }) => {
  const dx = to.x - from.x, dz = to.z - from.z, l = Math.hypot(dx, dz);
  return { dx: dx / l, dz: dz / l };
};

// ------------------------------------------------------------------ Night 1: Đảo Bến
function night1(): MapDef {
  return {
    night: 1,
    duration: T.night1_duration_s,
    start: { x: 0, y: 0, z: 0 },
    startFacing: { x: 0, z: 1 },
    lanterns: [lantern(1, 0, 0, 25), lantern(2, 23.8, 0, 7.7), lantern(3, 14.7, 0, -20.2), lantern(4, -14.7, 0, -20.2), lantern(5, -23.8, 0, 7.7)],
    motePoints: [...ring(12, 8, 0, 45), ...ring(33, 16, 0, 22.5)],
    shadePoints: ring(37, 12, 15, 30),
    shade: { firstTick: 300, firstCount: 2, interval: 480, max: 6, speed: T.shade_speed },
    charms: [],
    obstacles: [],
    pads: [],
    wind: false,
    heightAt: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  };
}

// ------------------------------------------------------------------ Night 2: Đảo Cau (two islands + bamboo bridge)
function night2(): MapDef {
  const A = { x: 0, z: 0 }, B = { x: 70, z: 0 };
  const islandPts = (cx: number) => [...ring(10, 4, 0, 90, 0, cx), ...ring(22, 8, 0, 45, 0, cx)];
  return {
    night: 2,
    duration: T.night2_duration_s,
    start: { x: 0, y: 0, z: 0 },
    startFacing: { x: 0, z: 1 },
    lanterns: [lantern(1, 0, 0, 20), lantern(2, 17, 0, -10), lantern(3, -17, 0, -10), lantern(4, 70, 0, 20), lantern(5, 87, 0, -10), lantern(6, 53, 0, -10)],
    motePoints: [...islandPts(0), ...islandPts(70)],
    shadePoints: [...ring(26, 8, 22.5, 45, 0, 0), ...ring(26, 8, 22.5, 45, 0, 70)],
    shade: { firstTick: 300, firstCount: 2, interval: 420, max: 8, speed: T.shade_speed },
    charms: [{ id: "C1", x: 35, y: 0, z: 0 }],
    obstacles: [],
    pads: [
      { x: 20, y: 0, z: 18, r: 1, vy: 14, vh: 24, ...toward({ x: 20, z: 18 }, B) },
      { x: 50, y: 0, z: -18, r: 1, vy: 14, vh: 24, ...toward({ x: 50, z: -18 }, A) },
    ],
    wind: false,
    heightAt: (x, z) => (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && Math.abs(z) <= 2) ? 0 : null),
  };
}

// ------------------------------------------------------------------ Night 3: Đảo Chuông (3 tiers, ramps, pad, tower, wind)
function night3(): MapDef {
  const RAMP_ANGLES = [30, 150];
  const heightAt = (x: number, z: number): number | null => {
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    let h = 0;
    if (z > 0 && r >= 12 && r <= 24) h = 3; // tier 1: annulus 12..24 on the z > 0 half
    if (r <= 8) h = 6; // tier 2: disc r 8
    for (const a of RAMP_ANGLES) {
      const ux = Math.cos(rad(a)), uz = Math.sin(rad(a));
      const along = x * ux + z * uz, across = Math.abs(-x * uz + z * ux);
      if (along >= 24 && along <= 30 && across <= 1.5) h = Math.max(h, (3 * (30 - along)) / 6); // 3 m wide, foot r30 -> top r24
    }
    return h;
  };
  return {
    night: 3,
    duration: T.night3_duration_s,
    start: { x: 0, y: 0, z: -30 },
    startFacing: { x: 0, z: 1 },
    lanterns: [lantern(1, 0, 6, 6), lantern(2, 18, 3, 10), lantern(3, -18, 3, 10), lantern(4, 35, 0, -10), lantern(5, -35, 0, -10), lantern(6, 20, 0, -35), lantern(7, -20, 0, -35)],
    motePoints: [...ring(34, 18, 0, 20, 0), ...ring(18, 8, 20, 20, 3), ...ring(5, 4, 45, 90, 6)],
    shadePoints: ring(43, 16, 0, 22.5),
    shade: { firstTick: 300, firstCount: 2, interval: 360, max: 10, speed: 4.5 },
    charms: [{ id: "C1", x: 30, y: 0, z: 25 }, { id: "C2", x: -30, y: 0, z: 25 }],
    obstacles: [{ x: 0, z: 0, r: 2 }], // bell tower on tier 2
    pads: [{ x: 0, y: 3, z: 13, r: 1, vy: 12, vh: 8, dx: 0, dz: -1 }],
    wind: true,
    heightAt,
  };
}

export function getMap(night: number): MapDef {
  if (night === 1) return night1();
  if (night === 2) return night2();
  if (night === 3) return night3();
  throw new Error(`unknown night ${night}`);
}
