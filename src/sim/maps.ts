// Standard maps (ticket Part 2). Angles are measured from +X, counter-clockwise seen from above:
// x = r cos(a), z = -r sin(a).
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
export const polar = (r: number, deg: number, y = 0): Pt => ({ x: r * Math.cos(rad(deg)), y, z: -r * Math.sin(rad(deg)) });
const ring = (r: number, count: number, startDeg = 0, step = 360 / count, y = 0) =>
  Array.from({ length: count }, (_, i) => polar(r, startDeg + i * step, y));

function night1(): MapDef {
  return {
    night: 1,
    duration: T.night1_duration_s,
    start: { x: 0, y: 0, z: 0 },
    startFacing: { x: 0, z: 1 },
    lanterns: [
      { id: "L1", x: 0, y: 0, z: 25 },
      { id: "L2", x: 23.8, y: 0, z: 7.7 },
      { id: "L3", x: 14.7, y: 0, z: -20.2 },
      { id: "L4", x: -14.7, y: 0, z: -20.2 },
      { id: "L5", x: -23.8, y: 0, z: 7.7 },
    ],
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

export function getMap(night: number): MapDef {
  if (night === 1) return night1();
  throw new Error(`night ${night} is not implemented yet`);
}
