# ADR-0001: Đèn có nhiên liệu, luật thắng chuyển sang "sống tới bình minh"

Trạng thái: chấp nhận (Phase 3, Ticket-03, Contract v1.2). Thay thế các quyết định trước về "đèn sáng là sáng mãi" và "thắng khi tất cả đèn sáng".

## Bối cảnh
Playtest cho thấy người chơi giỏi thắp hết đèn trong 2 phút rồi game kết thúc. Nhà thiết kế đổi mục tiêu: giữ đảo sáng tới bình minh. Điều này đòi hỏi đèn phải có thể tắt, tức là đổi mô hình trạng thái của đèn.

## Quyết định

### 1. Mô hình trạng thái đèn
Trước: `lit: boolean` và `deposited`. Đèn thắp xong không đổi nữa.
Sau, mỗi đèn có:

| Trường | Ý nghĩa |
|---|---|
| `lit` | đang sáng |
| `fuel` | 0..100; chỉ có nghĩa khi đang sáng, đèn tắt luôn báo 0 |
| `ever_lit` | đã từng sáng; quyết định chi phí thắp (10 lần đầu, 5 khi thắp lại) |
| `relit_count` | số lần thắp lại |
| `deposited` | tiến độ nạp cho đèn đang tắt; về 0 khi đèn hết dầu |

Vòng đời: tắt → (đủ đom đóm) → sáng, fuel = 100 → hao dần → (fuel ≤ 0) tắt, `ever_lit` giữ nguyên → có thể thắp lại với 5 đom đóm.

### 2. Nhiên liệu tính bằng số nguyên
`fuel` nội bộ là số nguyên theo 1/60 đơn vị (một tick hao đúng 1 đơn vị). Lý do: tránh sai số số thực tích lũy qua 18.000 tick (ticket gợi ý rõ), giữ tính tất định. Chỉ làm tròn 1 chữ số thập phân khi xuất. Mốc "fuel < 30" so sánh trên số nguyên (đúng 30 thì còn vùng an toàn).

### 3. Hao dầu và hút dầu nằm ở bước 2 của tick
Hao 1/giây và hút 5/giây của mỗi Bóng Mực `drain` trừ ở bước 2; đèn có fuel ≤ 0 tắt ngay sau bước 2 (trước khi Mây di chuyển). Lý do: ticket yêu cầu đúng thứ tự này; nó đảm bảo một đèn hết dầu không còn được nạp trong cùng tick.

### 4. Bóng Mực có thêm một trạng thái `drain`
Wander chọn đèn yếu (sáng, fuel < 30) gần nhất, bằng nhau thì id nhỏ; không có thì đi về đèn tắt gần nhất. Tới trong 2 m thì đứng yên hút 5 dầu/giây. Thoát `drain` theo thứ tự ưu tiên: Mây vào trong 6 m (sang `chase`), trúng Tỏa Sáng (sang `stunned`), rồi đèn tắt / dầu ≥ 30 / cách đèn > 2 m (sang `wander`).
Vùng an toàn chỉ còn với đèn sáng có fuel ≥ 30.
Giả định của tôi (ticket không nêu): Bóng Mực wander đi tới đèn mục tiêu với tốc độ `shade_speed`. Phase 2 của tôi chỉ có wander ngẫu nhiên, nên hành vi "đi tới đèn" là mới.

### 5. Luật thắng/thua xét ở cuối tick, không còn thắng sớm
Thứ tự: hết Ngọn Lửa thì thua `no_flames`; hết giờ mà số đèn sáng ≥ ceil(0.6 × tổng) thì thắng `dawn_survived`; hết giờ mà thiếu đèn thì thua `dawn`. `all_lit` không còn được dùng. Thời gian giảm còn 240/270/300 s.

### 6. Sức chứa và điểm
Sức chứa = min(20, 10 + 2 × lần thắp thành công); lần thắp thành công gồm cả thắp lại, không gồm châm dầu và đèn đặt sẵn bằng scenario. Điểm theo bảng mới (không còn thưởng thời gian); điểm bình minh tính theo fuel tại tick cuối.

## Hệ quả
- Test Phase 2 dựa trên `all_lit`, điểm cũ, thời lượng 300/330/360, nạp vào đèn đang sáng đều sai theo luật mới. Chúng được viết lại ở `tests/v12-*.test.ts`; lý do ghi ở `docs/notes/ai-log.md`. Bằng chứng Phase 2 giữ nguyên ở tag `phase-2`.
- Client phải thêm thanh dầu, đèn nhấp nháy khi fuel < 30, hiển thị `mang / sức chứa`, kết thúc Đêm ở bình minh và chế độ màu dễ phân biệt.
- Rủi ro đã biết: hành vi "wander đi tới đèn" và việc `refuel` không phát `deposit` là suy đoán của tôi; có thể lệch với test ẩn.

## Phương án đã cân nhắc
- Dầu dạng số thực: bị loại vì sai số tích lũy và khó bảo đảm tất định.
- Giữ `all_lit` làm điều kiện thắng song song: bị loại vì ticket nói rõ "không còn thắng sớm".
