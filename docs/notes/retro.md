# Retro: Đảo Đèn Lồng, 4 phase làm cùng AI

Công cụ: Claude Code (VS Code), model Sonnet 5.5, **một phiên dài** cho cả 4 phase. Kết quả: 39 commit, khoảng 3.750 dòng TypeScript (mã và script) và 1.460 dòng test, 160 unit test, CI xanh trên Linux, 4 tag và Release `v1.0.0`.

## 1. Đánh giá từng phase

| Phase | Việc | Đạt | Điều học được |
|---|---|---|---|
| 1 (PRD-0, v1.0) | Lõi tất định, headless, bản 3D đầu | Có bằng chứng sinh bằng script, 66 test | Ghi giả định trước khi code giúp không đoán lại; hai commit đầu thiếu file (message nói có mà thực tế không) |
| 2 (Ticket-02, v1.1) | Số chuẩn mới, 3 bản đồ, Gió Lạc, Bùa, client 3 Đêm | 113 test, mutation 16/16, client 60 FPS | Ticket tự mâu thuẫn (quy ước góc, điểm xuất phát Đêm 3): tôi chọn và ghi giả định thay vì hỏi |
| 3 (Ticket-03, v1.2) | Đèn cạn dầu, thắng ở bình minh | ADR, 31 test mới, 11 test cũ sửa/xóa kèm lý do, mutation 22/22 | Change request đổi mục tiêu game nhưng chỉ chạm 11 test, nhờ test bám vào luật chứ không vào chi tiết cài đặt. **Client không theo kịp** |
| 4 (Ticket-04, v1.3) | Bench, soak, bảng xếp hạng, đóng gói | Soak, bench, bảng xếp hạng, Release chạy được trên thư mục sạch | Đo trước khi tối ưu; CI Linux đỏ 4 lần mà tôi không xem |

**Chưa đạt ở phase cuối:** đổi phím, cỡ chữ ≥ 18 px, giảm chuyển động, chỉ báo hình ảnh đầy đủ, thanh dầu, chế độ màu dễ phân biệt, video. Bench đạt nhưng 1% low sát ngưỡng (30,3 so với 30) và dao động theo máy.

## 2. Điều gì hiệu quả khi làm với AI
- **Viết test trước, rồi phá hằng số (mutation) để thử test.** Cách này bắt được test lỏng ít nhất 6 lần (FALL_Y, EXPEL_TICKS, độ rộng dốc, bán kính bục nhảy, hồi chiêu lướt khi có bùa...). Test xanh ngay lần đầu là tín hiệu cần nghi ngờ, không phải để ăn mừng.
- **Bằng chứng sinh từ lệnh chạy thật** (`npm run proof`), giá trị mong đợi tính tay từ ticket, và script của phase cũ tự từ chối chạy trên hợp đồng mới để không ghi đè bằng chứng đã tag.
- **Tách lõi khỏi hiển thị**: cùng `createSim` cho headless, client, bot, soak; sửa luật ở một chỗ.
- **ADR và CHANGELOG viết trước khi sửa mã** ở Phase 3 giúp liệt kê chính xác test nào bị luật mới làm sai.
- **Đo thay vì đoán.** Tôi đoán nút thắt bench là 200 Bóng Mực; đo cho thấy Bóng Mực chỉ góp khoảng 9 FPS còn HUD ghi DOM mỗi khung hình mới là nguyên nhân (75 lên 105 FPS).

## 3. Điều gì không hiệu quả
- Một phiên quá dài: ngữ cảnh phình, mỗi lượt đọc lại hàng chục triệu token.
- Client luôn đi sau lõi: đến Phase 4 vẫn còn nợ thanh dầu và chế độ màu từ Phase 3.
- Tin kết quả trên Windows mà không xem CI Linux; đo bench trên laptop chạy pin gây mất nhiều lượt vì số dao động.
- Giả định cho chỗ ticket nói thiếu (hành vi wander tới đèn, `refuel` không phát `deposit`) chưa được kiểm tra với giảng viên.

## 4. Những lần AI sai và cách phát hiện
| Lỗi của AI | Phát hiện bằng |
|---|---|
| Test sai hợp đồng (`move: [5,0]` ngoài [-1,1]) | Chạy test: code từ chối đúng |
| Hai commit thiếu file so với message | Đối chiếu `git status` với message |
| Cảnh quá tối, camera nhìn ngược hướng (typecheck và build đều sạch) | **Xem ảnh chụp thật** bằng Chrome |
| `proof` đạt 100% ngay lần đầu, nghi là đạt cho có | Mutation: phá hằng số, kiểm `proof` có trượt |
| Đổi tuning làm client không biên dịch | `npm run typecheck` ngay sau khi sửa |
| Bench chập chờn (treo, 1 khung hình sau 63 s) | Lặp lại 10+ lần, in lỗi trang, đọc nguồn điện (pin) |
| **Soak đỏ trên Linux (+28% bộ nhớ)** mà tôi không xem CI | Tình cờ chạy `gh run list`; xác nhận bằng log CI |

Quy tắc rút ra, đã đưa vào harness: kiểm tra `git status` sau mỗi commit; phá thử hằng số sau khi viết test; xem ảnh thật khi sửa client; xem CI sau mỗi push.

## 5. Harness nào giúp nhiều nhất
1. **AGENTS.md ngắn** với các quy ước chốt từ lỗi thật (nhiên liệu là số nguyên 1/60, không ghi DOM mỗi khung hình, thứ tự tick bắt buộc) và được cập nhật qua các phase.
2. **Hook `Stop`** chặn kết thúc khi typecheck hoặc test đỏ (có chốt chống vòng lặp).
3. **Skill `verify`**: quy trình typecheck, test, mutation, proof, đo hiệu năng.
4. Chốt chặn theo `contract_version` trong các script `proof`.

## 6. Token và chi phí (theo nhật ký phiên, mô hình `claude-sonnet-5-5`)
Tổng: **0,72 triệu token đầu ra**, 1,6 triệu ghi bộ nhớ đệm, **115,6 triệu đọc bộ nhớ đệm**, 240 lượt trả lời. Số này không phải số tiền (xem `ai-log.md`: bảng chi tiết theo phase và giới hạn của phép ước tính).

**Cách tiết kiệm:** AGENTS.md ngắn; chốt giả định và cách kiểm chứng trước khi code (ít làm lại); sửa theo từng điểm nhỏ thay vì viết lại file; chỉ chụp và đọc ảnh khi giao diện đổi lớn; dùng script để đo thay vì đọc kết quả bằng mắt; nén ngữ cảnh khi gần đầy.
**Chưa tiết kiệm được:** một phiên dài đọc lại ngữ cảnh lớn mỗi lượt (Phase 4 chiếm khoảng 49 triệu token đọc bộ nhớ đệm, nhiều nhất); lặp lại phép đo bench nhiều lần.

## 7. Nếu làm lại
- **Chia phiên theo phase** và để lại ghi chú bàn giao trong repo thay vì giữ một ngữ cảnh khổng lồ.
- **Xem CI sau mỗi lần push**, và thử trên Linux sớm, vì giảng viên chấm trên macOS/Linux.
- **Làm client song song với lõi** từng phase, có tiêu chí nghiệm thu riêng, để không dồn nợ giao diện về cuối.
- **Hỏi giảng viên/trợ giảng** những chỗ ticket mâu thuẫn (quy ước góc) thay vì tự quyết.
- **Đo bench sớm, khi cắm điện**, và đặt mục tiêu hiệu năng ngay từ Phase 2 thay vì để đến Phase 4.
- Dành thời gian cho **đổi phím và cỡ chữ** từ đầu (rẻ, có số đo) thay vì để cuối.
