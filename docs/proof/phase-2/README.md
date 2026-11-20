# Phase 2: truy vết yêu cầu đến bằng chứng

Tái lập toàn bộ bằng chứng bằng **một lệnh**: `npm run proof`. Lệnh chạy CLI headless thật qua 42 tình huống, tự đối chiếu với giá trị tính tay từ [spec](../../notes/phase2-spec.md), chạy cả bộ unit test, đo thời gian một Đêm đầy đủ, rồi ghi [RESULTS.md](RESULTS.md), `runs/*.jsonl` (output thô), `scenarios/*.json` (đầu vào), `test-report.txt`. FPS của client đo riêng bằng `npm run fps` ([fps.json](fps.json)); ảnh chụp và kiểm tra tự động của client bằng `npm run screens` (thư mục [screens/](screens/)). Cả hai cần Chrome.

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
| AC-PERF (FPS) | >= 30 FPS ở 1280x720 | `fps.json` (`npm run fps`): 60.1 / 60.1 / 60.0 FPS trung bình ở Đêm 1/2/3 (Intel UHD, Chrome 157) | Đạt (người chơi đứng yên, vsync khóa ở 60) |
| AC-FLOW | Menu, giới thiệu Đêm, chuỗi 3 Đêm, Bình Minh | `screens/01`, `02`, `08`; `npm run screens` kiểm tra menu → giới thiệu → chơi và thua → "Chơi lại Đêm" (đồng hồ về 5:00, 3 ngọn lửa) | **Đạt một phần**: đã chạy thật menu, giới thiệu Đêm 1/2/3, thua và chơi lại. **Chưa chạy thật** nhánh thắng → Đêm kế tiếp → Bình Minh (đã viết, chưa có kịch bản tự động thắng ván) |
| AC-PAUSE (client) | Esc/P tạm dừng; Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | `screens/04`; kiểm tra đồng hồ đứng yên 2.2 s khi tạm dừng (4:57 → 4:57) | Đạt (các nút Tiếp tục, Về menu chưa bấm thử tự động; "Chơi lại Đêm" và "Cài đặt" đã bấm) |
| AC-SETTINGS | Âm lượng và độ nhạy chuột, lưu giữa các lần mở | `screens/05`; đặt 25% và 140% rồi tải lại trang: localStorage giữ `{"volume":0.25,"sensitivity":1.4}` | Đạt (việc lưu đã kiểm chứng; hiệu lực của độ nhạy khi kéo chuột chưa đo) |
| AC-AUDIO | Nhạc nền và 10 hiệu ứng | Mã trong `src/web/audio.ts` (Web Audio, tổng hợp tại chỗ, không dùng file âm thanh); chạy cả phiên chụp ảnh không phát sinh lỗi trình duyệt (0 lỗi) | **Đạt một phần**: **chưa nghe thử** (môi trường tự động không phát được âm thanh), nên âm lượng và chất lượng chưa được đánh giá |
| AC-HUD | Bố cục, bảng màu chuẩn, nhắc nạp đèn, mũi tên chỉ đèn | `screens/03`, `06`, `07`, `09`, `10`: Ngọn Lửa trên trái, đồng hồ giữa, đèn + điểm phải, thanh 10 ô dưới giữa, hồi chiêu Lướt/Tỏa Sáng dưới phải, mũi tên khi đèn ngoài màn hình, huy hiệu Bùa | **Đạt một phần**: bảng màu được áp dụng cho vật liệu và CSS theo mã hex của ticket nhưng **chưa đo bằng pixel** (màu hiển thị chịu ảnh hưởng của ánh sáng); đồng hồ đổi đỏ và nhấp nháy ở ≤ 30 s chưa chụp; nhắc "E — Nạp ánh sáng" chưa chụp |
| Client 3D Đêm 2, 3 | Dựng hình bản đồ mới, Gió Lạc, Bùa, gió | `screens/06` (cầu tre, hai đảo), `07` (tầng, dốc, tháp), `09` (nhặt Bùa Gió), `10`, `11` (cảnh báo gió, lá bay, biểu ngữ) | **Đạt một phần**: bản đồ, Bùa, gió đã thấy tận mắt. **Chưa thấy** Gió Lạc và bục nhảy trong ảnh chụp |

## Giới hạn đã biết (trung thực)

- **Client chưa được chơi thử bằng tay trọn vẹn.** Mọi kiểm chứng client ở trên do script tự động (`npm run screens`) và ảnh chụp. Chưa ai chơi một ván hoàn chỉnh trên Đêm 2 hoặc 3, nên cảm giác điều khiển, độ khó, va chạm với địa hình (tầng, dốc, tháp) khi chơi thật chưa được đánh giá. Logic địa hình đã được unit test ở phần headless.
- **Chưa kiểm chứng:** nhánh thắng → Đêm kế tiếp → Bình Minh, âm thanh (chưa nghe), Gió Lạc và bục nhảy trong cảnh 3D, đồng hồ đỏ nhấp nháy ở 30 s cuối, tiếng đếm ngược 10 s.
- **FPS đo khi người chơi đứng yên** ở đầu mỗi Đêm, vsync khóa ở 60. Cảnh đông hơn (nhiều Bóng Mực, đom đóm, Gió Lạc, lá gió) có thể thấp hơn; chưa đo.
- **Mã nguồn client không có unit test**; phần hiển thị chỉ được kiểm chứng bằng ảnh và script tự động.
- **Bằng chứng chỉ chứng minh code khớp giả định của tôi.** Test và code cùng dựa trên [phase2-spec.md](../../notes/phase2-spec.md). Rủi ro lớn nhất: A1 (cách tăng tốc), A8 (`spawning` 60 tick), A12 (nút tạm dừng), A18 (quy ước góc z = +r sin(a)), A19 (điểm xuất phát Đêm 3 là (0,0,-30)), A22 (Gió Lạc), A23 (`night_start` ở tick 1).
- **Kiểm tra đột biến** (phá một hằng số rồi xem test và `proof` có trượt không) đã chạy: unit test bắt 14 đột biến bản đồ/gió và 16 đột biến Gió Lạc/Bùa; `proof` bắt 6/6 đột biến thử. Một chỗ yếu: đổi vận tốc ngang của bục nhảy Đêm 3 chỉ unit test bắt, check C3.b của `proof` vẫn đạt vì Mây vẫn đáp lên tầng 2.
- Một đột biến tương đương đã biết: kéo dài dốc Đêm 3 quá r=30 không đổi hành vi (độ cao âm).
- Test của Phase 1 bị luật Ticket-02 thay (lý do trong [spec](../../notes/phase2-spec.md) mục 5 và [ai-log](../../notes/ai-log.md)); chúng được thay bằng test v1.1, không bị tắt âm thầm.
