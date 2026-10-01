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
