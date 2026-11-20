# Phase 1 — Kết quả bằng chứng (sinh tự động)

> File này do `npm run proof` sinh ra từ lần chạy thật của CLI headless. Không sửa tay.
> Giá trị mong đợi nằm trong `scripts/proof.ts` và được tính tay từ `docs/notes/assumptions.md`.

- Code commit khi chạy: `fcbb454` (+uncommitted changes in code)
- Node v26.13.1, win32 x64
- Unit tests: 66/66 đạt (chi tiết: `test-report.txt`)
- Kiểm tra end-to-end: 23/23 đạt

| ID | Yêu cầu | Điều được kiểm tra | Kết quả |
|---|---|---|---|
| C1.a | R3 | walking +Z picks all 8 motes in order (carried 1..8) | ĐẠT |
| C1.b | R4 | interact at 2 m deposits 8 into L5 then lights it (deposit before lantern_lit) | ĐẠT |
| C1.c | R8 | all lit => game_over won/all_lit, end.state won, run stops at tick 101 | ĐẠT |
| C1.d | R14 | score = 80 (motes) + 100 (lantern) + 298 (s left) + 150 (flames) = 628 | ĐẠT |
| C1.e | R1 | first line is snapshot tick 0, last line is end | ĐẠT |
| C2.a | R6 | 3 hits: flames 2,1,0 and dropped floor(carried*0.5) = 5,2,1 | ĐẠT |
| C2.b | R6 | invulnerable 1.5 s (90 ticks) between hits | ĐẠT |
| C2.c | R6 | game_over lost/no_flames right after the 3rd hit, score 0 (no bonus on loss) | ĐẠT |
| C3.a | R5 | pulse at tick 1 stuns only S1 (4 m in radius 6), not S2 (20 m) | ĐẠT |
| C3.b | R5 | cost 2 (carried 5 -> 3); S1 pushed 3 m away (x 4 -> 7) and stunned | ĐẠT |
| C3.c | R5 | stun lasts 3 s: stunned at tick 100, chasing again at tick 200 | ĐẠT |
| C3.d | R14 | score is 25 (one stun) | ĐẠT |
| C4 | R7 | time runs out => game_over lost/dawn at tick 60, run stops at 60 | ĐẠT |
| C5 | R9 | shade approaches lit lantern but never closer than safe_radius 5 (min over 600 ticks) | ĐẠT |
| C6.a | R10 | same seed/scenario/inputs twice => byte-identical (sha256 56455d52bec5...) | ĐẠT |
| C6.b | R10 | different seed => different output | ĐẠT |
| C6.c | R12 | no coordinate has more than 3 decimals | ĐẠT |
| C6.d | R1 | snapshots every 10 ticks from 0 (default) | ĐẠT |
| C7.a | R11 | valid run exits 0 | ĐẠT |
| C7.b | R11 | invalid JSON inputs exits 2 with a message on stderr | ĐẠT |
| C7.c | R11 | non-increasing frame ticks exits 2 | ĐẠT |
| C7.d | R11 | missing required args exits non-zero | ĐẠT |
| UT | all | unit test suite: 66/66 pass | ĐẠT |

## Lệnh tái lập từng lần chạy

- `c1-win` (exit 0, sha256 dd015e9aa0cf): `node src/headless/cli.ts --seed 1 --night 1 --ticks 400 --out docs/proof/phase-1/runs/c1-win.jsonl --snapshot-every 10 --scenario docs/proof/phase-1/scenarios/c1-win.scenario.json --inputs docs/proof/phase-1/scenarios/c1-win.inputs.json`
- `c2-lose` (exit 0, sha256 cbf3c64e9993): `node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out docs/proof/phase-1/runs/c2-lose.jsonl --snapshot-every 10 --scenario docs/proof/phase-1/scenarios/c2-lose.scenario.json`
- `c3-pulse` (exit 0, sha256 e7adccb0a988): `node src/headless/cli.ts --seed 1 --night 1 --ticks 250 --out docs/proof/phase-1/runs/c3-pulse.jsonl --snapshot-every 10 --scenario docs/proof/phase-1/scenarios/c3-pulse.scenario.json --inputs docs/proof/phase-1/scenarios/c3-pulse.inputs.json`
- `c4-dawn` (exit 0, sha256 9c4bad4451cc): `node src/headless/cli.ts --seed 1 --night 1 --ticks 1000 --out docs/proof/phase-1/runs/c4-dawn.jsonl --scenario docs/proof/phase-1/scenarios/c4-dawn.scenario.json`
- `c5-safe` (exit 0, sha256 e9e1532fee8a): `node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out docs/proof/phase-1/runs/c5-safe.jsonl --snapshot-every 1 --scenario docs/proof/phase-1/scenarios/c5-safe.scenario.json`
- `c6-det-a` (exit 0, sha256 56455d52bec5): `node src/headless/cli.ts --seed 42 --night 1 --ticks 1500 --out docs/proof/phase-1/runs/c6-det-a.jsonl --scenario docs/proof/phase-1/scenarios/c6-det-a.scenario.json --inputs docs/proof/phase-1/scenarios/c6-det-a.inputs.json`
- `c6-det-b` (exit 0, sha256 56455d52bec5): `node src/headless/cli.ts --seed 42 --night 1 --ticks 1500 --out docs/proof/phase-1/runs/c6-det-b.jsonl --scenario docs/proof/phase-1/scenarios/c6-det-b.scenario.json --inputs docs/proof/phase-1/scenarios/c6-det-b.inputs.json`
- `c6-det-other-seed` (exit 0, sha256 4c9e8559b12a): `node src/headless/cli.ts --seed 43 --night 1 --ticks 1500 --out docs/proof/phase-1/runs/c6-det-other-seed.jsonl --scenario docs/proof/phase-1/scenarios/c6-det-other-seed.scenario.json --inputs docs/proof/phase-1/scenarios/c6-det-other-seed.inputs.json`
- `c7-ok` (exit 0, sha256 365436506c8a): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-1/runs/c7-ok.jsonl`
- `c7-bad-json` (exit 2, sha256 e3b0c44298fc): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-1/runs/c7-bad-json.jsonl --inputs docs/proof/phase-1/scenarios/c7-bad-json.inputs.json`
- `c7-bad-order` (exit 2, sha256 e3b0c44298fc): `node src/headless/cli.ts --seed 1 --night 1 --ticks 10 --out docs/proof/phase-1/runs/c7-bad-order.jsonl --inputs docs/proof/phase-1/scenarios/c7-bad-order.inputs.json`
