# Đảo Đèn Lồng

> Video demo: (cập nhật ở Release v1.0.0)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi (đội nón lá có treo đèn lồng nhỏ, quàng khăn đỏ), gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen qua ba đêm: **Đảo Bến**, **Đảo Cau**, **Đảo Chuông**. Đảo sáng dần lên mỗi khi một ngọn đèn được thắp.

**Trạng thái (Phase 2):** lõi mô phỏng, chế độ headless (Test Contract v1.1) và bản 3D cho cả 3 Đêm đã có. Những gì chưa kiểm chứng (chưa chơi tay trọn ván, chưa nghe âm thanh, nhánh thắng → Bình Minh chưa chạy tự động) được ghi trung thực ở [bằng chứng Phase 2](docs/proof/phase-2/README.md).

## Cài đặt và chạy (3 lệnh)
```
npm install
npm run dev        # mở http://localhost:5173
npm test           # unit test
```
Bản tĩnh để chạy ở bất kỳ đâu: `npm run build:web`, rồi phục vụ thư mục `dist/` bằng một web server tĩnh bất kỳ (Windows, macOS, Linux). Cần Node.js 22.18 trở lên.

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D | Đi lại (theo hướng camera) |
| Space | Nhảy (chỉ khi chạm đất) |
| Shift | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| E | Nạp đom đóm vào đèn gần nhất chưa sáng (trong 2 m) |
| F | Tỏa sáng: làm choáng và đẩy lùi Bóng Mực trong 5 m (tốn 3 đom đóm, hồi 3 s) |
| Mũi tên trái/phải hoặc kéo chuột | Xoay camera |
| Esc hoặc P | Tạm dừng (Tiếp tục, Chơi lại Đêm, Cài đặt, Về menu) |
| R | Chơi lại Đêm |

Cài đặt (âm lượng, độ nhạy chuột) được lưu lại giữa các lần mở game. Âm thanh được tổng hợp trực tiếp bằng Web Audio (không dùng file âm thanh nào).

## Luật chơi (số chuẩn của Ticket-02)
- Mang tối đa 10 đom đóm; mỗi đèn cần 10 để sáng. Thắp hết đèn của Đêm thì **thắng** Đêm đó; thắng cả 3 Đêm thì đón Bình Minh, điểm tổng là tổng điểm các Đêm đã thắng. Thua thì chơi lại chính Đêm đó.
- Bóng Mực đuổi khi Mây vào tầm 12 m (bỏ đuổi ở 18 m). Chạm vào thì mất 1 ngọn lửa (có 3), rơi một nửa số đom đóm đang mang ra quanh Mây (nhặt lại được trong 8 giây), rồi bất tử 1.5 giây; Bóng Mực bị đẩy lùi 2 m. Hết lửa thì thua; hết giờ mà chưa thắp hết đèn cũng thua.
- Rơi khỏi đảo (Y < -10) mất 1 ngọn lửa và toàn bộ đom đóm, rồi hồi sinh sau 1 giây.
- Bóng Mực không vào được vòng 6 m quanh đèn đã sáng.
- Điểm: +10 mỗi đom đóm nạp vào đèn, +100 mỗi đèn thắp, +5 mỗi Bóng Mực trúng Tỏa Sáng. Khi thắng cộng thêm +2 mỗi giây còn lại và +50 mỗi ngọn lửa còn lại.
- **Đêm 2 (Đảo Cau):** hai đảo nối bằng cầu tre không lan can, bục vàng tung Mây sang đảo bên kia, Gió Lạc cướp đom đóm của người mang từ 5 trở lên, Bùa Gió (chạy 7.2 m/s, lướt không hồi chiêu trong 10 giây).
- **Đêm 3 (Đảo Chuông):** ba tầng với vách đứng, hai dốc, một bục nhảy lên tầng trên cùng, tháp chuông, và gió mạnh mỗi 30 giây (lá bay báo trước 2 giây).

## Headless (Test Contract v1.1)
Khai báo ở [game.contract.json](game.contract.json). Logic chạy 60 tick/giây, không cần cửa sổ hay GPU:
```
node src/headless/cli.ts --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json] --ticks <int> --out <f.jsonl> [--snapshot-every 10]
```
Mã thoát: 0 bình thường, 2 nếu `--night` không hợp lệ hoặc file scenario/inputs sai định dạng, khác 0 nếu lỗi khác. Cùng seed, scenario và inputs cho output giống hệt nhau. Một Đêm đầy đủ (21.600 tick) chạy trong dưới 0.3 giây.

## Kiểm chứng
- `npm test`: unit test (luật v1.1, ba bản đồ, Gió Lạc, Bùa, tất định, CLI, contract).
- `npm run proof`: chạy CLI thật qua 42 tình huống, tự đối chiếu, đo thời gian một Đêm đầy đủ và sinh bằng chứng ở [docs/proof/phase-2/](docs/proof/phase-2/README.md).
- `npm run fps`: đo FPS của bản 3D ở 1280x720 bằng Chrome thật (cần Chrome; đặt `CHROME_PATH` nếu ở chỗ khác).
- `npm run screens`: điều khiển bản 3D như người chơi bằng Chrome thật, chụp ảnh, kiểm tra tạm dừng, lưu cài đặt, luồng thua và chơi lại.
- Bằng chứng Phase 1 ở [docs/proof/phase-1/](docs/proof/phase-1/README.md) (khớp tag `phase-1`).

## Tài liệu
- Spec và giả định Phase 2: [docs/notes/phase2-spec.md](docs/notes/phase2-spec.md) (Phase 1: [assumptions.md](docs/notes/assumptions.md))
- Nhật ký dùng AI và retro: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Quy ước cho agent: [AGENTS.md](AGENTS.md)

## Sáng tạo của tôi
(bổ sung nếu còn thời gian; phải không đổi đầu ra headless)
