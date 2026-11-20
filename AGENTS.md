# AGENTS.md — Đảo Đèn Lồng

Game 3D, lõi mô phỏng tất định + chế độ headless theo Test Contract (hiện **v1.1**, Phase 2). Trước khi sửa luật chơi đọc `docs/notes/phase2-spec.md` (giả định A1..A17 và tiêu chí nghiệm thu); Phase 1 nằm ở `assumptions.md` và đã bị Ticket-02 thay một phần.

## Lệnh
- Cài: `npm install`
- Test: `npm test` (node:test, không cần build)
- Kiểm kiểu: `npm run typecheck`
- Headless: `node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out/run.jsonl` (`--night` 1, 2, 3)
- Chơi bản 3D: `npm run dev` (mở `http://localhost:5173`, thêm `#play` để bỏ qua menu); build tĩnh: `npm run build:web`
- Kiểm tra ván thắng được: `node scripts/bot.ts 20`
- `npm run proof:phase1` CHỈ hợp lệ ở tag `phase-1` (v1.0); trên v1.1 nó tự từ chối để không ghi đè bằng chứng Phase 1.

## Cấu trúc
- `src/sim/`: lõi mô phỏng thuần (KHÔNG import three/DOM/Date/Math.random). `sim.ts` luật chơi, `maps.ts` bản đồ chuẩn, `parse.ts` scenario/inputs, `tuning.ts` hằng số.
- `src/headless/`: CLI theo Test Contract.
- `src/web/`: lớp hiển thị 3D (Three.js + Vite), chỉ đọc `sim.view()`; KHÔNG chứa luật chơi. Web và headless dùng chung `createSim`.
- `tests/`: `v11-*.test.ts` (luật v1.1), `determinism`, `cli`, `contract`; `docs/proof/`: bằng chứng theo phase.

## Quy ước bắt buộc
- Số tuning chỉ lấy từ `game.contract.json` (số chuẩn của ticket); không hằng số tự chọn rải trong code. Hằng số ngoài contract nằm ở `tuning.ts` và có giả định đánh số trong `phase2-spec.md`.
- Thứ tự một tick là bắt buộc (12 bước, xem đầu `sim.ts`); đổi thứ tự là đổi hành vi, phải có test.
- Tất định: mọi ngẫu nhiên qua PRNG có seed; không dùng thời gian thực.
- 1 tick = 1/60 s; bước k đọc input tick k, ghi sự kiện `tick = k+1`. Khi tạm dừng `tick` vẫn tăng, `sim_tick` đứng yên.
- Khoảng cách tính trên XZ (trừ Tỏa Sáng: 3D), "trong bán kính" là ≤ r. Tọa độ ghi làm tròn 3 chữ số.
- Thực thể sáng tạo thêm phải tắt khi headless, không đổi output contract.
- TypeScript chỉ dùng cú pháp erasable (không enum/namespace) để Node chạy trực tiếp.
- Không viết test luôn đạt; không sửa tay output. Test cũ bị đổi luật: sửa kèm lý do trong `docs/notes/`. Sau khi viết test, thử phá một hằng số (mutation) để chắc test bắt được.
- Không commit `.env`, key, token. Commit nhỏ, mỗi commit một việc.
