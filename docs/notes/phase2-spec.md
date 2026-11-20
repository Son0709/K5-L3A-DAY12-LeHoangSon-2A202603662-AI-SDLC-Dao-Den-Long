# Phase 2 (Ticket-02, Contract v1.1): spec, giả định, tiêu chí nghiệm thu

Nguồn: Ticket-02 "Ba hòn đảo". Số liệu chuẩn nằm trong `game.contract.json` (v1.1) và **thay thế** mọi số Phase 1. Tài liệu này ghi (1) những gì đổi so với Phase 1, (2) các giả định cho chỗ ticket chưa nói, (3) tiêu chí nghiệm thu, (4) test Phase 1 bị ảnh hưởng.

## 1. Luật Phase 1 bị thay bởi ticket (lý do đổi hướng)

| Mục | Phase 1 | Phase 2 (ticket) |
|---|---|---|
| Số liệu | tự chọn (cost 8, pulse 2, safe 5...) | số chuẩn: cost 10, interact 2.0, pickup 1.0, pulse 3/5 m/3 s, safe 6, stun 120 tick |
| Đom đóm khi bị đánh | mất hẳn | rơi ra vành 1.5–2.5 m, TTL 480 tick, nhặt lại được |
| Rơi khỏi đảo | rìa là tường chặn | Y < -10: -1 lửa, mất hết đom đóm, 60 tick chờ rồi hồi sinh |
| Điểm đom đóm | +10 khi nhặt | +10 mỗi đom đóm **nạp** vào đèn |
| Điểm | stun 25, giây 1 | stun 5, giây còn lại x2 |
| Chạm Bóng Mực | chỉ xét khoảng cách XZ | XZ <= 1.0 và chênh cao <= 1.5; bóng bị recoil 2 m / 60 tick |
| Sinh Bóng Mực | 2 lúc đầu, 1 con/10 s, tối đa 5 | 2 con tại tick 300, rồi 1 con mỗi 480 tick (Đêm 1), tối đa 6, 12 điểm r=37 cách người chơi >= 15 m |
| Thắng/thua | game_over phát ngay khi sự kiện xảy ra | xét **cuối tick** (bước 11): hết lửa thì luôn thua, đủ đèn thì thắng kể cả đúng tick hết giờ |
| Snapshot tick game-over | không ghi | ghi nếu tới lượt snapshot |
| Vật lý | dịch chuyển tức thời | tăng/giảm tốc 0.1 s, nhảy v=7, g=-20, lướt 14 m/s |

## 2. Giả định (chỗ ticket chưa nói)

- **A1** Tăng tốc: vận tốc ngang tiến tuyến tính tới đích với gia tốc 60 m/s² (đạt 6 m/s trong 0.1 s), cả trên không.
- **A2** Hướng: nhân vật quay mặt theo hướng input khác 0; ban đầu quay +Z. Lướt đi theo hướng input, nếu đứng yên thì theo hướng đang quay mặt.
- **A3** Lướt: 12 tick, vận tốc ngang 14 m/s; trong lúc lướt trên không vy bị đóng băng (giữ độ cao). Hồi chiêu 90 tick tính từ lúc bắt đầu. Lướt khi `dashT > 0` bị bỏ qua.
- **A4** Chạm đất: `grounded` khi chân ở mặt đất; đi xuống bậc thấp hơn <= 0.35 m thì bám mặt đất, lớn hơn thì rơi; đi vào vùng cao hơn > 0.35 m thì bị chặn (vách).
- **A5** Bộ đếm: giảm ở đầu mỗi sim tick (bước 2). Trạng thái "N tick" nghĩa là tồn tại trong đúng N tick tính từ tick sinh/kích hoạt (kích hoạt ở tick s thì còn hiệu lực tới tick s+N-1; cooldown dùng được lại ở tick s+N).
- **A6** Đom đóm rơi: TTL 480, hiện diện trong 480 tick sau tick sinh; vị trí ngẫu nhiên (theo seed) trên vành 1.5–2.5 m **có mặt đất**; nếu 8 lần thử đều ở ngoài đảo thì đặt dưới chân Mây.
- **A7** Điểm sinh đom đóm "trống" = không có đom đóm đang nằm đúng điểm đó; chọn ngẫu nhiên theo seed. 20 đom đóm đầu tiên chọn 20 điểm khác nhau trong 24 điểm.
- **A8** Trạng thái Bóng Mực: `spawning` (60 tick đứng yên, vô hại), `wander` (đi 2 m/s, đổi hướng mỗi 90 tick), `chase`, `recoil`, `stunned`. Bóng đang bị đẩy ra khỏi vùng an toàn mới thắp cũng báo `recoil`. Phát hiện/bỏ đuổi tính theo khoảng cách XZ.
- **A9** Bóng Mực lơ lửng: độ cao = độ cao đã cho + chênh độ cao địa hình; không bị vách chặn, chỉ bị vật cản (tháp) chặn.
- **A10** Tỏa Sáng: mục tiêu là Bóng Mực có khoảng cách 3D từ tâm (chân Mây + 0.8 m) tới tâm Bóng Mực <= 5 m, chốt ở tick kích hoạt. `pulse.stunned_ids` liệt kê các Bóng Mực trúng. Điểm +5 cho mỗi con mỗi lần.
- **A11** Đẩy lùi do pulse: 4 m ngang trong 15 tick (4/15 m mỗi tick), dừng nếu gặp vật cản. Hướng đẩy cố định tại tick kích hoạt.
- **A12** Pause trong headless: nút `pause` bật/tắt (chuyển false→true). Khi tạm dừng, `tick` vẫn tăng, `sim_tick` và mọi bộ đếm đứng yên, snapshot ghi `state: "paused"`. Tick vừa tạm dừng dừng bước ngay sau khi đọc input; tick tiếp tục thì chạy bình thường.
- **A13** `player.invuln` trong snapshot là boolean (còn bất tử hay không).
- **A14** Gió mạnh (Đêm 3): cơn gió đầu bắt đầu ở tick 1800, rồi mỗi 1800 tick; kéo dài 300 tick; báo trước 120 tick; hướng ngẫu nhiên theo seed.
- **A15** Đom đóm/Bóng Mực trong scenario: toạ độ y được tôn trọng. Mặc định cho điểm sinh ngẫu nhiên: đom đóm y = độ cao mặt đất, Bóng Mực y = mặt đất + 1.0.
- **A16** Điểm toàn game = tổng điểm các Đêm đã thắng (chỉ có ý nghĩa ở client; headless chạy từng Đêm).
- **A17** Mỗi lần `--night N` bắt đầu với 3 Ngọn Lửa, điểm 0.

- **A18** Quy ước góc: x = r cos(a), **z = +r sin(a)** (không phải -r sin). Lý do: tầng 1 Đêm 3 chỉ có ở nửa z > 0 mà đom đóm tầng 1 và hai dốc nằm ở góc 20°–160° / 30° / 150°; chỉ quy ước này đặt chúng lên đúng tầng. Các tập điểm Đêm 1 và 2 đối xứng qua trục X nên không đổi.
- **A19** Điểm xuất phát Đêm 2 là (0,0,0), Đêm 3 là (0,0,-30) (tầng 0), vì (0,0,0) của Đêm 3 nằm trong tháp chuông trên tầng 2. Quay mặt về +Z. Hồi sinh sau khi rơi cũng ở điểm xuất phát.
- **A20** Gió mạnh: chu kỳ 1800 tick, cơn thứ c (c >= 1) bắt đầu ở tick 1800c, kéo dài 300 tick, báo trước 120 tick; hướng chọn ngẫu nhiên theo seed khi bắt đầu báo trước và giữ tới hết cơn (`wind.dir_deg` hiện hướng sắp tới ngay trong lúc báo trước, `active` chỉ true khi đang thổi). Gió dịch chuyển người chơi 2 m/s theo hướng đó, vẫn bị tường chặn.
- **A21** Gió Lạc, Bóng Mực bay lơ lửng nên đi qua vách tầng; chỉ tháp chuông chặn Bóng Mực và người chơi.

## 3. Tiêu chí nghiệm thu (acceptance criteria)

**Số liệu chuẩn (Phần 1)**
- AC-P1: tuning trong `game.contract.json` khớp bảng ticket; mọi hằng số trong code đọc từ đó.
- AC-MOVE: chạy 60 tick ở input (0,1) đi đúng 6 m (sau tăng tốc 6 tick, sai số < 0.4 m); dừng trong <= 6 tick.
- AC-JUMP: nhảy chỉ khi chạm đất; đỉnh = 1.225 m; hết nhảy sau khoảng 0.7 s.
- AC-DASH: lướt đi 14 m/s trong 12 tick, hồi 90 tick từ lúc bắt đầu, trên không giữ độ cao, không bất tử.
- AC-MOTE: sinh 20 ở 20 điểm khác nhau; trần 30; tick 240 sinh thêm 1 khi < 30; nhặt cần XZ <= 1.0 và chênh cao <= 1.5.
- AC-LANTERN: cost 10, nạp từng phần, chọn đèn gần nhất (hoà thì id nhỏ), chỉ đèn chưa sáng; +10 mỗi đom đóm nạp, +100 mỗi đèn.
- AC-SAFE: bóng ngoài bị chặn ở mép 6 m; bóng trong vùng lúc đèn vừa sáng bị đẩy ra tối đa 30 tick và vô hại.
- AC-PULSE: cần 3 đom đóm; bán kính 5 m 3D từ chân+0.8; choáng 120 tick; đẩy 4 m trong 15 tick; hồi 180 tick; +5 mỗi bóng mỗi lần.
- AC-SHADE: tốc độ 4 (4.5 Đêm 3); phát hiện 12/18; đánh: -1 lửa, rơi floor(carried/2), bất tử 90, recoil 2 m/60 tick; tối đa 1 lần mất lửa mỗi tick; lịch sinh tick 300 (x2) rồi mỗi chu kỳ.
- AC-FALL: Y < -10 xảy ra đúng 1 lần, bỏ qua bất tử, mất toàn bộ đom đóm, 60 tick chờ rồi hồi sinh ở xuất phát bất tử 90 tick; hết lửa thì thua, không hồi sinh.
- AC-END: thứ tự thắng/thua đúng ticket; điểm thắng = floor(giây) x 2 + 50 x lửa.
- AC-ORDER: 12 bước mỗi tick theo đúng thứ tự ticket.

**Tính năng Phần 3**
- AC-DRIFT: Gió Lạc 7 m/s, tối đa 2, sinh ở tick 1200k, id D1..; idle→chase khi Mây mang >= 5 và <= 15 m; chạm XZ <= 1.2 cướp min(3, đang mang) rồi flee 240 tick; mỗi con cướp 1 lần; Tỏa Sáng làm chase→flee không cướp, flee đang mang đồ thì thả lại và biến mất sau 120 tick; không gây mất lửa, vùng an toàn không chặn.
- AC-CHARM: Bùa Gió nhặt như đom đóm; 600 tick: chạy 7.2 m/s, lướt không hồi chiêu; nhặt lại làm mới; xuất hiện lại sau 2700 tick; đúng vị trí theo Đêm.
- AC-NIGHTS: Đêm 1/2/3 có đúng bản đồ, đèn, điểm sinh, bục nhảy, gió, tháp, tầng, dốc theo ticket; `--night` nhận 1/2/3.
- AC-PAUSE: tạm dừng đứng yên toàn bộ logic; tiếp tục chạy lại đúng.
- AC-FLOW (client): Menu → giới thiệu Đêm → chơi → kết quả → Đêm kế; thắng Đêm 3 hiện Bình Minh với tổng điểm; thua thì chơi lại Đêm đó.
- AC-SETTINGS (client): âm lượng và độ nhạy chuột, lưu qua localStorage.
- AC-AUDIO (client): nhạc nền và 10 hiệu ứng, âm thanh tổng hợp bằng Web Audio (không dùng asset ngoài).
- AC-HUD (client): đúng bố cục và bảng màu trong ticket.
- AC-PERF: một Đêm đầy đủ (21.600 tick) headless <= 30 s; bản thường >= 30 FPS ở 1280x720. Đo thật và ghi lại.
- AC-CONTRACT-1.1: snapshot, scenario, input, sự kiện và tên trạng thái Bóng Mực theo v1.1.

## 4. Kế hoạch làm (thứ tự)
M1 lõi headless Đêm 1 theo v1.1 (test trước). M2 Đêm 2 và 3 (địa hình, bục nhảy, gió). M3 Gió Lạc và Bùa Gió. M4 client. M5 bằng chứng, đo hiệu năng, cập nhật AGENTS.md. Phần client được cắt bớt nếu hết giờ, và ghi trung thực phần chưa làm.

## 5. Test Phase 1 bị ảnh hưởng

Các test Phase 1 dựa trên số tự chọn (cost 8, pulse 2, safe 5, rìa đảo chặn, điểm 25/giây 1, game_over tức thì...) sai theo luật mới, **không phải do hồi quy**. Chúng được thay bằng các test v1.1 ở `tests/v11-*.test.ts` với số chuẩn; các test không phụ thuộc số chuẩn (tất định, hình dạng JSONL, mã thoát, làm tròn) được giữ. Bằng chứng Phase 1 (`docs/proof/phase-1/`) giữ nguyên, khớp tag `phase-1`.
