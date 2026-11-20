# AGENTS.md — Đảo Đèn Lồng

Game 3D, lõi mô phỏng tất định + chế độ headless theo Test Contract (hiện **v1.2**, Phase 3: đèn cạn dầu, thắng ở bình minh). Trước khi sửa luật chơi đọc `docs/notes/adr-0001-lantern-fuel.md` (mô hình đèn, thứ tự tick, `drain`) và `docs/notes/phase2-spec.md` (giả định A1..A23); `CHANGELOG.md` liệt kê thay đổi phá vỡ tương thích. Phase 1 nằm ở `assumptions.md` và đã bị Ticket-02 và 03 thay một phần.

## Lệnh
- Cài: `npm install`
- Test: `npm test` (node:test, không cần build)
- Kiểm kiểu: `npm run typecheck`
- Headless: `node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out/run.jsonl` (`--night` 1, 2, 3)
- Chơi bản 3D: `npm run dev` (mở `http://localhost:5173`, thêm `#play` để bỏ qua menu); build tĩnh: `npm run build:web`
- Bằng chứng Phase 3: `npm run proof` (chạy CLI thật, sinh `docs/proof/phase-3/`; phải N/N đạt). Chạy sau khi đã commit code để `RESULTS.md` ghi commit sạch.
- Ảnh chụp và kiểm tra tự động client bằng Chrome thật: `npm run screens` (ghi `docs/proof/phase-2/screens/`)
- FPS bản 3D: `npm run fps` (cần Chrome, ghi `docs/proof/phase-2/fps.json`; yêu cầu >= 30 FPS ở 1280x720)
- `node scripts/bot.ts 20`: bot cũ chơi thử Đêm 1 (chỉ tham khảo, chưa chỉnh cho số chuẩn v1.1).
- `npm run proof:phase1` (v1.0) và `npm run proof:phase2` (v1.1) CHỈ hợp lệ ở tag tương ứng; trên v1.2 chúng tự từ chối để không ghi đè bằng chứng đã tag.

## Harness
- Skill `.claude/skills/verify/SKILL.md`: quy trình kiểm chứng (typecheck, test, mutation, proof, hiệu năng). Dùng sau mỗi thay đổi luật và trước khi tag.
- Hook `Stop` (`.claude/settings.json` + `scripts/stop-gate.ts`): chặn kết thúc khi typecheck hoặc test đỏ; có chốt chống vòng lặp `stop_hook_active`.

## Cấu trúc
- `src/sim/`: lõi mô phỏng thuần (KHÔNG import three/DOM/Date/Math.random). `sim.ts` luật chơi, `maps.ts` bản đồ chuẩn, `parse.ts` scenario/inputs, `tuning.ts` hằng số.
- `src/headless/`: CLI theo Test Contract.
- `src/web/`: client (Three.js + Vite), chỉ đọc `sim.view()`; KHÔNG chứa luật chơi. Web và headless dùng chung `createSim`. `main.ts` luồng game/HUD/input, `scene.ts` dựng cảnh theo bản đồ và bảng màu, `audio.ts` âm thanh tổng hợp (Web Audio, không asset), `settings.ts` lưu cài đặt.
- Thay đổi client phải kiểm chứng bằng `npm run screens` (xem ảnh thật) chứ không chỉ typecheck: lần đầu cảnh quá tối và camera nhìn ngược hướng mà typecheck không thấy.
- `tests/`: `v11-*.test.ts` (luật v1.1), `determinism`, `cli`, `contract`; `docs/proof/`: bằng chứng theo phase.

## Quy ước bắt buộc
- Nhiên liệu đèn là số nguyên theo 1/60 (`fuelU`); không dùng số thực cho dầu. Hao dầu và hút dầu ở bước 2, đèn hết dầu tắt ngay sau bước 2; thắng/thua chỉ xét ở bước 11 (không thắng sớm).
- Số tuning chỉ lấy từ `game.contract.json` (số chuẩn của ticket); không hằng số tự chọn rải trong code. Hằng số ngoài contract nằm ở `tuning.ts` và có giả định đánh số trong `phase2-spec.md`.
- Thứ tự một tick là bắt buộc (12 bước, xem đầu `sim.ts`); đổi thứ tự là đổi hành vi, phải có test.
- Tất định: mọi ngẫu nhiên qua PRNG có seed; không dùng thời gian thực.
- 1 tick = 1/60 s; bước k đọc input tick k, ghi sự kiện `tick = k+1`. Khi tạm dừng `tick` vẫn tăng, `sim_tick` đứng yên.
- Khoảng cách tính trên XZ (trừ Tỏa Sáng: 3D), "trong bán kính" là ≤ r. Tọa độ ghi làm tròn 3 chữ số.
- Thực thể sáng tạo thêm phải tắt khi headless, không đổi output contract.
- TypeScript chỉ dùng cú pháp erasable (không enum/namespace) để Node chạy trực tiếp.
- Không viết test luôn đạt; không sửa tay output. Test cũ bị đổi luật: sửa kèm lý do trong `docs/notes/`. Sau khi viết test, thử phá một hằng số (mutation) để chắc test bắt được.
- Không commit `.env`, key, token. Commit nhỏ, mỗi commit một việc.
