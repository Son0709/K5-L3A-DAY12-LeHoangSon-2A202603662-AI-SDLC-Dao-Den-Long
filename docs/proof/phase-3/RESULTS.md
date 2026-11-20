# Phase 3 — Kết quả bằng chứng (sinh tự động)

> File này do `npm run proof` sinh ra từ lần chạy thật của CLI headless. Không sửa tay.
> Giá trị mong đợi nằm trong `scripts/proof3.ts`, tính tay từ Ticket-03 và `docs/notes/adr-0001-lantern-fuel.md`.

- Code commit khi chạy: `1be1b10`
- Máy: 11th Gen Intel(R) Core(TM) i5-11400H @ 2.70GHz, 12 luồng, 16 GB RAM, win32 x64, Node v26.13.1
- Unit tests: 143/143 đạt (chi tiết: `test-report.txt`)
- Kiểm tra end-to-end: 45/45 đạt

| ID | Yêu cầu | Điều được kiểm tra | Kết quả |
|---|---|---|---|
| A1.a | AC-FUEL | a scenario lantern with lit:true and no fuel starts at 100, ever_lit, no event, no score; it burns 1/s (99 at 60 ticks, 90 at 600) | ĐẠT |
| A1.b | AC-FUEL | fuel 0.05 (3 units of 1/60) goes out at tick 3: lantern_out, fuel 0, deposited 0, ever_lit kept | ĐẠT |
| A2 | AC-FUEL | refuel: 55 burns to 54.98 first, so 5 motes (ceil 4.5) refill it to 100 for 25 points; with 2 motes fuel is 75 for 10 points; event refuel, no deposit | ĐẠT |
| A3.a | AC-LIGHT | first light costs 10: deposit then lantern_lit relight:false; score 10x5 + 100 = 150; capacity 12 | ĐẠT |
| A3.b | AC-LIGHT | a lantern that was lit before costs only 5: relight:true; score 5x5 + 40 = 65; fuel back to 100; relit_count 1 | ĐẠT |
| A3.c | AC-LIGHT | step order: a lantern that burns out and is fed in the same tick gives lantern_out, deposit (5), lantern_lit (relight) | ĐẠT |
| A4 | AC-CAPACITY | capacity = min(20, 10 + 2 x successful_lights): 0->10, 1->12, 3->16, 5->20, 8->20 | ĐẠT |
| B1.a | AC-DRAIN | a wander shade within 2 m of a weak lit lantern switches to drain and stands still | ĐẠT |
| B1.b | AC-DRAIN | drain takes 5/s on top of the burn of 1/s (tick 1 burn only, then 6 units per tick): fuel 14.1 at tick 60 | ĐẠT |
| B1.c | AC-DRAIN | fuel_drain is logged every 60 ticks of draining (ticks 61 and 121) with lantern, shade and fuel | ĐẠT |
| B1.d | AC-DRAIN | a drained lantern goes out at tick 51; the shade returns to wander | ĐẠT |
| B2 | AC-DRAIN | the safe zone needs fuel >= 30: exactly 30 keeps it (shade pushed to 6 m), below 30 loses it | ĐẠT |
| B3.a | AC-DRAIN | a wander shade heads for the weak lit lantern (L1, 44 m away at -X) rather than the nearer dark L2 | ĐẠT |
| B3.b | AC-DRAIN | two equally weak lanterns: the smaller id (L1, at +X) is chosen | ĐẠT |
| B4 | AC-DRAIN | drain -> chase when Mây is within 6 m (6.0 chases, 6.1 keeps draining) | ĐẠT |
| B5 | AC-SCORE | Tỏa Sáng on a draining shade scores 15 in total (not 5); it is stunned and stops draining while stunned | ĐẠT |
| B5.b | AC-SCORE | Tỏa Sáng on an ordinary shade still scores 5 | ĐẠT |
| B6 | AC-DRAIN | refuelling a drained lantern to >= 30 frees it: the shade is expelled (recoil, harmless) and is outside the 6 m zone by tick 31 | ĐẠT |
| C1.a | AC-WIN | 3 of 5 lit at dawn wins: game_over won/dawn_survived at tick 60; score 3 x (50 + floor 99) + 3 flames x 50 = 597 | ĐẠT |
| C1.b | AC-WIN | 2 of 5 lit at dawn loses with reason dawn and no bonus | ĐẠT |
| C2 | AC-WIN | thresholds ceil(0.6 x total): Night 1 needs 3/5, Night 2 needs 4/6, Night 3 needs 5/7 | ĐẠT |
| C3.a | AC-WIN | no early win: all 5 lanterns lit does not end the night | ĐẠT |
| C3.b | AC-WIN | no flames beats everything: lost/no_flames even with 5 lit lanterns on the dawn tick | ĐẠT |
| C3.c | AC-WIN | a lantern that burns out before dawn no longer counts (3 lit at the start, 2 at dawn: lost) | ĐẠT |
| C4 | AC-WIN | night durations are 240 / 270 / 300 s | ĐẠT |
| D1.a | AC-CONTRACT-1.2 | snapshot: every lantern has fuel, ever_lit, relit_count (dark lantern: fuel 0); player has capacity | ĐẠT |
| D1.b | AC-CONTRACT-1.2 | scenario: lit:true without fuel means fuel 100 (and does not raise the capacity) | ĐẠT |
| D1.c | AC-CONTRACT-1.2 | scenario fields fuel, ever_lit and player.successful_lights are honoured (fuel 50.5, ever_lit on a dark lantern, capacity 16) | ĐẠT |
| D2.1 | AC-CONTRACT-1.2 | Night 1: same seed twice => byte-identical (sha256 66be6d561dd8...); other seed differs; 3-decimal rounding | ĐẠT |
| D2.2 | AC-CONTRACT-1.2 | Night 2: same seed twice => byte-identical (sha256 02113cbd6f28...); other seed differs; 3-decimal rounding | ĐẠT |
| D2.3 | AC-CONTRACT-1.2 | Night 3: same seed twice => byte-identical (sha256 f5a574aa5f71...); other seed differs; 3-decimal rounding | ĐẠT |
| D3 | AC-CONTRACT-1.2 | exit codes: ok 0; --night 4 -> 2; invalid JSON -> 2 | ĐẠT |
| R1 | AC-SHADE | contact: hits at ticks 1, 91, 181 (90-tick invulnerability); flames 2,1,0; drops 5,2,1; then lost/no_flames | ĐẠT |
| R2 | AC-PULSE | Tỏa Sáng: stuns only the shade in range, costs 3, pushed 4 m in 15 ticks, stunned through tick 120 | ĐẠT |
| R3.a | AC-MOVE | movement: 6 m/s reached at tick 6; 60 ticks cover 5.75 m; stops within 6 ticks | ĐẠT |
| R3.b | AC-DASH | dash: 2.8 m in 12 ticks; 90-tick cooldown from the start (events at 1 and 96) | ĐẠT |
| R3.c | AC-FALL | falling off the island: Y < -10 at tick 60, one fall hit, all motes lost | ĐẠT |
| R3.d | AC-PAUSE | pause: sim_tick, time and position frozen while paused (events at 11 / 51) | ĐẠT |
| R4 | AC-MOTE | schedules: 20 motes at start, 21 at tick 240; shades 2 at tick 300 then 1 at 780; spawning for 60 ticks | ĐẠT |
| R5.a | AC-NIGHTS | Night 2: the pad launches Mây at 24 m/s and she lands inside the other island after 78-92 ticks | ĐẠT |
| R5.b | AC-NIGHTS | Night 3: wind announced from tick 1680, blows 1800-2099 at 2 m/s | ĐẠT |
| R6.a | AC-DRIFT | drifter: steals 3 of 5 on contact, once; flees and vanishes at tick 241 | ĐẠT |
| R6.b | AC-CHARM | charm at (35,0,0): charm_picked at tick 1, charm_s = 10, respawn in 45 s | ĐẠT |
| E1 | AC-PERF | a full night (21,600 ticks, worst case) runs headless in <= 30 s: N1 0.25 s, N2 0.32 s, N3 0.33 s | ĐẠT |
| UT | all | unit test suite: 143/143 pass | ĐẠT |

## Hiệu năng headless: một Đêm đầy đủ (21.600 tick, trường hợp xấu nhất)

| Đêm | Thời gian | Kích thước output |
|---|---:|---:|
| 1 | 0.25 s | 6.1 MB |
| 2 | 0.32 s | 6.8 MB |
| 3 | 0.33 s | 6.3 MB |

## Lệnh tái lập từng lần chạy

- `a1-burn` (exit 0, sha256 47a09e2baaab): `node src/headless/cli.ts --seed 1 --night 1 --ticks 601 --out docs/proof/phase-3/runs/a1-burn.jsonl --snapshot-every 60 --scenario docs/proof/phase-3/scenarios/a1-burn.scenario.json`
- `a1-out` (exit 0, sha256 192d71010f6a): `node src/headless/cli.ts --seed 1 --night 1 --ticks 8 --out docs/proof/phase-3/runs/a1-out.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/a1-out.scenario.json`
- `a2-refuel-full` (exit 0, sha256 546399336c85): `node src/headless/cli.ts --seed 1 --night 1 --ticks 3 --out docs/proof/phase-3/runs/a2-refuel-full.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/a2-refuel-full.scenario.json --inputs docs/proof/phase-3/scenarios/a2-refuel-full.inputs.json`
- `a2-refuel-part` (exit 0, sha256 14c24c9ba0f0): `node src/headless/cli.ts --seed 1 --night 1 --ticks 3 --out docs/proof/phase-3/runs/a2-refuel-part.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/a2-refuel-part.scenario.json --inputs docs/proof/phase-3/scenarios/a2-refuel-part.inputs.json`
- `a3-first-light` (exit 0, sha256 d4729c3207b6): `node src/headless/cli.ts --seed 1 --night 1 --ticks 3 --out docs/proof/phase-3/runs/a3-first-light.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/a3-first-light.scenario.json --inputs docs/proof/phase-3/scenarios/a3-first-light.inputs.json`
- `a3-relight` (exit 0, sha256 6802bc381b57): `node src/headless/cli.ts --seed 1 --night 1 --ticks 3 --out docs/proof/phase-3/runs/a3-relight.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/a3-relight.scenario.json --inputs docs/proof/phase-3/scenarios/a3-relight.inputs.json`
- `a3-out-then-relight` (exit 0, sha256 e04188a76076): `node src/headless/cli.ts --seed 1 --night 1 --ticks 3 --out docs/proof/phase-3/runs/a3-out-then-relight.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/a3-out-then-relight.scenario.json --inputs docs/proof/phase-3/scenarios/a3-out-then-relight.inputs.json`
- `a4-cap-0` (exit 0, sha256 1b55cd8756c7): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/a4-cap-0.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/a4-cap-0.scenario.json`
- `a4-cap-1` (exit 0, sha256 1ea26761bf0c): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/a4-cap-1.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/a4-cap-1.scenario.json`
- `a4-cap-3` (exit 0, sha256 5d474b315fa6): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/a4-cap-3.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/a4-cap-3.scenario.json`
- `a4-cap-5` (exit 0, sha256 153e987f24e5): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/a4-cap-5.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/a4-cap-5.scenario.json`
- `a4-cap-8` (exit 0, sha256 153e987f24e5): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/a4-cap-8.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/a4-cap-8.scenario.json`
- `b1-drain` (exit 0, sha256 49045c3e6d67): `node src/headless/cli.ts --seed 1 --night 1 --ticks 130 --out docs/proof/phase-3/runs/b1-drain.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b1-drain.scenario.json`
- `b1-dead` (exit 0, sha256 c7ccee580365): `node src/headless/cli.ts --seed 1 --night 1 --ticks 80 --out docs/proof/phase-3/runs/b1-dead.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b1-dead.scenario.json`
- `b2-zone-30.016666666666666` (exit 0, sha256 f42bfe7ab503): `node src/headless/cli.ts --seed 1 --night 1 --ticks 2 --out docs/proof/phase-3/runs/b2-zone-30.016666666666666.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b2-zone-30.016666666666666.scenario.json`
- `b2-zone-30` (exit 0, sha256 92cd6367440e): `node src/headless/cli.ts --seed 1 --night 1 --ticks 2 --out docs/proof/phase-3/runs/b2-zone-30.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b2-zone-30.scenario.json`
- `b2-zone-100` (exit 0, sha256 d0d1a28b128c): `node src/headless/cli.ts --seed 1 --night 1 --ticks 2 --out docs/proof/phase-3/runs/b2-zone-100.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b2-zone-100.scenario.json`
- `b3-weakest` (exit 0, sha256 b1de11308c9c): `node src/headless/cli.ts --seed 1 --night 1 --ticks 61 --out docs/proof/phase-3/runs/b3-weakest.jsonl --snapshot-every 60 --scenario docs/proof/phase-3/scenarios/b3-weakest.scenario.json`
- `b3-tie` (exit 0, sha256 76916d1f7e08): `node src/headless/cli.ts --seed 1 --night 1 --ticks 31 --out docs/proof/phase-3/runs/b3-tie.jsonl --snapshot-every 30 --scenario docs/proof/phase-3/scenarios/b3-tie.scenario.json`
- `b4-chase-6` (exit 0, sha256 f1fbab54d18e): `node src/headless/cli.ts --seed 1 --night 1 --ticks 2 --out docs/proof/phase-3/runs/b4-chase-6.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b4-chase-6.scenario.json`
- `b4-chase-6.1` (exit 0, sha256 8ac79eceb416): `node src/headless/cli.ts --seed 1 --night 1 --ticks 2 --out docs/proof/phase-3/runs/b4-chase-6.1.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b4-chase-6.1.scenario.json`
- `b5-pulse-drain` (exit 0, sha256 8a6c807b12ef): `node src/headless/cli.ts --seed 1 --night 1 --ticks 200 --out docs/proof/phase-3/runs/b5-pulse-drain.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b5-pulse-drain.scenario.json --inputs docs/proof/phase-3/scenarios/b5-pulse-drain.inputs.json`
- `b5-pulse-normal` (exit 0, sha256 4cb9eae1f52f): `node src/headless/cli.ts --seed 1 --night 1 --ticks 3 --out docs/proof/phase-3/runs/b5-pulse-normal.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/b5-pulse-normal.scenario.json --inputs docs/proof/phase-3/scenarios/b5-pulse-normal.inputs.json`
- `b6-refuel-frees` (exit 0, sha256 dcd11724e883): `node src/headless/cli.ts --seed 1 --night 1 --ticks 45 --out docs/proof/phase-3/runs/b6-refuel-frees.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/b6-refuel-frees.scenario.json --inputs docs/proof/phase-3/scenarios/b6-refuel-frees.inputs.json`
- `c1-dawn-win` (exit 0, sha256 ac7844ea0c8f): `node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out docs/proof/phase-3/runs/c1-dawn-win.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c1-dawn-win.scenario.json`
- `c1-dawn-lose` (exit 0, sha256 d31c53c585c6): `node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out docs/proof/phase-3/runs/c1-dawn-lose.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c1-dawn-lose.scenario.json`
- `c2-n1-3of5` (exit 0, sha256 f9dc95cd3224): `node src/headless/cli.ts --seed 1 --night 1 --ticks 100 --out docs/proof/phase-3/runs/c2-n1-3of5.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c2-n1-3of5.scenario.json`
- `c2-n1-2of5` (exit 0, sha256 741c025e4aec): `node src/headless/cli.ts --seed 1 --night 1 --ticks 100 --out docs/proof/phase-3/runs/c2-n1-2of5.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c2-n1-2of5.scenario.json`
- `c2-n2-4of6` (exit 0, sha256 c5adb16d36ef): `node src/headless/cli.ts --seed 1 --night 2 --ticks 100 --out docs/proof/phase-3/runs/c2-n2-4of6.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c2-n2-4of6.scenario.json`
- `c2-n2-3of6` (exit 0, sha256 94d52c3f7272): `node src/headless/cli.ts --seed 1 --night 2 --ticks 100 --out docs/proof/phase-3/runs/c2-n2-3of6.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c2-n2-3of6.scenario.json`
- `c2-n3-5of7` (exit 0, sha256 85db8552b0b1): `node src/headless/cli.ts --seed 1 --night 3 --ticks 100 --out docs/proof/phase-3/runs/c2-n3-5of7.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c2-n3-5of7.scenario.json`
- `c2-n3-4of7` (exit 0, sha256 87fcab9091cd): `node src/headless/cli.ts --seed 1 --night 3 --ticks 100 --out docs/proof/phase-3/runs/c2-n3-4of7.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c2-n3-4of7.scenario.json`
- `c3-no-early-win` (exit 0, sha256 c68948947649): `node src/headless/cli.ts --seed 1 --night 1 --ticks 300 --out docs/proof/phase-3/runs/c3-no-early-win.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c3-no-early-win.scenario.json`
- `c3-no-flames` (exit 0, sha256 3cb4c66e4d8d): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-3/runs/c3-no-flames.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c3-no-flames.scenario.json`
- `c3-burn-out` (exit 0, sha256 3d4d51784e81): `node src/headless/cli.ts --seed 1 --night 1 --ticks 200 --out docs/proof/phase-3/runs/c3-burn-out.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c3-burn-out.scenario.json`
- `c4-night1` (exit 0, sha256 6b3efb708308): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/c4-night1.jsonl --snapshot-every 10`
- `c4-night2` (exit 0, sha256 1b741676a7a4): `node src/headless/cli.ts --seed 1 --night 2 --ticks 1 --out docs/proof/phase-3/runs/c4-night2.jsonl --snapshot-every 10`
- `c4-night3` (exit 0, sha256 9daccfd50f35): `node src/headless/cli.ts --seed 1 --night 3 --ticks 1 --out docs/proof/phase-3/runs/c4-night3.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/c4-night3.scenario.json`
- `d1-shape` (exit 0, sha256 9ec3cce2a645): `node src/headless/cli.ts --seed 1 --night 1 --ticks 2 --out docs/proof/phase-3/runs/d1-shape.jsonl --snapshot-every 10`
- `d1-default-fuel` (exit 0, sha256 d753c16b7e21): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/d1-default-fuel.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/d1-default-fuel.scenario.json`
- `d1-scenario` (exit 0, sha256 6d45507fbe34): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1 --out docs/proof/phase-3/runs/d1-scenario.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/d1-scenario.scenario.json`
- `d2-n1-a` (exit 0, sha256 66be6d561dd8): `node src/headless/cli.ts --seed 42 --night 1 --ticks 3000 --out docs/proof/phase-3/runs/d2-n1-a.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n1-a.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n1-a.inputs.json`
- `d2-n1-b` (exit 0, sha256 66be6d561dd8): `node src/headless/cli.ts --seed 42 --night 1 --ticks 3000 --out docs/proof/phase-3/runs/d2-n1-b.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n1-b.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n1-b.inputs.json`
- `d2-n1-c` (exit 0, sha256 1ad4746c6051): `node src/headless/cli.ts --seed 43 --night 1 --ticks 3000 --out docs/proof/phase-3/runs/d2-n1-c.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n1-c.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n1-c.inputs.json`
- `d2-n2-a` (exit 0, sha256 02113cbd6f28): `node src/headless/cli.ts --seed 42 --night 2 --ticks 3000 --out docs/proof/phase-3/runs/d2-n2-a.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n2-a.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n2-a.inputs.json`
- `d2-n2-b` (exit 0, sha256 02113cbd6f28): `node src/headless/cli.ts --seed 42 --night 2 --ticks 3000 --out docs/proof/phase-3/runs/d2-n2-b.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n2-b.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n2-b.inputs.json`
- `d2-n2-c` (exit 0, sha256 07a6f43c8072): `node src/headless/cli.ts --seed 43 --night 2 --ticks 3000 --out docs/proof/phase-3/runs/d2-n2-c.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n2-c.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n2-c.inputs.json`
- `d2-n3-a` (exit 0, sha256 f5a574aa5f71): `node src/headless/cli.ts --seed 42 --night 3 --ticks 3000 --out docs/proof/phase-3/runs/d2-n3-a.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n3-a.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n3-a.inputs.json`
- `d2-n3-b` (exit 0, sha256 f5a574aa5f71): `node src/headless/cli.ts --seed 42 --night 3 --ticks 3000 --out docs/proof/phase-3/runs/d2-n3-b.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n3-b.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n3-b.inputs.json`
- `d2-n3-c` (exit 0, sha256 93beaa7195cd): `node src/headless/cli.ts --seed 43 --night 3 --ticks 3000 --out docs/proof/phase-3/runs/d2-n3-c.jsonl --snapshot-every 100 --scenario docs/proof/phase-3/scenarios/d2-n3-c.scenario.json --inputs docs/proof/phase-3/scenarios/d2-n3-c.inputs.json`
- `d3-night4` (exit 2, sha256 e3b0c44298fc): `node src/headless/cli.ts --seed 1 --night 4 --ticks 10 --out docs/proof/phase-3/runs/d3-night4.jsonl --snapshot-every 10`
- `d3-bad-json` (exit 2, sha256 e3b0c44298fc): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-3/runs/d3-bad-json.jsonl --snapshot-every 10 --inputs docs/proof/phase-3/scenarios/d3-bad-json.inputs.json`
- `d3-ok` (exit 0, sha256 a591f6fb3c43): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-3/runs/d3-ok.jsonl --snapshot-every 10`
- `r1-hits` (exit 0, sha256 2864949c83b1): `node src/headless/cli.ts --seed 1 --night 1 --ticks 400 --out docs/proof/phase-3/runs/r1-hits.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/r1-hits.scenario.json`
- `r2-pulse` (exit 0, sha256 1c66a1e8bdd3): `node src/headless/cli.ts --seed 1 --night 1 --ticks 130 --out docs/proof/phase-3/runs/r2-pulse.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r2-pulse.scenario.json --inputs docs/proof/phase-3/scenarios/r2-pulse.inputs.json`
- `r3-move` (exit 0, sha256 286acd8ad9ac): `node src/headless/cli.ts --seed 1 --night 1 --ticks 70 --out docs/proof/phase-3/runs/r3-move.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r3-move.scenario.json --inputs docs/proof/phase-3/scenarios/r3-move.inputs.json`
- `r3-dash` (exit 0, sha256 6925805e40d7): `node src/headless/cli.ts --seed 1 --night 1 --ticks 130 --out docs/proof/phase-3/runs/r3-dash.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r3-dash.scenario.json --inputs docs/proof/phase-3/scenarios/r3-dash.inputs.json`
- `r3-fall` (exit 0, sha256 2195e4c1cf0a): `node src/headless/cli.ts --seed 1 --night 1 --ticks 120 --out docs/proof/phase-3/runs/r3-fall.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r3-fall.scenario.json`
- `r3-pause` (exit 0, sha256 da3b5cc8dbe1): `node src/headless/cli.ts --seed 1 --night 1 --ticks 100 --out docs/proof/phase-3/runs/r3-pause.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r3-pause.scenario.json --inputs docs/proof/phase-3/scenarios/r3-pause.inputs.json`
- `r4-schedule` (exit 0, sha256 b4849d53c471): `node src/headless/cli.ts --seed 1 --night 1 --ticks 800 --out docs/proof/phase-3/runs/r4-schedule.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/r4-schedule.scenario.json`
- `r5-pad-a` (exit 0, sha256 a851c549dbcf): `node src/headless/cli.ts --seed 1 --night 2 --ticks 160 --out docs/proof/phase-3/runs/r5-pad-a.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r5-pad-a.scenario.json`
- `r5-wind` (exit 0, sha256 4bd5ede99f48): `node src/headless/cli.ts --seed 1 --night 3 --ticks 2200 --out docs/proof/phase-3/runs/r5-wind.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/r5-wind.scenario.json`
- `r6-steal` (exit 0, sha256 2c36dad3e82e): `node src/headless/cli.ts --seed 1 --night 2 --ticks 250 --out docs/proof/phase-3/runs/r6-steal.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r6-steal.scenario.json`
- `r6-charm` (exit 0, sha256 af6f6541623b): `node src/headless/cli.ts --seed 1 --night 2 --ticks 20 --out docs/proof/phase-3/runs/r6-charm.jsonl --snapshot-every 1 --scenario docs/proof/phase-3/scenarios/r6-charm.scenario.json`
- `e1-full-night1` (exit 0, sha256 dc1affee8bdd): `node src/headless/cli.ts --seed 1 --night 1 --ticks 21600 --out out/e1-full-night1.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/e1-full-night1.scenario.json`
- `e1-full-night2` (exit 0, sha256 c33f660026d0): `node src/headless/cli.ts --seed 1 --night 2 --ticks 21600 --out out/e1-full-night2.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/e1-full-night2.scenario.json`
- `e1-full-night3` (exit 0, sha256 dd83ccb6061e): `node src/headless/cli.ts --seed 1 --night 3 --ticks 21600 --out out/e1-full-night3.jsonl --snapshot-every 10 --scenario docs/proof/phase-3/scenarios/e1-full-night3.scenario.json`
