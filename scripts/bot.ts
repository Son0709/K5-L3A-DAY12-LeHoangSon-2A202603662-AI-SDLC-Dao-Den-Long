// Playability check: a simple greedy bot plays the default night through the real simulation core.
// It is NOT a proof of fun, only of "the night can be won with the contract tuning".
// Usage: node scripts/bot.ts [seeds=20]
import { createSim, type InputState } from "../src/sim/sim.ts";
import { parseScenario } from "../src/sim/parse.ts";
import { T } from "../src/sim/tuning.ts";

const seeds = Number(process.argv[2] ?? 20);
const d = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

function play(seed: number) {
  const hits: number[] = [];
  const sim = createSim(parseScenario(undefined), seed, 1, (e) => { if (e.name === "player_hit") hits.push(e.tick); });
  const reason = "timeout";
  const inp: InputState = { mx: 0, mz: 0, yaw: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  for (let k = 0; k < 330 * 60 && sim.isPlaying(); k++) {
    const v = sim.view(), p = v.player;
    const unlit = v.lanterns.filter((l) => !l.lit);
    const needDeposit = p.carried >= T.lantern_cost || (v.motes.length === 0 && p.carried > 0) || (p.carried > 0 && unlit.some((l) => l.deposited > 0));
    let tx = 0, tz = 0, lantern: (typeof unlit)[number] | undefined;
    if (needDeposit && unlit.length) {
      lantern = unlit.reduce((a, b) => (d(p.x, p.z, a.x, a.z) < d(p.x, p.z, b.x, b.z) ? a : b));
      tx = lantern.x; tz = lantern.z;
    } else if (v.motes.length) {
      const m = v.motes.reduce((a, b) => (d(p.x, p.z, a.x, a.z) < d(p.x, p.z, b.x, b.z) ? a : b));
      tx = m.x; tz = m.z;
    }
    let dx = tx - p.x, dz = tz - p.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    let near = false;
    for (const s of v.shades) {
      if (s.stunned) continue;
      const dd = d(p.x, p.z, s.x, s.z);
      if (dd < 7) { dx += ((p.x - s.x) / dd) * (7 / dd) * 0.6; dz += ((p.z - s.z) / dd) * (7 / dd) * 0.6; }
      if (dd < 2.6) near = true;
    }
    const m = Math.hypot(dx, dz) || 1;
    inp.mx = Math.max(-1, Math.min(1, dx / m)); inp.mz = Math.max(-1, Math.min(1, dz / m));
    const atLantern = lantern && d(p.x, p.z, lantern.x, lantern.z) <= T.interact_radius - 0.3;
    if (atLantern) { inp.mx = 0; inp.mz = 0; }
    inp.interact = !!atLantern && k % 2 === 0;
    inp.pulse = near && p.carried >= T.pulse_cost && k % 2 === 0;
    sim.step(k, inp);
  }
  const r = sim.result(), v = sim.view();
  return { seed, state: r.state, score: r.score, lit: v.lanterns.filter((l) => l.lit).length, flames: v.player.flames, hits: hits.length, secondsLeft: Math.round(v.timeLeft) , reason };
}

const results = Array.from({ length: seeds }, (_, i) => play(i + 1));
const wins = results.filter((r) => r.state === "won").length;
for (const r of results) console.log(`seed ${String(r.seed).padStart(2)}: ${r.state.padEnd(7)} lit ${r.lit}/5 flames ${r.flames} hits ${r.hits} left ${String(r.secondsLeft).padStart(3)}s score ${r.score}`);
console.log(`\ngreedy bot: ${wins}/${seeds} won; mean lit lanterns ${(results.reduce((a, r) => a + r.lit, 0) / seeds).toFixed(2)}/5`);
