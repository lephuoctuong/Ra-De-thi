# BÁO CÁO RÀ SOÁT & BÀN GIAO – RA ĐỀ THI

Ngày rà soát: 03/10/2026

## 1. Phạm vi

Đã rà soát ZIP mã nguồn được cung cấp, tập trung vào:

- luồng frontend React/Vite;
- Express API và các endpoint Gemini;
- số hóa tài liệu;
- biến môi trường;
- cấu hình Vercel/Node;
- dependency manifest và lockfile;
- lưu trữ đề/bài làm;
- các điểm có nguy cơ lỗi build/runtime.

## 2. Lỗi đã sửa trong bản bàn giao

### A. Lỗi nghiêm trọng trong `server.ts`

`/api/extract-text` tồn tại hai đoạn triển khai chồng lấn. Sau khi handler đầu tiên đóng, phần code xử lý TXT/PDF/ảnh cũ vẫn còn, tạo ra cấu trúc route không hợp lệ và có nguy cơ làm TypeScript/build fail.

Đã loại bỏ đoạn triển khai trùng, giữ lại một handler `/api/extract-text` duy nhất với:

- kiểm tra Base64;
- giới hạn payload;
- DOCX → Mammoth;
- TXT → UTF-8;
- PDF/ảnh → Gemini multimodal;
- validation kết quả số hóa;
- giới hạn response;
- mã lỗi có cấu trúc.

### B. Hai backend cạnh tranh

Source có `server.ts` và `backend.ts` chứa hai bản Express backend khác nhau. `backend.ts` còn model Gemini cũ và cấu hình khác `server.ts`.

Đã chuyển `backend.ts` thành compatibility shim trỏ về `server.ts`. `dev.ts` cũng dùng trực tiếp backend chuẩn.

Kết quả: chỉ còn một nguồn sự thật cho API.

### C. Lockfile không đồng bộ

`package.json` khai báo `qrcode` nhưng `package-lock.json` cũ không có package này và vẫn còn dấu vết `@google/genai` đã bị loại khỏi runtime.

Do môi trường rà soát không truy cập được npm registry, không thể tạo lại lockfile chính xác. Thay vì giao một lockfile sai khiến `npm ci` có thể thất bại, lockfile cũ đã được loại khỏi bản bàn giao. Vercel/npm sẽ tạo dependency tree từ `package.json`.

### D. Chuẩn hóa Node.js

Giữ Node.js `24.x`, phù hợp với trạng thái Vercel hiện tại. Node 20 đã bị Vercel deprecate cho build/function mới từ 01/10/2026.

### E. Chuẩn hóa Vercel

Vite build vào `public/`. `server.ts` là Express entrypoint duy nhất. `vercel.json` được đồng bộ Output Directory = `public`.

Không thêm `api/[...path].ts` cạnh `server.ts`, vì Vercel hiện có cơ chế zero-configuration cho Express và nhận diện `server.ts`.

## 3. Gemini API

Model production:

`gemini-3.8-flash`

Fallback:

`gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash`

Các model trên đều đang có trong danh mục Gemini API hiện hành.

API key:

`process.env.GEMINI_API_KEY`

Không đưa API key vào frontend bundle.

Endpoint:

`GET /api/health`

Không trả về giá trị secret; chỉ trả về trạng thái `geminiConfigured`.

## 4. Số hóa dữ liệu

Pipeline hiện tại:

`Upload → Base64 → kiểm tra payload → phân loại MIME → Mammoth/TXT hoặc Gemini → validate → sanitize → lưu source`

Các fallback kiểu “chưa cung cấp tài liệu”, “vui lòng tải lên...” không được phép trở thành dữ liệu nguồn hợp lệ.

## 5. Vercel payload

Vercel giới hạn request/response body của Function ở 4.5 MB. Source đang đặt Express JSON limit 4 MB và giới hạn Base64 ở mức thấp hơn giới hạn platform để tạo headroom.

Do Base64 làm tăng kích thước dữ liệu, tài liệu lớn cần chia nhỏ. Đây là giới hạn nền tảng, không phải lỗi giao diện.

## 6. Điểm cần lưu ý nhưng không tự ý thay đổi

### Lưu trữ JSON

`student-exams-vault.json` và `student-submissions.json` vẫn được giữ nguyên để không thay đổi quy trình nghiệp vụ. Tuy nhiên filesystem serverless không phải database bền vững. Trên Vercel, dữ liệu ghi mới không nên được xem là lưu trữ lâu dài.

Muốn giải quyết triệt để cần thêm database/object storage ở một phiên bản riêng.

### Dữ liệu mặc định

Source vẫn có một số dữ liệu mẫu/hardcode về đơn vị, môn học và năm học cũ trong giao diện/kho đề. Vì yêu cầu hiện tại là giữ nguyên giao diện và quy trình nghiệp vụ, các giá trị này không bị xóa tự ý. Đây là hạng mục nên tách thành cấu hình hệ thống ở phiên bản sau nếu cần dùng cho nhiều trường.

## 7. Kiểm thử thực tế

Đã thực hiện kiểm tra tĩnh và rà soát cấu trúc source.

Không thể hoàn tất `npm install`/`npm run typecheck`/`npm run build:web` trong môi trường kiểm tra hiện tại vì môi trường không phân giải được `registry.npmjs.org` và lệnh cài dependency bị timeout.

Vì vậy không tuyên bố giả rằng bản build production đã chạy thành công.

## 8. Checklist kiểm thử sau khi đưa ZIP lên máy/GitHub/Vercel

```text
[ ] npm install
[ ] npm run typecheck
[ ] npm run build:web
[ ] npm start
[ ] GET /api/health → 200
[ ] geminiConfigured = true
[ ] Upload TXT
[ ] Upload DOCX
[ ] Upload PDF
[ ] Upload PNG/JPG/WEBP
[ ] Bước 0 không nhận fallback làm nguồn
[ ] Bước 1
[ ] Bước 2
[ ] Bước 3
[ ] Bước 5
[ ] Lưu Kho đề
[ ] Giao đề
[ ] Học sinh nộp bài
[ ] Phân tích bài làm
```

## 9. Tình trạng bàn giao

Bản ZIP bàn giao đã được làm sạch các lỗi source-level quan trọng phát hiện trong lần rà soát này và giữ nguyên kiến trúc/giao diện/nghiệp vụ hiện hữu ở mức tối đa.

Điểm chưa thể xác nhận trong môi trường hiện tại là build thực tế sau cài dependency, do hạn chế kết nối npm registry.
