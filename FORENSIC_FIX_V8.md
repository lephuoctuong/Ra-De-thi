# FORENSIC FIX V8

## Hiện tượng

Deployment V7 đã vượt qua lỗi định tuyến 404 nhưng thao tác số hóa tài liệu trên giao diện vẫn có thể nhận HTTP 500 chung chung. Khi Vercel trả lỗi runtime trước hoặc trong lúc khởi tạo backend, frontend không có đủ thông tin để phân biệt lỗi cấu hình API key, lỗi SDK, quota hay lỗi dữ liệu.

## Thay đổi triệt để

1. Bỏ import runtime `@google/genai` khỏi `server.ts`.
2. Gọi Gemini 3.8 Flash qua REST `generateContent` từ server. API key chỉ nằm trong `process.env.GEMINI_API_KEY`.
3. Chuyển schema `Type.*` sang hằng số schema REST tương đương.
4. Chuẩn hóa nội dung multimodal từ dạng SDK cũ (`inlineData`) sang REST (`inline_data`).
5. Thêm timeout 55 giây và fallback model Gemini 3.7/3.6/3.5 cho lỗi tạm thời/quota.
6. Phân loại lỗi thành các mã HTTP/JSON rõ ràng, đặc biệt `MISSING_GEMINI_API_KEY`, `GEMINI_AUTH`, `GEMINI_QUOTA`, `GEMINI_BAD_REQUEST`, `GEMINI_TIMEOUT`.
7. `/api/health` trả `build`, `runtime`, `geminiConfigured`, `model` nhưng không bao giờ trả API key.
8. Import `mammoth` trì hoãn chỉ khi xử lý DOCX.
9. Nâng Node deployment target lên `24.x`.
10. Giữ nguyên các route nghiệp vụ, Steps 0–6, dữ liệu ngân hàng câu hỏi/ma trận/bản đặc tả/đề thi và logic chống lưu fallback nguồn.

## Kiểm tra bắt buộc sau deploy

Mở `/api/health`. Kết quả phải là JSON có:

- `ok: true`
- `build: 2026-10-source-validation-v8`
- `runtime: "vercel"`
- `model: "gemini-3.8-flash"`
- `geminiConfigured: true`

Nếu `geminiConfigured` là `false`, đây là cấu hình Vercel chứ không phải lỗi mã nguồn: thêm `GEMINI_API_KEY` trong Project Settings → Environment Variables và Redeploy.

## Security detail

The Gemini REST request now sends the key in the `x-goog-api-key` request header rather than putting the key in the URL query string. The key is never returned by `/api/health` or any browser response.
