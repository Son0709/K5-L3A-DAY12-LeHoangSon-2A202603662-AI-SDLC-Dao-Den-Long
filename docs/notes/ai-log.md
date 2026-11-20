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
