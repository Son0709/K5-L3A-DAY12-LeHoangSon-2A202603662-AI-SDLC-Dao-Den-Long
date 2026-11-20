# Nhật ký dùng AI

Công cụ: Claude Code (VS Code), model Sonnet 5.5.

## Phase 1

| Bước | Việc | Token/chi phí ước tính |
|---|---|---|
| Chuẩn bị | Đọc tài liệu lab, cài Node, gh, đăng nhập gh | chưa ghi |
| Yêu cầu | Phân tích PRD-0, soạn giả định và tuning, kế hoạch kiểm chứng | chưa ghi |
| Khung repo | package.json, AGENTS.md, contract, CI, CLI hello | chưa ghi |
| Test trước | Viết 66 test theo kế hoạch kiểm chứng (59 đỏ với bản giữ chỗ) | chưa ghi |
| Lõi mô phỏng | sim, parse, rng, CLI thật, 66/66 đạt | chưa ghi |
| Bằng chứng | `scripts/proof.ts`, 23 check end-to-end, mutation check | chưa ghi |

Cách tiết kiệm: AGENTS.md ngắn, chốt giả định trước khi code, viết kiểm chứng trước, commit nhỏ.

## Lỗi của AI và cách xử lý

| Lỗi | Phát hiện bằng | Xử lý |
|---|---|---|
| Test dùng `move: [5, 0]`, vi phạm contract (mỗi thành phần phải trong [-1, 1]) | Chạy test: code từ chối đúng input sai | Sửa test thành `[1, 1]`, không nới code |
| Hai commit đầu chỉ chứa `tsconfig.json` và `package.json` dù message nói có cả code và test | Đối chiếu `git status` và `git ls-tree` với message | `git reset --soft HEAD~2`, commit lại đủ file (khi chưa push, chưa tag) |
| Bằng chứng ban đầu 23/23 đạt ngay lần đầu, có thể là đạt cho có | Tự nghi ngờ | Mutation check: đổi một con số tuning, `proof` phải trượt, rồi hoàn nguyên |

Bài học cho harness: kiểm tra `git status` sau mỗi lần commit; mọi bằng chứng phải sinh từ lệnh chạy thật (`npm run proof`), không viết tay.

## Phase 2

| Bước | Việc | Token/chi phí ước tính |
|---|---|---|
| Spec | Đọc Ticket-02, viết `phase2-spec.md`: bảng luật bị thay, 17 giả định, tiêu chí nghiệm thu | chưa ghi |
| M1 | Lõi v1.1 Đêm 1: số chuẩn, vật lý, lướt, rơi đảo, pause, thứ tự 12 bước, snapshot/sự kiện mới | chưa ghi |
| Test | Thay test Phase 1 bằng `tests/v11-*` (72 test); mutation check 10 hằng số | chưa ghi |

Lỗi của AI và cách xử lý (Phase 2):

| Lỗi | Phát hiện bằng | Xử lý |
|---|---|---|
| 72/72 test đạt ngay lần đầu, có thể lỏng | Nghi ngờ, chạy mutation 10 hằng số | 2 đột biến sống (`EXPEL_TICKS`, `FALL_Y`); thêm test mốc tick rơi (tick 60) và đẩy dần; cả 10 đều bị bắt |
| `scripts/proof.ts` (Phase 1) sẽ ghi đè bằng chứng đã tag nếu chạy với v1.1 | Rà soát tác động của đổi luật | Thêm chốt chặn theo `contract_version`, đổi tên thành `proof:phase1`; kiểm tra thật nó từ chối (mã 2) và không file nào đổi |

M2 (Đêm 2 và 3): bản đồ, địa hình, bục nhảy, tầng, dốc, tháp, gió; 93 test; mutation 14/14 (1 mutant tương đương).

| Lỗi (M2) | Phát hiện bằng | Xử lý |
|---|---|---|
| Quy ước góc trong ticket tự mâu thuẫn: "ngược chiều kim đồng hồ" cho z = -r sin(a), nhưng tầng 1 (z > 0) có đom đóm ở 20°-160° | Đọc kỹ dữ liệu Đêm 3 trước khi code | Chọn z = +r sin(a), ghi giả định A18 kèm lý do; tập điểm Đêm 1 và 2 đối xứng nên không ảnh hưởng |
| Điểm xuất phát (0,0,0) của Đêm 3 nằm trong tháp chuông | Đối chiếu bản đồ | Chọn (0,0,-30), ghi A19 |
| Vận tốc phóng của bục nhảy chỉ hiện ở tick sau | Test bục nhảy đỏ, thăm dò bằng script | Sửa code: đặt vận tốc ngay khi phóng |
| Test độ rộng dốc đặt người chơi xuất phát bên trong vùng dốc, nên không phân biệt được đột biến | Mutation `across <= 2.5` vẫn sống | Sửa test: xuất phát ngoài vùng dốc, kiểm tra dừng ở vách r=24; đột biến bị bắt |

M3 (Gió Lạc, Bùa Gió, `night_start`): 113 test; mutation 16/16.

| Lỗi (M3) | Phát hiện bằng | Xử lý |
|---|---|---|
| Quên sự kiện `night_start` (có trong danh sách sự kiện v1.1 nhưng chưa được cài ở M1) | Rà lại danh sách sự kiện của ticket trước khi viết M3 | Phát ở tick 1; helper test loại nó khỏi danh sách để so sánh nguyên danh sách sự kiện, test riêng kiểm tra nó; ghi A23 |
| M1 làm lướt chỉ bỏ qua hồi chiêu khi `dashCd === 0`, sai với bùa: "không hồi chiêu" phải bỏ qua cả hồi chiêu đang chạy | Đọc lại luật Bùa Gió khi viết test | Sửa điều kiện; test mới (cooldown đang chạy 80 tick vẫn lướt được) |
| Test so `charm_s` thực với giá trị đã làm tròn 3 chữ số | Test đỏ; đọc giá trị thật 3.333 | Sửa test (sai ở test, code đúng) |
| Đột biến "vẫn đặt hồi chiêu 90 tick khi có bùa" sống sót | Mutation check | Thêm test bùa hết hiệu lực giữa hai lần lướt; đột biến bị bắt |

M5 (bằng chứng Phase 2): `scripts/proof2.ts` 42 check end-to-end qua CLI thật, đo một Đêm đầy đủ (0.16 đến 0.25 s), `scripts/fps.ts` đo FPS bằng Chrome thật (60.1 FPS, Intel UHD), skill `verify`, hook `Stop` chặn khi test đỏ.

| Lỗi (M5) | Phát hiện bằng | Xử lý |
|---|---|---|
| `proof` 42/42 đạt ngay lần đầu | Nghi ngờ, phá 6 hằng số rồi chạy lại proof | 6/6 bị bắt; một chỗ yếu: check bục nhảy Đêm 3 trong proof lỏng hơn unit test (ghi trong README bằng chứng) |
| Chốt chống vòng lặp của hook `Stop` không hoạt động khi thử | Chạy thử 4 trường hợp (xanh, đỏ, đỏ + `stop_hook_active`, khôi phục) | Nguyên nhân: PowerShell 5.1 chèn BOM vào stdin làm `JSON.parse` lỗi; script giờ loại BOM; thử lại đủ 4 trường hợp đều đúng |
| README còn mô tả luật Phase 1 (cost 8, `fall_enabled` false...) và nói client đủ tính năng | Rà lại tài liệu so với thực tế | Viết lại README theo v1.1 và nói rõ client mới chơi được Đêm 1; bảng truy vết ghi "Chưa đạt" cho phần client |

Test Phase 1 bị luật Ticket-02 thay (lý do, không phải hồi quy): cost 8→10, pickup/interact radius, pulse (cost/radius/cooldown), safe radius, rìa đảo thành rơi, đom đóm mất hẳn→rơi ra vành, điểm nhặt→điểm nạp, lịch sinh Bóng Mực, `game_over` tức thì→cuối tick. Chúng được viết lại ở `tests/v11-*.test.ts` với số chuẩn; `determinism`, `cli`, `contract` được giữ/cập nhật.
