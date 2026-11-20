# Phase 4: truy vết yêu cầu đến bằng chứng

Tái lập bằng **một lệnh**: `npm run proof`. Lệnh chạy lại các luật headless của Phase 1–3 qua CLI thật (hồi quy), chạy soak, kiểm tra bảng xếp hạng qua lệnh xuất, đọc `bench.json` và `soak.json` đã commit, chạy bộ unit test, rồi ghi [RESULTS.md](RESULTS.md), `runs/`, `scenarios/`, `test-report.txt`. Bench cần cửa sổ trình duyệt thật nên **không** được chạy lại trong `proof`; dùng `npm run bench`.

Bằng chứng Phase 1, 2, 3 giữ nguyên ở các thư mục của chúng (khớp tag); `proof:phase1/2/3` tự từ chối chạy trên v1.3 để không ghi đè.

## Bảng truy vết (Ticket-04)

| Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|
| **Bench**: cảnh chuẩn (200 Bóng Mực wander, 100 đom đóm, L1-L3 sáng fuel 100, tắt sát thương/nhặt/hao dầu/kết thúc, camera bay vòng r=30 y=15 15 s/vòng), 3 s khởi động, đo `--duration`, ghi `bench.json` với đúng công thức | `scripts/bench.ts`, `src/web/main.ts` (`startBench`), [../../../bench.json](../../../bench.json); proof I1.a đến I1.c | **Đạt trên máy đã đo, biên mỏng**: avg 92,7 FPS (≥ 60), 1% low 30,3 (≥ 30), tải 2,6 s (≤ 10). Ba lần đo: avg 92,4–98,4, 1% low **29,6–35,2** (một lần dưới ngưỡng 0,4). Máy chấm khác sẽ cho số khác |
| **Soak**: 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed, đếm lỗi, RSS đầu/cuối | `scripts/soak.ts`, [../../../soak.json](../../../soak.json); proof G1.a đến G1.d; 4 unit test | **Đạt**: 0 lỗi, 56,4 → 63 MB (+11,7%, ngưỡng +20%). Cả 10 Đêm kết thúc "lost" vì input ngẫu nhiên hay rơi khỏi đảo (theo mô hình input của ticket) |
| **Bảng xếp hạng**: tên 3–12 ký tự, top 10, thứ tự điểm rồi thời gian, lưu đĩa, màn hình từ menu, `--export-leaderboard` | 12 unit test; `npm run e2e:leaderboard` (14/14, Chrome thật: thua, tên sai bị từ chối, tên có dấu được nhận, tắt rồi bật lại máy chủ vẫn còn điểm, xuất đúng); proof H1.a đến H1.d; ảnh trong `screens/` | **Đạt** |
| **Đổi phím** (mọi hành động, báo trùng, khôi phục mặc định, lưu bền) | Chưa làm | **Chưa đạt** |
| **Chỉ báo hình ảnh** (Bóng Mực xuất hiện kèm mũi tên chỉ hướng, gió sắp thổi, 10 s cuối, đèn dầu < 30) | Gió sắp thổi đã có biểu ngữ (Phase 2); phần còn lại chưa làm | **Đạt một phần** (1/4) |
| **Giảm chuyển động** (tắt rung camera và chớp màn hình) | Chưa làm (game hiện không có rung camera; chớp màn hình khi bị đánh vẫn bật) | **Chưa đạt** |
| **Cỡ chữ UI** ≥ 18 px ở 1280×720; tùy chọn chữ lớn ×1,25 | Chưa làm (nhiều chỗ HUD đang 12–16 px) | **Chưa đạt** |
| **Đóng gói**: README đủ mục, CHANGELOG 4 phase, CREDITS, LICENSE, Release `v1.0.0` chạy được | LICENSE có sẵn; README, CHANGELOG, CREDITS cần cập nhật; Release chưa tạo | **Chưa đạt** |
| **Contract v1.3** (`bench_cmd`, `soak_cmd`, luật v1.0–v1.2 giữ nguyên) | proof F1, unit test `contract`, nhóm hồi quy R1–R6 và các nhóm A–D chạy lại với v1.3 | **Đạt** |
| **Retro** (1–2 trang) và **video demo** | Chưa làm | **Chưa đạt** |
| Còn nợ từ Phase 3 (client): thanh dầu, nhấp nháy khi dầu < 30, chế độ màu dễ phân biệt, toast `refuel`/`lantern_out` | Chưa làm | **Chưa đạt** |

## Rủi ro và giới hạn đã biết (trung thực)

1. **Bench dao động và sát ngưỡng 1% low trên máy này** (GPU tích hợp Intel). Nguyên nhân tìm được: nút thắt là HUD ghi DOM mỗi khung hình (đã sửa), laptop chạy pin bị giảm xung (`power_source` được ghi vào `bench.json`), Chrome tạm dừng khung hình khi cửa sổ bị che (đã thêm theo dõi tiến độ, đưa cửa sổ lên trước, và tự chạy lại headless nếu cửa sổ lỗi). Khử răng cưa (MSAA) là chi phí lớn còn lại; tôi giữ nguyên để cảnh bench "như lúc chơi thật".
2. **Số bench trong repo là của một máy**, chạy khi cắm điện, lấy lần ở giữa trong ba lần. Ticket nói máy chấm của giảng viên là thước đo chính thức.
3. **Bench cần Chrome, Edge hoặc Chromium** có sẵn trên máy (điều khiển qua `puppeteer-core`). Ghi `peak_mem_mb` là bộ nhớ của cả cây tiến trình trình duyệt.
4. **Soak chủ yếu kiểm tra độ ổn định của logic**: mỗi Đêm thua nhanh nên tổng chỉ khoảng 22.000 tick.
5. **Các giả định dễ lệch test ẩn** của Phase 1–3 vẫn như đã ghi (Bóng Mực wander đi tới đèn ở 4 m/s, `refuel` không phát `deposit`, quy ước góc `z = +r·sin(a)`, xuất phát Đêm 3 ở (0,0,−30), `night_start` ở tick 1).
6. Mutation check nhóm mới: 6/6 đột biến bị `proof` bắt; bảng xếp hạng 10/11 bị unit test bắt (1 đột biến tương đương).
