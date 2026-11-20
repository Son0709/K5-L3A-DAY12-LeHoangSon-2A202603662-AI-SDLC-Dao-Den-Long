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

M4 (client): chuỗi 3 Đêm, menu/giới thiệu Đêm (Ông Đăng)/kết quả/Bình Minh, tạm dừng, cài đặt lưu localStorage, âm thanh tổng hợp, HUD đúng bố cục và bảng màu, mũi tên chỉ đèn, dựng hình Đêm 2 và 3 (cầu, tầng, dốc, tháp, bục), Gió Lạc, Bùa, lá gió. `scripts/screens.ts` điều khiển Chrome thật và chụp ảnh.

| Lỗi (M4) | Phát hiện bằng | Xử lý |
|---|---|---|
| Cảnh quá tối (cỏ gần như đen) dù typecheck và build đều sạch | Xem ảnh chụp thật bằng Chrome | Three >= r155 không nhân ánh sáng với π nên hệ số quy đổi 0.15 + 0.55p phải lớn hơn nhiều; tăng hệ số hai lần (4 → 8 → 12) và xem lại ảnh sau mỗi lần |
| Camera bắt đầu nhìn ngược hướng Mây (đèn đầu tiên ở sau lưng) | Ảnh chụp Đêm 2: không thấy đèn nào | Đặt `camYaw = 180` khi bắt đầu Đêm; công thức đi theo hướng camera giữ nguyên |
| Cách chụp "màn thua" (đứng yên) không đáng tin: Bóng Mực lang thang tới khi Mây vào tầm 12 m nên không thua | Ảnh chụp cho thấy vẫn đang chơi sau 26 giây | Đổi sang kịch bản thật hơn: đi ra khỏi đảo 3 lần (mỗi lần rơi mất 1 ngọn lửa) |
| 6 lỗi 404 trong console | Script đếm lỗi trình duyệt, in URL | Là `favicon.ico`; nhúng favicon vào HTML; chạy lại còn 0 lỗi |
| Có ý định dùng `window.__debug` để ép trạng thái thắng cho ảnh chụp | Cân nhắc | Bỏ: không thêm mã chỉ phục vụ kiểm thử vào sản phẩm; ghi rõ nhánh thắng chưa được chạy tự động |

Chưa kiểm chứng ở client (ghi trong bằng chứng): nhánh thắng/Bình Minh, âm thanh, Gió Lạc và bục nhảy trong cảnh 3D, chơi tay trọn ván.

## Phase 4 (Ticket-04, Contract v1.3: phát hành)

Bước 1 (bench, soak, v1.3) và bước 2 (bảng xếp hạng): xem bảng lỗi dưới. Mutation check bảng xếp hạng 10/11 (1 đột biến tương đương: ghi file nguyên tử).

| Lỗi (Phase 4) | Phát hiện bằng | Xử lý |
|---|---|---|
| Đoán nút thắt hiệu năng là 200 Bóng Mực (1.000 draw call) | Đo thay vì đoán: tách từng nguyên nhân bằng cờ thử nghiệm | Bóng Mực chỉ góp ~9 FPS; nút thắt thật là HUD ghi DOM mỗi khung hình. Chỉ cập nhật DOM khi đổi: 75,7 lên 105 FPS, p1_low 22,6 lên 35. Vẫn chuyển sang dựng instanced vì rẻ và đúng |
| Nghi ngờ phép lấy mẫu bộ nhớ (PowerShell) làm giật | Chạy `--no-mem` so sánh | Không phải nguyên nhân; giữ lấy mẫu |
| Lệnh bench chập chờn: treo, 1 khung hình sau 63 s, tải 28 s | Lặp lại 10+ lần, in lỗi trang, đọc `power_source` | Laptop chạy pin (giảm xung) và cửa sổ bị che làm Chrome dừng khung hình. Thêm theo dõi tiến độ, đưa cửa sổ lên trước, tự chạy lại headless nếu lỗi, ghi `power_source`. Vẫn còn dao động trên GPU tích hợp; ghi trung thực |
| `bench.json` đầu tiên báo `vsync_off: false` dù không bị khóa 60 | Đối chiếu probe (57 fps) với avg 75,8 | Phép thăm dò trang trống không đáng tin; dùng thêm `min_frame_ms` (< 5 ms thì không thể bị vsync) |
| **CI trên Linux đỏ ở cả 4 lần push của Phase 4 mà tôi không kiểm tra** (chỉ tin kết quả trên Windows): test soak báo bộ nhớ 81,6 lên 104,9 MB (+28%) | Tình cờ chạy `gh run list` khi chuẩn bị viết README ("hỗ trợ Linux/macOS") | Nguyên nhân: JIT của V8 tăng vài MB ở mọi chương trình, trên Linux đủ vượt ngưỡng 20%. Thử `--max-semi-space-size` trước: vô tác dụng trên Windows (bác bỏ giả thuyết thế hệ trẻ). Làm nóng JIT trước mốc đo: tăng 11% xuống −2,6%; công khai `warmup_nights` và `mem_cold_start_mb`. Bài học: xem CI sau mỗi lần push, và không tuyên bố hỗ trợ nền tảng nếu chưa có bằng chứng. Chưa xác nhận được trên Linux thật cho tới khi CI chạy lại |
| Gọi `showResult(true)` trong khi hàm không nhận tham số; phím game (R, E, Space) có thể kích hoạt khi gõ tên | Tự rà mã trước khi chạy | Sửa; chặn phím game khi tiêu điểm ở ô nhập; e2e xác nhận gõ "Rex Ro" không kích hoạt gì |

## Phase 3 (Ticket-03, Contract v1.2: đèn cạn dầu)

Quy trình: đọc ticket, liệt kê luật bị thay và giả định, viết ADR + CHANGELOG, viết test v1.2 trước, rồi sửa lõi. Mutation check 22/22.

Test Phase 2 bị luật Ticket-03 làm sai (11 test), mỗi cái được sửa hoặc xóa kèm lý do, không có test nào bị skip:

| Test | Việc làm | Lý do |
|---|---|---|
| `contract`: v1.1 keys, tuning numbers | viết lại cho v1.2 | contract_version, thời lượng Đêm 240/270/300, khóa nhiên liệu và bảng điểm mới |
| `v11-core`: snapshot tick 0, `time_left_s` | đổi 300 thành 240, 299 thành 239 | Đêm 1 ngắn lại |
| `v11-maps`: Night 2 và 3 snapshot | đổi 330 thành 270, 360 thành 300 | như trên |
| `v11-core`: "last lantern: all_lit wins ... floor(s) x 2" | **xóa** | không còn thắng sớm và không còn thưởng thời gian; luật dawn được test ở `v12-fuel` |
| `v11-items`: full deposit và partial deposit (điểm) | đổi điểm 10/mote thành 5/mote | điểm mỗi đom đóm nạp đổi |
| `v11-items`: "lit lanterns are skipped" | bỏ dòng đó, chuyển sang `v12-fuel` | đèn sáng chưa đầy dầu nay là đèn nhận được |

Lỗi của AI và cách xử lý (Phase 3):

| Lỗi | Phát hiện bằng | Xử lý |
|---|---|---|
| Hai kỳ vọng sai trong test mới: hướng đi của Bóng Mực (tính thiếu thành phần chéo, 0.89 chứ không phải > 1) và đặt đèn ở 40 dầu (không phải đèn yếu nên không hút được) | Test mới đỏ, đọc từng lỗi | Sửa test (code đúng theo ticket), ghi chú tính tay trong test |
| Kỳ vọng "sau choáng về wander" bỏ qua việc wander kiểm tra tầm 12 m ngay lúc đó | Test đỏ, giá trị thật là `chase` | Sửa test: kiểm tra "không còn drain" thay vì ép đúng chữ `wander` |
| Đổi tuning làm client không biên dịch (`per_second_left` đã bị bỏ) | `npm run typecheck` đỏ ngay sau khi sửa lõi | Sửa tối thiểu client để biên dịch lại; phần client đầy đủ làm sau |
| Thứ tự trong tick làm "đèn đầy dầu không được chọn" gần như không bao giờ xảy ra (hao dầu ở bước 2 trước khi tương tác ở bước 5) | Tính tay khi viết test refuel | Ghi chú trong test; test refuel dùng dầu 55 để tránh nhập nhằng; rủi ro đã ghi trong ADR |

Giả định chưa được xác nhận: Bóng Mực wander đi tới đèn với `shade_speed`; `refuel` không phát `deposit`.

Bằng chứng Phase 3: `scripts/proof3.ts` (45 check end-to-end qua CLI thật, gồm nhóm hồi quy R1-R6 cho hành vi Phase 1-2 không bị thay thế), `npm run proof` chuyển sang nó; `proof:phase2` đóng băng và tự từ chối trên v1.2. Mutation check trên proof: 7/8 bị bắt; `relight_cost = 6` làm script sập (TypeError) thay vì báo trượt có kiểm soát; `DRAIN_RANGE` chỉ unit test bắt. Cả hai ghi trong README bằng chứng.

Test Phase 1 bị luật Ticket-02 thay (lý do, không phải hồi quy): cost 8→10, pickup/interact radius, pulse (cost/radius/cooldown), safe radius, rìa đảo thành rơi, đom đóm mất hẳn→rơi ra vành, điểm nhặt→điểm nạp, lịch sinh Bóng Mực, `game_over` tức thì→cuối tick. Chúng được viết lại ở `tests/v11-*.test.ts` với số chuẩn; `determinism`, `cli`, `contract` được giữ/cập nhật.
