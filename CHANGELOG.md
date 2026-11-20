# Changelog

Định dạng: mỗi phase là một mục. "BREAKING" là thay đổi phá vỡ tương thích với phase trước.

## Phase 3 (Contract v1.2): Đèn cạn dầu

Quyết định thiết kế: [docs/notes/adr-0001-lantern-fuel.md](docs/notes/adr-0001-lantern-fuel.md).

### BREAKING
- **Mục tiêu đổi:** không còn thắng khi tất cả đèn sáng. Thắng = sống tới hết giờ và đủ ≥ ceil(0.6 × tổng) đèn đang sáng. `game_over.reason` `all_lit` không còn xuất hiện; thay bằng `dawn_survived` (thắng).
- **Đèn đã sáng nhận thêm đom đóm** (châm dầu), thay cho luật cũ "đèn sáng không nhận thêm". Bấm tương tác ở đèn sáng chưa đầy dầu phát `refuel` thay vì `deposit`.
- **Đèn có thể tắt** (`lantern_out`); đèn đã từng sáng chỉ cần 5 đom đóm để thắp lại.
- **Thời gian Đêm** 300/330/360 s → 240/270/300 s.
- **Bóng Mực vào được vùng an toàn của đèn yếu:** đèn sáng có fuel < 30 mất vùng an toàn. Trước đây vùng an toàn là vô điều kiện với đèn đã sáng.
- **Bóng Mực wander đi tới đèn** (đèn yếu gần nhất, nếu không có thì đèn tắt gần nhất) thay vì chỉ đi ngẫu nhiên.
- **Sức chứa** cố định 10 → `10 + 2 × lần thắp thành công`, tối đa 20.
- **Điểm** thay toàn bộ: +5 mỗi đom đóm nạp (trước +10), +100 thắp lần đầu, +40 thắp lại, Tỏa Sáng +5 (+15 nếu Bóng Mực đang `drain`), bình minh +50 + floor(fuel) mỗi đèn sáng và +50 mỗi Ngọn Lửa. Bỏ thưởng thời gian.
- **Snapshot:** mỗi đèn thêm `fuel`, `ever_lit`, `relit_count`; `player.capacity`; Bóng Mực có thêm trạng thái `drain`.
- **Scenario:** đèn thêm `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`. Đèn đặt `lit: true` không có `fuel` mặc định `fuel: 100`.
- **Sự kiện mới:** `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick khi đang hút); `lantern_lit` thêm `relight`.
- **Contract** `1.1` → `1.2`; `tuning` thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`, và các khóa điểm mới.

### Test
- Test Phase 2 dựa trên luật cũ được thay bằng `tests/v12-*.test.ts` (lý do trong `docs/notes/ai-log.md`). Không test nào bị skip.
- `npm run proof` chuyển sang Phase 3; bằng chứng Phase 2 giữ nguyên ở `docs/proof/phase-2/` (khớp tag `phase-2`).

## Phase 2 (Contract v1.1)
Số chuẩn của ticket, 3 Đêm, lướt, rơi khỏi đảo, tạm dừng, Gió Lạc, Bùa Gió, gió mạnh, client 3 Đêm.

## Phase 1 (Contract v1.0)
Đêm 1, lõi mô phỏng tất định, chế độ headless, bản 3D đầu tiên.
