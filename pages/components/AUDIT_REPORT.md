# Báo cáo rà soát – bản Vercel/Gemini 3.8

## Đã sửa

- Loại bỏ hoàn toàn các chuỗi/model model Gemini thế hệ cũ và SDK legacy khỏi source.
- Chuẩn hóa các lời gọi Gemini server-side về `gemini-3.8-flash`, có fallback 3.7/3.6/3.5.
- Cập nhật `@google/genai` lên nhánh 2.24.x và yêu cầu Node.js >= 20.
- Không inject `GEMINI_API_KEY` vào frontend; khóa chỉ đọc từ `process.env.GEMINI_API_KEY` ở server.
- Bổ sung kiểm tra dữ liệu nguồn để không lưu thông báo lỗi/fallback của Gemini vào Mục 1 hoặc Mục 2.
- Tự làm sạch `localStorage` cũ chứa fallback extraction; kết quả Bước 1/2/3/5 cũ cũng được vô hiệu hóa khi không có văn bản quy định hợp lệ.
- `/api/extract-text` kiểm tra kết quả ở server trước khi trả về.
- Giới hạn payload upload phía client phù hợp với giới hạn request body của Vercel; ảnh vẫn được nén trước khi gửi.
- Chặn response số hóa quá lớn để tránh vượt giới hạn response của Vercel.
- Loại bỏ `temperature` khỏi các cấu hình gọi Gemini trong source hiện tại để tránh cấu hình sampling không tương thích với model mới.
- Giữ nguyên các page, dữ liệu ngân hàng/ma trận/đề thi và quy trình nghiệp vụ Bước 0–6.
- Loại bỏ `bun.lock` cũ để Vercel không vô tình chọn lockfile chứa SDK Gemini cũ; `package-lock.json` là lockfile triển khai chính.

## Kiểm tra đã thực hiện

- Quét source: không còn `model Gemini thế hệ cũ`, cấu hình SDK REST legacy.
- Quét API key: không phát hiện API key literal trong source.
- Đếm điểm gọi Gemini: 11 điểm gọi `generateContent`, đều đi qua wrapper retry/fallback.
- Kiểm tra cú pháp TypeScript/TSX bằng TypeScript transpilation: các file đã chỉnh sửa đều hợp lệ về cú pháp.
- Kiểm tra hành vi validator: fallback trong ảnh bị đánh dấu không hợp lệ; văn bản nguồn thật được chấp nhận.

## Kiểm tra build

Môi trường kiểm tra hiện tại không có dependency `node_modules` và không thể tải đầy đủ npm registry trong thời gian kiểm tra, vì vậy không ghi nhận giả rằng `npm run lint`/`npm run build:web` đã chạy thành công. Sau khi đưa lên GitHub/Vercel, hệ thống build sẽ cài dependency từ `package-lock.json`.
