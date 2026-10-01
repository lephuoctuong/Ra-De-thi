// Bộ dữ liệu mẫu bài học, đề kiểm tra và ma trận theo chuẩn văn bản quy định & GDPT 2018 cho các môn học

export interface SubjectTemplateData {
  lesson: string;
  sampleExam: string;
  matrix: string;
}

// 1. SINH HỌC
const SINH_HOC_TEMPLATE = (grade: string = '9', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC SINH HỌC LỚP ${grade} - CHỦ ĐỀ: ADN VÀ BẢN CHẤT CỦA GEN

1. Cấu trúc hóa học của phân tử ADN:
- ADN (Axit Deoxyribonucleic) là đại phân tử hữu cơ cấu tạo theo nguyên tắc đa phân.
- Đơn phân là các nucleotide, gồm 4 loại: Adenine (A), Thymine (T), Guanine (G), Cytosine (C).
- Cấu trúc xoắn kép: Gồm 2 chuỗi polynucleotide xoắn song song ngược chiều nhau.
- Nguyên tắc bổ sung: A liên kết với T bằng 2 liên kết hydro (A = T), G liên kết với C bằng 3 liên kết hydro (G ≡ C).
- Hệ quả của nguyên tắc bổ sung:
  + Số lượng: A = T, G = C.
  + Tổng số nucleotide: N = 2A + 2G = 2T + 2C.
  + Chiều dài phân tử ADN: L = (N / 2) × 3.4 Å (hoặc 0.34 nm).
  + Số liên kết hydro: H = 2A + 3G.

2. Chức năng của ADN và cơ chế di truyền:
- Lưu giữ và truyền đạt thông tin di truyền qua các thế hệ tế bào và cơ thể.
- Quá trình nhân đôi ADN diễn ra trong nhân tế bào, theo nguyên tắc bán bảo toàn và nguyên tắc bổ sung.

3. Bản chất của gen và mối quan hệ ADN - ARN - Protein:
- Gen là một đoạn phân tử ADN mang thông tin mã hóa một sản phẩm xác định (chuỗi polypeptide hoặc ARN).
- Mối quan hệ: ADN (gen) làm khuôn mẫu tổng hợp mARN (phiên mã), mARN làm khuôn dịch mã tạo Protein, Protein biểu hiện thành tính trạng cơ thể.

4. Những sai lầm thường gặp của học sinh:
- Nhầm lẫn giữa nguyên tắc bổ sung trong nhân đôi ADN (A-T, G-C) với phiên mã tổng hợp mARN (A-U, T-A, G-C, C-G).
- Quên nhân hệ số 2 và 3 khi tính số liên kết hydro H = 2A + 3G.
- Áp dụng sai tỉ lệ phần trăm nucleotide: %A + %G = 50% tổng số nucleotide.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: SINH HỌC LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Đơn vị cấu tạo nên phân tử ADN là:
A. Axit amin.
B. Nucleotide.
C. Glucose.
D. Axit béo.

Câu 2. Trong phân tử ADN, nucleotide loại Adenine (A) liên kết bổ sung với nucleotide loại nào?
A. Thymine (T).
B. Guanine (G).
C. Cytosine (C).
D. Uracil (U).

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Học sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, học sinh chọn Đúng (Đ) hoặc Sai (S).
Cách tính điểm: Đúng 1 ý được 0.1 điểm, Đúng 2 ý được 0.25 điểm, Đúng 3 ý được 0.5 điểm, Đúng 4 ý được 1.0 điểm.

Câu 1. Khi nói về cấu trúc và chức năng của phân tử ADN:
a) Phân tử ADN được cấu tạo từ 4 loại nucleotide là A, U, G, C.
b) Các nucleotide trên hai mạch liên kết với nhau bằng liên kết hydro theo nguyên tắc bổ sung.
c) Quá trình nhân đôi ADN diễn ra theo nguyên tắc bán bảo toàn.
d) Chiều dài của phân tử ADN được tính bằng công thức L = N × 3.4 Å.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 6. Mỗi câu trả lời đúng được 0.5 điểm.

Câu 1. Một gen có tổng số 3000 nucleotide, trong đó số nucleotide loại Adenine (A) là 600. Hãy tính số lượng nucleotide loại Guanine (G) của gen đó.
Đáp số: .........`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN SINH HỌC - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Cấu tạo hóa học & Cấu trúc ADN | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Chức năng ADN & Cơ chế nhân đôi | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Bản chất Gen & Bài tập tính toán ADN | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 2. KHOA HỌC TỰ NHIÊN
const KHTN_TEMPLATE = (grade: string = '8', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC KHOA HỌC TỰ NHIÊN LỚP ${grade} - CHỦ ĐỀ: PHẢN ỨNG HÓA HỌC VÀ BIẾN ĐỔI CHẤT

1. Hiện tượng vật lí và hiện tượng hóa học:
- Hiện tượng vật lí: Là hiện tượng chất bị biến đổi về trạng thái, hình dạng nhưng vẫn giữ nguyên là chất ban đầu (ví dụ: nước đá tan, bẻ cong thanh sắt).
- Hiện tượng hóa học: Là hiện tượng chất biến đổi tạo ra chất mới có tính chất khác với chất ban đầu (ví dụ: than cháy tạo khí cacbonic, sắt bị gỉ sét).

2. Phản ứng hóa học và Định luật bảo toàn khối lượng:
- Phản ứng hóa học là quá trình biến đổi từ chất này thành chất khác. Chất ban đầu gọi là chất phản ứng (tham gia), chất mới sinh ra gọi là sản phẩm.
- Dấu hiệu nhận biết có phản ứng hóa học xảy ra: Có sự thay đổi màu sắc, xuất hiện kết tủa, giải phóng chất khí, tỏa nhiệt hoặc phát sáng.
- Định luật bảo toàn khối lượng: Trong một phản ứng hóa học, tổng khối lượng của các chất sản phẩm bằng tổng khối lượng của các chất phản ứng:
  m(A) + m(B) = m(C) + m(D)

3. Phương trình hóa học:
- Phương trình hóa học biểu diễn ngắn gọn phản ứng hóa học bằng công thức hóa học.
- Các bước lập phương trình hóa học: Viết sơ đồ phản ứng -> Cân bằng số nguyên tử mỗi nguyên tố -> Viết phương trình hóa học hoàn chỉnh.

4. Những sai lầm thường gặp của học sinh:
- Nhầm lẫn giữa hiện tượng vật lí (hòa tan muối vào nước) với hiện tượng hóa học.
- Quên không cân bằng hệ số trước công thức hóa học mà tự ý thay đổi chỉ số chân của nguyên tố.
- Quên tính cả khối lượng chất khí thoát ra khi áp dụng định luật bảo toàn khối lượng.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: KHOA HỌC TỰ NHIÊN LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Quá trình nào sau đây là hiện tượng hóa học?
A. Cồn để trong lọ không đậy nắp bị bay hơi.
B. Cơm để lâu ngày trong không khí bị ôi thiu.
C. Nước lỏng đông đặc thành đá trong tủ lạnh.
D. Dây tóc bóng đèn nóng sáng khi có dòng điện chạy qua.

Câu 2. Trong một phản ứng hóa học, hạt vi mô nào được bảo toàn?
A. Số phân tử của mỗi chất.
B. Số nguyên tử của mỗi nguyên tố.
C. Trạng thái của các chất.
D. Liên kết giữa các nguyên tử.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Học sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, học sinh chọn Đúng (Đ) hoặc Sai (S).
Cách tính điểm: Đúng 1 ý được 0.1 điểm, Đúng 2 ý được 0.25 điểm, Đúng 3 ý được 0.5 điểm, Đúng 4 ý được 1.0 điểm.

Câu 1. Cho thanh sắt (Fe) tác dụng với dung dịch axit clohiđric (HCl) sinh ra sắt(II) clorua (FeCl2) và khí hiđro (H2):
a) Đây là một hiện tượng hóa học vì có chất mới sinh ra.
b) Khí hiđro thoát ra là dấu hiệu nhận biết có phản ứng hóa học xảy ra.
c) Tổng khối lượng của Fe và dung dịch HCl phản ứng luôn nhỏ hơn khối lượng các sản phẩm tạo thành.
d) Phương trình hóa học đã cân bằng là: Fe + 2HCl -> FeCl2 + H2.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 6. Mỗi câu trả lời đúng được 0.5 điểm.

Câu 1. Nung nóng 100 gam đá vôi (CaCO3) thu được 56 gam vôi sống (CaO) và khí cacbon đioxit (CO2). Khối lượng khí CO2 thu được là bao nhiêu gam?
Đáp số: ......... gam`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN KHOA HỌC TỰ NHIÊN - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Biến đổi vật lí và biến đổi hóa học | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Phản ứng hóa học & Định luật bảo toàn khối lượng | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Phương trình hóa học & Tính theo phương trình | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 3. TOÁN
const TOAN_TEMPLATE = (grade: string = '9', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC TOÁN HỌC LỚP ${grade} - CHỦ ĐỀ: PHƯƠNG TRÌNH BẬC HAI MỘT ẨN VÀ HỆ THỨC VI-ÉT

1. Định nghĩa và công thức nghiệm phương trình bậc hai:
- Phương trình bậc hai một ẩn có dạng tổng quát: ax² + bx + c = 0 (với a ≠ 0).
- Biệt thức Delta: Δ = b² - 4ac.
  + Nếu Δ > 0: Phương trình có 2 nghiệm phân biệt: x1,2 = (-b ± √Δ) / (2a).
  + Nếu Δ = 0: Phương trình có nghiệm kép: x1 = x2 = -b / (2a).
  + Nếu Δ < 0: Phương trình vô nghiệm trên tập số thực ℝ.
- Biệt thức Delta phẩy (khi b = 2b'): Δ' = b'² - ac.

2. Hệ thức Vi-ét và ứng dụng:
- Định lý Vi-ét: Nếu x1, x2 là hai nghiệm của phương trình ax² + bx + c = 0 (a ≠ 0) thì:
  + Tổng hai nghiệm: S = x1 + x2 = -b / a
  + Tích hai nghiệm: P = x1 × x2 = c / a
- Ứng dụng nhẩm nghiệm:
  + Nếu a + b + c = 0 thì phương trình có nghiệm x1 = 1, x2 = c / a.
  + Nếu a - b + c = 0 thì phương trình có nghiệm x1 = -1, x2 = -c / a.
- Tìm hai số biết tổng S và tích P: Hai số đó là nghiệm của phương trình: X² - SX + P = 0 (điều kiện: S² - 4P ≥ 0).

3. Những sai lầm thường gặp của học sinh:
- Quên điều kiện a ≠ 0 khi biện luận số nghiệm của phương trình bậc hai chứa tham số.
- Nhầm dấu trong hệ thức Vi-ét: nhầm S = b/a (đúng phải là -b/a).
- Sai sót khi tính bình phương số âm trong biệt thức Delta: (-b)² thay vì -b².`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: TOÁN LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Biệt thức Δ của phương trình bậc hai 2x² - 5x + 2 = 0 là:
A. Δ = 9.
B. Δ = -9.
C. Δ = 41.
D. Δ = 1.

Câu 2. Nếu phương trình ax² + bx + c = 0 (a ≠ 0) có a + b + c = 0 thì nghiệm của phương trình là:
A. x1 = 1; x2 = -c/a.
B. x1 = 1; x2 = c/a.
C. x1 = -1; x2 = -c/a.
D. x1 = -1; x2 = c/a.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Học sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) ở mỗi câu, học sinh chọn Đúng (Đ) hoặc Sai (S).
Cách tính điểm: Đúng 1 ý được 0.1 điểm, Đúng 2 ý được 0.25 điểm, Đúng 3 ý được 0.5 điểm, Đúng 4 ý được 1.0 điểm.

Câu 1. Cho phương trình bậc hai: x² - 6x + 8 = 0 có hai nghiệm x1, x2:
a) Phương trình có biệt thức thu gọn Δ' = 1 > 0 nên có hai nghiệm phân biệt.
b) Tổng hai nghiệm theo định lý Vi-ét là x1 + x2 = 6.
c) Tích hai nghiệm theo định lý Vi-ét là x1 × x2 = -8.
d) Giá trị biểu thức A = x1² + x2² bằng 20.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 6. Mỗi câu trả lời đúng được 0.5 điểm.

Câu 1. Cho phương trình x² - 7x + 12 = 0. Tìm tổng x1 + x2 của hai nghiệm phương trình.
Đáp số: .........`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN TOÁN - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Phương trình bậc hai & Công thức nghiệm | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Hệ thức Vi-ét và các ứng dụng cơ bản | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Bài toán thực tế & Phương trình quy về bậc hai | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 4. NGỮ VĂN
const NGU_VAN_TEMPLATE = (grade: string = '9', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC NGỮ VĂN LỚP ${grade} - CHỦ ĐỀ: ĐỌC HIỂU VĂN BẢN VÀ NGHỊ LUẬN XÃ HỘI

1. Tri thức đọc hiểu văn bản:
- Thể loại: Truyện, thơ hiện đại hoặc văn bản nghị luận.
- Phương thức biểu đạt: Tự sự, miêu tả, biểu cảm, nghị luận, thuyết minh.
- Biện pháp tu từ thường gặp: So sánh, ẩn dụ, nhân hóa, hoán dụ, điệp từ/ngữ, liệt kê, tương phản. Tác dụng của biện pháp tu từ trong việc diễn đạt cảm xúc, hình ảnh.
- Nhận biết các thành phần câu: Thành phần biệt lập (tình thái, cảm thán, gọi - đáp, phụ chú), khởi ngữ, liên kết câu và liên kết đoạn văn.

2. Kỹ năng làm bài Nghị luận xã hội:
- Nghị luận về một sự việc, hiện tượng đời sống hoặc một vấn đề tư tưởng đạo lí.
- Cấu trúc đoạn văn nghị luận (khoảng 200 chữ):
  + Mở đoạn: Dẫn dắt và nêu vấn đề cần nghị luận.
  + Thân đoạn: Giải thích ngắn gọn -> Bàn luận, phân tích các khía cạnh đúng/sai -> Dẫn chứng thực tế tiêu biểu -> Phản đề, mở rộng vấn đề.
  + Kết đoạn: Bài học nhận thức và hành động của bản thân.

3. Những sai lầm thường gặp của học sinh:
- Trả lời cộc lốc, không thành câu hoàn chỉnh ở phần đọc hiểu.
- Phân tích chung chung, không chỉ rõ tác dụng cụ thể của biện pháp tu từ gắn với văn cảnh.
- Viết lan man, kể lể dài dòng thay vì lập luận phân tích trong đoạn văn nghị luận.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: NGỮ VĂN LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. ĐỌC HIỂU (4.0 điểm).
Đọc ngữ liệu sau và trả lời các câu hỏi:
"Ước mơ giống như những vì sao trên bầu trời đêm, có thể chúng ta không bao giờ chạm tới được nhưng nếu dõi theo chúng, chúng ta sẽ tìm thấy hướng đi của cuộc đời mình..."

Câu 1 (NB - 0.5 điểm). Xác định phương thức biểu đạt chính của đoạn trích trên.
Câu 2 (NB - 0.5 điểm). Chỉ ra biện pháp tu từ so sánh được sử dụng trong câu văn trên.
Câu 3 (TH - 1.5 điểm). Nêu tác dụng của hình ảnh "những vì sao trên bầu trời đêm" đối với việc thể hiện ý nghĩa của ước mơ.
Câu 4 (VD - 1.5 điểm). Từ nội dung đoạn trích, em hãy rút ra thông điệp có ý nghĩa nhất đối với bản thân.

PHẦN II. LÀM VĂN (6.0 điểm).
Câu 1 (2.0 điểm). Viết một đoạn văn (khoảng 150 - 200 chữ) trình bày suy nghĩ của em về ý chí vượt qua khó khăn để theo đuổi ước mơ của thế hệ trẻ hôm nay.
Câu 2 (4.0 điểm). Phân tích vẻ đẹp tâm hồn và lòng dũng cảm của thế hệ trẻ Việt Nam qua một tác phẩm văn học em đã học trong chương trình.`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN NGỮ VĂN - LỚP ${grade}):
| Kĩ năng / Mạch kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Đọc hiểu văn bản | 1.0 đ (2 câu) | 1.5 đ (1 câu) | 1.5 đ (1 câu) | 4.0 đ |
| 2. Nghị luận xã hội (Đoạn văn) | 0.5 đ | 0.5 đ | 1.0 đ | 2.0 đ |
| 3. Nghị luận văn học (Bài viết) | 1.0 đ | 1.5 đ | 1.5 đ | 4.0 đ |
| Tổng số điểm | 2.5 đ (25%) | 3.5 đ (35%) | 4.0 đ (40%) | 10.0 đ |`
});

// 5. TIẾNG ANH
const TIENG_ANH_TEMPLATE = (grade: string = '9', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC TIẾNG ANH LỚP ${grade} - CHỦ ĐỀ: ENVIRONMENT & GREEN LIVING

1. Grammar & Structures:
- Conditional Sentences (Type 1 & Type 2):
  + Type 1: If + S + V(present simple), S + will/can + V(bare-inf) -> Real situation in present/future.
  + Type 2: If + S + V(past simple/were), S + would/could + V(bare-inf) -> Unreal situation in present.
- Connectors: Because, Since, Although, Even though, However, Therefore.
- Passive Voice: S + be + V3/ed (+ by O).

2. Vocabulary & Topics:
- Environmental issues: pollution, deforestation, global warming, carbon footprint, recycle, single-use plastic.
- Solutions: save energy, plant trees, eco-friendly products, public transport.

3. Common Errors by Students:
- Using "was" instead of "were" for all persons in Conditional sentence Type 2.
- Confusing "Although" (followed by clause) with "In spite of / Despite" (followed by noun phrase / V-ing).
- Forgetting third-person singular "-s/es" in present simple tense.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: TIẾNG ANH LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Multiple Choice Questions (3.0 points).
Choose the best option (A, B, C or D) to complete each sentence.

Câu 1. If we ________ public transport more often, we will help reduce traffic jams and air pollution.
A. use
B. used
C. will use
D. are using

Câu 2. She decided to walk to school ________ it was raining lightly.
A. because
B. although
C. despite
D. however

PHẦN II. True / False Statements (4.0 points).
Read the text and decide whether each statement is True (T) or False (F).

Câu 1. Plastic waste is one of the most urgent environmental problems worldwide:
a) Plastic items take hundreds of years to decompose in nature.
b) Burning plastic trash is an eco-friendly method to protect our atmosphere.
c) Reusable shopping bags can significantly cut down single-use plastic waste.
d) Recycling alone is sufficient to eliminate all environmental damage.

PHẦN III. Sentence Transformation & Short Answers (3.0 points).
Complete the second sentence so that it has the same meaning as the first one.

Câu 1. We don't have enough money, so we can't buy electric cars.
-> If we had enough money, we ....................................................`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN TIẾNG ANH - LỚP ${grade}):
| Mảng kiến thức kĩ năng | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Phonetics & Vocabulary | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Grammar & Structures | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Reading Comprehension & Writing | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 6. VẬT LÍ
const VAT_LI_TEMPLATE = (grade: string = '9', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC VẬT LÍ LỚP ${grade} - CHỦ ĐỀ: ĐỊNH LUẬT ÔM VÀ ĐOẠN MẠCH ĐIỆN

1. Định luật Ôm đối với đoạn mạch:
- Cường độ dòng điện chạy qua dây dẫn tỉ lệ thuận với hiệu điện thế đặt vào hai đầu dây và tỉ lệ nghịch với điện trở của dây:
  I = U / R (Trong đó: I đo bằng Ampe A, U đo bằng Vôn V, R đo bằng Ôm Ω).

2. Đoạn mạch nối tiếp và song song:
- Đoạn mạch nối tiếp:
  + I = I1 = I2
  + U = U1 + U2
  + R_td = R1 + R2
- Đoạn mạch song song:
  + I = I1 + I2
  + U = U1 = U2
  + 1 / R_td = 1 / R1 + 1 / R2 (hoặc R_td = (R1 × R2) / (R1 + R2))

3. Công suất điện và Điện năng tiêu thụ:
- Công suất điện: P = U × I = I² × R = U² / R (Đơn vị Watt W).
- Điện năng tiêu thụ (Định luật Jun - Len-xơ): A = Q = I² × R × t = U × I × t (Đơn vị Jun J hoặc kWh).

4. Những sai lầm thường gặp của học sinh:
- Quên đổi đơn vị thời gian sang giây (s) khi tính nhiệt lượng theo công thức Q = I²Rt.
- Nhầm lẫn công thức điện trở tương đương của mạch song song với mạch nối tiếp.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: VẬT LÍ LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Hệ thức nào sau đây biểu diễn đúng định luật Ôm cho một đoạn mạch?
A. I = U × R.
B. I = U / R.
C. I = R / U.
D. U = I / R.

Câu 2. Hai điện trở R1 = 10 Ω và R2 = 20 Ω mắc nối tiếp với nhau. Điện trở tương đương của đoạn mạch là:
A. 30 Ω.
B. 15 Ω.
C. 6.67 Ω.
D. 200 Ω.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Câu 1. Cho mạch điện gồm hai điện trở R1 = 6 Ω và R2 = 12 Ω mắc song song vào hiệu điện thế U = 12V:
a) Hiệu điện thế giữa hai đầu mỗi điện trở đều bằng 12V.
b) Điện trở tương đương của đoạn mạch song song bằng 18 Ω.
c) Cường độ dòng điện qua R1 là 2A.
d) Công suất tiêu thụ điện toàn mạch là 36W.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Câu 1. Một bóng đèn có ghi 220V - 100W hoạt động bình thường ở hiệu điện thế 220V. Tính điện trở của bóng đèn khi đó (tính theo đơn vị Ôm Ω).
Đáp số: ......... Ω`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN VẬT LÍ - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Định luật Ôm và Điện trở dây dẫn | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Đoạn mạch nối tiếp & song song | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Công suất điện & Định luật Jun-Lenxơ | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 7. HÓA HỌC
const HOA_HOC_TEMPLATE = (grade: string = '9', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC HÓA HỌC LỚP ${grade} - CHỦ ĐỀ: TÍNH CHẤT HÓA HỌC CỦA AXIT VÀ BAZƠ

1. Tính chất hóa học của Axit (ví dụ: HCl, H2SO4 loãng):
- Làm đổi màu chất chỉ thị: Quỳ tím hóa đỏ.
- Tác dụng với kim loại đứng trước H trong dãy hoạt động hóa học: Axit + Kim loại -> Muối + Khí H2 (Ví dụ: Fe + 2HCl -> FeCl2 + H2↑).
- Tác dụng với bazơ (phản ứng trung hòa): Axit + Bazơ -> Muối + H2O (Ví dụ: HCl + NaOH -> NaCl + H2O).
- Tác dụng với oxit bazơ: Axit + Oxit bazơ -> Muối + H2O.
- Tác dụng với muối: Axit + Muối -> Muối mới + Axit mới (điều kiện có kết tủa hoặc khí bay hơi).

2. Tính chất hóa học của Bazơ (tan và không tan):
- Làm quỳ tím hóa xanh, dung dịch phenolphtalein không màu hóa hồng.
- Tác dụng với axit tạo muối và nước.
- Bazơ tan tác dụng với oxit axit tạo muối và nước.
- Bazơ không tan bị nhiệt phân hủy tạo oxit bazơ tương ứng và nước: Cu(OH)2 --t°--> CuO + H2O.

3. Những sai lầm thường gặp của học sinh:
- Cho kim loại Cu, Ag tác dụng với HCl/H2SO4 loãng (chú ý Cu, Ag đứng sau H nên không phản ứng).
- Quên điều kiện phản ứng trao đổi trong dung dịch (phải có chất kết tủa, chất khí hoặc chất điện li yếu như H2O sinh ra).`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: HÓA HỌC LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Dung dịch axit clohiđric (HCl) làm quỳ tím chuyển sang màu gì?
A. Màu đỏ.
B. Màu xanh.
C. Màu vàng.
D. Không đổi màu.

Câu 2. Kim loại nào sau đây phản ứng được với dung dịch axit H2SO4 loãng sinh ra khí H2?
A. Cu.
B. Ag.
C. Fe.
D. Au.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Câu 1. Cho mẩu nhôm (Al) vào dung dịch axit clohiđric (HCl) dư:
a) Khí sinh ra là khí hiđro (H2) không màu, nhẹ hơn không khí.
b) Dung dịch thu được sau phản ứng có chứa muối nhôm clorua (AlCl3).
c) Hiện tượng quan sát được là mẩu nhôm tan dần và có sủi bọt khí.
d) Phương trình hóa học đã cân bằng là: Al + 2HCl -> AlCl2 + H2.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Câu 1. Cho 5.6 gam sắt (Fe) phản ứng hoàn toàn với dung dịch HCl dư. Thể tích khí H2 thu được ở điều kiện chuẩn (đkc, 1 mol khí = 24.79 lít) là bao nhiêu lít? (Làm tròn đến 2 chữ số thập phân).
Đáp số: ......... lít`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN HÓA HỌC - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Phân loại và Tính chất hóa học của Axit | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Tính chất hóa học của Bazơ & Muối | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Bài toán tính theo phương trình hóa học | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 8. LỊCH SỬ VÀ ĐỊA LÍ
const LICHSU_DIALI_TEMPLATE = (grade: string = '8', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC LỊCH SỬ VÀ ĐỊA LÍ LỚP ${grade} - CHỦ ĐỀ: PHONG TRÀO KHÁNG CHIẾN VÀ ĐẶC ĐIỂM ĐỊA HÌNH VIỆT NAM

PHẦN 1. PHÂN MÔN LỊCH SỬ:
- Phong trào Cần Vương (1885 - 1896):
  + Nguyên nhân bùng nổ: Cuộc phản công quân Pháp tại kinh thành Huế thất bại, Tôn Thất Thuyết phò vua Hàm Nghi ra Tân Sở (Quảng Trị) hạ chiếu Cần Vương kêu gọi nhân dân giúp vua cứu nước.
  + Các giai đoạn: Giai đoạn 1 (1885 - 1888) có vua Hàm Nghi lãnh đạo; Giai đoạn 2 (1888 - 1896) do các sĩ phu văn thân lãnh đạo tiêu biểu là cuộc khởi nghĩa Hương Khê (Phan Đình Phùng).
  + Ý nghĩa: Thể hiện tinh thần yêu nước quật cường của nhân dân, để lại nhiều bài học lịch sử quý giá.

PHẦN 2. PHÂN MÔN ĐỊA LÍ:
- Đặc điểm chung của địa hình Việt Nam:
  + Đồi núi chiếm 3/4 diện tích lãnh thổ, đồng bằng chiếm 1/4 diện tích.
  + Địa hình đồi núi thấp là chủ yếu (dưới 1000m chiếm tới 85%).
  + Hướng địa hình chính: Hướng Tây Bắc - Đông Nam và hướng vòng cung.
  + Địa hình chịu tác động mạnh mẽ của khí hậu nhiệt đới ẩm gió mùa và con người.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: LỊCH SỬ VÀ ĐỊA LÍ LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Ai là người đã nhân danh vua Hàm Nghi ra chiếu Cần Vương vào ngày 13/7/1885?
A. Phan Đình Phùng.
B. Hoàng Hoa Thám.
C. Tôn Thất Thuyết.
D. Nguyễn Thiện Thuật.

Câu 2. Địa hình đồi núi chiếm bao nhiêu phần diện tích lãnh thổ nước ta?
A. 1/4 diện tích.
B. 1/2 diện tích.
C. 3/4 diện tích.
D. 4/5 diện tích.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Câu 1. Khi tìm hiểu về cuộc khởi nghĩa Hương Khê trong phong trào Cần Vương:
a) Khởi nghĩa Hương Khê nổ ra trên địa bàn 4 tỉnh: Thanh Hóa, Nghệ An, Hà Tĩnh, Quảng Bình.
b) Người lãnh đạo cao nhất của khởi nghĩa là Phan Đình Phùng và Cao Thắng.
c) Nghĩa quân đã tự chế tạo thành công súng trường theo mẫu súng của Pháp.
d) Sự thất bại của khởi nghĩa Hương Khê đánh dấu sự kết thúc của triều đại nhà Nguyễn.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Câu 1. Chiếu Cần Vương đầu tiên được vua Hàm Nghi ban hành tại căn cứ nào (thuộc tỉnh Quảng Trị)?
Đáp số: .........`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN LỊCH SỬ VÀ ĐỊA LÍ - LỚP ${grade}):
| Phân môn / Mạch kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Lịch sử: Phong trào Cần Vương & Khởi nghĩa | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Địa lí: Đặc điểm địa hình & Khoáng sản | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Vận dụng thực tiễn & Tự nhiên địa phương | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 9. TIN HỌC
const TIN_HOC_TEMPLATE = (grade: string = '8', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC TIN HỌC LỚP ${grade} - CHỦ ĐỀ: THUẬT TOÁN VÀ LẬP TRÌNH CƠ BẢN

1. Khái niệm thuật toán và các cấu trúc điều khiển:
- Thuật toán là dãy các thao tác xác định, được thực hiện theo một trình tự xác định để giải quyết một bài toán.
- Ba cấu trúc điều khiển cơ bản:
  + Cấu trúc tuần tự: Các lệnh thực hiện lần lượt từ trên xuống dưới.
  + Cấu trúc rẽ nhánh (if - else): Chọn thực hiện câu lệnh dựa vào điều kiện đúng hay sai.
  + Cấu trúc lặp (for / while): Lặp lại một công việc với số lần biết trước hoặc thỏa mãn điều kiện lặp.

2. Biến, kiểu dữ liệu và biểu thức trong lập trình:
- Kiểu dữ liệu cơ bản: Số nguyên (int), số thực (float), chuỗi kí tự (string), logic (boolean: True/False).
- Phép toán số học: +, -, *, /, // (chia lấy phần nguyên), % (chia lấy phần dư), ** (lũy thừa).
- Phép so sánh: ==, !=, >, <, >=, <=.

3. Những lỗi sai học sinh thường gặp:
- Nhầm lẫn giữa phép gán (=) và phép so sánh bằng (==).
- Lỗi thụt lề (IndentationError) trong Python.
- Vòng lặp vô tận (vô hạn) do không cập nhật biến đếm hoặc điều kiện lặp luôn đúng.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: TIN HỌC LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Trong Python, để chia lấy phần dư của phép chia 15 cho 4 ta sử dụng toán tử nào?
A. 15 / 4
B. 15 // 4
C. 15 % 4
D. 15 ** 4

Câu 2. Biến trong chương trình dùng để làm gì?
A. Lưu trữ giá trị có thể thay đổi trong quá trình thực hiện chương trình.
B. Cố định giá trị không bao giờ thay đổi.
C. Đổi tên chương trình.
D. Vẽ hình đồ họa.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Câu 1. Cho đoạn chương trình Python sau:
x = 10
if x % 2 == 0:
    print("Chan")
else:
    print("Le")
a) x là biến số có kiểu dữ liệu là số nguyên (int).
b) Phép toán x % 2 == 0 kiểm tra xem x có phải là số chẵn hay không.
c) Kết quả in ra màn hình của đoạn chương trình trên là chữ "Le".
d) Cấu trúc được sử dụng trong đoạn code trên là cấu trúc rẽ nhánh dạng đủ.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Câu 1. Cho đoạn code Python: s = 0; for i in range(1, 5): s = s + i. Sau khi chạy xong vòng lặp, giá trị của biến s bằng bao nhiêu?
Đáp số: .........`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN TIN HỌC - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Khái niệm Thuật toán & Cấu trúc tuần tự | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Cấu trúc rẽ nhánh & Vòng lặp | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Xử lí biến, mảng & Bài toán thực tế | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 10. CÔNG NGHỆ
const CONG_NGHE_TEMPLATE = (grade: string = '8', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC CÔNG NGHỆ LỚP ${grade} - CHỦ ĐỀ: BẢN VẼ KĨ THUẬT VÀ GIA CÔNG CƠ KHÍ

1. Bản vẽ kĩ thuật và hình chiếu vuông góc:
- Bản vẽ kĩ thuật là tài liệu trình bày các thông tin kĩ thuật của sản phẩm dưới dạng hình vẽ và các kí hiệu theo quy tắc thống nhất.
- Ba hình chiếu vuông góc:
  + Hình chiếu đứng: Hướng chiếu từ trước tới, thể hiện chiều cao và chiều dài.
  + Hình chiếu bằng: Hướng chiếu từ trên xuống, thể hiện chiều rộng và chiều dài.
  + Hình chiếu cạnh: Hướng chiếu từ trái sang, thể hiện chiều cao và chiều rộng.

2. Vật liệu cơ khí và dụng cụ gia công:
- Vật liệu kim loại: Kim loại đen (sắt, thép, gang) và kim loại màu (đồng, nhôm...).
- Dụng cụ đo và kiểm tra: Thước lá, thước cuộn, thước cặp.
- Dụng cụ gia công cơ khí cầm tay: Cưa tay, đục, dũa, búa.
- An toàn lao động khi gia công cơ khí: Đeo kính bảo hộ, mặc trang phục gọn gàng, không dùng dụng cụ bị lỏng cán hoặc sứt mẻ.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: CÔNG NGHỆ LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Hướng chiếu của hình chiếu đứng trên bản vẽ kĩ thuật là:
A. Từ trước tới.
B. Từ trên xuống.
C. Từ trái sang.
D. Từ phải sang.

Câu 2. Vật liệu nào sau đây thuộc nhóm kim loại đen?
A. Đồng.
B. Nhôm.
C. Thép.
D. Bạc.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Câu 1. Khi gia công cơ khí bằng dụng cụ cưa tay:
a) Lưỡi cưa phải được lắp căng vừa phải, răng cưa hướng về phía trước.
b) Khi đẩy cưa thì ấn nhẹ lực, khi kéo cưa về thì không ấn lực.
c) Được phép dùng tay gạt trực tiếp mạt sắt trên bề mặt phôi cưa.
d) Cần mặc bảo hộ lao động và đeo kính bảo vệ mắt trong quá trình cưa.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Câu 1. Hình chiếu nào thể hiện chiều cao và chiều rộng của vật thể?
Đáp số: .........`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN CÔNG NGHỆ - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Bản vẽ các khối hình học & Hình chiếu | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Vật liệu cơ khí & Dụng cụ gia công | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. An toàn lao động & Quy trình chế tạo | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// 11. GIÁO DỤC CÔNG DÂN
const GDCD_TEMPLATE = (grade: string = '8', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC GIÁO DỤC CÔNG DÂN LỚP ${grade} - CHỦ ĐỀ: TỰ LẬP VÀ TRÁCH NHIỆM VỚI BẢN THÂN

1. Khái niệm và biểu hiện của tính tự lập:
- Tự lập là tự làm lấy, tự giải quyết công việc của mình trong học tập, lao động và cuộc sống; không trông chờ, ỷ lại, dựa dẫm vào người khác.
- Biểu hiện: Tự giác học tập, chủ động sắp xếp thời gian biểu, tự chăm sóc bản thân, kiên trì vượt qua khó khăn để đạt mục tiêu.

2. Ý nghĩa của tính tự lập:
- Giúp cá nhân tự tin, bản lĩnh, nâng cao năng lực và dễ dàng thành công trong cuộc sống.
- Nhận được sự tin yêu, tôn trọng từ gia đình, thầy cô và bạn bè.

3. Rèn luyện tính tự lập:
- Bắt đầu từ những việc nhỏ hằng ngày: Tự dọn dẹp phòng ngủ, tự chuẩn bị sách vở, giúp đỡ cha mẹ việc nhà.
- Chịu trách nhiệm về hành vi và quyết định của chính mình.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: GIÁO DỤC CÔNG DÂN LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Hành vi nào sau đây thể hiện rõ nhất tính tự lập của học sinh?
A. Nhờ bạn làm bài tập về nhà giúp mình.
B. Tự giác ôn bài và chuẩn bị đồ dùng học tập trước khi đến lớp.
C. Luôn chờ bố mẹ nhắc nhở mới chịu đi học bài.
D. Dựa dẫm vào người khác khi gặp bài tập khó.

Câu 2. Tính tự lập mang lại ý nghĩa gì cho con người?
A. Làm con người trở nên cô độc.
B. Giúp con người tự tin, làm chủ cuộc sống và trưởng thành hơn.
C. Làm giảm khả năng hợp tác nhóm.
D. Tránh được mọi sai lầm trong cuộc sống.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Câu 1. Nhận định về tính tự lập trong học tập và sinh hoạt:
a) Tự lập có nghĩa là từ chối mọi sự giúp đỡ của người khác trong bất kì hoàn cảnh nào.
b) Người có tính tự lập luôn chủ động tìm cách giải quyết khó khăn của bản thân.
c) Học sinh còn nhỏ tuổi thì chưa cần rèn luyện tính tự lập.
d) Tự giác tham gia lao động gia đình phù hợp với sức khỏe là biểu hiện của tự lập.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Câu 1. Phẩm chất đạo đức nào thể hiện việc tự làm lấy công việc của mình mà không trông chờ, dựa dẫm vào người khác?
Đáp số: .........`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN GIÁO DỤC CÔNG DÂN - LỚP ${grade}):
| Chuẩn kiến thức kĩ năng | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Khái niệm & Biểu hiện của đức tính | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Ý nghĩa & Giá trị đối với cuộc sống | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Tình huống thực tiễn & Rèn luyện bản thân | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

// Generic dynamic generator for any other GDPT 2018 subject
const GENERIC_SUBJECT_TEMPLATE = (subject: string, grade: string = '9', duration: number = 45): SubjectTemplateData => ({
  lesson: `TÀI LIỆU BÀI HỌC MÔN ${subject.toUpperCase()} LỚP ${grade} - CHƯƠNG TRÌNH GDPT 2018

1. Mục tiêu và yêu cầu cần đạt:
- Nắm vững kiến thức trọng tâm, khái niệm định tính và bản chất của môn ${subject} lớp ${grade}.
- Rèn luyện kĩ năng giải quyết vấn đề và vận dụng kiến thức vào thực tiễn đời sống.

2. Nội dung kiến thức cốt lõi:
- Đơn vị kiến thức 1: Các định nghĩa, quy tắc và nguyên lí cơ bản của môn ${subject}.
- Đơn vị kiến thức 2: Phương pháp phân tích, các bước thực hiện và hệ thống hóa kiến thức.
- Đơn vị kiến thức 3: Bài tập rèn luyện và câu hỏi tình huống mức độ nhận biết, thông hiểu, vận dụng.

3. Các lỗi sai học sinh thường gặp:
- Nhầm lẫn giữa các khái niệm tương tự trong chương trình ${subject} lớp ${grade}.
- Đọc không kĩ đề bài, bỏ sót yêu cầu phụ hoặc tính toán sai sót.`,

  sampleExam: `SỞ GD & ĐT TỈNH QUẢNG TRỊ
TRƯỜNG THCS GIO LINH
ĐỀ THI MINH HỌA - KÌ THI KIỂM TRA ĐỊNH KÌ
Môn thi: ${subject.toUpperCase()} LỚP ${grade}
Thời gian làm bài: ${duration} phút (Không kể thời gian phát đề)

--------------------------------------------------
PHẦN I. Câu trắc nghiệm nhiều lựa chọn (3.0 điểm).
Học sinh trả lời từ câu 1 đến câu 12. Mỗi câu hỏi chỉ chọn một phương án trả lời đúng. Mỗi câu đúng được 0.25 điểm.

Câu 1. Đâu là nội dung cơ bản của môn ${subject} lớp ${grade}?
A. Khái niệm cơ bản 1.
B. Khái niệm cơ bản 2.
C. Khái niệm cơ bản 3.
D. Khái niệm cơ bản 4.

PHẦN II. Câu trắc nghiệm Đúng - Sai (4.0 điểm).
Câu 1. Các nhận định sau đây về môn ${subject} lớp ${grade}:
a) Nhận định cơ bản 1 là chính xác.
b) Nhận định cơ bản 2 là chính xác.
c) Nhận định cơ bản 3 là sai lệch.
d) Nhận định cơ bản 4 phản ánh đúng thực tiễn.

PHẦN III. Câu hỏi trắc nghiệm trả lời ngắn (3.0 điểm).
Câu 1. Nêu từ khóa hoặc thuật ngữ trọng tâm của chủ đề bài học môn ${subject} lớp ${grade}.
Đáp số: .........`,

  matrix: `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN ${subject.toUpperCase()} - LỚP ${grade}):
| Nội dung kiến thức | Nhận biết | Thông hiểu | Vận dụng | Tổng |
| :--- | :---: | :---: | :---: | :---: |
| 1. Kiến thức cơ bản & Khái niệm nền tảng | 4 câu (I) | 2 câu (I) | 1 ý (II) | 7 câu/ý |
| 2. Kĩ năng vận dụng & Phân tích chuyên sâu | 2 câu (I) | 2 ý (II) | 1 câu (III) | 5 câu/ý |
| 3. Tình huống thực tiễn & Tư duy sáng tạo | 2 câu (I) | 1 ý (II) | 2 câu (III) | 5 câu/ý |
| Tổng số câu/ý | 8 câu | 4 ý | 3 câu / ý | 15 câu |
| Tỉ lệ % điểm số | 30% | 40% | 30% | 100% |`
});

/**
 * Lấy bộ tài liệu mẫu chuẩn (SGK, Đề thi, Ma trận) theo môn học và khối lớp
 */
export const getSubjectTemplate = (subject: string, grade: string = '9', duration: number = 45): SubjectTemplateData => {
  const norm = (subject || '').trim().toLowerCase();
  
  if (norm.includes('sinh học') || norm === 'sinh') {
    return SINH_HOC_TEMPLATE(grade, duration);
  }
  if (norm.includes('khoa học tự nhiên') || norm.includes('khtn')) {
    return KHTN_TEMPLATE(grade, duration);
  }
  if (norm.includes('toán') || norm === 'toán học') {
    return TOAN_TEMPLATE(grade, duration);
  }
  if (norm.includes('ngữ văn') || norm === 'văn') {
    return NGU_VAN_TEMPLATE(grade, duration);
  }
  if (norm.includes('tiếng anh') || norm.includes('english')) {
    return TIENG_ANH_TEMPLATE(grade, duration);
  }
  if (norm.includes('vật lí') || norm.includes('vật lý') || norm === 'lí' || norm === 'lý') {
    return VAT_LI_TEMPLATE(grade, duration);
  }
  if (norm.includes('hóa học') || norm.includes('hoá học') || norm === 'hóa' || norm === 'hoá') {
    return HOA_HOC_TEMPLATE(grade, duration);
  }
  if (norm.includes('lịch sử và địa lí') || norm.includes('ls&đl') || norm.includes('ls - đl')) {
    return LICHSU_DIALI_TEMPLATE(grade, duration);
  }
  if (norm.includes('tin học') || norm === 'tin') {
    return TIN_HOC_TEMPLATE(grade, duration);
  }
  if (norm.includes('công nghệ')) {
    return CONG_NGHE_TEMPLATE(grade, duration);
  }
  if (norm.includes('giáo dục công dân') || norm === 'gdcd') {
    return GDCD_TEMPLATE(grade, duration);
  }

  // Fallback generic for any other subject in GDPT 2018 list
  return GENERIC_SUBJECT_TEMPLATE(subject || 'Sinh học', grade, duration);
};
