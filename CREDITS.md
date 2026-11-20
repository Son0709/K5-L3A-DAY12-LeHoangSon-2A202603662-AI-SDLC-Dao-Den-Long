# Credits

## Nội dung gốc
- Nhân vật (Mây, Bóng Mực, Gió Lạc, Ông Đăng), bối cảnh Đảo Đèn Lồng và tên các đảo: bản gốc của lab Đảo Đèn Lồng. Dự án không dùng nhân vật, nhạc, mô hình hay thương hiệu của game hoặc phim có sẵn.
- Toàn bộ hình ảnh trong game là **hình khối dựng bằng mã** (Three.js) và hình ảnh canvas tạo tại chỗ. Không có file hình, mô hình 3D hay font nào được thêm vào repo (giao diện dùng font hệ thống).
- Toàn bộ âm thanh (nhạc nền và 10 hiệu ứng) được **tổng hợp tại chỗ bằng Web Audio** (`src/web/audio.ts`). Không có file âm thanh.
- Ảnh chụp trong `docs/proof/` là ảnh chụp màn hình của chính game này.

## Công cụ AI tạo nội dung
- **Claude Code (Anthropic), model Sonnet 5.5**: viết phần lớn mã nguồn, test, tài liệu và các script kiểm chứng của dự án này, dưới sự điều phối, duyệt và kiểm chứng của tác giả. Các lời nhắc và harness (AGENTS.md, skill, hook) được giữ trong repo; nhật ký dùng AI ở `docs/notes/ai-log.md`.

## Thư viện và công cụ bên thứ ba (không sửa đổi, cài qua npm)
| Thành phần | Giấy phép | Dùng cho |
|---|---|---|
| [three](https://github.com/mrdoob/three.js) r187 | MIT | dựng cảnh 3D |
| [vite](https://github.com/vitejs/vite) | MIT | build và máy chủ phát triển |
| [typescript](https://github.com/microsoft/TypeScript) | Apache-2.0 | kiểm kiểu |
| [@types/three](https://github.com/DefinitelyTyped/DefinitelyTyped), @types/node | MIT | khai báo kiểu |
| [puppeteer-core](https://github.com/puppeteer/puppeteer) | Apache-2.0 | điều khiển Chrome cho `bench`, `fps`, `screens`, `e2e:leaderboard` (chỉ công cụ phát triển, không nằm trong game) |
| Node.js | MIT | môi trường chạy |
| Google Chrome / Chromium | (phần mềm có sẵn trên máy) | trình duyệt để chơi và để đo; không đi kèm repo |

## Giấy phép của dự án
MIT, xem [LICENSE](LICENSE).
