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


## Additional fix after live UI verification (2026-10-02)

The supplied screenshot showed the legacy extraction fallback text still rendered as source data while the regulation badge remained green. The source has therefore been hardened again:

1. The exact fallback phrase shown in the screenshot is now explicitly rejected.
2. `sanitizeSourceText()` is applied to restored source packages and manual source input.
3. React self-healing guards clear invalid lesson/regulation state immediately.
4. A versioned source-state migration clears only invalid legacy localStorage values.
5. Bước 0 completion and navigation use the same validation function as the status badge.
6. Vercel sends `no-store` for the HTML entry point to force a fresh application shell after deployment.

If the old green badge is still visible after deploying this ZIP, the browser is not executing this source build; use a fresh Vercel deployment and hard-refresh the site.

## V3 — Source validation hotfix (2026-10-02)

Root cause confirmed from the reported screenshot: the validation in V2 was too dependent on exact fallback phrases. A paraphrased fallback such as:

`Bạn chưa cung cấp nội dung văn bản hoặc hình ảnh tài liệu cần trích xuất...`

could pass an overly narrow string check in an older/browser deployment and appear as a valid regulation source.

V3 fixes this at four layers:

1. `utils/sourceValidation.ts`
   - Adds semantic fallback detection using combined signals (`chưa cung cấp` + extraction/upload language).
   - Normalizes Markdown markers and whitespace before validation.
   - `sanitizeSourceText()` returns an empty string for fallback/error text.
2. `App.tsx`
   - Bumps source schema to `2026-10-source-validation-v3`.
   - Invalid lesson/regulation values are removed at boot.
   - Invalid values are never persisted back to localStorage.
   - Dependent Step 1/2/3/5 results are cleared when the mandatory regulation source is invalid.
3. `pages/SourceSetup.tsx`
   - Mục 1 and Mục 2 status indicators use memoized validation values from the same validator.
   - The Next button uses the same validity decision.
4. `server.ts` and Step 1/2/3 clients
   - Mandatory regulation-source checks use the same validator, so the API cannot accept the fallback text as a regulation source.

Smoke test results:
- Screenshot Mục 1 fallback => INVALID
- Screenshot Mục 2 fallback => INVALID
- Representative real regulation text => VALID
- Representative real lesson text => VALID
