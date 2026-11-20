# Phase 2 — Kết quả bằng chứng (sinh tự động)

> File này do `npm run proof` sinh ra từ lần chạy thật của CLI headless. Không sửa tay.
> Giá trị mong đợi nằm trong `scripts/proof2.ts`, tính tay từ `docs/notes/phase2-spec.md` và ticket.

- Code commit khi chạy: `5f72a24`
- Máy: 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz, 12 luồng, 16 GB RAM, win32 x64, Node v26.13.1
- Unit tests: 113/113 đạt (chi tiết: `test-report.txt`)
- Kiểm tra end-to-end: 42/42 đạt

| ID | Yêu cầu | Điều được kiểm tra | Kết quả |
|---|---|---|---|
| A1.a | AC-MOTE | walking +Z picks 10 motes (carried 1..10) | ĐẠT |
| A1.b | AC-LANTERN | interact deposits 10 then lights L5 (deposit before lantern_lit) | ĐẠT |
| A1.c | AC-END | all lit => won/all_lit at tick 141, run stops there | ĐẠT |
| A1.d | AC-END | score = 100 + 100 + 297x2 + 150 = 944 | ĐẠT |
| A2.a | AC-SHADE | hits at ticks 1, 91, 181 (invulnerable 90 ticks); flames 2,1,0; dropped 5,2,1 | ĐẠT |
| A2.b | AC-END | lost/no_flames at the 3rd hit, no bonus score | ĐẠT |
| A3.a | AC-PULSE | pulse hits only S1 (4 m), costs 3 (5 -> 2), cooldown 3 s, +5 score | ĐẠT |
| A3.b | AC-PULSE | pushed 4 m in 15 ticks (x 4 -> 8), stunned through tick 120, chasing again at 121 | ĐẠT |
| A4 | AC-END | time out with lanterns dark => lost/dawn at tick 60 | ĐẠT |
| A5 | AC-SAFE | shade approaches a lit lantern but never closer than 6 m | ĐẠT |
| B1.a | AC-MOVE | accelerates 1 m/s per tick: 6 m/s at tick 6; 60 ticks cover 5.75 m | ĐẠT |
| B1.b | AC-MOVE | stops within 6 ticks after releasing the stick | ĐẠT |
| B2 | AC-JUMP | jump peak about 1.17 m (v=7, g=-20); lands; held key does not re-jump | ĐẠT |
| B3.a | AC-DASH | dash covers 2.8 m (14 m/s x 12 ticks), cooldown 90 ticks from the start: events at 1 and 96 only | ĐẠT |
| B4.a | AC-FALL | free fall crosses Y < -10 at tick 60: one fall hit, all motes lost | ĐẠT |
| B4.b | AC-FALL | walking off the rim: respawn after 60 ticks at the start, invulnerable, still 2 flames | ĐẠT |
| B5 | AC-PAUSE | paused/resumed events at 11/51; sim_tick, time and position frozen in between; state paused | ĐẠT |
| B6.a | AC-MOTE | 20 motes at start; 21 at tick 240; 22 at tick 480 | ĐẠT |
| B6.b | AC-SHADE | shades: 2 at tick 300 (S1, S2), 1 at tick 780 (S3); spawning for 60 ticks then wander | ĐẠT |
| C1.a | AC-CONTRACT-1.1 | snapshot has night, wind, player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}, motes.{kind,ttl_s}, drifters, charms | ĐẠT |
| C1.b | AC-NIGHTS | durations 300/330/360 s; lantern counts 5/6/7 | ĐẠT |
| C1.c | AC-CONTRACT-1.1 | night_start {night} is emitted once at tick 1 | ĐẠT |
| C1.d | AC-NIGHTS | Night 1 L2 = (23.8,0,7.7); Night 2 L4 = (70,0,20); Night 3 L1 = (0,6,6) | ĐẠT |
| C2.a | AC-NIGHTS | Night 2 pads: launched at 24 m/s horizontal; land inside the other island after 78-92 ticks, no fall | ĐẠT |
| C2.b | AC-NIGHTS | bridge is walkable; stepping off its side (|z| > 2) makes Mây fall | ĐẠT |
| C3.a | AC-NIGHTS | tier wall stops Mây at z = 12 (no climbing); a ramp leads up to tier 1 (y = 3) | ĐẠT |
| C3.b | AC-NIGHTS | pad at (0,3,13) lands Mây on tier 2 (y = 6); the bell tower (r = 2) blocks | ĐẠT |
| C3.c | AC-NIGHTS | wind: announced from tick 1680, blows 1800-2099 at 2 m/s towards the announced direction | ĐẠT |
| C3.d | AC-SHADE | Night 3 shades chase at 4.5 m/s | ĐẠT |
| D1.a | AC-DRIFT | drifters spawn at 1200 (D1) and 2400 (D2); a third is not spawned while two live | ĐẠT |
| D1.b | AC-DRIFT | chase + contact: steals 3 (5 -> 2) once, no flame lost; flees and vanishes at tick 241; loot is gone | ĐẠT |
| D1.c | AC-DRIFT | pulse on a fleeing thief drops 3 motes on the spot; it vanishes at tick 120 | ĐẠT |
| D1.d | AC-DRIFT | pulse on a chasing drifter: it flees without stealing | ĐẠT |
| D2.a | AC-CHARM | pickup at (35,0,0): charm_picked, charm_s = 10, respawn in 45 s | ĐẠT |
| D2.b | AC-CHARM | speed 7.2 m/s while the charm lasts, 6 m/s after | ĐẠT |
| D2.c | AC-CHARM | dash without cooldown (events at 1 and 21; the press at 5 during the dash is ignored) | ĐẠT |
| E1.1 | AC-CONTRACT-1.1 | Night 1: same seed twice => byte-identical (sha256 8e48c08b3a2e...); other seed differs; 3-decimal rounding | ĐẠT |
| E1.2 | AC-CONTRACT-1.1 | Night 2: same seed twice => byte-identical (sha256 c0deaae89f61...); other seed differs; 3-decimal rounding | ĐẠT |
| E1.3 | AC-CONTRACT-1.1 | Night 3: same seed twice => byte-identical (sha256 402e0a37803b...); other seed differs; 3-decimal rounding | ĐẠT |
| E2 | AC-CONTRACT-1.1 | exit codes: ok 0; --night 4 -> 2; invalid JSON -> 2; non-increasing ticks -> 2 | ĐẠT |
| F1 | AC-PERF | a full night (21,600 ticks, worst case) runs headless in <= 30 s: N1 0.15 s, N2 0.17 s, N3 0.22 s | ĐẠT |
| UT | all | unit test suite: 113/113 pass | ĐẠT |

## Hiệu năng headless: một Đêm đầy đủ (21.600 tick, trường hợp xấu nhất)

Đo bằng thời gian chạy CLI thật (gồm khởi động Node và ghi file). Ngưỡng của ticket: <= 30 giây.

| Đêm | Thời gian | Kích thước output |
|---|---:|---:|
| 1 | 0.15 s | 3.0 MB |
| 2 | 0.17 s | 3.5 MB |
| 3 | 0.22 s | 4.2 MB |

## Lệnh tái lập từng lần chạy

- `a1-win` (exit 0, sha256 9fec8ee575f2): `node src/headless/cli.ts --seed 1 --night 1 --ticks 400 --out docs/proof/phase-2/runs/a1-win.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/a1-win.scenario.json --inputs docs/proof/phase-2/scenarios/a1-win.inputs.json`
- `a2-lose` (exit 0, sha256 f89312c335bb): `node src/headless/cli.ts --seed 1 --night 1 --ticks 400 --out docs/proof/phase-2/runs/a2-lose.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/a2-lose.scenario.json`
- `a3-pulse` (exit 0, sha256 c7d1085980b8): `node src/headless/cli.ts --seed 1 --night 1 --ticks 130 --out docs/proof/phase-2/runs/a3-pulse.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/a3-pulse.scenario.json --inputs docs/proof/phase-2/scenarios/a3-pulse.inputs.json`
- `a4-dawn` (exit 0, sha256 744a16d9f449): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1000 --out docs/proof/phase-2/runs/a4-dawn.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/a4-dawn.scenario.json`
- `a5-safe` (exit 0, sha256 f45985a3ba8e): `node src/headless/cli.ts --seed 1 --night 1 --ticks 400 --out docs/proof/phase-2/runs/a5-safe.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/a5-safe.scenario.json`
- `b1-move` (exit 0, sha256 dc7b0961c19e): `node src/headless/cli.ts --seed 1 --night 1 --ticks 70 --out docs/proof/phase-2/runs/b1-move.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/b1-move.scenario.json --inputs docs/proof/phase-2/scenarios/b1-move.inputs.json`
- `b2-jump` (exit 0, sha256 6f6e359e791e): `node src/headless/cli.ts --seed 1 --night 1 --ticks 100 --out docs/proof/phase-2/runs/b2-jump.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/b2-jump.scenario.json --inputs docs/proof/phase-2/scenarios/b2-jump.inputs.json`
- `b3-dash` (exit 0, sha256 f2faac791fdf): `node src/headless/cli.ts --seed 1 --night 1 --ticks 130 --out docs/proof/phase-2/runs/b3-dash.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/b3-dash.scenario.json --inputs docs/proof/phase-2/scenarios/b3-dash.inputs.json`
- `b4-fall` (exit 0, sha256 cfdccf312740): `node src/headless/cli.ts --seed 1 --night 1 --ticks 120 --out docs/proof/phase-2/runs/b4-fall.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/b4-fall.scenario.json`
- `b4-rim` (exit 0, sha256 13444c95d9f6): `node src/headless/cli.ts --seed 1 --night 1 --ticks 260 --out docs/proof/phase-2/runs/b4-rim.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/b4-rim.scenario.json --inputs docs/proof/phase-2/scenarios/b4-rim.inputs.json`
- `b5-pause` (exit 0, sha256 2034d0a63b26): `node src/headless/cli.ts --seed 1 --night 1 --ticks 100 --out docs/proof/phase-2/runs/b5-pause.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/b5-pause.scenario.json --inputs docs/proof/phase-2/scenarios/b5-pause.inputs.json`
- `b6-schedule` (exit 0, sha256 6807f3a3fd9a): `node src/headless/cli.ts --seed 1 --night 1 --ticks 800 --out docs/proof/phase-2/runs/b6-schedule.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/b6-schedule.scenario.json`
- `c1-night1` (exit 0, sha256 0ed8f3503f6b): `node src/headless/cli.ts --seed 1 --night 1 --ticks 20 --out docs/proof/phase-2/runs/c1-night1.jsonl --snapshot-every 10`
- `c1-night2` (exit 0, sha256 f3dfb24e85b7): `node src/headless/cli.ts --seed 1 --night 2 --ticks 20 --out docs/proof/phase-2/runs/c1-night2.jsonl --snapshot-every 10`
- `c1-night3` (exit 0, sha256 cadf48eb56bb): `node src/headless/cli.ts --seed 1 --night 3 --ticks 20 --out docs/proof/phase-2/runs/c1-night3.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/c1-night3.scenario.json`
- `c2-pad-a` (exit 0, sha256 8ebb7075fb12): `node src/headless/cli.ts --seed 1 --night 2 --ticks 160 --out docs/proof/phase-2/runs/c2-pad-a.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/c2-pad-a.scenario.json`
- `c2-pad-b` (exit 0, sha256 b3721794fc32): `node src/headless/cli.ts --seed 1 --night 2 --ticks 160 --out docs/proof/phase-2/runs/c2-pad-b.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/c2-pad-b.scenario.json`
- `c2-bridge` (exit 0, sha256 bc6665687f27): `node src/headless/cli.ts --seed 1 --night 2 --ticks 90 --out docs/proof/phase-2/runs/c2-bridge.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/c2-bridge.scenario.json --inputs docs/proof/phase-2/scenarios/c2-bridge.inputs.json`
- `c2-gap` (exit 0, sha256 ed1756c34bba): `node src/headless/cli.ts --seed 1 --night 2 --ticks 200 --out docs/proof/phase-2/runs/c2-gap.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/c2-gap.scenario.json --inputs docs/proof/phase-2/scenarios/c2-gap.inputs.json`
- `c3-wall` (exit 0, sha256 c67a4a173936): `node src/headless/cli.ts --seed 1 --night 3 --ticks 80 --out docs/proof/phase-2/runs/c3-wall.jsonl --snapshot-every 80 --scenario docs/proof/phase-2/scenarios/c3-wall.scenario.json --inputs docs/proof/phase-2/scenarios/c3-wall.inputs.json`
- `c3-ramp` (exit 0, sha256 265629020ee3): `node src/headless/cli.ts --seed 1 --night 3 --ticks 100 --out docs/proof/phase-2/runs/c3-ramp.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/c3-ramp.scenario.json --inputs docs/proof/phase-2/scenarios/c3-ramp.inputs.json`
- `c3-pad` (exit 0, sha256 d7078f51d675): `node src/headless/cli.ts --seed 1 --night 3 --ticks 150 --out docs/proof/phase-2/runs/c3-pad.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/c3-pad.scenario.json`
- `c3-tower` (exit 0, sha256 642e03b882e5): `node src/headless/cli.ts --seed 1 --night 3 --ticks 120 --out docs/proof/phase-2/runs/c3-tower.jsonl --snapshot-every 120 --scenario docs/proof/phase-2/scenarios/c3-tower.scenario.json --inputs docs/proof/phase-2/scenarios/c3-tower.inputs.json`
- `c3-wind` (exit 0, sha256 09570ba9756c): `node src/headless/cli.ts --seed 1 --night 3 --ticks 2200 --out docs/proof/phase-2/runs/c3-wind.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/c3-wind.scenario.json`
- `c3-shades` (exit 0, sha256 66153bebf902): `node src/headless/cli.ts --seed 1 --night 3 --ticks 61 --out docs/proof/phase-2/runs/c3-shades.jsonl --snapshot-every 60 --scenario docs/proof/phase-2/scenarios/c3-shades.scenario.json`
- `d1-spawn` (exit 0, sha256 c8786fb46756): `node src/headless/cli.ts --seed 1 --night 2 --ticks 3700 --out docs/proof/phase-2/runs/d1-spawn.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/d1-spawn.scenario.json`
- `d1-steal` (exit 0, sha256 683459148022): `node src/headless/cli.ts --seed 1 --night 2 --ticks 250 --out docs/proof/phase-2/runs/d1-steal.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/d1-steal.scenario.json`
- `d1-pulse` (exit 0, sha256 e4ba59d15d65): `node src/headless/cli.ts --seed 1 --night 2 --ticks 130 --out docs/proof/phase-2/runs/d1-pulse.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/d1-pulse.scenario.json --inputs docs/proof/phase-2/scenarios/d1-pulse.inputs.json`
- `d1-pulse-chase` (exit 0, sha256 60fdfe8eba1b): `node src/headless/cli.ts --seed 1 --night 2 --ticks 40 --out docs/proof/phase-2/runs/d1-pulse-chase.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/d1-pulse-chase.scenario.json --inputs docs/proof/phase-2/scenarios/d1-pulse-chase.inputs.json`
- `d2-charm` (exit 0, sha256 317342b2a5cb): `node src/headless/cli.ts --seed 1 --night 2 --ticks 330 --out docs/proof/phase-2/runs/d2-charm.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/d2-charm.scenario.json --inputs docs/proof/phase-2/scenarios/d2-charm.inputs.json`
- `d2-speed` (exit 0, sha256 02be5d52ea73): `node src/headless/cli.ts --seed 1 --night 1 --ticks 330 --out docs/proof/phase-2/runs/d2-speed.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/d2-speed.scenario.json --inputs docs/proof/phase-2/scenarios/d2-speed.inputs.json`
- `d2-dash` (exit 0, sha256 0535d745a2dd): `node src/headless/cli.ts --seed 1 --night 1 --ticks 40 --out docs/proof/phase-2/runs/d2-dash.jsonl --snapshot-every 1 --scenario docs/proof/phase-2/scenarios/d2-dash.scenario.json --inputs docs/proof/phase-2/scenarios/d2-dash.inputs.json`
- `e1-n1-a` (exit 0, sha256 8e48c08b3a2e): `node src/headless/cli.ts --seed 42 --night 1 --ticks 3000 --out docs/proof/phase-2/runs/e1-n1-a.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n1-a.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n1-a.inputs.json`
- `e1-n1-b` (exit 0, sha256 8e48c08b3a2e): `node src/headless/cli.ts --seed 42 --night 1 --ticks 3000 --out docs/proof/phase-2/runs/e1-n1-b.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n1-b.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n1-b.inputs.json`
- `e1-n1-c` (exit 0, sha256 c2e66627173b): `node src/headless/cli.ts --seed 43 --night 1 --ticks 3000 --out docs/proof/phase-2/runs/e1-n1-c.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n1-c.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n1-c.inputs.json`
- `e1-n2-a` (exit 0, sha256 c0deaae89f61): `node src/headless/cli.ts --seed 42 --night 2 --ticks 3000 --out docs/proof/phase-2/runs/e1-n2-a.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n2-a.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n2-a.inputs.json`
- `e1-n2-b` (exit 0, sha256 c0deaae89f61): `node src/headless/cli.ts --seed 42 --night 2 --ticks 3000 --out docs/proof/phase-2/runs/e1-n2-b.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n2-b.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n2-b.inputs.json`
- `e1-n2-c` (exit 0, sha256 05e8b0bf429a): `node src/headless/cli.ts --seed 43 --night 2 --ticks 3000 --out docs/proof/phase-2/runs/e1-n2-c.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n2-c.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n2-c.inputs.json`
- `e1-n3-a` (exit 0, sha256 402e0a37803b): `node src/headless/cli.ts --seed 42 --night 3 --ticks 3000 --out docs/proof/phase-2/runs/e1-n3-a.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n3-a.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n3-a.inputs.json`
- `e1-n3-b` (exit 0, sha256 402e0a37803b): `node src/headless/cli.ts --seed 42 --night 3 --ticks 3000 --out docs/proof/phase-2/runs/e1-n3-b.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n3-b.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n3-b.inputs.json`
- `e1-n3-c` (exit 0, sha256 12ce1d8f5390): `node src/headless/cli.ts --seed 43 --night 3 --ticks 3000 --out docs/proof/phase-2/runs/e1-n3-c.jsonl --snapshot-every 100 --scenario docs/proof/phase-2/scenarios/e1-n3-c.scenario.json --inputs docs/proof/phase-2/scenarios/e1-n3-c.inputs.json`
- `e2-night4` (exit 2, sha256 e3b0c44298fc): `node src/headless/cli.ts --seed 1 --night 4 --ticks 10 --out docs/proof/phase-2/runs/e2-night4.jsonl --snapshot-every 10`
- `e2-bad-json` (exit 2, sha256 e3b0c44298fc): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-2/runs/e2-bad-json.jsonl --snapshot-every 10 --inputs docs/proof/phase-2/scenarios/e2-bad-json.inputs.json`
- `e2-bad-order` (exit 2, sha256 e3b0c44298fc): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-2/runs/e2-bad-order.jsonl --snapshot-every 10 --inputs docs/proof/phase-2/scenarios/e2-bad-order.inputs.json`
- `e2-ok` (exit 0, sha256 825c114bf78f): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-2/runs/e2-ok.jsonl --snapshot-every 10`
- `f1-full-night1` (exit 0, sha256 3166b3faa03e): `node src/headless/cli.ts --seed 1 --night 1 --ticks 21600 --out out/f1-full-night1.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/f1-full-night1.scenario.json`
- `f1-full-night2` (exit 0, sha256 5dca689ac71d): `node src/headless/cli.ts --seed 1 --night 2 --ticks 21600 --out out/f1-full-night2.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/f1-full-night2.scenario.json`
- `f1-full-night3` (exit 0, sha256 2e8981b42d26): `node src/headless/cli.ts --seed 1 --night 3 --ticks 21600 --out out/f1-full-night3.jsonl --snapshot-every 10 --scenario docs/proof/phase-2/scenarios/f1-full-night3.scenario.json`
