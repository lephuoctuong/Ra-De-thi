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
- Loại bỏ toàn bộ model Gemini 2.0 và cấu hình gọi trực tiếp bằng model đã ngừng hoạt động.
- Chuẩn hóa lời gọi AI server-side qua `@google/genai` với `gemini-3.8-flash` và fallback `3.7/3.6/3.5`.
- Không inject `GEMINI_API_KEY` vào Vite frontend bundle.
- Thêm Vercel serverless wrapper cho toàn bộ `/api/*`.
