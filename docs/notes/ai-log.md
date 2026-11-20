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

Test Phase 1 bị luật Ticket-02 thay (lý do, không phải hồi quy): cost 8→10, pickup/interact radius, pulse (cost/radius/cooldown), safe radius, rìa đảo thành rơi, đom đóm mất hẳn→rơi ra vành, điểm nhặt→điểm nạp, lịch sinh Bóng Mực, `game_over` tức thì→cuối tick. Chúng được viết lại ở `tests/v11-*.test.ts` với số chuẩn; `determinism`, `cli`, `contract` được giữ/cập nhật.
