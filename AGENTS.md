# AGENTS.md — Đảo Đèn Lồng

Game 3D, lõi mô phỏng tất định + chế độ headless theo Test Contract. Đọc `docs/notes/assumptions.md` trước khi sửa luật chơi.

## Lệnh
- Cài: `npm install`
- Test: `npm test` (node:test, không cần build)
- Kiểm kiểu: `npm run typecheck`
- Bằng chứng: `npm run proof` (chạy CLI thật, sinh `docs/proof/phase-1/`; phải 100% đạt trước khi tag)
- Headless: `node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out/run.jsonl`

## Cấu trúc
- `src/sim/`: lõi mô phỏng thuần (KHÔNG import three/DOM/Date/Math.random).
- `src/headless/`: CLI theo Test Contract v1.0.
- `src/web/`: lớp hiển thị 3D, chỉ đọc state từ `src/sim/`.
- `tests/`: test đơn vị + scenario; `docs/proof/`: bằng chứng theo phase.

## Quy ước bắt buộc
- Số tuning chỉ lấy từ `game.contract.json`; đổi số thì đổi file này và `assumptions.md`.
- Tất định: mọi ngẫu nhiên qua PRNG có seed; không dùng thời gian thực.
- 1 tick = 1/60 s; bước k đọc input tick k, ghi sự kiện `tick = k+1`.
- Khoảng cách tính trên mặt phẳng XZ, "trong bán kính" là ≤ r. Tọa độ ghi làm tròn 3 chữ số.
- Thực thể sáng tạo thêm phải tắt khi headless, không đổi output contract.
- TypeScript chỉ dùng cú pháp erasable (không enum/namespace) để Node chạy trực tiếp.
- Không viết test luôn đạt; không sửa tay output. Test cũ bị đổi luật: sửa kèm lý do trong `docs/notes/`.
- Không commit `.env`, key, token.
- Commit nhỏ, mỗi commit một việc.
