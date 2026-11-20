# Phase 2: truy vết yêu cầu đến bằng chứng

Tái lập toàn bộ bằng chứng bằng **một lệnh**: `npm run proof`. Lệnh chạy CLI headless thật qua 42 tình huống, tự đối chiếu với giá trị tính tay từ [spec](../../notes/phase2-spec.md), chạy cả bộ unit test, đo thời gian một Đêm đầy đủ, rồi ghi [RESULTS.md](RESULTS.md), `runs/*.jsonl` (output thô), `scenarios/*.json` (đầu vào), `test-report.txt`. FPS của client đo riêng bằng `npm run fps` ([fps.json](fps.json)).

Bằng chứng ghi commit đã chạy (`RESULTS.md`). Chạy lại ở tag `phase-2` phải ra cùng kết quả: output headless tất định, so bằng sha256. Bằng chứng Phase 1 giữ nguyên ở [../phase-1/](../phase-1/README.md), khớp tag `phase-1`.

## Bảng truy vết (tiêu chí nghiệm thu trong spec, mục 3)

| AC | Yêu cầu (Ticket-02) | Bằng chứng | Kết quả |
|---|---|---|---|
| AC-P1 | Số chuẩn khớp ticket | Unit test `contract` (so từng số) | Đạt |
| AC-MOVE | Chạy 6 m/s, tăng/dừng <= 0.1 s | B1.a, B1.b; unit test `v11-core` | Đạt (giả định A1: gia tốc tuyến tính 60 m/s²) |
| AC-JUMP | Nhảy v=7, g=-20, chỉ khi chạm đất | B2; unit test | Đạt |
| AC-DASH | Lướt 14 m/s, 0.2 s, hồi 1.5 s, giữ độ cao trên không | B3.a; unit test | Đạt |
| AC-MOTE | 20 đom đóm ở 20 điểm, trần 30, +1 mỗi 240 tick, nhặt XZ <= 1.0 và chênh cao <= 1.5 | A1.a, B6.a; unit test | Đạt |
| AC-LANTERN | Cost 10, nạp nhiều lần, đèn gần nhất / id nhỏ, chỉ đèn chưa sáng | A1.b; unit test `v11-items` | Đạt |
| AC-SAFE | Vùng an toàn 6 m, đẩy ra tối đa 30 tick | A5; unit test | Đạt |
| AC-PULSE | 3 đom đóm, 5 m (3D), hồi 3 s, choáng 120, đẩy 4 m/15 tick | A3.a, A3.b; unit test | Đạt |
| AC-SHADE | 4.0/4.5 m/s, phát hiện 12/18, recoil, bất tử 90, lịch sinh | A2.a, A2.b, B6.b, C3.d; unit test | Đạt |
| AC-FALL | Rơi Y < -10 đúng 1 lần, hồi sinh sau 60 tick | B4.a, B4.b; unit test | Đạt |
| AC-END | Thứ tự thắng/thua, điểm | A1.c, A1.d, A2.b, A4 | Đạt |
| AC-ORDER | 12 bước mỗi tick đúng thứ tự | Cấu trúc `sim.ts` + các test hành vi; không có test riêng cho thứ tự | **Đạt một phần**: thứ tự được cài đúng theo ticket, nhưng không có test nào chỉ kiểm tra thứ tự |
| AC-DRIFT | Gió Lạc: sinh, đuổi, cướp, bỏ chạy, Tỏa Sáng | D1.a đến D1.d; unit test `v11-features` | Đạt (giả định A22) |
| AC-CHARM | Bùa Gió: 7.2 m/s, lướt không hồi chiêu, 600 tick, xuất hiện lại 2700 tick | D2.a đến D2.c; unit test | Đạt |
| AC-NIGHTS | Đêm 1, 2, 3 đúng bản đồ, bục nhảy, tầng, dốc, tháp, gió | C1.a đến C1.d, C2.a, C2.b, C3.a đến C3.c; unit test `v11-maps` | Đạt (giả định A18, A19) |
| AC-PAUSE | Tạm dừng đứng yên logic | B5; unit test | Đạt (headless) |
| AC-CONTRACT-1.1 | Snapshot, scenario, input, sự kiện, tên trạng thái, mã thoát | C1.a, C1.c, E1.1 đến E1.3, E2 | Đạt |
| AC-PERF (headless) | Một Đêm đầy đủ <= 30 s | F1: xem bảng thời gian trong RESULTS.md (dưới 0.3 s) | Đạt |
| AC-PERF (FPS) | >= 30 FPS ở 1280x720 | `fps.json`: 60.1 FPS trung bình (Intel UHD, Chrome 157) | **Đạt cho bản client hiện tại**, xem giới hạn |
| AC-FLOW | Menu, giới thiệu Đêm, chuỗi 3 Đêm, Bình Minh | Chưa làm | **Chưa đạt** |
| AC-SETTINGS | Cài đặt âm lượng và độ nhạy, lưu localStorage | Chưa làm | **Chưa đạt** |
| AC-AUDIO | Nhạc nền và 10 hiệu ứng | Chưa làm | **Chưa đạt** |
| AC-HUD | HUD đầy đủ, bảng màu chuẩn, mũi tên chỉ đèn | Client chỉ có HUD của Phase 1 | **Chưa đạt** |
| Client 3D Đêm 2, 3 | Dựng hình bản đồ mới, Gió Lạc, Bùa, gió | Chưa làm | **Chưa đạt** |

## Giới hạn đã biết (trung thực)

- **Bản client chưa đạt Phase 2.** Client chỉ chơi được Đêm 1 với giao diện Phase 1 (thêm phím Shift để lướt). Toàn bộ phần client của Phần 3 (chuỗi 3 Đêm, tạm dừng, cài đặt, âm thanh, HUD và bảng màu chuẩn, dựng hình Đêm 2 và 3) **chưa làm**. Phần headless (lõi mô phỏng và Contract v1.1) đã đủ cho Đêm 1, 2, 3.
- **FPS đo trên bản client hiện tại** (chỉ Đêm 1, người chơi đứng yên, vsync khóa ở 60). Chưa đo trên Đêm 2 và 3 vì client chưa vẽ chúng. Phải đo lại sau khi làm xong client.
- **Bằng chứng chỉ chứng minh code khớp giả định của tôi.** Test và code cùng dựa trên [phase2-spec.md](../../notes/phase2-spec.md). Rủi ro lớn nhất: A1 (cách tăng tốc), A8 (`spawning` 60 tick), A12 (nút tạm dừng), A18 (quy ước góc z = +r sin(a)), A19 (điểm xuất phát Đêm 3 là (0,0,-30)), A22 (Gió Lạc), A23 (`night_start` ở tick 1).
- **Kiểm tra đột biến** (phá một hằng số rồi xem test và `proof` có trượt không) đã chạy: unit test bắt 14 đột biến bản đồ/gió và 16 đột biến Gió Lạc/Bùa; `proof` bắt 6/6 đột biến thử. Một chỗ yếu: đổi vận tốc ngang của bục nhảy Đêm 3 chỉ unit test bắt, check C3.b của `proof` vẫn đạt vì Mây vẫn đáp lên tầng 2.
- Một đột biến tương đương đã biết: kéo dài dốc Đêm 3 quá r=30 không đổi hành vi (độ cao âm).
- Test của Phase 1 bị luật Ticket-02 thay (lý do trong [spec](../../notes/phase2-spec.md) mục 5 và [ai-log](../../notes/ai-log.md)); chúng được thay bằng test v1.1, không bị tắt âm thầm.
