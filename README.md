# CÂU HỎI VÀ ĐỀ THI — Phiên bản nguồn quy định động

Ứng dụng giữ nguyên kiến trúc, giao diện và các luồng chức năng hiện có. Phiên bản này đã loại bỏ sự phụ thuộc cứng vào một văn bản quy định cụ thể.

## 1. Thay đổi chính

- Văn bản quy định ở **Bước 0** là nguồn bắt buộc do giáo viên tải lên hoặc dán trực tiếp.
- Không còn văn bản quy định mặc định được nhúng trong mã nguồn.
- Nguồn quy định được truyền xuyên suốt các bước: **Bước 0 → Bước 1 → Bước 2 → Bước 3 → Bước 5 → Kho đề → dữ liệu bài làm**.
- Khi thay nguồn quy định, các kết quả AI phụ thuộc vào nguồn cũ được xóa để tránh trộn dữ liệu.
- Ma trận mặc định không còn tự áp đặt số câu, điểm/câu hoặc cấu trúc đề cố định.
- Bước 3 không còn bắt buộc một cấu trúc phần thi hoặc tổng điểm cố định; cấu trúc phải lấy từ nguồn quy định + đề mẫu + ma trận/bản đặc tả.
- Các công thức điểm cố định trong bộ biên soạn ma trận đã được loại bỏ; điểm phải kế thừa từ nguồn đã xác lập.
- Tên trường, môn, khối, thời lượng và các tính năng giao đề/kho đề/phân tích bài làm hiện có được giữ nguyên.

## 2. Kiến trúc nguồn mới

```text
BƯỚC 0
  ├─ Tài liệu bài học / SGK
  ├─ Văn bản quy định chính thức  ← nguồn bắt buộc, do giáo viên cung cấp
  ├─ Đề kiểm tra mẫu
  └─ Ma trận mẫu (nếu có)
          ↓
BƯỚC 1 — Phân tích nguồn + nhận dạng form
          ↓
BƯỚC 2 — Ma trận + Bản đặc tả
          ↓
BƯỚC 3 — Đề kiểm tra gốc + đáp án + hướng dẫn chấm
          ↓
BƯỚC 4 — Xuất bản
          ↓
BƯỚC 5 — Mã đề tương đương
          ↓
Kho đề / Giao bài / Bài làm học sinh / Phân tích
```

## 3. Chạy ứng dụng tại máy tính

### Yêu cầu

- Node.js 20+ khuyến nghị.
- npm.
- API key Gemini được đặt trong biến môi trường `GEMINI_API_KEY`.


### V8 — ổn định Gemini/Vercel

- Backend gọi Gemini 3.8 Flash bằng **REST API server-side** thay vì import `@google/genai` tại runtime; điều này loại bỏ một điểm lỗi bundling/runtime thường gặp trên Vercel.
- API key chỉ đọc từ `process.env.GEMINI_API_KEY`, tuyệt đối không đưa vào frontend.
- Có `/api/health` để kiểm tra deployment và trạng thái cấu hình Gemini mà không làm lộ key.
- Lỗi Gemini được trả về theo mã rõ ràng (`MISSING_GEMINI_API_KEY`, `GEMINI_AUTH`, `GEMINI_QUOTA`, `GEMINI_BAD_REQUEST`, `GEMINI_TIMEOUT`...) thay vì popup 500 chung chung.
- Tệp Word dùng import `mammoth` trì hoãn; lỗi import một thư viện không còn làm hỏng toàn bộ API function khi xử lý ảnh/PDF.
- Dùng Node `24.x` cho deployment mới; Vercel đã vô hiệu hóa Node 20 cho deployment mới từ 01/10/2026.

### Cài đặt

```bash
npm install
```

Tạo file `.env.local`:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### Chạy phát triển

```bash
npm run dev
```

Mở trình duyệt tại:

```text
http://localhost:3000
```

### Kiểm tra TypeScript

```bash
npm run lint
```

### Build production

```bash
npm run build
```

Sau khi build:

```bash
npm start
```

## 4. Đưa lên GitHub

1. Tạo repository mới trên GitHub.
2. Giải nén ZIP.
3. Mở Terminal tại thư mục dự án.
4. Chạy:

```bash
git init
git add .
git commit -m "Remove hardcoded regulation dependency"
git branch -M main
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
```

**Không đưa `.env.local` hoặc API key lên GitHub.**

## 5. Đưa lại vào Google AI Studio

- Mở dự án ứng dụng hiện có trong Google AI Studio.
- Chọn chức năng nhập/đưa source code vào dự án.
- Sử dụng **toàn bộ ZIP phiên bản này**, không trộn từng file với phiên bản cũ.
- Sau khi import, kiểm tra lại biến môi trường/API key theo môi trường chạy.

## 6. Kiểm thử bắt buộc

### Test 01 — Không có văn bản quy định
- Mở ứng dụng mới.
- Không tải văn bản quy định.
- Bấm sang Bước 1.
- Kỳ vọng: hệ thống chặn và yêu cầu cung cấp nguồn.

### Test 02 — Nạp văn bản quy định A
- Tải văn bản quy định A.
- Nạp SGK/giáo án và đề mẫu.
- Chạy Bước 1.
- Kỳ vọng: kết quả phân tích phải dẫn chiếu và tuân theo nguồn A.

### Test 03 — Đổi sang văn bản quy định B
- Thay A bằng B.
- Kỳ vọng: kết quả Bước 1, 2, 3 và 5 cũ bị xóa; không trộn dữ liệu A/B.

### Test 04 — Ma trận không có nguồn mẫu
- Chỉ nạp văn bản quy định + tài liệu bài học.
- Kỳ vọng: không tự sinh số câu/điểm cố định theo một mẫu cũ.

### Test 05 — Ma trận có nguồn mẫu
- Nạp thêm ma trận/đề mẫu.
- Kỳ vọng: Bước 1 nhận dạng cấu trúc từ nguồn; Bước 2 kế thừa cấu trúc đã phân tích.

### Test 06 — Tạo đề
- Chạy Bước 3.
- Kiểm tra số phần, dạng câu, điểm số và thang điểm có khớp văn bản quy định + ma trận/bản đặc tả.

### Test 07 — Tạo mã đề
- Chạy Bước 5.
- Kiểm tra các mã đề giữ nguyên cấu trúc, mức độ, yêu cầu cần đạt và tổng điểm theo đề gốc đã được xác lập.

### Test 08 — Kho đề và bài làm
- Lưu đề.
- Mở Kho đề.
- Mở sản phẩm bài làm học sinh.
- Kỳ vọng: nguồn quy định vẫn được lưu trong package/session và không bị mất ở các bước sau.

## 7. Các điểm cần bổ sung trong phiên bản tiếp theo

1. **Nhận diện metadata của văn bản quy định**: tên, số/ký hiệu, ngày ban hành, cơ quan ban hành, phạm vi áp dụng.
2. **Hash nguồn quy định** để mỗi đề có thể truy vết chính xác phiên bản văn bản đã sử dụng.
3. **Versioning** cho nguồn quy định: A/B/C và lịch sử thay đổi.
4. **Cổng kiểm tra đồng bộ trước khi tạo đề**: nguồn → Bước 1 → ma trận → đặc tả → đề → đáp án → hướng dẫn chấm.
5. **Không cho chốt đề nếu phát hiện mâu thuẫn** giữa văn bản quy định, ma trận và đề.
6. **Audit log** ghi thời điểm, nguồn quy định, mã đề và các phiên bản dữ liệu đã dùng.
7. Khi có văn bản mới thay thế văn bản cũ, nên có cảnh báo rõ ràng để giáo viên chủ động xác nhận nguồn đang sử dụng.

## 8. Lưu ý quan trọng

ZIP này được tối ưu để **không phụ thuộc cứng vào một văn bản quy định cụ thể**. File ZIP nguồn người dùng cung cấp hiện không chứa một file PDF/Word riêng của văn bản quy định mới; vì vậy ứng dụng được thiết kế theo mô hình **source-driven**: giáo viên cung cấp văn bản chính thức ở Bước 0, sau đó toàn bộ quy trình sử dụng chính nguồn đó.

## 9. Cấu hình Gemini và triển khai Vercel

- Ứng dụng sử dụng **Google GenAI SDK `@google/genai` 2.24.x** ở phía server.
- Model mặc định: **`gemini-3.8-flash`**.
- Fallback khi lỗi tạm thời/quota: `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash`.
- Không còn cấu hình/model model Gemini thế hệ cũ trong mã nguồn.
- `GEMINI_API_KEY` chỉ được đọc ở server (`process.env.GEMINI_API_KEY`), không được inject vào Vite/frontend bundle.
- Trên Vercel, khai báo `GEMINI_API_KEY` trong **Project Settings → Environment Variables**; không commit `.env.local`.
- Bước 0 kiểm tra kết quả số hóa trước khi lưu: các chuỗi lỗi/fallback của Gemini không được phép trở thành `lesson` hoặc `regulationSource`.
- Trên Vercel, tệp gửi tới `/api/extract-text` được giới hạn thực tế ở **3 MB/tệp** để chừa headroom cho payload Base64/JSON dưới giới hạn request 4.5 MB của Vercel; tài liệu lớn cần chia nhỏ hoặc dán trực tiếp nội dung.
- Kết quả số hóa quá lớn cũng được chặn trước khi trả về để tránh vượt giới hạn response của Vercel.

### Triển khai GitHub → Vercel

1. Đẩy toàn bộ thư mục dự án lên GitHub.
2. Import repository vào Vercel.
3. Giữ Build Command: `npm run build:web`.
4. Output Directory: `dist`.
5. Thêm biến môi trường:
   `GEMINI_API_KEY=<API_KEY_CỦA_BẠN>`
6. Deploy và kiểm tra các endpoint `/api/*`.

**Lưu ý về dữ liệu server:** Vercel Functions không phải hệ thống lưu trữ dữ liệu bền vững. Các file JSON `student-exams-vault.json` và `student-submissions.json` vẫn được giữ nguyên trong source ZIP và được dùng tốt khi chạy Node server truyền thống, nhưng khi triển khai serverless trên Vercel, dữ liệu ghi mới vào filesystem không nên được xem là kho dữ liệu lâu dài. Nếu cần lưu trữ bền vững trên Vercel, nên bổ sung database/object storage ở một phiên bản riêng mà không thay đổi quy trình nghiệp vụ hiện tại.



## Deployment note — V7 Vercel API routing fix

This package uses the current Vercel Express deployment model: the root `server.ts` exports the Express app as the **default export**. The previous `api/[...path].ts` catch-all wrapper has been removed because it could leave the static Vite shell deployed while `/api/*` requests returned HTTP 404.

V7 also adds a diagnostic endpoint:

`GET /api/health`

A successful deployment returns HTTP 200 JSON containing `build: 2026-10-source-validation-v8`. Test this endpoint before testing Gemini.

Vercel Build Command: `npm run build:web`
Output Directory: `dist`
Node.js: `>=22`
Environment Variable: `GEMINI_API_KEY` (server-side only)

## Deployment note — source validation v2

This build contains a self-healing migration for legacy `localStorage` values that were incorrectly storing the extraction fallback text in Mục 1/Mục 2. It also marks the HTML entry point as `no-store` on Vercel to reduce stale-shell issues.

After importing a new commit into Vercel, open the deployment URL and perform one hard refresh. The build marker is available as the HTML meta tag `app-build=2026-10-02-source-validation-v2`.

If Mục 2 still shows a green “Đã có văn bản quy định” badge while its textarea contains the fallback sentence beginning “Bạn chưa cung cấp hình ảnh...”, the browser is executing an older deployment and not this build.

## Deployment verification for V3 source-validation fix

This source package contains build marker `2026-10-source-validation-v3` in `index.html`.
After deploying to Vercel, open the new deployment URL and perform a hard refresh (`Ctrl+Shift+R`).
The Mục 2 status must be red/"Chưa cung cấp văn bản quy định" when the textarea contains any extraction fallback such as:

`Bạn chưa cung cấp nội dung văn bản hoặc hình ảnh tài liệu cần trích xuất...`

The green `✓ Đã có văn bản quy định` state is reserved for actual user-provided regulation content.

## Deployment note — V8 Step 0 / HTTP 500 forensic fix

V8 keeps the V7 Vercel Express entrypoint and adds a bounded 60-second function duration for `server.ts`. `/api/health` now reports `build: 2026-10-source-validation-v8`, the active Gemini model, and a boolean `geminiConfigured` flag without exposing the API key.

For PDF/image digitization, Step 0 checks `/api/health` before sending the file and the server uses Gemini 3.8 Flash with low thinking for lower latency. Gemini errors are returned as structured JSON with a specific code instead of collapsing every API failure into HTTP 500.

After deployment, verify:
- `/api/health` → `build` is `2026-10-source-validation-v8`
- `/api/health` → `geminiConfigured` is `true`
- Then test a small PDF/image in Step 0.
