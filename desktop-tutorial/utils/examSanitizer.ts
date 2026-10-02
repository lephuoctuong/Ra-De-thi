/**
 * examSanitizer.ts
 * Tiện ích bóc tách và lọc đề thi bảo mật:
 * CHỈ GIỮ LẠI ĐỀ BÀI KIỂM TRA, LOẠI BỎ 100% ĐÁP ÁN, HƯỚNG DẪN CHẤM VÀ THANG ĐIỂM
 * Phục vụ chuẩn xác tính năng giao bài cho học sinh (Không giao đáp án).
 */

/**
 * Loại bỏ phần Đáp án, Hướng dẫn chấm, Bảng đáp án, Thang điểm chi tiết khỏi nội dung đề thi.
 */
export function stripAnswersAndGradingGuide(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  const text = rawText.trim();

  // Danh sách các regex phát hiện điểm bắt đầu của phần Đáp án / Hướng dẫn chấm
  // Đảm bảo KHÔNG khớp nhầm với câu chữ trong câu hỏi (ví dụ: "chọn một đáp án đúng", "khoanh tròn vào đáp án")
  const answerSectionRegexes = [
    // 1. Dòng tiêu đề Markdown có dấu # (#, ##, ###, ####)
    /\n\s*#{1,4}\s*(?:(?:PHẦN|Phần|MỤC|Mục)\s*(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN|THANG\s*ĐIỂM|BIỂU\s*ĐIỂM|LỜI\s*GIẢI|HƯỚNG\s*DẪN\s*GIẢI).*/i,
    
    // 2. Dòng in đậm độc lập: **ĐÁP ÁN...** hoặc **HƯỚNG DẪN CHẤM...**
    /\n\s*\*\*(?:(?:PHẦN|Phần)\s*(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN|THANG\s*ĐIỂM|BIỂU\s*ĐIỂM|LỜI\s*GIẢI).*\*\*/i,
    
    // 3. Tiêu đề dạng số: "2. Đáp án", "2. ĐÁP ÁN", "II. ĐÁP ÁN", "B. HƯỚNG DẪN CHẤM", "3. Hướng dẫn chấm"
    /\n\s*(?:2|3|II|III|B|C)\s*[\.:\)]\s*(?:ĐÁP\s*ÁN|Đáp\s*án|HƯỚNG\s*DẪN\s*CHẤM|Hướng\s*dẫn\s*chấm|BẢNG\s*ĐÁP\s*ÁN|Thang\s*điểm).*/i,
    
    // 4. Dòng in hoa đứng độc lập là tiêu đề phân mục
    /\n\s*(?:PHẦN\s+(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN\s*VÀ\s*HƯỚNG\s*DẪN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM\s*CHI\s*TIẾT|BẢNG\s*ĐÁP\s*ÁN\s*CHÍNH\s*THỨC|ĐÁP\s*ÁN\s*CHÍNH\s*THỨC|HƯỚNG\s*DẪN\s*CHẤM\s*VÀ\s*THANG\s*ĐIỂM)\s*(?:\r?\n|$)/i,

    // 5. Đường kẻ ngang phân cách kèm từ khóa đáp án
    /\n\s*---\s*\n\s*(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN).*/i
  ];

  let cutoffIndex = -1;

  for (const rx of answerSectionRegexes) {
    const match = text.match(rx);
    if (match && match.index !== undefined) {
      const matchedLine = match[0].toLowerCase();
      // Bỏ qua nếu là lời dặn câu hỏi (chọn đáp án, khoanh đáp án, trong các đáp án sau...)
      const isInstructionPhrase = 
        matchedLine.includes('chọn') || 
        matchedLine.includes('khoanh') || 
        matchedLine.includes('nào sau đây') || 
        matchedLine.includes('mỗi câu');

      if (!isInstructionPhrase) {
        if (cutoffIndex === -1 || match.index < cutoffIndex) {
          cutoffIndex = match.index;
        }
      }
    }
  }

  if (cutoffIndex !== -1) {
    return text.substring(0, cutoffIndex).trim();
  }

  return text;
}

/**
 * Tách một mã đề cụ thể (101, 102, 103, 104) từ văn bản Bộ 4 mã đề hoán đổi (Step 5),
 * đồng thời lọc sạch 100% phần đáp án bên trong mã đề đó.
 */
export function extractVariantQuestionsOnly(
  step5Content: string, 
  variant: '101' | '102' | '103' | '104' | 'all'
): string {
  if (!step5Content || typeof step5Content !== 'string') return '';

  if (variant === 'all') {
    // Nếu giao cả 4 mã đề: Tách từng mã đề và lọc sạch đáp án của từng mã đề
    const variants: ('101' | '102' | '103' | '104')[] = ['101', '102', '103', '104'];
    const cleanedBlocks = variants.map(v => {
      const block = extractSingleVariantRawBlock(step5Content, v);
      return stripAnswersAndGradingGuide(block);
    }).filter(b => b.length > 50);

    if (cleanedBlocks.length > 0) {
      return cleanedBlocks.join('\n\n---\n\n');
    }
    return stripAnswersAndGradingGuide(step5Content);
  }

  // Nếu giao một mã đề cụ thể
  const rawBlock = extractSingleVariantRawBlock(step5Content, variant);
  return stripAnswersAndGradingGuide(rawBlock);
}

/**
 * Trích xuất khối nội dung của một mã đề cụ thể từ Step 5
 */
function extractSingleVariantRawBlock(text: string, variant: string): string {
  const startRegex = new RegExp(
    `(?:^|\\n)\\s*(?:#{1,3}\\s*|PHẦN\\s*[0-9IVX]+\\s*[:.-]\\s*)?M[Ãã]\\s*[Đđ][Ềề]\\s*[:.-]?\\s*${variant}\\b`, 
    'i'
  );
  
  const startMatch = text.match(startRegex);
  if (!startMatch || startMatch.index === undefined) {
    return text;
  }

  const fromIndex = startMatch.index + (startMatch[0].startsWith('\n') ? 1 : 0);
  const remaining = text.substring(fromIndex);

  // Tìm điểm bắt đầu của mã đề tiếp theo
  const otherVariants = ['101', '102', '103', '104'].filter(v => v !== variant);
  const nextVariantRegex = new RegExp(
    `(?:^|\\n)\\s*(?:#{1,3}\\s*|PHẦN\\s*[0-9IVX]+\\s*[:.-]\\s*)?M[Ãã]\\s*[Đđ][Ềề]\\s*[:.-]?\\s*(?:${otherVariants.join('|')})\\b`, 
    'i'
  );

  const nextMatch = remaining.substring(startMatch[0].length).match(nextVariantRegex);
  if (nextMatch && nextMatch.index !== undefined) {
    return remaining.substring(0, startMatch[0].length + nextMatch.index).trim();
  }

  return remaining.trim();
}

/**
 * Hàm tổng hợp an toàn: Lấy nội dung đề thi CHỈ CHỨA CÂU HỎI cho học sinh
 */
export function getStudentExamQuestionsOnly(
  examPackage: { resultStep3?: string; resultStep5?: string; questionsOnlyContent?: string },
  variant: 'step3' | '101' | '102' | '103' | '104' | 'all' = 'step3'
): string {
  if (variant === 'step3') {
    if (examPackage.questionsOnlyContent?.trim()) {
      return stripAnswersAndGradingGuide(examPackage.questionsOnlyContent);
    }
    const raw = examPackage.resultStep3 || examPackage.resultStep5 || '';
    return stripAnswersAndGradingGuide(raw);
  }

  const sourceWithVariants = examPackage.resultStep5?.trim()
    ? examPackage.resultStep5
    : (examPackage.questionsOnlyContent?.trim() || examPackage.resultStep3 || '');

  return extractVariantQuestionsOnly(sourceWithVariants, variant);
}
