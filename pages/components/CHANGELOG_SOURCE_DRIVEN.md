
## Bản sửa Bước 0 / Vercel – 2026-10-02
- Loại bỏ việc coi thông báo lỗi số hóa của Gemini là dữ liệu thật trong Mục 1/Mục 2.
- Làm sạch `localStorage` cũ và vô hiệu hóa kết quả phụ thuộc khi thiếu nguồn quy định hợp lệ.
- Kiểm tra kết quả `/api/extract-text` ở cả server và client trước khi lưu.
- Điều chỉnh upload theo giới hạn request/response của Vercel; ảnh vẫn được nén phía client.
- Cập nhật Google GenAI SDK lên nhánh 2.24.x và bỏ cấu hình sampling không cần thiết cho Gemini 3.8.
# CHANGELOG — SOURCE-DRIVEN REGULATION

## Mục tiêu
Loại bỏ hoàn toàn sự phụ thuộc cứng vào văn bản quy định cũ, nhưng giữ nguyên giao diện và các luồng chức năng chính của ứng dụng.

## Đã chỉnh sửa

- Đổi state nội bộ từ tên phụ thuộc văn bản cũ sang `regulationSource`.
- Đổi khóa lưu trữ sang `qbank_regulation_source`.
- Xóa mọi chuỗi nhận diện/sử dụng trực tiếp văn bản cũ trong source.
- Đồng bộ source qua các API Step 1, Step 2, Step 3, Step 5.
- Kho đề, xuất đề, lưu session và phân tích bài làm sử dụng `regulationSource`.
- Loại bỏ fallback văn bản quy định.
- Loại bỏ phân bổ ma trận mặc định theo một cấu trúc điểm cố định.
- Loại bỏ công thức điểm/câu cố định khỏi thao tác chỉnh sửa ma trận.
- Bước 3 dùng cấu trúc nguồn-driven thay vì ép một cấu trúc phần thi cố định.
- Checklist chuyển sang trạng thái chưa xác thực cho đến khi có đối chiếu nguồn.

## Không thay đổi chủ ý

- Giao diện React/Tailwind hiện có.
- Các bước workflow và điều hướng chính.
- Kho đề, giao bài, QR, lưu bài học sinh và các tính năng quản lý hiện có.
- Cơ chế AI/Gemini và fallback model hiện có.
- Các template bài học/đề mẫu đang có, vì chúng không phải là nguồn quy định pháp lý mặc định.


## Phiên bản cập nhật Gemini/Vercel
- Loại bỏ toàn bộ model model Gemini thế hệ cũ và cấu hình gọi trực tiếp bằng model đã ngừng hoạt động.
- Chuẩn hóa lời gọi AI server-side qua `@google/genai` với `gemini-3.8-flash` và fallback `3.7/3.6/3.5`.
- Không inject `GEMINI_API_KEY` vào Vite frontend bundle.
- Thêm Vercel serverless wrapper cho toàn bộ `/api/*`.


## 2026-10-02 — Source validation hardening v2

- Added strict detection of the exact legacy extraction fallback shown in Mục 1/Mục 2 screenshots.
- Added `sanitizeSourceText()` so fallback/error prose can never be stored as lesson or regulation data, including manual paste and restored exam packages.
- Added self-healing React guards for legacy invalid state.
- Added a source-schema migration marker so the first launch of the new build cleans only invalid legacy source values.
- Navigation and Bước 0 completion now use source validation rather than a non-empty-string check.
- Added Vercel `no-store` headers for the HTML entry point to reduce stale-browser/deployment-cache problems.
