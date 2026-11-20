# Phase 3: truy vết yêu cầu đến bằng chứng

Tái lập toàn bộ bằng chứng bằng **một lệnh**: `npm run proof`. Lệnh chạy CLI headless thật qua 45 tình huống, tự đối chiếu với giá trị tính tay từ Ticket-03 và [ADR-0001](../../notes/adr-0001-lantern-fuel.md), chạy cả bộ unit test, đo thời gian một Đêm đầy đủ, rồi ghi [RESULTS.md](RESULTS.md), `runs/*.jsonl`, `scenarios/*.json`, `test-report.txt`.

Chạy lại ở tag `phase-3` phải ra cùng kết quả (output headless tất định, so bằng sha256). Bằng chứng Phase 1 và 2 giữ nguyên ở [../phase-1/](../phase-1/README.md) và [../phase-2/](../phase-2/README.md), khớp các tag tương ứng; script của chúng (`proof:phase1`, `proof:phase2`) tự từ chối chạy trên v1.2 để không ghi đè.

Quyết định thiết kế: [ADR-0001](../../notes/adr-0001-lantern-fuel.md). Thay đổi phá vỡ tương thích: [CHANGELOG.md](../../../CHANGELOG.md). Test cũ bị luật mới làm sai: bảng trong [ai-log](../../notes/ai-log.md) (11 test, mỗi cái sửa hoặc xóa kèm lý do, không có test nào bị skip).

## Bảng truy vết

| AC | Yêu cầu (Ticket-03) | Bằng chứng | Kết quả |
|---|---|---|---|
| AC-FUEL | Đèn có dầu 100, hao 1/giây (tính theo tick), hết dầu thì tắt, `lantern_out`, giữ `ever_lit` | A1.a, A1.b; unit test `v12-fuel` | Đạt |
| AC-REFUEL | Châm dầu: `min(đang mang, ceil((100-fuel)/10))`, +10 dầu mỗi đom đóm, sự kiện `refuel`; chọn đèn nhận được gần nhất, hòa thì id nhỏ | A2; unit test | Đạt (xem rủi ro 1) |
| AC-LIGHT | Thắp lần đầu 10, thắp lại 5; `relight`; `relit_count`; thứ tự trong tick (tắt rồi mới nạp) | A3.a, A3.b, A3.c | Đạt |
| AC-CAPACITY | Sức chứa `10 + 2 x lần thắp thành công`, tối đa 20; đèn đặt sẵn không tính | A4, D1.b; unit test | Đạt |
| AC-DRAIN | Đèn < 30 dầu mất vùng an toàn; wander chọn đèn yếu nhất; hút 5/s trong 2 m; `fuel_drain` mỗi 60 tick; thoát `drain` về chase / stunned / wander; châm lên ≥ 30 thì đẩy Bóng Mực ra | B1.a đến B1.d, B2, B3, B4, B6; unit test `v12-drain` | Đạt (xem rủi ro 2) |
| AC-WIN | Hết giờ thì thắng nếu sống và đủ ≥ ceil(0.6 x tổng) đèn; `dawn_survived`; không thắng sớm; `no_flames` luôn thắng thế; 240/270/300 s | C1.a, C1.b, C2, C3.a đến C3.c, C4 | Đạt |
| AC-SCORE | +5/đom đóm nạp, +100 thắp đầu, +40 thắp lại, Tỏa Sáng +5 (+15 nếu đang drain), bình minh +50 + floor(fuel) mỗi đèn và +50 mỗi lửa, bỏ thưởng thời gian | A2, A3, B5, C1.a; unit test `contract` | Đạt |
| AC-CONTRACT-1.2 | Snapshot, scenario, sự kiện, lý do kết thúc, tất định, mã thoát | D1.a đến D1.c, D2.1 đến D2.3, D3 | Đạt |
| AC-REGRESSION | Test ẩn Phase 1-2 không bị thay thế vẫn đạt | R1 đến R6 (va chạm, Tỏa Sáng, di chuyển, lướt, rơi, tạm dừng, lịch sinh, bục nhảy, gió, Gió Lạc, Bùa) và toàn bộ unit test Phase 1-2 còn hiệu lực | Đạt |
| AC-PERF | Một Đêm đầy đủ headless <= 30 s | E1: dưới 0.35 s mỗi Đêm | Đạt |
| AC-UI-FUEL | Thanh dầu trên đèn đang sáng; nhấp nháy 1 Hz khi dầu < 30 | Chưa làm | **Chưa đạt** |
| AC-UI-HUD | HUD hiển thị mang / sức chứa | `src/web/main.ts` đã đọc `capacity` từ lõi; chưa chụp ảnh kiểm tra | **Đạt một phần**: đã cài đặt, **chưa kiểm chứng bằng ảnh** |
| AC-COLORBLIND | Cài đặt "Bảng màu dễ phân biệt": viền và mắt Bóng Mực #00B3FF, cảnh báo #FFFFFF kèm ⚠, đèn tắt xẹp 20% và có vết rách, đèn sắp hết dầu nhấp nháy | Chưa làm | **Chưa đạt** |
| Client: kết thúc ở bình minh | Màn kết quả cho `dawn_survived`; toast `refuel`, `lantern_out` | Client hiển thị theo `state` nên Đêm vẫn kết thúc đúng; chưa có toast cho `refuel` / `lantern_out`, chưa chụp ảnh | **Chưa kiểm chứng** |

## Rủi ro và giới hạn đã biết (trung thực)

1. **"Đèn đầy dầu không được chọn" gần như không xảy ra** do thứ tự trong tick: dầu hao ở bước 2, trước khi tương tác ở bước 5, nên đèn vừa đầy luôn thiếu 1/60 khi người chơi bấm. Tôi bám đúng thứ tự ticket nêu (và test refuel dùng dầu 55 để tránh nhập nhằng), nhưng test ẩn có thể kỳ vọng khác.
2. **Hai giả định của tôi, ticket không nêu:** Bóng Mực `wander` đi tới đèn mục tiêu với `shade_speed` (4 m/s); `refuel` không phát `deposit`. Đây là chỗ dễ lệch với test ẩn nhất. Hành vi "đi về đèn tắt gần nhất như trước" thực ra là mới (Phase 2 của tôi chưa có).
3. **Client chưa làm đủ Phase 3.** Lõi mô phỏng đã chuyển sang v1.2, nhưng client mới chỉ được vá để biên dịch và chạy (hiển thị sức chứa, văn bản luật). Thanh dầu, nhấp nháy, chế độ màu dễ phân biệt và kết quả ở bình minh chưa có; chưa chụp ảnh hay đo FPS cho Phase 3.
4. **Bằng chứng chỉ chứng minh code khớp giả định của tôi** (spec ADR-0001), chưa chắc khớp test ẩn.
5. **Kiểm tra đột biến** đã chạy: 22 đột biến hằng số và điều kiện của luật mới bị unit test bắt hết; `proof` bắt 7/8 đột biến thử. Chỗ yếu: đổi `DRAIN_RANGE` chỉ unit test bắt; đổi `relight_cost` làm script sập thay vì báo trượt có kiểm soát.
6. Đầu ra của Phase 2 bị đổi có chủ đích: điểm, thời lượng, điều kiện thắng. Không có hồi quy ngoài ý muốn nào được phát hiện: các hành vi không bị ticket thay thế (R1 đến R6) vẫn cho kết quả cũ.
