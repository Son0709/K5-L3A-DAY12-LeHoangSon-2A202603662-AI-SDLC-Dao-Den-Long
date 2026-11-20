# Giả định Phase 1 (PRD-0, Contract v1.0)

Chỗ PRD-0 mơ hồ được tự giả định như dưới đây. Số liệu khớp `game.contract.json`.

## Tuning

| Khóa | Giá trị | Ghi chú |
|---|---:|---|
| player_speed | 6 m/s | |
| carry_capacity | 10 | |
| lantern_cost | 8 | 5 đèn cần 40 đom đóm |
| lantern_count_night1 | 5 | theo PRD |
| pickup_radius | 1.2 m | |
| interact_radius | 2.5 m | |
| pulse_cost | 2 | trừ vào đom đóm đang mang |
| pulse_radius | 6 m | |
| night1_duration_s | 300 | |
| flames | 3 | |
| invuln_s | 1.5 | |
| hit_drop_ratio | 0.5 | rơi floor(carried × 0.5), mất hẳn |
| pulse_stun_s | 3 | |
| pulse_push_m | 3 | |
| pulse_cooldown_s | 4 | |
| safe_radius | 5 m | chỉ quanh đèn đã sáng |
| shade_speed | 4 m/s | |
| shade_hit_radius | 1.0 m | |
| fall_enabled | false | rìa đảo là tường chặn |
| score | mote 10, lantern 100, stun 25, second_left 1, flame_left 50 | giây/flame còn lại chỉ cộng khi thắng |

## Luật chơi

**Bố cục và thực thể**
1. Đảo tròn bán kính 40 m, tâm (0,0,0). Mây xuất phát ở tâm. Rìa đảo chặn, không rơi, nên không có sự kiện `player_hit` với `by: "fall"`.
2. Đèn L1..L5 xếp vòng bán kính 25 m, cách nhau 72°, L1 ở (0,0,25).
3. Ban đầu có 60 đom đóm rải ngẫu nhiên theo seed. Mặc định `time_left_s` = 300.

**Di chuyển**
4. Di chuyển theo công thức xoay camera của contract. Nhảy có trọng lực, chỉ ảnh hưởng trục Y; mọi khoảng cách đo trên XZ.

**Nhặt và nạp đèn**
5. Nhặt đom đóm tự động khi trong `pickup_radius`. Đầy `carry_capacity` thì không nhặt. Mỗi lần nhặt ghi `mote_picked` và cộng `per_mote`.
6. `interact` trong `interact_radius` của đèn chưa sáng nạp `min(carried, cost − deposited)`. Đủ `lantern_cost` thì ghi `deposit`, rồi `lantern_lit`, cộng `per_lantern`. Phần dư vẫn ở `carried`. Nếu `amount = 0` thì không ghi sự kiện.

**Tỏa sáng (pulse)**
7. Pulse cần `carried ≥ pulse_cost` và hết cooldown, nếu không thì bỏ qua (không sự kiện). Thành công: trừ `pulse_cost`, ghi `pulse`. Mỗi Bóng Mực trong `pulse_radius` (kể cả đang choáng) bị đặt lại choáng `pulse_stun_s`, bị đẩy `pulse_push_m` ra xa, và vào `stunned_ids`. `per_stun` chỉ cộng cho con chưa choáng trước đó.
8. Bóng Mực đang choáng đứng yên, không gây sát thương.

**Bóng Mực**
9. Bóng Mực đuổi thẳng Mây ở `shade_speed`. Trạng thái: `chase`, `stunned`. Không vào được vòng `safe_radius` quanh đèn đã sáng (đèn chưa sáng không cản).
10. Với `random_shades: true`: có 2 con lúc bắt đầu, sau đó mỗi 10 s sinh thêm một con, tối đa 5 con cùng lúc. Chúng xuất hiện ở rìa đảo, cách Mây ≥ 20 m, ghi `shade_spawned`, id `S1, S2…` tăng dần. `random_shades: false` thì không tự sinh.

**Bị chạm và thắng/thua**
11. Bị chạm khi Bóng Mực không choáng ở trong `shade_hit_radius` và Mây không bất tử: `flames −1`, rơi `floor(carried × 0.5)` (mất hẳn), bất tử `invuln_s`. Ghi `player_hit {by:"shade"}`.
12. Thua `no_flames` khi `flames = 0`; thua `dawn` khi `time_left_s ≤ 0`; thắng `all_lit` khi cả 5 đèn sáng.
13. `game_over` chỉ ghi một lần, ngay sau sự kiện gây ra nó.

**Scenario và điểm**
14. Scenario dựng bằng `lit: true` không phát sự kiện, không cộng điểm. Score ban đầu là 0.
15. Khi thắng cộng thêm `per_second_left × giây nguyên còn lại` và `per_flame_left × flames còn lại`. Khi thua không cộng.

## Thứ tự xử lý trong một tick
input → di chuyển Mây → nhặt → interact → pulse → di chuyển Bóng Mực → va chạm → tự sinh → giảm giờ → kiểm tra kết thúc.

## Kỹ thuật
- TypeScript; lõi mô phỏng thuần chạy bằng Node (headless); Three.js + Vite cho bản web tĩnh (chạy macOS/Linux).
- PRNG có seed (mulberry32); không dùng `Math.random` hay thời gian thực.

## Rủi ro đã biết
Giả định 7, 9, 11 dễ lệch với test ẩn nhất (điều kiện pulse, đèn chưa sáng có cản Bóng Mực không, rơi đom đóm).

## Kế hoạch kiểm chứng (viết trước khi code)

| Yêu cầu | Kiểm chứng |
|---|---|
| Tick và snapshot | snapshot tick 0, `--ticks N` đúng N bước, `time_left_s` đúng |
| Di chuyển, xoay camera | `move` với `cam_yaw_deg` 0 và 90, kiểm tra vị trí |
| Nhặt, sức chứa | đom đóm ở 1.1 m và 1.3 m (ngưỡng ≤ r), nhặt quá capacity |
| Nạp, thắp đèn | nạp từng phần, đủ, phần dư, điểm |
| Pulse | choáng, đẩy, cooldown, thiếu đom đóm, `stunned_ids` |
| Bị chạm | `dropped` đúng, bất tử, hết máu thì thua |
| Safe radius | Bóng Mực bị chặn ở rìa vòng quanh đèn sáng |
| Thắng/thua | `all_lit`, `dawn`, `no_flames`, dòng `end` |
| Tất định | chạy hai lần cùng seed, so output |
| Lỗi đầu vào | file sai định dạng thì mã thoát 2 |
