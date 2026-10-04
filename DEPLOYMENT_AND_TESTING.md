# HƯỚNG DẪN CẤU HÌNH & KIỂM THỬ – RA ĐỀ THI

## 1. Cấu trúc triển khai đã chuẩn hóa

- Frontend React/Vite: build vào `public/`.
- Backend Express: `server.ts` là entrypoint duy nhất.
- `backend.ts` chỉ còn là compatibility shim, không còn một backend thứ hai.
- Gemini API: REST server-side, chỉ đọc `process.env.GEMINI_API_KEY`.
- Node.js: 24.x.
- Vercel: nhận diện Express theo `server.ts`; không cần `api/[...path].ts` wrapper.

Vercel hiện hỗ trợ deploy Express với zero configuration và nhận diện `server.ts` ở root; frontend tĩnh được phục vụ từ `public/`.

## 2. Biến môi trường

`.env.example`:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Local: tạo `.env.local` và không commit file này.

Vercel: Project → Settings → Environment Variables → `GEMINI_API_KEY`, sau đó Redeploy.

Kiểm tra:

```text
GET /api/health
```

Kỳ vọng:

- `ok: true`
- `geminiConfigured: true`
- `model: gemini-3.8-flash`
- `build: 2026-10-source-validation-v11`

## 3. Kiểm thử build cục bộ

```bash
npm install
npm run typecheck
npm run build:web
```

Kiểm thử API:

```bash
npm start
```

Sau đó mở `/api/health`.

Có thể dùng Vercel CLI `vercel dev` sau khi liên kết project để mô phỏng gần môi trường triển khai hơn.

## 4. Kiểm thử số hóa tài liệu

### TXT
- Tệp UTF-8 hợp lệ → trả về text.
- Tệp rỗng → 422.
- Nội dung fallback của AI → 422.

### DOCX
- DOCX hợp lệ → Mammoth trích xuất raw text.
- DOCX hỏng → 422, không làm sập API.

### PDF / PNG / JPG / WEBP
- Kiểm tra MIME + extension.
- Chuyển Base64 → Gemini multimodal.
- Không lưu câu trả lời fallback của Gemini thành dữ liệu nguồn.

### Payload
Vercel giới hạn request/response body của Function ở 4.5 MB. Source này chủ động giới hạn body Express và Base64 thấp hơn để có headroom; tài liệu lớn cần chia nhỏ hoặc chuyển sang cơ chế upload/storage chuyên dụng.

## 5. Kiểm thử hồi quy nghiệp vụ

1. Nạp nguồn bài học.
2. Nạp văn bản quy định.
3. Nạp đề mẫu/ma trận mẫu nếu có.
4. Chạy Bước 1.
5. Chạy Bước 2.
6. Chạy Bước 3.
7. Xuất bản.
8. Tạo mã đề tương đương ở Bước 5.
9. Lưu Kho đề.
10. Giao đề và kiểm tra cổng học sinh.
11. Nộp bài thử.
12. Mở phân tích bài làm.

Ở mỗi bước, kiểm tra rằng dữ liệu nguồn không bị thay thế bằng thông báo lỗi/fallback.

## 6. Lưu ý dữ liệu trên Vercel

`student-exams-vault.json` và `student-submissions.json` được giữ nguyên để bảo toàn quy trình hiện tại. Tuy nhiên filesystem của serverless không nên được xem là database bền vững. Các thao tác ghi có thể chỉ tồn tại trong instance hiện tại.

Nếu cần dữ liệu bài làm bền vững trên Vercel, phiên bản tiếp theo nên thêm database/object storage riêng. Không nên tự động đổi sang một dịch vụ mới trong bản này vì việc đó sẽ thay đổi kiến trúc lưu trữ nghiệp vụ.

## 7. Checklist trước khi merge GitHub

- [ ] `npm install` thành công.
- [ ] `npm run typecheck` thành công.
- [ ] `npm run build:web` thành công.
- [ ] Không có API key thật trong source.
- [ ] Không có `.env.local` trong commit.
- [ ] `/api/health` trả 200.
- [ ] Gemini model đúng `gemini-3.8-flash`.
- [ ] Upload TXT/DOCX/PDF/ảnh đã kiểm thử.
- [ ] Bước 0 không nhận fallback làm dữ liệu nguồn.
- [ ] Bước 1–5 không chạy khi thiếu nguồn quy định bắt buộc.
- [ ] Giao đề/nộp bài/phân tích bài làm không bị thay đổi.

## 8. Nguyên tắc cập nhật mã nguồn về sau

Không sửa trực tiếp một route chỉ để làm cho một trường hợp test pass. Mọi thay đổi upload/số hóa phải kiểm tra đồng thời:

`frontend upload → API validation → Gemini → source sanitizer → state/localStorage → Bước 1 → Bước 2 → Bước 3 → Bước 5`.

Mọi thay đổi Gemini phải kiểm tra:

`model → REST request schema → response schema → retry/fallback → error mapping → /api/health`.
