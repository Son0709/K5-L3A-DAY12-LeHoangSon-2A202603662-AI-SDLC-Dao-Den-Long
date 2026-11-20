# Đảo Đèn Lồng

> Video demo: (cập nhật ở Release v1.0.0)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi (đội nón lá có treo đèn lồng nhỏ), gom đom đóm để thắp lại 5 Đèn Lồng Lớn và né Bóng Mực trong sương đen. Đảo sáng dần lên mỗi khi một ngọn đèn được thắp.

**Trạng thái:** Phase 1. Lõi mô phỏng, chế độ headless và bản 3D chơi được (Đêm 1 – Đảo Bến).

## Cài đặt và chạy (3 lệnh)
```
npm install
npm run dev        # mở http://localhost:5173
npm test           # 66 unit test
```
Bản tĩnh để chạy ở bất kỳ đâu: `npm run build:web`, rồi phục vụ thư mục `dist/` bằng một web server tĩnh bất kỳ (Windows, macOS, Linux). Cần Node.js 22.18 trở lên.

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | Đi lại (theo hướng camera) |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất (trong 2.5 m) |
| F | Tỏa sáng: làm choáng và đẩy lùi Bóng Mực (tốn 2 đom đóm, hồi 4 giây) |
| Mũi tên trái/phải hoặc kéo chuột | Xoay camera |
| R | Chơi lại |

## Luật chơi và cách tính điểm
- Gom đom đóm (mang tối đa 10), mang tới đèn, mỗi đèn cần 8 đom đóm để sáng. Thắp đủ 5 đèn thì **thắng**.
- Bóng Mực đuổi Mây; chạm vào thì mất 1 ngọn lửa (có 3), rơi một nửa số đom đóm đang mang, rồi bất tử 1.5 giây. Hết lửa hoặc hết 5 phút (trời sáng) thì **thua**.
- Bóng Mực không vào được vòng 5 m quanh đèn đã sáng.
- Điểm: +10 mỗi đom đóm, +100 mỗi đèn thắp, +25 mỗi Bóng Mực bị tỏa sáng làm choáng. Khi thắng cộng thêm +1 mỗi giây còn lại và +50 mỗi ngọn lửa còn lại.

## Headless (Test Contract v1.0)
Khai báo ở [game.contract.json](game.contract.json). Logic chạy 60 tick/giây, không cần cửa sổ hay GPU:
```
node src/headless/cli.ts --seed <int> --night 1 [--scenario f.json] [--inputs f.json] --ticks <int> --out <f.jsonl> [--snapshot-every 10]
```
Mã thoát: 0 bình thường, 2 nếu file scenario/inputs sai định dạng, khác 0 nếu lỗi khác. Cùng seed, scenario và inputs cho output giống hệt nhau.

Các khái niệm của contract mà game không có: `fall_enabled` là `false` (rìa đảo là tường chặn, không rơi), nên không có sự kiện `player_hit` với `by: "fall"`.

## Kiểm chứng
- `npm test`: unit test (luật chơi v1.1, tất định, CLI, contract).
- Bằng chứng Phase 1 ở [docs/proof/phase-1/](docs/proof/phase-1/README.md) (khớp tag `phase-1`, sinh bằng `npm run proof` ở tag đó). Bằng chứng Phase 2 đang được xây dựng.
- `node scripts/bot.ts 20`: một bot chơi thử qua lõi mô phỏng để kiểm tra ván thắng được.

## Tài liệu
- Giả định và kế hoạch kiểm chứng: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký dùng AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Quy ước cho agent: [AGENTS.md](AGENTS.md)

## Sáng tạo của tôi
(bổ sung nếu còn thời gian; phải không đổi đầu ra headless)
