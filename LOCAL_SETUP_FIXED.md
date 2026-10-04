# Khắc phục lỗi `Failed to fetch` khi chạy local

Bản sửa này xử lý lỗi frontend ở `localhost:3001` gọi `/api/*` nhưng Vite không chuyển tiếp request sang backend `localhost:3000`.

## Chạy local

Cửa sổ 1:
```powershell
cd "E:\RA_DE_THI\Ra-De-thi-main_AUDITED_VERCEL_2026-10-03\Ra-De-thi-main"
npm.cmd run dev
```

Cửa sổ 2:
```powershell
cd "E:\RA_DE_THI\Ra-De-thi-main_AUDITED_VERCEL_2026-10-03\Ra-De-thi-main"
npm.cmd exec vite -- --host
```

Mở:
`http://localhost:3001`

Vite sẽ proxy `/api/*` từ `3001` sang backend `3000`.

## Gemini API key

Tạo file `.env.local` trong thư mục project:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

`dev-server.ts` của bản sửa sẽ tự nạp `.env.local` khi chạy local. Không commit file `.env.local`.

## Kiểm tra backend

Mở:
`http://localhost:3000/api/health`

Kỳ vọng:
- `ok: true`
- `geminiConfigured: true`
- `build: 2026-10-source-validation-v11`

Nếu `geminiConfigured` là `false`, lỗi không còn là Vite/proxy; cần cấu hình `GEMINI_API_KEY`.
