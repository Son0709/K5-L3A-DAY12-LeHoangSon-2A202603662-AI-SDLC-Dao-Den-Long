# Phase 1: truy vết yêu cầu đến bằng chứng

Tái lập toàn bộ bằng chứng bằng **một lệnh**: `npm run proof`. Lệnh chạy CLI headless thật, đối chiếu với giá trị tính tay, và ghi lại [RESULTS.md](RESULTS.md) (kết quả từng check), `runs/*.jsonl` (output thô), `scenarios/*.json` (đầu vào), `test-report.txt` (báo cáo unit test).

Bằng chứng khớp mã: `RESULTS.md` ghi commit đã chạy. Chạy lại ở tag `phase-1` phải ra cùng kết quả (output headless tất định, so bằng sha256).

Giả định và số tuning: [../../notes/assumptions.md](../../notes/assumptions.md).

## Bảng truy vết

| ID | Yêu cầu (PRD-0 / Contract v1.0) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R1 | Mô hình tick, snapshot từ tick 0, dòng `end` | Unit test `core`, check C1.e, C6.d | RESULTS.md, `runs/c1-win.jsonl` | Đạt |
| R2 | Đi lại, xoay camera, chuẩn hóa vector, rìa đảo, nhảy | Unit test `core` (chỉ unit test) | `test-report.txt` | Đạt (headless). Cảm giác điều khiển 3D: chưa có |
| R3 | Nhặt đom đóm (ngưỡng ≤ r, sức chứa) | Unit test `lanterns`, check C1.a | `runs/c1-win.jsonl` | Đạt |
| R4 | Nạp ánh sáng và thắp đèn | Unit test `lanterns`, check C1.b | `runs/c1-win.jsonl` | Đạt |
| R5 | Tỏa sáng xua Bóng Mực (cost, đẩy, choáng, cooldown) | Unit test `shades`, check C3.a đến C3.c | `runs/c3-pulse.jsonl` | Đạt |
| R6 | Bóng Mực đuổi, chạm mất máu, bất tử tạm, thua | Unit test `shades`, check C2.a đến C2.c | `runs/c2-lose.jsonl` | Đạt |
| R7 | Hết đêm (dawn) thì thua | Unit test `lanterns`, check C4 | `runs/c4-dawn.jsonl` | Đạt |
| R8 | Thắp hết đèn thì thắng | Check C1.c | `runs/c1-win.jsonl` | Đạt |
| R9 | Bóng Mực không vào vùng an toàn quanh đèn sáng | Unit test `shades`, check C5 | `runs/c5-safe.jsonl` | Đạt |
| R10 | Tất định (cùng đầu vào, cùng đầu ra) | Check C6.a, C6.b; unit test `determinism`, `cli` | `runs/c6-det-*.jsonl` (sha256 trong RESULTS.md) | Đạt |
| R11 | Mã thoát 0 / 2 / khác 0 | Check C7.a đến C7.d; unit test `cli` | RESULTS.md | Đạt |
| R12 | Tọa độ làm tròn 3 chữ số | Check C6.c | RESULTS.md | Đạt |
| R14 | Điểm số theo bảng tuning | Check C1.d, C3.d; unit test | RESULTS.md | Đạt |
| R15 | `game.contract.json` khai đúng tuning | Unit test `contract` | `test-report.txt` | Đạt |
| R13 | Game 3D chơi được, HUD, chơi lại, Mây đội nón lá | Ảnh chụp bản build thật (Chrome headless); bot tham lam chơi qua lõi `createSim` (`node scripts/bot.ts`) | `screens/menu.png`, `screens/play-start.png`, `bot-playability.txt` | **Đạt một phần**: cảnh 3D, HUD, nón lá + đèn nhỏ render đúng; ván thắng được (bot 20/20). **Chưa có** bằng chứng người chơi thật chơi trọn ván trên trình duyệt, và chưa chụp màn thắng/thua |

## Giới hạn đã biết (trung thực)

- **Bằng chứng này chỉ chứng minh code khớp giả định của tôi.** Test và code cùng dựa trên [assumptions.md](../../notes/assumptions.md). Chưa có cách biết khớp với test ẩn của giảng viên. Rủi ro lớn nhất: giả định 7 (điều kiện tỏa sáng), 9 (đèn chưa sáng không cản Bóng Mực), 11 (đom đóm rơi mất hẳn).
- Mutation check đã chạy một lần: đổi `per_lantern` từ 100 thành 101 làm test và `proof` thất bại như mong đợi (350 so với 349), nên các check không đạt vô điều kiện.
- Sự kiện `dash` không có trong game (contract chỉ nói "nếu có").
- R2: phần logic đã có test; cảm giác điều khiển và camera trong bản 3D chưa được kiểm chứng bằng chơi tay.
- Bot chơi dễ: thắng 20/20 seed, chỉ bị chạm 1 lần trong 20 ván. Bot chỉ chứng minh ván **thắng được**, không chứng minh game **thú vị**. Độ khó có thể thấp với người chơi, tuning bị khóa theo contract (`shade_speed` 4 so với `player_speed` 6).
- Ảnh chụp dùng WebGL phần mềm (SwiftShader) nên không phản ánh hiệu năng thật; số đo hiệu năng thuộc Phase sau.
