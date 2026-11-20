# Đảo Đèn Lồng

> Video demo: (cập nhật ở Release v1.0.0)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn và né Bóng Mực trong sương đen.

**Trạng thái:** đang dựng khung (Phase 1). Lõi mô phỏng và bản 3D chưa xong.

## Cài đặt và chạy
```
npm install
npm test
node src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out/run.jsonl
```

## Headless
Theo Test Contract v1.0, khai báo ở [game.contract.json](game.contract.json):
```
node src/headless/cli.ts --seed <int> --night 1 [--scenario f.json] [--inputs f.json] --ticks <int> --out <f.jsonl> [--snapshot-every 10]
```

## Tài liệu
- Giả định và kế hoạch kiểm chứng: [docs/notes/assumptions.md](docs/notes/assumptions.md)
- Nhật ký dùng AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Quy ước cho agent: [AGENTS.md](AGENTS.md)

## Điều khiển, cách tính điểm, Sáng tạo của tôi
(bổ sung khi có bản chơi được)
