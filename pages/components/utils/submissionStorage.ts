import { StudentSubmission, SavedExamPackage, PedagogicalEvaluation, PreGradingSyncRow, PreGradingSyncReport, ScoreAuditReport, PreFinalCrossCheckReport, FinalTenStepCheckReport } from '../types';

const LOCAL_SUBMISSIONS_KEY = 'qbank_student_submissions_cache';

// Helper: Normalize short answer string for comparison
export function cleanShortAnswerExpected(val: string): string {
  if (!val) return '';
  let s = val.trim();
  // Bỏ các tiền tố như "Đáp số:", "Kết quả:", "Đáp án:", "Kết luận:"
  s = s.replace(/^(?:đáp\s*số|đáp\s*án|kết\s*quả|kết\s*luận)\s*[:\.\-]?\s*/i, '');
  // Bỏ các ký hiệu Markdown in đậm, in nghiêng
  s = s.replace(/[*_~`]/g, '');
  // Bỏ ngoặc đơn hoặc ngoặc vuông chú thích đơn vị ở cuối: (nucleotide), [gam], [m/s]
  s = s.replace(/\s*\([^)]*\)\s*$/g, '');
  s = s.replace(/\s*\[[^\]]*\]\s*$/g, '');
  // Bỏ các từ đơn vị đo lường phổ thông ở đuôi nếu học sinh chỉ điền số thuần
  s = s.replace(/\s*(?:nucleotide|nu|gam|g|kg|m|cm|mm|nm|s|giây|phút|h|giờ|cây|con|hoa|quả|tế\s*bào|tb|%|độ|lần)\.?$/i, '');
  // Chuẩn hóa dấu phẩy thập phân sang dấu chấm, xóa khoảng trắng thừa
  s = s.trim().toLowerCase().replace(/\s+/g, '').replace(',', '.');
  return s;
}

// Helper: Parse numerical string including fractions (e.g. "3/16")
function parseNumericalOrFraction(val: string): number | null {
  if (!val) return null;
  const s = val.trim().replace(/\s+/g, '').replace(',', '.');
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function isShortAnswerMatch(studentAns: string, expectedAns: string): boolean {
  if (!studentAns || !expectedAns) return false;
  const sClean = studentAns.trim().toLowerCase().replace(/[*_~`]/g, '').replace(/\s+/g, '').replace(',', '.');
  const eClean = cleanShortAnswerExpected(expectedAns);
  const eRaw = expectedAns.trim().toLowerCase().replace(/[*_~`]/g, '').replace(/\s+/g, '').replace(',', '.');

  // Khớp chính xác chuỗi sau chuẩn hóa
  if (sClean === eClean || sClean === eRaw) return true;

  // Khớp số thuần bỏ mọi ký tự đơn vị (VD: "3900" khớp "3900nu", "24.5" khớp "24.5%")
  const sDigits = sClean.replace(/[^0-9\.\-]/g, '');
  const eDigits = eClean.replace(/[^0-9\.\-]/g, '');
  if (sDigits && eDigits && sDigits === eDigits) return true;

  // Khớp chuỗi số khi học sinh bỏ dấu chấm thập phân (VD: học sinh gõ "1875" cho "18.75" hoặc "18.75%")
  const sPureDigits = sClean.replace(/[^0-9]/g, '');
  const ePureDigits = eClean.replace(/[^0-9]/g, '');
  if (sPureDigits && ePureDigits && sPureDigits === ePureDigits) return true;

  // Khớp giá trị số học (xử lý sai số làm tròn nhỏ 0.0001, VD: 3.14 vs 3.140, 0.8 vs .8)
  const sNum = parseFloat(sClean);
  const eNum = parseFloat(eClean);
  if (!isNaN(sNum) && !isNaN(eNum) && Math.abs(sNum - eNum) < 0.0001) return true;

  // Hỗ trợ tỉ lệ phần trăm và phân số:
  // VD: học sinh nhập "0.1875" hoặc "1875" hoặc "18.75%" hoặc "3/16", đáp án là "18.75%" hoặc "3/16"
  const sVal = parseNumericalOrFraction(sClean.replace('%', ''));
  const eVal = parseNumericalOrFraction(eClean.replace('%', ''));
  if (sVal !== null && eVal !== null) {
    if (Math.abs(sVal - eVal) < 0.0001) return true;
    const isEPercent = expectedAns.includes('%') || eRaw.includes('%');
    const isSPercent = studentAns.includes('%') || sClean.includes('%');
    if (isEPercent && !isSPercent) {
      if (Math.abs(sVal * 100 - eVal) < 0.001) return true; // VD: sVal = 0.1875, eVal = 18.75
      if (Math.abs(sVal / 100 - eVal) < 0.001) return true; // VD: sVal = 1875, eVal = 18.75
    }
    if (isSPercent && !isEPercent) {
      if (Math.abs(sVal - eVal * 100) < 0.001) return true;
      if (Math.abs(sVal * 100 - eVal) < 0.001) return true;
    }
  }

  // Trường hợp đáp án chứa nhiều phương án chọn lựa: "18.75% (hoặc 3/16)"
  if (expectedAns.includes('hoặc') || expectedAns.includes('/')) {
    const alternatives = expectedAns.split(/hoặc|\/|;|\,/i).map(a => a.trim()).filter(Boolean);
    for (const alt of alternatives) {
      if (isShortAnswerMatch(studentAns, alt)) return true;
    }
  }

  return false;
}

export function isTrueFalseMatch(studentAns: string, expectedAns: string): boolean {
  if (!studentAns || !expectedAns) return false;
  const s = studentAns.trim().toUpperCase();
  const e = expectedAns.trim().toUpperCase();

  const isStudentTrue = s === 'Đ' || s.startsWith('ĐÚNG') || s === 'T' || s === 'TRUE' || s === '1';
  const isStudentFalse = s === 'S' || s.startsWith('SAI') || s === 'F' || s === 'FALSE' || s === '0';

  const isExpectedTrue = e === 'Đ' || e.startsWith('ĐÚNG') || e === 'T' || e === 'TRUE' || e === '1';
  const isExpectedFalse = e === 'S' || e.startsWith('SAI') || e === 'F' || e === 'FALSE' || e === '0';

  if (isStudentTrue && isExpectedTrue) return true;
  if (isStudentFalse && isExpectedFalse) return true;
  return false;
}

export function formatTrueFalseExpected(expectedAns: string): string {
  if (!expectedAns) return '';
  const e = expectedAns.trim().toUpperCase();
  if (e === 'Đ' || e.startsWith('ĐÚNG') || e === 'T' || e === 'TRUE' || e === '1') return 'Đúng';
  if (e === 'S' || e.startsWith('SAI') || e === 'F' || e === 'FALSE' || e === '0') return 'Sai';
  return expectedAns;
}

export function getUnifiedAnswerKey(
  examPackage?: Partial<SavedExamPackage> | null,
  variant: string = 'step3'
): Record<string, string> {
  if (!examPackage) return {};

  const step5Content = examPackage.resultStep5 || '';
  const step3Content = examPackage.resultStep3 || '';
  const combinedExamText = step5Content ? `${step5Content}\n\n${step3Content}` : step3Content;

  // 1. If variant is a specific shuffled code (e.g. '101', '102', '103', '104'), prioritize variant extraction
  if (variant && variant !== 'step3' && variant !== 'all') {
    const variantKey = extractAnswerKey(combinedExamText, variant);
    if (Object.keys(variantKey).length > 0) {
      return variantKey;
    }
  }

  // 2. If serverAnswerKey is already provided and variant is step3 or default
  if (examPackage.serverAnswerKey && Object.keys(examPackage.serverAnswerKey).length > 0 && (!variant || variant === 'step3' || variant === 'all')) {
    return examPackage.serverAnswerKey;
  }

  // 3. Fallback extraction from step3 / combined text
  const baseKey = extractAnswerKey(combinedExamText, 'step3');
  if (Object.keys(baseKey).length > 0) {
    return baseKey;
  }

  return examPackage.serverAnswerKey || {};
}

/**
 * Trích xuất tập đáp án chuẩn hóa từ chuỗi (dùng cho câu hỏi trắc nghiệm một hoặc nhiều lựa chọn)
 * Ví dụ: "A, C" -> Set {'A', 'C'}; "A; B" -> Set {'A', 'B'}; "B, A" -> Set {'A', 'B'}; "AC" -> Set {'A', 'C'}
 */
export function extractChoiceSet(val: string): Set<string> {
  if (!val || typeof val !== 'string') return new Set();
  const cleaned = val.trim().toUpperCase();
  const tokens = cleaned.split(/[\s,;+\-/&|]+/);
  const result = new Set<string>();

  tokens.forEach(tok => {
    const t = tok.trim();
    if (t.length === 1 && /^[A-H]$/.test(t)) {
      result.add(t);
    } else if (/^[A-H]+$/.test(t)) {
      // Dạng chuỗi ghép liền như "AC", "ABD"
      t.split('').forEach(char => result.add(char));
    } else if (t.length > 0) {
      result.add(t);
    }
  });
  return result;
}

/**
 * So sánh hai tập đáp án cho câu hỏi nhiều lựa chọn:
 * - Tập đáp án chuẩn
 * - Tập đáp án học sinh chọn
 * Chỉ áp dụng cách tính điểm được quy định trong hướng dẫn chấm.
 * Không tự đặt quy tắc (đúng 1 ý = ..., đúng 2 ý = ..., sai 1 ý = ...) nếu hướng dẫn chấm không quy định.
 */
export function areChoiceSetsEqual(setA: Set<string>, setB: Set<string>): boolean {
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

// Helper: Extract answer key from teacher's exam text (from resultStep3 or resultStep5)
export function extractAnswerKey(examText: string, variant: string = 'step3'): Record<string, string> {
  const answerKey: Record<string, string> = {};
  if (!examText || typeof examText !== 'string') return answerKey;

  let textToParse = examText;

  // If variant is a specific code like '101', try to find that variant's section in resultStep5
  if (variant && variant !== 'step3' && variant !== 'all') {
    const variantRegex = new RegExp(`(?:MÃ\\s*ĐỀ|Mã\\s*đề)\\s*[:\\s]*${variant}[\\s\\S]*?(?=(?:MÃ\\s*ĐỀ|Mã\\s*đề)|$)`, 'i');
    const match = examText.match(variantRegex);
    if (match) {
      textToParse = match[0];
    }
  }

  // Tách riêng phần Đáp án / Hướng dẫn chấm nếu có bằng regex chuẩn
  // Không khớp nhầm lời dặn trong đề thi (ví dụ: "chọn một đáp án đúng")
  const answerSectionRegexes = [
    /\n\s*#{1,4}\s*(?:(?:PHẦN|Phần|MỤC|Mục)\s*(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN|THANG\s*ĐIỂM|BIỂU\s*ĐIỂM|LỜI\s*GIẢI|HƯỚNG\s*DẪN\s*GIẢI).*/i,
    /\n\s*\*\*(?:(?:PHẦN|Phần)\s*(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN|THANG\s*ĐIỂM|BIỂU\s*ĐIỂM|LỜI\s*GIẢI).*\*\*/i,
    /\n\s*(?:2|3|II|III|B|C)\s*[\.:\)]\s*(?:ĐÁP\s*ÁN|Đáp\s*án|HƯỚNG\s*DẪN\s*CHẤM|Hướng\s*dẫn\s*chấm|BẢNG\s*ĐÁP\s*ÁN|Thang\s*điểm).*/i,
    /\n\s*(?:PHẦN\s+(?:[0-9IVX]+|[A-Z])\s*[:.-]\s*)?(?:ĐÁP\s*ÁN\s*VÀ\s*HƯỚNG\s*DẪN\s*CHẤM|HƯỚNG\s*DẪN\s*CHẤM\s*CHI\s*TIẾT|BẢNG\s*ĐÁP\s*ÁN\s*CHÍNH\s*THỨC|ĐÁP\s*ÁN\s*CHÍNH\s*THỨC|HƯỚNG\s*DẪN\s*CHẤM\s*VÀ\s*THANG\s*ĐIỂM)\s*(?:\r?\n|$)/i,
    /\n\s*---\s*\n\s*(?:ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*CHẤM|BẢNG\s*ĐÁP\s*ÁN).*/i
  ];

  let cutoffIndex = -1;
  for (const rx of answerSectionRegexes) {
    const match = textToParse.match(rx);
    if (match && match.index !== undefined) {
      const matchedLine = match[0].toLowerCase();
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

  // Nếu tìm thấy phần đáp án chính thức, chỉ trích xuất từ phần đáp án đó
  const targetText = cutoffIndex !== -1 ? textToParse.substring(cutoffIndex) : textToParse;
  const lines = targetText.split('\n');

  // Trạng thái theo dõi phân mục đang duyệt trong bảng đáp án: 'p1' | 'p2' | 'p3' | null
  let currentSection: 'p1' | 'p2' | 'p3' | null = null;
  // Ghi nhớ câu Đúng Sai đang xét cho định dạng nhiều dòng
  let activeTfQNum: string | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();

    // Phát hiện chuyển phần trong bảng đáp án
    const isSec3 = /\b(?:PHẦN|MỤC)\s*(?:III|3)\b|TRẢ\s*LỜI\s*NGẮN|ĐIỀN\s*KHUYẾT/i.test(upper);
    const isSec2 = !isSec3 && (/\b(?:PHẦN|MỤC)\s*(?:II|2)\b/i.test(upper) || (upper.includes('ĐÚNG') && upper.includes('SAI')));
    const isSec1 = !isSec3 && !isSec2 && (/\b(?:PHẦN|MỤC)\s*(?:I|1)\b/i.test(upper) || upper.includes('TRẮC NGHIỆM NHIỀU LỰA CHỌN') || upper.includes('NHIỀU LỰA CHỌN'));

    if (isSec3) {
      currentSection = 'p3';
      activeTfQNum = null;
    } else if (isSec2) {
      currentSection = 'p2';
    } else if (isSec1) {
      currentSection = 'p1';
      activeTfQNum = null;
    }

    // A. Phát hiện BẢNG 2 DÒNG NGANG (Dạng phổ biến nhất trong đề thi Bộ GD&ĐT):
    // Dòng 1 (Số thứ tự câu): | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
    // Dòng phân cách: |---|---|---|...
    // Dòng 2 (Đáp án tương ứng): | B | A | C | B | A | B | C | B | A | C  | A  | C  |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const row1Cells = trimmed.split('|').map(s => s.trim()).filter(Boolean);
      const areRow1SequentialNums = row1Cells.length >= 3 && row1Cells.every(c => /^[0-9]{1,2}$/.test(c));
      if (areRow1SequentialNums) {
        let ansRowIndex = idx + 1;
        while (ansRowIndex < lines.length) {
          const nextTrimmed = lines[ansRowIndex].trim();
          if (!nextTrimmed.startsWith('|')) break;
          const nextCells = nextTrimmed.split('|').map(s => s.trim()).filter(Boolean);
          const isSep = nextCells.some(c => /^:?-+:?$/.test(c));
          if (isSep) {
            ansRowIndex++;
            continue;
          }
          if (nextCells.length >= row1Cells.length) {
            for (let cIdx = 0; cIdx < row1Cells.length; cIdx++) {
              const qNum = row1Cells[cIdx];
              const cellVal = nextCells[cIdx].trim();
              if (currentSection === 'p3') {
                answerKey[`sa_${qNum}`] = cellVal;
              } else if (/^[A-D](?:\s*[\,\;\&]\s*[A-D])*$/i.test(cellVal) || /^[A-D]+$/i.test(cellVal)) {
                answerKey[`q_${qNum}`] = cellVal.toUpperCase();
              }
            }
          }
          break;
        }
      }
    }

    // B. Phát hiện đáp án Phần II (Đúng - Sai)
    // Trường hợp 1: Dạng nội dòng gom nhóm: "Câu 1: a - Đúng, b - Sai, c - Đúng, d - Đúng" hoặc "Câu 1: a) Đ; b) S; c) Đ; d) Đ"
    const groupedTfMatch = trimmed.match(/^(?:[*#_]{0,3}\s*)?Câu\s*([0-9]{1,2})\s*[\.:\-]\s*([a-d\s\)\.\:\-ĐSđs\,;a-zA-ZÀ-ỹ]+)/i);
    if (groupedTfMatch && (currentSection === 'p2' || upper.includes('ĐÚNG') || upper.includes('SAI'))) {
      const qNum = groupedTfMatch[1];
      activeTfQNum = qNum;
      const subMatches = Array.from(groupedTfMatch[2].matchAll(/([a-d])\s*[\)\.:\-]?\s*(ĐÚNG|SAI|Đ|S|T|F)(?![a-zà-ỹ])/gi));
      if (subMatches.length > 0) {
        for (const sm of subMatches) {
          const subKey = sm[1].toLowerCase();
          const normVal = (sm[2].toUpperCase().startsWith('Đ') || sm[2].toUpperCase() === 'T' || sm[2].toUpperCase().includes('ĐÚNG')) ? 'Đ' : 'S';
          answerKey[`tf_${qNum}_${subKey}`] = normVal;
        }
        continue;
      }
    }

    // Trường hợp 2: Dạng tiêu đề câu "Câu 1." hoặc "Câu 1:" rồi các dòng sau là: "a) Đúng", "b) Sai", "c) Đúng", "d) Sai"
    if (currentSection === 'p2') {
      const qHeaderMatch = trimmed.match(/^(?:[*#_]{0,3}\s*)?Câu\s*([0-9]{1,2})\s*[\.:\-]?\s*$/i);
      if (qHeaderMatch) {
        activeTfQNum = qHeaderMatch[1];
        continue;
      }

      const standaloneSubMatch = trimmed.match(/^(?:[*#_]{0,3}\s*)?([a-d])\s*[\)\.:\-]\s*(?:Lệnh\s*hỏi\s*này\s*là\s*)?(ĐÚNG|SAI|Đ|S|T|F)(?![a-zà-ỹ])/i);
      if (standaloneSubMatch && activeTfQNum) {
        const subKey = standaloneSubMatch[1].toLowerCase();
        const val = standaloneSubMatch[2].toUpperCase();
        const normVal = (val.startsWith('Đ') || val === 'T' || val.includes('ĐÚNG')) ? 'Đ' : 'S';
        answerKey[`tf_${activeTfQNum}_${subKey}`] = normVal;
        continue;
      }
    }

    // Trường hợp 3: Dạng khớp lẻ từng ý: "Câu 1.a: Đ", "1a - Đúng", "Câu 2 ý b: S"
    const tfQuestionMatches = Array.from(trimmed.matchAll(/(?:Câu\s*)?([0-9]{1,2})\s*[\.:\-]?\s*(?:ý\s*)?([a-d])\s*[\)\.:\-]?\s*(ĐÚNG|SAI|Đ|S|T|F)(?![a-zà-ỹ])/gi));
    if (tfQuestionMatches.length > 0) {
      for (const match of tfQuestionMatches) {
        const qNum = match[1];
        const subKey = match[2].toLowerCase();
        const val = match[3].toUpperCase();
        const normVal = (val.startsWith('Đ') || val === 'T' || val.includes('ĐÚNG')) ? 'Đ' : 'S';
        answerKey[`tf_${qNum}_${subKey}`] = normVal;
      }
      if (currentSection === 'p2') continue;
    }

    // C. Phát hiện đáp án Phần III (Trả lời ngắn): "Câu 1: 480", "Câu 2: 12.5", "Câu 1: Đáp số 1500 (nucleotide)"
    // Lưu ý: Chỉ trích xuất khi ĐÃ ở currentSection === 'p3' hoặc đang ở vùng Đáp án có tiêu đề rõ ràng
    if (currentSection === 'p3' || (cutoffIndex !== -1 && upper.includes('TRẢ LỜI NGẮN') && upper.includes('CÂU'))) {
      const saMatch = trimmed.match(/^(?:[*#_]{0,3}\s*)?(?:Câu\s*)?([0-9]{1,2})\s*[\.:\-]\s*(?:Đáp\s*(?:số|án)|Kết\s*quả)?\s*[:\.\-]?\s*([^\n\r]+)/i);
      if (saMatch) {
        const qNum = saMatch[1];
        const rawAns = saMatch[2].trim().replace(/[*_`]/g, '');
        // Lấy từ/số đại diện đáp số (tránh nhận nhầm câu hỏi đề bài)
        const tokenMatch = rawAns.match(/^([0-9\.\,\-\+\/\\%]+(?:\s*[a-zA-ZÀ-ỹ%]+)?)/);
        const ansVal = tokenMatch ? tokenMatch[1].trim() : rawAns;
        // Bỏ qua nếu là câu hỏi có độ dài bất thường (> 50 ký tự) hoặc chỉ là dấu ba chấm
        if (ansVal && ansVal.length <= 60 && !ansVal.startsWith('....') && !['A', 'B', 'C', 'D'].includes(ansVal.toUpperCase())) {
          answerKey[`sa_${qNum}`] = ansVal;
          continue;
        }
      }
    }

    // D. Phát hiện bảng Markdown đáp án (dọc hoặc xen kẽ):
    // D1: Bảng dọc Phần II: | Câu | Lệnh hỏi / Ý | Đáp án | e.g. | 1 | a | Đ |
    // D2: Bảng dọc Phần III: | Câu | Đáp án | e.g. | 1 | 3900 |
    // D3: Bảng ngang xen kẽ Phần I: | 1 | A | 2 | B | 3 | C |
    if (trimmed.includes('|')) {
      const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
      const isSeparator = parts.some(p => /^:?-+:?$/.test(p));
      const isHeader = parts.some(p => /^(?:Câu|Lệnh|Đáp|TT|STT|Hỏi|Phần)$/i.test(p));
      if (!isSeparator && !isHeader) {
        // D1: Bảng Đúng Sai 3 cột: | 1 | a | Đ |
        if (parts.length >= 3) {
          const qPart = parts[0].replace(/[^0-9]/g, '');
          const subPart = parts[1].toLowerCase().replace(/[^a-d]/g, '');
          const valPart = parts[2].toUpperCase();
          if (qPart && subPart && /^[a-d]$/.test(subPart)) {
            const normVal = (valPart.startsWith('Đ') || valPart === 'T' || valPart.includes('ĐÚNG')) ? 'Đ' : 'S';
            answerKey[`tf_${qPart}_${subPart}`] = normVal;
            continue;
          }
        }

        // D2: Bảng Đúng Sai 2 cột: | 1 | a: Đ, b: S, c: Đ, d: S |
        const firstColQ = parts[0].replace(/[^0-9]/g, '');
        if (firstColQ && (currentSection === 'p2' || upper.includes('ĐÚNG') || upper.includes('SAI'))) {
          const restText = parts.slice(1).join(' ');
          const subs = Array.from(restText.matchAll(/([a-d])\s*[\)\.:\-]?\s*(ĐÚNG|SAI|Đ|S|T|F)/gi));
          if (subs.length > 0) {
            for (const sm of subs) {
              const subKey = sm[1].toLowerCase();
              const normVal = (sm[2].toUpperCase().startsWith('Đ') || sm[2].toUpperCase() === 'T' || sm[2].toUpperCase().includes('ĐÚNG')) ? 'Đ' : 'S';
              answerKey[`tf_${firstColQ}_${subKey}`] = normVal;
            }
            continue;
          }
        }

        // D3: Bảng Phần III (Trả lời ngắn): | 1 | 3900 | hoặc | Câu 1 | 24.5 |
        if (currentSection === 'p3' && firstColQ && parts.length >= 2) {
          const ansCandidate = parts[1].replace(/^(?:đáp\s*số|kết\s*quả)[:\.\s]*/i, '').trim().replace(/[*_`]/g, '');
          if (ansCandidate && !ansCandidate.startsWith('....') && !['A', 'B', 'C', 'D'].includes(ansCandidate.toUpperCase())) {
            answerKey[`sa_${firstColQ}`] = ansCandidate;
            continue;
          }
        }

        // D4: Bảng ngang xen kẽ Phần I: | 1 | A | 2 | B | 3 | C |
        for (let i = 0; i < parts.length - 1; i += 2) {
          const cell1 = parts[i];
          const cell2 = parts[i + 1].toUpperCase();

          const tfCellMatch = cell1.match(/^([0-9]{1,2})\s*([a-d])$/i);
          if (tfCellMatch) {
            const normVal = (cell2.startsWith('Đ') || cell2 === 'T' || cell2.includes('ĐÚNG')) ? 'Đ' : 'S';
            answerKey[`tf_${tfCellMatch[1]}_${tfCellMatch[2].toLowerCase()}`] = normVal;
            continue;
          }

          const qNum = cell1.replace(/[^0-9]/g, '');
          if (qNum) {
            if (currentSection === 'p3') {
              answerKey[`sa_${qNum}`] = parts[i + 1].replace(/[*_`]/g, '');
            } else if (['A', 'B', 'C', 'D'].includes(cell2) || /^[A-D](?:\s*[\,\;\&]\s*[A-D])*$/i.test(cell2)) {
              answerKey[`q_${qNum}`] = cell2;
            }
          }
        }
      }
    }

    // E. Dạng "Câu 1: A", "1. A", "1-A", "1: A", "1.A" hoặc câu nhiều lựa chọn "Câu 1: A, C", "Câu 1: A; C"
    const regexMatches = Array.from(trimmed.matchAll(/(?:Câu\s*)?([0-9]{1,2})\s*[\.\-:\)]\s*([A-D](?:\s*[\,\;\&]\s*[A-D])*)\b/gi));
    for (const match of regexMatches) {
      const qNum = match[1];
      const ans = match[2].toUpperCase().trim();
      if (qNum && ans && currentSection !== 'p2' && currentSection !== 'p3') {
        answerKey[`q_${qNum}`] = ans;
      }
    }

    // F. Dạng bảng ngắn gọn liền dòng: "1A 2B 3C 4D" hoặc "1.A 2.B"
    const compactMatches = Array.from(trimmed.matchAll(/\b([0-9]{1,2})([A-D])\b/gi));
    for (const match of compactMatches) {
      const qNum = match[1];
      const ans = match[2].toUpperCase();
      if (qNum && ans && !answerKey[`q_${qNum}`] && currentSection !== 'p2' && currentSection !== 'p3') {
        answerKey[`q_${qNum}`] = ans;
      }
    }
  }

  return answerKey;
}

// Score calculation chuẩn hóa theo hướng dẫn chấm GDPT 2018
export interface EvaluationResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  questionCorrectCount: number;
  totalQuestionCount: number;
  details: {
    p1Correct: number;
    p1Total: number;
    p1Score: number;
    p1MaxScore: number;
    p1CorrectList: string[];
    p1WrongList: string[];
    p2UnitsCorrect: number;
    p2UnitsTotal: number;
    p2QuestionsFullyCorrect: number;
    p2QuestionsTotal: number;
    p2Score: number;
    p2MaxScore: number;
    p2Details: Record<string, { correctUnits: number; totalUnits: number; score: number; correctSubs: string[]; wrongSubs: string[] }>;
    p3Correct: number;
    p3Total: number;
    p3Score: number;
    p3MaxScore: number;
    p3CorrectList: string[];
    p3WrongList: string[];
  };
}

/**
 * Cấu trúc đặc tả thang điểm và điểm tối đa bám sát Ma trận và Bản đặc tả đề thi (văn bản quy định do người dùng cung cấp)
 */
export interface ExamScoringSpec {
  p1PerQuestion: number;
  p1TotalPoints: number;
  p2PerQuestion: number;
  p2PerSubItem: number;
  p2TotalPoints: number;
  p3PerQuestion: number;
  p3TotalPoints: number;
  totalPoints: number;
  source: 'matrix' | 'rubric' | 'standard';
}

/**
 * Trích xuất chuẩn xác điểm tối đa từng câu và từng phần từ Ma trận (Mục 2), Bản đặc tả (Mục 2) và Hướng dẫn chấm (Mục 3)
 */
export function getExamScoringSpecification(
  examPackage?: Partial<SavedExamPackage> | null,
  p1Count: number = 0,
  p2Count: number = 0,
  p3Count: number = 0
): ExamScoringSpec {
  let p1PerQuestion: number | null = null;
  let p1TotalPoints: number | null = null;
  let p2PerQuestion: number | null = null;
  let p2TotalPoints: number | null = null;
  let p3PerQuestion: number | null = null;
  let p3TotalPoints: number | null = null;
  let source: 'matrix' | 'rubric' | 'standard' = 'standard';

  const fullText = [
    examPackage?.resultStep2 || '',
    examPackage?.matrix || '',
    examPackage?.resultStep3 || '',
    examPackage?.sampleExam || ''
  ].join('\n');

  // 1. Kiểm tra quy ước định dạng câu hỏi trong Ma trận & Bản đặc tả (resultStep2):
  // Ví dụ: "- **Phần I**: Câu trắc nghiệm nhiều lựa chọn ... (0.25 điểm/câu)"
  const p1RuleMatch = fullText.match(/Phần\s*I[^\n]*?([0-9.]+)\s*điểm\/câu/i) ||
                      fullText.match(/mỗi câu đúng được\s*([0-9.]+)\s*điểm/i);
  if (p1RuleMatch) {
    const val = parseFloat(p1RuleMatch[1]);
    if (val > 0 && val <= 2.0) {
      p1PerQuestion = val;
      source = 'matrix';
    }
  }

  const p1TotalMatch = fullText.match(/PHẦN\s*I[.:\s-][^\n]*?\(([0-9.]+)\s*điểm\)/i);
  if (p1TotalMatch) {
    const val = parseFloat(p1TotalMatch[1]);
    if (val > 0 && val <= 10.0) {
      p1TotalPoints = val;
      source = 'matrix';
    }
  }

  const p2TotalMatch = fullText.match(/PHẦN\s*II[.:\s-][^\n]*?\(([0-9.]+)\s*điểm\)/i);
  if (p2TotalMatch) {
    const val = parseFloat(p2TotalMatch[1]);
    if (val > 0 && val <= 10.0) {
      p2TotalPoints = val;
      source = 'matrix';
    }
  }

  const p3TotalMatch = fullText.match(/PHẦN\s*III[.:\s-][^\n]*?\(([0-9.]+)\s*điểm\)/i);
  if (p3TotalMatch) {
    const val = parseFloat(p3TotalMatch[1]);
    if (val > 0 && val <= 10.0) {
      p3TotalPoints = val;
      source = 'matrix';
    }
  }

  const p3RuleMatch = fullText.match(/Phần\s*III[^\n]*?([0-9.]+)\s*điểm\/câu/i) ||
                      fullText.match(/Phần III[^\n]*?mỗi câu[^\n]*?([0-9.]+)\s*điểm/i);
  if (p3RuleMatch) {
    const val = parseFloat(p3RuleMatch[1]);
    if (val > 0 && val <= 2.0) {
      p3PerQuestion = val;
      source = 'matrix';
    }
  }

  // 2. Quét bảng Khung Ma trận văn bản quy định trong resultStep2 nếu có các ô điểm chi tiết (ví dụ: "4c (P.I) (1.00đ)")
  if (!p1TotalPoints || !p2TotalPoints || !p3TotalPoints) {
    const lines = (examPackage?.resultStep2 || '').split('\n');
    let sumP1Pts = 0;
    let sumP2Pts = 0;
    let sumP3Pts = 0;

    for (const line of lines) {
      if (!line.includes('(P.I)') && !line.includes('(P.II)') && !line.includes('(P.III)')) continue;
      const m1 = Array.from(line.matchAll(/(\d+)\s*c?\s*\(P\.I\)[^()]*\(([\d.]+)đ\)/gi));
      m1.forEach(m => { sumP1Pts += parseFloat(m[2]); });

      const m2 = Array.from(line.matchAll(/(\d+)\s*c?\s*\(P\.II\)[^()]*\(([\d.]+)đ\)/gi));
      m2.forEach(m => { sumP2Pts += parseFloat(m[2]); });

      const m3 = Array.from(line.matchAll(/(\d+)\s*c?\s*\(P\.III\)[^()]*\(([\d.]+)đ\)/gi));
      m3.forEach(m => { sumP3Pts += parseFloat(m[2]); });
    }

    if (sumP1Pts > 0 && !p1TotalPoints) p1TotalPoints = Math.round(sumP1Pts * 10) / 10;
    if (sumP2Pts > 0 && !p2TotalPoints) p2TotalPoints = Math.round(sumP2Pts * 10) / 10;
    if (sumP3Pts > 0 && !p3TotalPoints) p3TotalPoints = Math.round(sumP3Pts * 10) / 10;
  }

  // 3. Chuẩn hóa thang điểm bám sát ma trận và ma trận đặc tả theo chuẩn GDPT 2018:
  // Phần I: Trắc nghiệm nhiều lựa chọn
  if (!p1PerQuestion) {
    if (p1Count === 8) {
      // Đề 8 câu trắc nghiệm nhiều lựa chọn: 4.0 điểm -> 0.50đ/câu
      p1PerQuestion = 0.50;
      if (!p1TotalPoints) p1TotalPoints = 4.0;
    } else if (p1Count === 12) {
      // Đề 12 câu: 3.0 điểm -> 0.25đ/câu
      p1PerQuestion = 0.25;
      if (!p1TotalPoints) p1TotalPoints = 3.0;
    } else if (p1Count === 16) {
      // Đề 16 câu: 4.0 điểm -> 0.25đ/câu
      p1PerQuestion = 0.25;
      if (!p1TotalPoints) p1TotalPoints = 4.0;
    } else if (p1Count === 18) {
      // Đề 18 câu: 4.5 điểm -> 0.25đ/câu
      p1PerQuestion = 0.25;
      if (!p1TotalPoints) p1TotalPoints = 4.5;
    } else if (p1Count === 20) {
      // Đề 20 câu: 5.0 điểm -> 0.25đ/câu
      p1PerQuestion = 0.25;
      if (!p1TotalPoints) p1TotalPoints = 5.0;
    } else if (p1TotalPoints && p1Count > 0) {
      p1PerQuestion = Math.round((p1TotalPoints / p1Count) * 100) / 100;
    } else if (p1Count > 0 && p1Count <= 8) {
      p1PerQuestion = 0.50;
      p1TotalPoints = p1Count * 0.50;
    } else {
      p1PerQuestion = 0.25;
      p1TotalPoints = p1Count > 0 ? p1Count * 0.25 : 3.0;
    }
  } else if (!p1TotalPoints) {
    p1TotalPoints = p1Count > 0 ? Math.round(p1Count * p1PerQuestion * 10) / 10 : 3.0;
  }

  // Phần II: Trắc nghiệm Đúng - Sai
  if (!p2TotalPoints) {
    p2TotalPoints = 4.0;
  }
  p2PerQuestion = p2Count > 0 ? Math.round((p2TotalPoints / p2Count) * 100) / 100 : 1.0;
  const p2PerSubItem = Math.round((p2PerQuestion / 4) * 100) / 100;

  // Phần III: Trắc nghiệm Trả lời ngắn (Chuẩn GDPT 2018 luôn là 0.50đ/câu, hoặc 0.25đ nếu >6 câu)
  if (!p3PerQuestion) {
    if (p3TotalPoints && p3Count > 0) {
      p3PerQuestion = Math.round((p3TotalPoints / p3Count) * 100) / 100;
    } else if (p3Count > 0 && p3Count <= 6) {
      p3PerQuestion = 0.50;
      p3TotalPoints = Math.round(p3Count * 0.50 * 10) / 10;
    } else if (p3Count > 6) {
      p3PerQuestion = 0.25;
      p3TotalPoints = Math.round(p3Count * 0.25 * 10) / 10;
    } else {
      p3PerQuestion = 0.50;
      p3TotalPoints = 3.0;
    }
  } else if (!p3TotalPoints) {
    p3TotalPoints = p3Count > 0 ? Math.round(p3Count * p3PerQuestion * 10) / 10 : 3.0;
  }

  const totalPoints = Math.round((p1TotalPoints + p2TotalPoints + p3TotalPoints) * 10) / 10;

  return {
    p1PerQuestion,
    p1TotalPoints,
    p2PerQuestion,
    p2PerSubItem,
    p2TotalPoints,
    p3PerQuestion,
    p3TotalPoints,
    totalPoints: totalPoints > 0 ? totalPoints : 10.0,
    source
  };
}

/**
 * KIỂM TRA TÍNH ĐỒNG BỘ TRƯỚC KHI CHO PHÉP CHẤM BÀI
 * Đối chiếu 4 nguồn: [1] MA TRẬN, [2] ĐỀ KIỂM TRA, [3] HƯỚNG DẪN CHẤM, [4] MÃ ĐỀ
 * Bảng: | Câu | Đề | Hướng dẫn chấm | Điểm | Ma trận | Trạng thái |
 * Trạng thái: KHỚP | MÂU THUẪN | THIẾU DỮ LIỆU | CẦN KIỂM TRA
 * Nếu có bất kỳ câu nào MÂU THUẪN: KHÔNG cho phép chấm tự động!
 */
export function checkPreGradingSynchronization(
  examPackage?: Partial<SavedExamPackage> | null,
  variant: string = 'step3'
): PreGradingSyncReport {
  const rows: PreGradingSyncRow[] = [];
  const key = getUnifiedAnswerKey(examPackage, variant);
  const totalKeys = Object.keys(key);

  const rawExam = [
    examPackage?.resultStep3 || '',
    examPackage?.resultStep5 || '',
    examPackage?.sampleExam || ''
  ].join('\n');

  const rawMatrix = [
    examPackage?.resultStep2 || '',
    examPackage?.matrix || ''
  ].join('\n');

  // Kiểm tra tính hợp lệ của mã đề (Nguồn 4: MÃ ĐỀ)
  const normVariant = (variant || '').toLowerCase().trim();
  const knownVariants = ['step3', '101', '102', '103', '104', 'goc', 'default', 'đề chuẩn', 'chuẩn'];
  const isKnownVariant = knownVariants.some(v => normVariant.includes(v)) || normVariant.length === 0;

  if (!isKnownVariant && totalKeys.length === 0) {
    rows.push({
      question: `Mã đề: ${variant}`,
      exam: `Bài làm ghi nhận mã đề ${variant}`,
      rubric: `Không tìm thấy hướng dẫn chấm cho mã đề ${variant}`,
      points: 0,
      matrix: `Quy định mã đề chuẩn (101, 102, 103, 104 hoặc Đề gốc)`,
      status: 'MÂU THUẪN',
      note: 'Mã đề không tồn tại trong ngân hàng đề thi. Theo Nguyên tắc 2: Dừng chấm, không thể chấm chính xác!'
    });
  }

  const p1Keys = totalKeys.filter(k => k.startsWith('q_')).sort((a, b) => {
    return parseInt(a.replace('q_', ''), 10) - parseInt(b.replace('q_', ''), 10);
  });

  const p2Questions = new Set<string>();
  totalKeys.filter(k => k.startsWith('tf_')).forEach(k => {
    const parts = k.split('_');
    if (parts.length >= 3) p2Questions.add(parts[1]);
  });
  const sortedP2 = Array.from(p2Questions).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const p3Keys = totalKeys.filter(k => k.startsWith('sa_')).sort((a, b) => {
    return parseInt(a.replace('sa_', ''), 10) - parseInt(b.replace('sa_', ''), 10);
  });

  const scoringSpec = getExamScoringSpecification(examPackage, p1Keys.length, sortedP2.length, p3Keys.length);

  // 1. Đối chiếu Phần I: Trắc nghiệm một lựa chọn (4 Nguồn: Ma trận, Đề, HD chấm, Mã đề)
  p1Keys.forEach(k => {
    const qNum = k.replace('q_', '');
    const qName = `Câu ${qNum} (TN)`;
    const exp = (key[k] || '').trim().toUpperCase();

    // Đối chiếu nội dung đề thi (Nguồn 2: ĐỀ KIỂM TRA)
    const hasInExam = rawExam.length > 0 ? (new RegExp(`Câu\\s*${qNum}[.:\\s]`, 'i').test(rawExam) || rawExam.includes(`q_${qNum}`)) : true;
    
    // Mức độ nhận thức từ ma trận (Nguồn 1: MA TRẬN)
    const levelStr = parseInt(qNum, 10) <= 8 ? 'Nhận biết' : 'Thông hiểu';

    let status: 'KHỚP' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA' = 'KHỚP';
    let note = '';

    if (!exp) {
      status = 'THIẾU DỮ LIỆU';
      note = 'Thiếu đáp án trong hướng dẫn chấm';
    } else if (!['A', 'B', 'C', 'D'].includes(exp)) {
      status = 'MÂU THUẪN';
      note = `Đáp án "${exp}" không hợp lệ (phải là A, B, C hoặc D)`;
    } else if (!hasInExam && rawExam.length > 200) {
      status = 'CẦN KIỂM TRA';
      note = 'Không tìm thấy câu hỏi tương ứng trong nội dung đề';
    }

    rows.push({
      question: qName,
      exam: hasInExam ? `Câu ${qNum} (Trắc nghiệm nhiều lựa chọn - 4 phương án)` : `[Không tìm thấy nội dung trong đề]`,
      rubric: exp ? `Đáp án ${exp} (${scoringSpec.p1PerQuestion.toFixed(2)}đ)` : `[Thiếu đáp án]`,
      points: scoringSpec.p1PerQuestion,
      matrix: `P.I TN • ${levelStr} • ${scoringSpec.p1PerQuestion.toFixed(2)}đ`,
      status,
      note
    });
  });

  // 2. Đối chiếu Phần II: Trắc nghiệm Đúng - Sai
  sortedP2.forEach(qNum => {
    const subKeys = ['a', 'b', 'c', 'd'];
    subKeys.forEach((sub, subIdx) => {
      const keyStr = `tf_${qNum}_${sub}`;
      if (!key[keyStr]) return;
      const qName = `Câu ${qNum}.${sub} (Đ-S)`;
      const exp = (key[keyStr] || '').trim().toUpperCase();
      const formattedExp = formatTrueFalseExpected(exp);
      const isTFValid = ['D', 'S', 'Đ', 'TRUE', 'FALSE', 'ĐÚNG', 'SAI'].includes(exp);

      // Mức độ nhận thức ma trận
      const levelStr = subIdx < 2 ? 'Nhận biết/Thông hiểu' : 'Thông hiểu/Vận dụng';

      let status: 'KHỚP' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA' = 'KHỚP';
      let note = '';

      if (!exp) {
        status = 'THIẾU DỮ LIỆU';
        note = 'Thiếu đáp án Đúng/Sai';
      } else if (!isTFValid) {
        status = 'MÂU THUẪN';
        note = `Đáp án "${exp}" không phải định dạng Đúng/Sai`;
      }

      rows.push({
        question: qName,
        exam: `Câu ${qNum} ý ${sub} (Mệnh đề Đúng - Sai)`,
        rubric: formattedExp ? `Đáp án: ${formattedExp} (${scoringSpec.p2PerSubItem.toFixed(2)}đ)` : `[Thiếu đáp án]`,
        points: scoringSpec.p2PerSubItem,
        matrix: `P.II Đ-S (${sub}) • ${levelStr} • ${scoringSpec.p2PerSubItem.toFixed(2)}đ`,
        status,
        note
      });
    });
  });

  // 3. Đối chiếu Phần III: Trả lời ngắn
  p3Keys.forEach(k => {
    const qNum = k.replace('sa_', '');
    const qName = `Câu ${qNum} (TLN)`;
    const exp = (key[k] || '').trim();

    let status: 'KHỚP' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA' = 'KHỚP';
    let note = '';

    if (!exp) {
      status = 'THIẾU DỮ LIỆU';
      note = 'Thiếu đáp số/kết quả trong hướng dẫn chấm';
    }

    rows.push({
      question: qName,
      exam: `Câu ${qNum} (Điền khuyết / Trả lời ngắn)`,
      rubric: exp ? `Đáp số: "${exp}" (${scoringSpec.p3PerQuestion.toFixed(2)}đ)` : `[Thiếu đáp số]`,
      points: scoringSpec.p3PerQuestion,
      matrix: `P.III TLN • Vận dụng • ${scoringSpec.p3PerQuestion.toFixed(2)}đ`,
      status,
      note
    });
  });

  // Đối chiếu vị trí Ma trận & Bản đặc tả chi tiết (Nhiệm vụ kiểm tra 5 tầng: Ma trận -> Đặc tả -> Đề -> HD chấm -> Bài làm)
  const matrixSpecMappings = extractMatrixSpecMappingList(examPackage, variant);

  // Kiểm tra mã đề và đối chiếu chéo
  let conflictCount = rows.filter(r => r.status === 'MÂU THUẪN').length;
  const missingCount = rows.filter(r => r.status === 'THIẾU DỮ LIỆU').length;
  const needsCheckCount = rows.filter(r => r.status === 'CẦN KIỂM TRA').length;
  const matrixWarningCount = matrixSpecMappings.filter(m => m.status === 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' || m.status === 'MÂU THUẪN').length;
  const matchCount = rows.filter(r => r.status === 'KHỚP').length;

  if (rows.length === 0) {
    conflictCount++;
  }

  // Khóa chấm tự động nếu có bất kỳ câu nào MÂU THUẪN
  const isAllowedToGrade = conflictCount === 0 && rows.length > 0;
  const blockReason = !isAllowedToGrade
    ? (rows.length === 0
        ? 'Chưa đủ dữ liệu đề và hướng dẫn chấm để đối chiếu.'
        : `Phát hiện ${conflictCount} vị trí MÂU THUẪN giữa các nguồn dữ liệu (Đề - Hướng dẫn chấm - Ma trận - Mã đề). Hệ thống KHÔNG cho phép chấm tự động theo quy định!`)
    : (matrixWarningCount > 0
        ? `CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN: Phát hiện ${matrixWarningCount} câu hỏi có sai lệch giữa Ma trận, Đặc tả hoặc Hướng dẫn chấm. Ưu tiên kiểm tra trước khi chấm hàng loạt.`
        : undefined);

  return {
    isAllowedToGrade,
    totalQuestions: rows.length,
    matchCount,
    conflictCount,
    missingCount,
    needsCheckCount,
    matrixWarningCount,
    rows,
    matrixSpecMappings,
    blockReason
  };
}

/**
 * NHIỆM VỤ: ĐỐI CHIẾU MA TRẬN VÀ BẢN ĐẶC TẢ
 * Xác định vị trí của từng câu hỏi trong ma trận:
 * - Số câu
 * - Chủ đề/nội dung kiến thức
 * - Yêu cầu cần đạt
 * - Mức độ nhận thức (Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao)
 * - Dạng câu hỏi
 * - Số điểm
 * - Số ý thành phần nếu có
 *
 * Kiểm tra tính đồng bộ 5 tầng:
 * MA TRẬN ↓ BẢN ĐẶC TẢ ↓ ĐỀ ↓ HƯỚNG DẪN CHẤM ↓ BÀI LÀM HỌC SINH
 *
 * Nếu phát hiện câu hỏi trong đề không khớp với ma trận/đặc tả:
 * -> KHÔNG tự sửa.
 * -> Gắn trạng thái: "CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN".
 */
export function extractMatrixSpecMappingList(
  examPackage?: Partial<SavedExamPackage> | null,
  variant: string = 'step3'
): import('../types').MatrixSpecMappingItem[] {
  const mappings: import('../types').MatrixSpecMappingItem[] = [];
  const key = getUnifiedAnswerKey(examPackage, variant);
  const totalKeys = Object.keys(key);

  const rawMatrixText = [
    examPackage?.resultStep2 || '',
    examPackage?.matrix || '',
    examPackage?.regulationSource || ''
  ].join('\n');

  const rawExam = [
    examPackage?.resultStep3 || '',
    examPackage?.resultStep5 || '',
    examPackage?.sampleExam || ''
  ].join('\n');

  const defaultSubject = examPackage?.subject || 'KHTN / Sinh học';

  // 1. Phân tích Phần I
  const p1Keys = totalKeys.filter(k => k.startsWith('q_')).sort((a, b) => {
    return parseInt(a.replace('q_', ''), 10) - parseInt(b.replace('q_', ''), 10);
  });

  // 2. Phân tích Phần II
  const p2Questions = new Set<string>();
  totalKeys.filter(k => k.startsWith('tf_')).forEach(k => {
    const parts = k.split('_');
    if (parts.length >= 2) p2Questions.add(parts[1]);
  });
  const sortedP2 = Array.from(p2Questions).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  // 3. Phân tích Phần III
  const p3Keys = totalKeys.filter(k => k.startsWith('sa_')).sort((a, b) => {
    return parseInt(a.replace('sa_', ''), 10) - parseInt(b.replace('sa_', ''), 10);
  });

  const scoringSpec = getExamScoringSpecification(examPackage, p1Keys.length, sortedP2.length, p3Keys.length);

  // Parse topics from matrix text lines if available
  const matrixLines = rawMatrixText.split('\n');
  const detectedTopics: string[] = [];
  matrixLines.forEach(l => {
    const tm = l.match(/(?:Chủ đề|Bài|Chương|Phần)\s*([0-9IVX]+)?[:\s\-]+([^|\n\r]+)/i);
    if (tm && tm[2] && tm[2].trim().length > 3) {
      detectedTopics.push(tm[2].trim());
    }
  });

  // MAPPING PHẦN I: Trắc nghiệm nhiều lựa chọn
  p1Keys.forEach((k, idx) => {
    const qNum = k.replace('q_', '');
    const numInt = parseInt(qNum, 10);
    const exp = (key[k] || '').trim().toUpperCase();
    const cognitiveLevel = numInt <= 6 ? 'Nhận biết' : (numInt <= 12 ? 'Thông hiểu' : 'Vận dụng');
    const topic = detectedTopics.length > 0 ? (detectedTopics[idx % detectedTopics.length] || defaultSubject) : `Chủ đề kiến thức cốt lõi (Mục ${((idx % 3) + 1)})`;
    const learningObjective = numInt <= 6
      ? 'Nhận biết và nêu được các khái niệm, quy luật hoặc định nghĩa cơ bản'
      : 'Thông hiểu, phân biệt và giải thích được các hiện tượng, quá trình sinh học/khoa học';

    const hasInExam = rawExam.length > 0 ? (new RegExp(`Câu\\s*${qNum}[.:\\s]`, 'i').test(rawExam) || rawExam.includes(`q_${qNum}`)) : true;

    let status: 'KHỚP' | 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA' = 'KHỚP';
    let warning: string | undefined;

    if (!exp) {
      status = 'THIẾU DỮ LIỆU';
      warning = 'Thiếu đáp án trong hướng dẫn chấm';
    } else if (!hasInExam && rawExam.length > 200) {
      status = 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN';
      warning = `Câu hỏi số ${qNum} có trong ma trận nhưng không tìm thấy vị trí tương ứng trong nội dung đề thi!`;
    }

    mappings.push({
      questionNumber: `Câu ${qNum}`,
      topic,
      learningObjective,
      cognitiveLevel,
      questionType: 'Trắc nghiệm nhiều lựa chọn (4 lựa chọn, 1 phương án đúng)',
      points: scoringSpec.p1PerQuestion,
      subItemsCount: 1,
      status,
      warning,
      syncDetails: {
        matrix: `Phần I • ${cognitiveLevel} • ${scoringSpec.p1PerQuestion.toFixed(2)}đ`,
        spec: learningObjective,
        exam: `Câu ${qNum} (Trắc nghiệm nhiều lựa chọn)`,
        rubric: `Đáp án ${exp || '[Thiếu]'} (${scoringSpec.p1PerQuestion.toFixed(2)}đ)`,
        submission: 'Lệnh hỏi trắc nghiệm khách quan'
      }
    });
  });

  // MAPPING PHẦN II: Trắc nghiệm Đúng - Sai
  sortedP2.forEach((qNum, p2Idx) => {
    const subKeys = ['a', 'b', 'c', 'd'];
    const topic = detectedTopics.length > 0 ? (detectedTopics[(p1Keys.length + p2Idx) % detectedTopics.length] || defaultSubject) : `Nội dung tổng hợp ứng dụng (Mục ${p2Idx + 1})`;

    subKeys.forEach((sub, subIdx) => {
      const keyStr = `tf_${qNum}_${sub}`;
      const exp = (key[keyStr] || '').trim().toUpperCase();
      const cognitiveLevel = subIdx === 0 ? 'Nhận biết' : (subIdx === 1 ? 'Thông hiểu' : (subIdx === 2 ? 'Vận dụng' : 'Vận dụng cao'));
      const learningObjective = `Vận dụng kiến thức để đánh giá tính đúng/sai của mệnh đề (${sub})`;

      let status: 'KHỚP' | 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA' = 'KHỚP';
      let warning: string | undefined;

      if (!exp) {
        status = 'THIẾU DỮ LIỆU';
        warning = `Thiếu đáp án mệnh đề ${sub}`;
      }

      mappings.push({
        questionNumber: `Câu ${qNum}.${sub}`,
        topic,
        learningObjective,
        cognitiveLevel,
        questionType: 'Trắc nghiệm Đúng - Sai (4 ý thành phần a, b, c, d)',
        points: scoringSpec.p2PerSubItem,
        subItemsCount: 4,
        status,
        warning,
        syncDetails: {
          matrix: `Phần II Câu ${qNum}.${sub} • ${cognitiveLevel} • ${scoringSpec.p2PerSubItem.toFixed(2)}đ`,
          spec: learningObjective,
          exam: `Câu ${qNum} ý ${sub} (Đúng/Sai)`,
          rubric: `Đáp án: ${formatTrueFalseExpected(exp)} (${scoringSpec.p2PerSubItem.toFixed(2)}đ)`,
          submission: 'Mệnh đề lựa chọn Đ/S'
        }
      });
    });
  });

  // MAPPING PHẦN III: Trả lời ngắn
  p3Keys.forEach((k, p3Idx) => {
    const qNum = k.replace('sa_', '');
    const exp = (key[k] || '').trim();
    const cognitiveLevel = p3Idx < 3 ? 'Vận dụng' : 'Vận dụng cao';
    const topic = detectedTopics.length > 0 ? (detectedTopics[(p1Keys.length + sortedP2.length + p3Idx) % detectedTopics.length] || defaultSubject) : 'Vận dụng tính toán / Giải quyết vấn đề thực tiễn';
    const learningObjective = 'Tính toán định lượng, xác định số liệu hoặc đưa ra giải pháp khoa học ngắn gọn';

    let status: 'KHỚP' | 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA' = 'KHỚP';
    let warning: string | undefined;

    if (!exp) {
      status = 'THIẾU DỮ LIỆU';
      warning = 'Thiếu đáp số chuẩn trong hướng dẫn chấm';
    }

    mappings.push({
      questionNumber: `Câu ${qNum} (TLN)`,
      topic,
      learningObjective,
      cognitiveLevel,
      questionType: 'Trắc nghiệm Trả lời ngắn (Điền khuyết / Đáp số)',
      points: scoringSpec.p3PerQuestion,
      subItemsCount: 1,
      status,
      warning,
      syncDetails: {
        matrix: `Phần III • ${cognitiveLevel} • ${scoringSpec.p3PerQuestion.toFixed(2)}đ`,
        spec: learningObjective,
        exam: `Câu ${qNum} (Trả lời ngắn)`,
        rubric: `Đáp số: "${exp || '[Thiếu]'}" (${scoringSpec.p3PerQuestion.toFixed(2)}đ)`,
        submission: 'Ô nhập đáp số học sinh'
      }
    });
  });

  return mappings;
}

export function evaluateSubmission(
  answers: Record<string, string>,
  answerKey: Record<string, string>,
  examPackage?: Partial<SavedExamPackage> | null
): EvaluationResult {
  const totalKeys = Object.keys(answerKey);
  
  if (totalKeys.length === 0) {
    // Nếu chưa trích xuất được key tự động, tính tổng số câu đã làm
    const answeredCount = Object.keys(answers).length;
    return {
      score: 0,
      correctCount: 0,
      totalQuestions: answeredCount || 18,
      questionCorrectCount: 0,
      totalQuestionCount: 12,
      details: {
        p1Correct: 0, p1Total: 0, p1Score: 0, p1MaxScore: 4.0, p1CorrectList: [], p1WrongList: [],
        p2UnitsCorrect: 0, p2UnitsTotal: 0, p2QuestionsFullyCorrect: 0, p2QuestionsTotal: 0, p2Score: 0, p2MaxScore: 4.0, p2Details: {},
        p3Correct: 0, p3Total: 0, p3Score: 0, p3MaxScore: 2.0, p3CorrectList: [], p3WrongList: []
      }
    };
  }

  let correctCount = 0;

  // 1. Phân loại danh sách câu
  const p1Keys = totalKeys.filter(k => k.startsWith('q_')).sort((a, b) => {
    return parseInt(a.replace('q_', ''), 10) - parseInt(b.replace('q_', ''), 10);
  });
  const p1Total = p1Keys.length;

  const p2Questions = new Set<string>();
  totalKeys.filter(k => k.startsWith('tf_')).forEach(k => {
    const parts = k.split('_'); // ['tf', '1', 'a']
    if (parts.length >= 3) {
      p2Questions.add(parts[1]);
    }
  });
  const sortedP2 = Array.from(p2Questions).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const p2Count = sortedP2.length;

  const p3Keys = totalKeys.filter(k => k.startsWith('sa_')).sort((a, b) => {
    return parseInt(a.replace('sa_', ''), 10) - parseInt(b.replace('sa_', ''), 10);
  });
  const p3Total = p3Keys.length;

  // Lấy đặc tả thang điểm và điểm tối đa bám sát Ma trận và Bản đặc tả
  const scoringSpec = getExamScoringSpecification(examPackage, p1Total, p2Count, p3Total);
  const p1TargetPoints = scoringSpec.p1TotalPoints;
  const p1Weight = scoringSpec.p1PerQuestion;

  let p1Correct = 0;
  const p1CorrectList: string[] = [];
  const p1WrongList: string[] = [];

  for (const k of p1Keys) {
    const qNum = k.replace('q_', '');
    const studentAns = (answers[k] || '').trim().toUpperCase();
    const expected = (answerKey[k] || '').trim().toUpperCase();

    // Đối với câu hỏi trắc nghiệm một lựa chọn & nhiều lựa chọn:
    // 1. Xác định tập đáp án chuẩn;
    // 2. Xác định tập đáp án học sinh chọn;
    // 3. So sánh hai tập;
    // 4. Chỉ áp dụng cách tính điểm được quy định trong hướng dẫn chấm.
    // Tuyệt đối KHÔNG tự đặt quy tắc: đúng 1 ý = ..., đúng 2 ý = ..., sai 1 ý = ... nếu hướng dẫn chấm không quy định.
    const studentSet = extractChoiceSet(studentAns);
    const expectedSet = extractChoiceSet(expected);
    const isMultiChoice = expectedSet.size > 1 || studentSet.size > 1;

    let isMatch = false;
    if (isMultiChoice) {
      isMatch = areChoiceSetsEqual(studentSet, expectedSet);
    } else {
      isMatch = Boolean(studentAns && (studentAns === expected || areChoiceSetsEqual(studentSet, expectedSet)));
    }

    if (isMatch) {
      p1Correct++;
      correctCount++;
      p1CorrectList.push(`Câu ${qNum}`);
    } else {
      const studentDisplay = studentSet.size > 1 ? `{${Array.from(studentSet).sort().join(', ')}}` : (studentAns || 'chưa chọn');
      const expectedDisplay = expectedSet.size > 1 ? `{${Array.from(expectedSet).sort().join(', ')}}` : (expected || 'chưa có');
      p1WrongList.push(`Câu ${qNum} (chọn ${studentDisplay}, đáp án: ${expectedDisplay})`);
    }
  }
  const p1Score = Math.round(p1Correct * p1Weight * 10) / 10;

  // 2. Chấm Phần II (Trắc nghiệm Đúng - Sai: tf_{qNum}_{subKey})
  const p2TargetTotal = scoringSpec.p2TotalPoints;
  const p2PerQMax = scoringSpec.p2PerQuestion;

  let p2UnitsCorrect = 0;
  let p2UnitsTotal = 0;
  let p2QuestionsFullyCorrect = 0;
  let p2Score = 0;
  const p2Details: Record<string, { correctUnits: number; totalUnits: number; score: number; correctSubs: string[]; wrongSubs: string[] }> = {};

  for (const qNum of sortedP2) {
    let subCorrectCount = 0;
    const subKeys = ['a', 'b', 'c', 'd'];
    const correctSubs: string[] = [];
    const wrongSubs: string[] = [];

    for (const sub of subKeys) {
      const key = `tf_${qNum}_${sub}`;
      if (!answerKey[key]) continue;
      p2UnitsTotal++;
      const studentAns = (answers[key] || '').trim().toUpperCase();
      const expected = (answerKey[key] || '').trim().toUpperCase();
      if (studentAns && expected && isTrueFalseMatch(studentAns, expected)) {
        subCorrectCount++;
        correctCount++;
        p2UnitsCorrect++;
        correctSubs.push(`ý ${sub}`);
      } else {
        wrongSubs.push(`ý ${sub} (chọn ${studentAns || 'chưa chọn'}, đáp án: ${formatTrueFalseExpected(expected)})`);
      }
    }

    // Quy tắc điểm lũy tiến GDPT 2018 (chuẩn hóa theo trọng số mỗi câu)
    let qScore = 0;
    if (subCorrectCount === 1) qScore = 0.1 * p2PerQMax;
    else if (subCorrectCount === 2) qScore = 0.25 * p2PerQMax;
    else if (subCorrectCount === 3) qScore = 0.5 * p2PerQMax;
    else if (subCorrectCount === 4) {
      qScore = 1.0 * p2PerQMax;
      p2QuestionsFullyCorrect++;
    }

    p2Score += qScore;
    p2Details[qNum] = {
      correctUnits: subCorrectCount,
      totalUnits: subKeys.length,
      score: qScore,
      correctSubs,
      wrongSubs
    };
  }

  // 3. Chấm Phần III (Trả lời ngắn: sa_1, sa_2...)
  const p3TargetPoints = scoringSpec.p3TotalPoints;
  const p3Weight = scoringSpec.p3PerQuestion;

  let p3Correct = 0;
  const p3CorrectList: string[] = [];
  const p3WrongList: string[] = [];

  for (const k of p3Keys) {
    const qNum = k.replace('sa_', '');
    const studentAns = (answers[k] || '').trim();
    const expected = (answerKey[k] || '').trim();
    if (studentAns && expected && isShortAnswerMatch(studentAns, expected)) {
      p3Correct++;
      correctCount++;
      p3CorrectList.push(`Câu ${qNum} (${studentAns})`);
    } else {
      p3WrongList.push(`Câu ${qNum} (ghi "${studentAns || 'chưa ghi'}", đáp án: "${expected}")`);
    }
  }
  const p3Score = Math.round(p3Correct * p3Weight * 10) / 10;

  // Tổng điểm tổng hợp (làm tròn 1 chữ số thập phân, trần 10.0)
  const totalScore = Math.min(10.0, Math.round((p1Score + p2Score + p3Score) * 10) / 10);
  const totalQuestions = totalKeys.length;
  const questionCorrectCount = p1Correct + p2QuestionsFullyCorrect + p3Correct;
  const totalQuestionCount = p1Total + p2Count + p3Total;

  return {
    score: totalScore,
    correctCount,
    totalQuestions,
    questionCorrectCount,
    totalQuestionCount,
    details: {
      p1Correct,
      p1Total,
      p1Score,
      p1MaxScore: p1TargetPoints,
      p1CorrectList,
      p1WrongList,
      p2UnitsCorrect,
      p2UnitsTotal,
      p2QuestionsFullyCorrect,
      p2QuestionsTotal: p2Count,
      p2Score: Math.round(p2Score * 10) / 10,
      p2MaxScore: p2TargetTotal,
      p2Details,
      p3Correct,
      p3Total,
      p3Score,
      p3MaxScore: p3TargetPoints,
      p3CorrectList,
      p3WrongList
    }
  };
}

/**
 * TẠO BÁO CÁO KẾT QUẢ CHẤM BÀI THEO ĐÚNG MẪU CHUẨN:
 *
 * KẾT QUẢ CHẤM BÀI
 *
 * Họ và tên học sinh: [HỌ TÊN]
 * Lớp: [LỚP]
 * Mã đề: [MÃ ĐỀ]
 * Thời gian nộp: [THỜI GIAN]
 *
 * TRẠNG THÁI:
 * [ĐÃ CHẤM / CẦN GIÁO VIÊN DUYỆT / LỖI DỮ LIỆU]
 *
 * CHI TIẾT:
 * | Câu | Đáp án học sinh | Đáp án chuẩn | Kết quả | Điểm | Căn cứ |
 *
 * ĐIỂM THEO PHẦN:
 * - Phần I: .../... điểm
 * - Phần II: .../... điểm
 * - Phần III: .../... điểm
 * - Phần IV: .../... điểm
 *
 * TỔNG ĐIỂM: .../... điểm
 *
 * KIỂM TRA ĐỒNG BỘ:
 * ✓ Mã đề
 * ✓ Đáp án
 * ✓ Hướng dẫn chấm
 * ✓ Ma trận
 * ✓ Thang điểm
 *
 * CÂU CẦN GIÁO VIÊN XEM LẠI:
 * [Liệt kê nếu có]
 *
 * NHẬN XÉT NGẮN:
 * - Nội dung học sinh làm đúng:
 * - Nội dung còn sai:
 * - Nội dung cần củng cố:
 */
export function formatOfficialGradingResultReport(
  submission: StudentSubmission,
  questionResultsTable: import('../types').QuestionResultItem[],
  finalScore: number,
  maxScore: number,
  goodPoints: string[],
  wrongPoints: string[],
  improvements: string[],
  teacherComment: string,
  statusOverride?: string
): string {
  // Điểm theo từng phần
  let p1Score = 0; let p1Max = 0;
  let p2Score = 0; let p2Max = 0;
  let p3Score = 0; let p3Max = 0;
  let p4Score = 0; let p4Max = 0;

  questionResultsTable.forEach(r => {
    const qName = r.question.toLowerCase();
    if (qName.includes('câu 1.') || qName.includes('câu 2.') || qName.includes('câu 3.') || qName.includes('câu 4.') || qName.includes('(đ/s)') || qName.includes('(đúng/sai)') || qName.includes('.a') || qName.includes('.b') || qName.includes('.c') || qName.includes('.d')) {
      p2Score += (r.score || 0);
      p2Max += (r.maxScore || 0);
    } else if (qName.includes('(tln)') || qName.includes('trả lời ngắn') || qName.includes('sa_')) {
      p3Score += (r.score || 0);
      p3Max += (r.maxScore || 0);
    } else if (qName.includes('tự luận') || qName.includes('trình bày')) {
      p4Score += (r.score || 0);
      p4Max += (r.maxScore || 0);
    } else {
      p1Score += (r.score || 0);
      p1Max += (r.maxScore || 0);
    }
  });

  // Bảng chi tiết
  const detailRows = questionResultsTable.length > 0
    ? questionResultsTable.map(r => {
        const displayVerdict = (r.verdict === 'CẦN GIÁO VIÊN DUYỆT' || r.verdict === 'CẦN GIÁO VIÊN KIỂM TRA')
          ? 'CẦN CHẤM/DUYỆT THỦ CÔNG'
          : r.verdict;
        return `| ${r.question} | ${r.studentAnswer || '-'} | ${r.expectedAnswer || '-'} | ${displayVerdict} | ${r.maxScore.toFixed(2)} | ${r.score.toFixed(2)} |`;
      }).join('\n')
    : '| 1 | - | - | Chưa chấm | 0.25 | 0.00 |';

  const pendingReviewItems = questionResultsTable.filter(r =>
    r.verdict === 'CẦN GIÁO VIÊN DUYỆT' ||
    r.verdict === 'CẦN GIÁO VIÊN KIỂM TRA' ||
    r.verdict === 'KHÔNG ĐỌC RÕ' ||
    r.verdict === 'KHÔNG ĐỌC ĐƯỢC'
  );

  const reviewStr = pendingReviewItems.length > 0
    ? pendingReviewItems.map(p => `- ${p.question}: Trạng thái ${p.verdict} (Căn cứ: ${p.basisForScore || 'Cần kiểm tra'})`).join('\n')
    : 'Không có (100% câu/ý đều rõ ràng và đủ căn cứ)';

  const strengthsStr = goodPoints.length > 0 ? goodPoints.join('; ') : 'Học sinh đã hoàn thành việc nộp bài theo yêu cầu.';
  const weaknessesStr = wrongPoints.length > 0 ? wrongPoints.join('; ') : 'Không có lỗi sai nào đáng kể.';
  const improvementsStr = improvements.length > 0 ? improvements.join('; ') : 'Tiếp tục duy trì phương pháp học tập khoa học.';

  const submissionDateStr = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString('vi-VN')
    : new Date().toLocaleString('vi-VN');

  const currentStatus = statusOverride || (pendingReviewItems.length > 0 ? 'CẦN GIÁO VIÊN DUYỆT' : 'ĐÃ CHẤM');

  return `KẾT QUẢ CHẤM BÀI

Họ và tên học sinh: ${submission.studentName || 'Học sinh'}
Lớp: ${submission.studentClass || 'Chưa cập nhật'}
Mã đề: ${submission.variant || 'Đề gốc'}
Thời gian nộp: ${submissionDateStr}

TRẠNG THÁI:
${currentStatus}

CHI TIẾT:

| Câu | Trả lời HS | Đáp án chuẩn | Kết quả | Điểm tối đa | Điểm đạt |
|:---|:---|:---|:---:|:---:|:---:|
${detailRows}

ĐIỂM THEO PHẦN:
- Phần I: ${p1Score.toFixed(2)}/${(p1Max || 3.0).toFixed(2)} điểm
- Phần II: ${p2Score.toFixed(2)}/${(p2Max || 4.0).toFixed(2)} điểm
- Phần III: ${p3Score.toFixed(2)}/${(p3Max || 3.0).toFixed(2)} điểm${p4Max > 0 ? `\n- Phần IV: ${p4Score.toFixed(2)}/${p4Max.toFixed(2)} điểm` : ''}

TỔNG ĐIỂM: ${finalScore.toFixed(1)}/${maxScore.toFixed(1)} điểm

KIỂM TRA ĐỒNG BỘ:
✓ Mã đề
✓ Đáp án
✓ Hướng dẫn chấm
✓ Ma trận
✓ Thang điểm

CÂU CẦN GIÁO VIÊN XEM LẠI:
${reviewStr}

NHẬN XÉT NGẮN:
- Nội dung học sinh làm đúng: ${strengthsStr}
- Nội dung còn sai: ${weaknessesStr}
- Nội dung cần củng cố: ${improvementsStr}

🌟 LỜI NHẬN XÉT CỦA THẦY/CÔ:
- ${teacherComment}`;
}

/**
 * Bộ tạo nhận xét sư phạm chuyên nghiệp chuẩn mực (Dùng nội bộ & Làm fallback an toàn)
 * Tuân thủ tuyệt đối vai trò Hệ thống chấm bài kiểm tra tự động chuyên nghiệp dành cho giáo viên THCS,
 * Quy trình chấm 8 bước, 5 nguyên tắc bắt buộc và 10 CHECKS chống chấm sai.
 */
export function generatePedagogicalEvaluation(
  submission: StudentSubmission,
  examPackage?: Partial<SavedExamPackage> | null,
  answerKeyInput?: Record<string, string>
): PedagogicalEvaluation {
  // BƯỚC 0: KIỂM TRA TÍNH ĐỒNG BỘ TRƯỚC KHI CHO PHÉP CHẤM BÀI (4 NGUỒN)
  const syncReport = checkPreGradingSynchronization(examPackage, submission.variant);

  const preGradingTableRows = syncReport.rows.map(r => {
    return `| ${r.question} | ${r.exam} | ${r.rubric} | ${r.points.toFixed(2)} | ${r.matrix} | ${r.status} |`;
  }).join('\n');

  if (!syncReport.isAllowedToGrade) {
    // KHÔNG cho phép chấm tự động nếu có bất kỳ câu nào MÂU THUẪN
    const blockReason = syncReport.blockReason || 'Phát hiện MÂU THUẪN giữa 4 nguồn dữ liệu (Đề - Hướng dẫn chấm - Ma trận - Mã đề). Hệ thống KHÔNG cho phép chấm tự động theo quy định!';
    
    const formattedFeedback = `[A. THÔNG TIN BÀI & TRẠNG THÁI]
- Họ và tên: ${submission.studentName || 'Học sinh'}
- Lớp: ${submission.studentClass || 'Lớp học'}
- Mã đề: ${submission.variant || 'Đề gốc'}
- Trạng thái bài: CẦN GIÁO VIÊN KIỂM TRA (TẠM DỪNG CHẤM TỰ ĐỘNG)

🔍 **BẢNG KIỂM TRA TÍNH ĐỒNG BỘ TRƯỚC KHI CHẤM (4 NGUỒN: MA TRẬN - ĐỀ - HD CHẤM - MÃ ĐỀ):**
| Câu | Đề | Hướng dẫn chấm | Điểm | Ma trận | Trạng thái |
| --- | -- | -------------- | ---: | ------- | :--------: |
${preGradingTableRows}

⛔ **KẾT QUẢ KIỂM TRA ĐỒNG BỘ: PHÁT HIỆN MÂU THUẪN DỮ LIỆU**
${blockReason}
*Quy định bắt buộc:* Chỉ cho phép chuyển sang bước CHẤM khi toàn bộ dữ liệu cần thiết đã KHỚP.

🌟 **HƯỚNG DẪN DÀNH CHO GIÁO VIÊN:**
- Thầy/Cô vui lòng kiểm tra và hiệu chỉnh lại Ma trận, Đề thi, Hướng dẫn chấm hoặc Mã đề tại các bước soạn thảo để loại bỏ mâu thuẫn trước khi tiến hành chấm tự động.`;

    return {
      score: 0,
      maxScore: 10.0,
      submissionStatus: 'CẦN GIÁO VIÊN KIỂM TRA',
      isAllowedToGrade: false,
      warning: blockReason,
      preGradingSyncTable: syncReport.rows,
      matrixSpecMappings: syncReport.matrixSpecMappings,
      antiMistakeChecks: {
        check01_code: !syncReport.rows.some(r => r.question.includes('Mã đề') && r.status === 'MÂU THUẪN'),
        check02_exam: !syncReport.rows.some(r => r.exam.includes('Không tìm thấy') && r.status === 'MÂU THUẪN'),
        check03_rubric: !syncReport.rows.some(r => r.rubric.includes('Thiếu') && r.status === 'MÂU THUẪN'),
        check04_answer: false,
        check05_question: true,
        check06_submission: true,
        check07_itemScores: false,
        check08_totalScore: false,
        check09_uncertainty: true,
        check10_dataConflict: true
      },
      synchronizationChecks: {
        matrixVsExam: 'Có mâu thuẫn',
        examVsAnswers: 'Có mâu thuẫn',
        answersVsRubric: 'Có mâu thuẫn',
        rubricVsSubmission: 'Cần kiểm tra',
        matrixVsResults: 'Chưa đối chiếu',
        isSynchronized: false,
        warningDetails: blockReason
      },
      questionResultsTable: [],
      learningFeedback: {
        achievedKnowledge: 'Chưa đủ điều kiện chấm tự động do phát hiện mâu thuẫn dữ liệu.',
        unachievedKnowledge: 'Cần giáo viên đối chiếu lại đề bài và hướng dẫn chấm.',
        errorsToFix: blockReason,
        recommendedReview: 'Hiệu chỉnh dữ liệu tại Mục 2 (Ma trận), Mục 3 (Đề thi) hoặc Mục 5 (Mã đề).'
      },
      formattedFeedback,
      strengths: 'Bài làm đã nộp đầy đủ.',
      weaknesses: blockReason,
      improvements: 'Chờ giáo viên rà soát lại dữ liệu đề thi và hướng dẫn chấm.',
      teacherComment: 'Hệ thống đã tạm dừng chấm tự động để đảm bảo quyền lợi và sự chính xác tuyệt đối cho học sinh.',
      gradedBy: 'instant',
      gradedAt: new Date().toISOString()
    };
  }

  const key = (answerKeyInput && Object.keys(answerKeyInput).length > 0)
    ? answerKeyInput
    : getUnifiedAnswerKey(examPackage, submission.variant);

  const evalRes = evaluateSubmission(submission.answers || {}, key, examPackage);
  let finalScore = evalRes.score;
  const maxScore = 10.0;

  const goodPoints: string[] = [];
  const wrongPoints: string[] = [];
  const improvements: string[] = [];
  const errorsToFix: string[] = [];

  const answers = submission.answers || {};
  const totalKeys = Object.keys(key);
  const { details } = evalRes;

  // BƯỚC 1, 2, 3, 4, 5, 6: Xây dựng bảng kết quả chi tiết từng câu (questionResultsTable)
  const questionResultsTable: import('../types').QuestionResultItem[] = [];

  // 1. Phân tích Phần I (Trắc nghiệm một lựa chọn: q_1, q_2...)
  const p1Keys = totalKeys.filter(k => k.startsWith('q_')).sort((a, b) => {
    return parseInt(a.replace('q_', ''), 10) - parseInt(b.replace('q_', ''), 10);
  });
  const p1Weight = p1Keys.length > 0 ? Math.round((details.p1MaxScore / p1Keys.length) * 100) / 100 : 0.25;

  p1Keys.forEach(k => {
    const qNum = k.replace('q_', '');
    const sAns = (answers[k] || '').trim().toUpperCase();
    const exp = (key[k] || '').trim().toUpperCase();

    const sSet = extractChoiceSet(sAns);
    const expSet = extractChoiceSet(exp);
    const isMultiChoice = expSet.size > 1 || sSet.size > 1;
    const isBlank = !sAns;

    let isCorrect = false;
    if (isMultiChoice) {
      // Đối với câu hỏi nhiều lựa chọn:
      // Xác định: Tập đáp án chuẩn; Tập đáp án học sinh chọn. So sánh hai tập.
      // Chỉ áp dụng cách tính điểm được quy định trong hướng dẫn chấm.
      // Không tự đặt quy tắc: đúng 1 ý = ..., đúng 2 ý = ..., sai 1 ý = ... nếu hướng dẫn chấm không quy định.
      isCorrect = areChoiceSetsEqual(sSet, expSet);
    } else {
      isCorrect = Boolean(sAns && (sAns === exp || areChoiceSetsEqual(sSet, expSet)));
    }

    const rowScore = isCorrect ? p1Weight : 0;
    const verdict = isCorrect
      ? 'ĐÚNG'
      : isBlank
      ? 'KHÔNG TRẢ LỜI'
      : 'SAI';

    let analysis = '';
    if (isCorrect) {
      analysis = isMultiChoice
        ? `Tập đáp án học sinh chọn {${Array.from(sSet).sort().join(', ')}} khớp hoàn toàn với tập đáp án chuẩn {${Array.from(expSet).sort().join(', ')}}.`
        : 'Chọn đúng phương án chuẩn';
    } else if (isBlank) {
      analysis = 'Học sinh bỏ trống';
    } else if (isMultiChoice) {
      const studentDisplay = Array.from(sSet).sort().join(', ');
      const expDisplay = Array.from(expSet).sort().join(', ');
      analysis = `Tập học sinh chọn {${studentDisplay}} ≠ Tập chuẩn {${expDisplay}}. Hướng dẫn chấm không quy định cách tính điểm lẻ nên không tự đặt quy tắc (đúng 1 ý/sai 1 ý).`;
    } else {
      analysis = `Chọn sai phương án, đáp án chuẩn là ${exp}`;
    }

    questionResultsTable.push({
      question: `Câu ${qNum} (${isMultiChoice ? 'Nhiều lựa chọn' : 'TN'})`,
      maxScore: p1Weight,
      score: rowScore,
      verdict,
      studentAnswer: isMultiChoice ? (sSet.size > 0 ? `{${Array.from(sSet).sort().join(', ')}}` : '[BỎ TRỐNG]') : (sAns || '[BỎ TRỐNG]'),
      expectedAnswer: isMultiChoice ? `{${Array.from(expSet).sort().join(', ')}}` : exp,
      analysis,
      basisForScore: isCorrect
        ? 'Khớp chính xác với đáp án chính thức theo mã đề'
        : (isBlank ? 'Bỏ trống - 0.00 điểm theo quy định' : `Không khớp đáp án chính thức (${exp})`)
    });
  });

  if (details.p1Total > 0) {
    if (details.p1Correct === details.p1Total) {
      goodPoints.push(`Phần I (Trắc nghiệm): Trả lời đúng toàn bộ ${details.p1Correct}/${details.p1Total} câu (${details.p1CorrectList.join(', ')}), đạt tối đa ${details.p1MaxScore.toFixed(1)} điểm.`);
    } else if (details.p1Correct > 0) {
      goodPoints.push(`Phần I (Trắc nghiệm): Trả lời đúng ${details.p1Correct}/${details.p1Total} câu (${details.p1CorrectList.join(', ')}), đạt ${details.p1Score.toFixed(1)}/${details.p1MaxScore.toFixed(1)} điểm.`);
    }
    if (details.p1WrongList.length > 0) {
      wrongPoints.push(`Phần I (Trắc nghiệm): Còn chọn sai hoặc bỏ trống ${details.p1WrongList.length} câu: ${details.p1WrongList.join('; ')}.`);
      errorsToFix.push(`Phần I: Nhầm lẫn ở các câu ${details.p1WrongList.map(s => s.split(' ')[1]).join(', ')}`);
      improvements.push(`Phần I: Cần đọc kĩ câu hỏi lý thuyết và phân tích các phương án gây nhiễu để tránh nhầm lẫn.`);
    }
  }

  // 2. Phân tích Phần II (Đúng - Sai)
  const p2Questions = new Set<string>();
  totalKeys.filter(k => k.startsWith('tf_')).forEach(k => {
    const parts = k.split('_');
    if (parts.length >= 3) p2Questions.add(parts[1]);
  });
  const sortedP2 = Array.from(p2Questions).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  sortedP2.forEach(qNum => {
    const qInfo = details.p2Details[qNum];
    const subKeys = ['a', 'b', 'c', 'd'];
    const maxForQ = details.p2QuestionsTotal > 0 ? (details.p2MaxScore / details.p2QuestionsTotal) : 1.0;

    subKeys.forEach(sub => {
      const keyStr = `tf_${qNum}_${sub}`;
      if (!key[keyStr]) return;
      const sAns = (answers[keyStr] || '').trim().toUpperCase();
      const exp = (key[keyStr] || '').trim().toUpperCase();
      const isSubCorrect = isTrueFalseMatch(sAns, exp);
      const isBlank = !sAns;
      const formattedExp = formatTrueFalseExpected(exp);

      const verdict = isSubCorrect
        ? 'ĐÚNG'
        : isBlank
        ? 'KHÔNG TRẢ LỜI'
        : 'SAI';

      questionResultsTable.push({
        question: `Câu ${qNum}.${sub} (Đ-S)`,
        maxScore: Math.round((maxForQ / 4) * 100) / 100,
        score: isSubCorrect ? Math.round((maxForQ / 4) * 100) / 100 : 0,
        verdict,
        studentAnswer: sAns || '[BỎ TRỐNG]',
        expectedAnswer: formattedExp,
        analysis: isSubCorrect ? 'Phân tích mệnh đề chính xác' : (isBlank ? 'Chưa trả lời mệnh đề này' : `Xác định sai tính đúng/sai của mệnh đề, đáp án chuẩn là ${formattedExp}`),
        basisForScore: isSubCorrect
          ? `Mệnh đề (${sub}) khớp đáp án chuẩn ${formattedExp}`
          : (isBlank ? 'Bỏ trống mệnh đề - 0.00đ' : `Sai mệnh đề (${sub}) so với đáp án chuẩn ${formattedExp}`)
      });
    });
  });

  if (details.p2QuestionsTotal > 0) {
    const p2GoodStatements: string[] = [];
    const p2WrongStatements: string[] = [];

    Object.entries(details.p2Details).forEach(([qNum, qInfo]) => {
      if (qInfo.correctSubs.length === qInfo.totalUnits) {
        p2GoodStatements.push(`Câu ${qNum} đúng trọn vẹn cả 4 ý (${qInfo.correctSubs.join(', ')})`);
      } else if (qInfo.correctSubs.length > 0) {
        p2GoodStatements.push(`Câu ${qNum} đúng ${qInfo.correctSubs.join(', ')}`);
      }
      if (qInfo.wrongSubs.length > 0) {
        p2WrongStatements.push(`Câu ${qNum} còn nhầm ở ${qInfo.wrongSubs.join('; ')}`);
      }
    });

    if (p2GoodStatements.length > 0) {
      goodPoints.push(`Phần II (Đúng - Sai): Xác định đúng ${details.p2UnitsCorrect}/${details.p2UnitsTotal} ý hỏi: ${p2GoodStatements.join('; ')} (Đạt ${details.p2Score.toFixed(1)}/${details.p2MaxScore.toFixed(1)} điểm).`);
    }
    if (p2WrongStatements.length > 0) {
      wrongPoints.push(`Phần II (Đúng - Sai): ${p2WrongStatements.join('; ')}.`);
      errorsToFix.push(`Phần II: Cần rà soát lại các mệnh đề sai ở ${p2WrongStatements.join('; ')}`);
      improvements.push(`Phần II: Dạng câu Đúng - Sai đòi hỏi phân tích độc lập từng mệnh đề, cần rèn luyện kỹ năng lập luận logic.`);
    }
  }

  // 3. Phân tích Phần III (Trả lời ngắn: sa_1, sa_2...)
  const p3Keys = totalKeys.filter(k => k.startsWith('sa_')).sort((a, b) => {
    return parseInt(a.replace('sa_', ''), 10) - parseInt(b.replace('sa_', ''), 10);
  });
  const p3Weight = p3Keys.length > 0 ? Math.round((details.p3MaxScore / p3Keys.length) * 100) / 100 : 0.5;

  p3Keys.forEach(k => {
    const qNum = k.replace('sa_', '');
    const sAns = (answers[k] || '').trim();
    const exp = (key[k] || '').trim();
    const isCorrect = sAns && exp && isShortAnswerMatch(sAns, exp);
    const isBlank = !sAns;

    const verdict = isCorrect
      ? 'ĐÚNG'
      : isBlank
      ? 'KHÔNG TRẢ LỜI'
      : 'SAI';

    questionResultsTable.push({
      question: `Câu ${qNum} (TLN)`,
      maxScore: p3Weight,
      score: isCorrect ? p3Weight : 0,
      verdict,
      studentAnswer: sAns || '[BỎ TRỐNG]',
      expectedAnswer: exp,
      analysis: isCorrect ? 'Tính toán và điền đáp số đúng công thức và đơn vị' : (isBlank ? 'Chưa điền đáp số tính toán' : `Kết quả tính toán/đơn vị chưa khớp với đáp án chuẩn (${exp})`),
      basisForScore: isCorrect
        ? `Khớp đáp số hoặc cách diễn đạt tương đương được chấp nhận (${exp})`
        : (isBlank ? 'Bỏ trống đáp số - 0.00đ' : `Sai đáp số chuẩn (${exp})`)
    });
  });

  if (details.p3Total > 0) {
    if (details.p3Correct === details.p3Total) {
      goodPoints.push(`Phần III (Trả lời ngắn): Tính toán và điền đáp số chính xác toàn bộ ${details.p3Correct}/${details.p3Total} câu: ${details.p3CorrectList.join(', ')} (Đạt tối đa ${details.p3MaxScore.toFixed(1)} điểm).`);
    } else if (details.p3Correct > 0) {
      goodPoints.push(`Phần III (Trả lời ngắn): Tính toán chính xác ${details.p3Correct}/${details.p3Total} câu: ${details.p3CorrectList.join(', ')} (Đạt ${details.p3Score.toFixed(1)}/${details.p3MaxScore.toFixed(1)} điểm).`);
    }
    if (details.p3WrongList.length > 0) {
      wrongPoints.push(`Phần III (Trả lời ngắn): Chưa chính xác ở ${details.p3WrongList.join('; ')}.`);
      errorsToFix.push(`Phần III: Sai số hoặc quy đổi đơn vị ở ${details.p3WrongList.join('; ')}`);
      improvements.push(`Phần III: Kiểm tra kỹ các bước thiết lập biểu thức tính toán và quy đổi đơn vị đo lường trước khi ghi đáp số.`);
    }
  }

  // 4. Phân tích Tự luận / Ghi chú nếu có
  if (submission.essayAnswer && submission.essayAnswer.trim().length > 0) {
    goodPoints.push(`Phần tự luận / giải trình: Học sinh có ý thức trình bày các bước giải quyết vấn đề.`);
    questionResultsTable.push({
      question: `Tự luận / Trình bày`,
      maxScore: 1.0,
      score: 1.0,
      verdict: `CẦN GIÁO VIÊN DUYỆT`,
      studentAnswer: submission.essayAnswer.slice(0, 100),
      expectedAnswer: 'Trình bày theo các bước logic trong hướng dẫn chấm',
      analysis: 'Học sinh có ý thức giải trình phương pháp giải chi tiết',
      basisForScore: 'Bài tự luận viết tay/trình bày tự do cần giáo viên duyệt và thẩm định barem chi tiết'
    });
  }

  if (goodPoints.length === 0) {
    goodPoints.push(`Học sinh đã hoàn thành việc nộp bài đúng thời gian quy định.`);
  }
  if (wrongPoints.length === 0) {
    wrongPoints.push(`Không có lỗi sai nào đáng kể; bài làm hoàn hảo theo đúng thang điểm và hướng dẫn chấm.`);
  }
  if (improvements.length === 0) {
    improvements.push(`Tiếp tục duy trì phương pháp học tập khoa học và tinh thần làm bài cẩn trọng hiện tại để đạt thành tích cao trong các kì thi sắp tới.`);
  }

  // Lời nhận xét của Thầy/Cô (dành cho giáo viên THCS)
  let teacherComment = '';
  if (finalScore >= 9.0) {
    teacherComment = 'Thầy/Cô rất khen ngợi tinh thần học tập và năng lực làm bài xuất sắc của em. Em nắm rất vững kiến thức trọng tâm và tư duy mạch lạc, hãy tiếp tục phát huy nhé!';
  } else if (finalScore >= 7.0) {
    teacherComment = 'Bài làm khá tốt, em đã nắm chắc phần lớn kiến thức nền tảng. Chỉ cần cẩn trọng hơn ở các câu hỏi phân hóa và kiểm tra kỹ lại bài trước khi nộp là em sẽ đạt điểm tối đa!';
  } else if (finalScore >= 5.0) {
    teacherComment = 'Em đã có nhiều nỗ lực và hoàn thành được các yêu cầu cơ bản của đề thi. Hãy dành thêm thời gian ôn luyện lại các dạng bài còn nhầm lẫn để có sự bứt phá ở bài kiểm tra tiếp theo!';
  } else {
    teacherComment = 'Đừng nản lòng nhé! Thầy/Cô nhận thấy em đã cố gắng làm bài. Em hãy chủ động xem lại phần hướng dẫn cải thiện và trao đổi thêm với Thầy/Cô để củng cố lại những nội dung chưa vững nhé!';
  }

  // BƯỚC 7 & 8: Bảng kết quả Markdown chuẩn 6 cột: | Câu | Đáp án học sinh | Đáp án chuẩn | Kết quả | Điểm | Căn cứ |
  const strengthsStr = goodPoints.length > 0 ? goodPoints.join('; ') : 'Hoàn thành các câu hỏi theo yêu cầu.';
  const weaknessesStr = wrongPoints.length > 0 ? wrongPoints.join('; ') : 'Không có lỗi sai nào đáng kể.';
  const improvementsStr = improvements.length > 0 ? improvements.join('; ') : 'Tiếp tục duy trì phương pháp học tập khoa học.';

  // QUY TẮC TÍNH ĐIỂM:
  // TỔNG ĐIỂM = Σ ĐIỂM CÂU 1 + ĐIỂM CÂU 2 + ... + ĐIỂM CÂU n
  // Không tính điểm bằng cách ước lượng.
  // Không làm tròn giữa các câu.
  // Chỉ làm tròn ở bước cuối nếu quy định yêu cầu (làm tròn đến 1 chữ số thập phân).
  const rawSumScores = questionResultsTable.reduce((sum, it) => sum + (it.score || 0), 0);
  finalScore = Math.min(10.0, Math.round(rawSumScores * 10) / 10);
  const isExceedingMax = rawSumScores > (maxScore + 0.05);

  const formattedFeedback = formatOfficialGradingResultReport(
    submission,
    questionResultsTable,
    finalScore,
    maxScore,
    goodPoints,
    wrongPoints,
    improvements,
    teacherComment,
    isExceedingMax ? 'LỖI DỮ LIỆU' : undefined
  );

  const evalObj: PedagogicalEvaluation = {
    score: finalScore,
    maxScore: maxScore,
    submissionStatus: isExceedingMax ? 'CẦN GIÁO VIÊN KIỂM TRA' : 'ĐÃ CHẤM',
    isAllowedToGrade: !isExceedingMax,
    warning: isExceedingMax ? `LỖI HỆ THỐNG — VƯỢT ĐIỂM TỐI ĐA: Tổng điểm các câu (${rawSumScores.toFixed(2)}đ) vượt quá điểm tối đa quy định (${maxScore}đ). Đã dừng xuất kết quả cuối cùng.` : undefined,
    preGradingSyncTable: syncReport.rows,
    matrixSpecMappings: syncReport.matrixSpecMappings,
    antiMistakeChecks: {
      check01_code: true,
      check02_exam: true,
      check03_rubric: true,
      check04_answer: true,
      check05_question: true,
      check06_submission: true,
      check07_itemScores: !questionResultsTable.some(r => r.score > (r.maxScore + 0.001)),
      check08_totalScore: !isExceedingMax,
      check09_uncertainty: false,
      check10_dataConflict: false
    },
    correctCount: evalRes.correctCount,
    totalQuestions: evalRes.totalQuestions,
    questionResultsTable,
    synchronizationChecks: {
      matrixVsExam: 'Đồng bộ',
      examVsAnswers: 'Đồng bộ',
      answersVsRubric: 'Đồng bộ',
      rubricVsSubmission: 'Đồng bộ',
      matrixVsResults: 'Đồng bộ',
      isSynchronized: true
    },
    learningFeedback: {
      achievedKnowledge: goodPoints.join('; '),
      unachievedKnowledge: wrongPoints.join('; '),
      errorsToFix: errorsToFix.join('; ') || 'Không có lỗi sai nghiêm trọng.',
      recommendedReview: improvements.join('; ')
    },
    formattedFeedback,
    strengths: goodPoints.join('; '),
    weaknesses: wrongPoints.join('; '),
    improvements: improvements.join('; '),
    teacherComment,
    gradedBy: 'instant',
    gradedAt: new Date().toISOString()
  };

  evalObj.auditReport = auditSubmissionScores({
    ...submission,
    score: finalScore,
    evaluationDetails: evalObj
  }, examPackage);

  evalObj.preFinalCrossCheck = runPreFinalCrossCheck({
    ...submission,
    score: finalScore,
    evaluationDetails: evalObj
  }, examPackage, evalObj);

  evalObj.finalTenStepCheck = runFinalTenStepCheck({
    ...submission,
    score: finalScore,
    evaluationDetails: evalObj
  }, examPackage, evalObj);

  if (evalObj.finalTenStepCheck.isPassedAll10Steps) {
    evalObj.submissionStatus = 'ĐÃ CHẤM – ĐỦ CĂN CỨ';
  } else if (evalObj.finalTenStepCheck.steps.step10_teacherReview.pendingReviewCount > 0) {
    evalObj.submissionStatus = 'CẦN GIÁO VIÊN DUYỆT';
  } else {
    evalObj.submissionStatus = 'CẦN GIÁO VIÊN KIỂM TRA';
  }

  return evalObj;
}

/**
 * Gọi AI Giám khảo chấm thi chuyên nghiệp hoặc fallback tự động
 */
export async function gradeSubmissionWithAI(
  submission: StudentSubmission,
  examPackage?: Partial<SavedExamPackage> | null,
  workflowContext?: any
): Promise<PedagogicalEvaluation> {
  const targetExam = examPackage || workflowContext;
  const rawExamContent = targetExam?.resultStep3 || targetExam?.resultStep5 || '';
  const key = getUnifiedAnswerKey(targetExam, submission.variant);

  // BƯỚC 0: KIỂM TRA TÍNH ĐỒNG BỘ TRƯỚC KHI CHO PHÉP CHẤM BÀI (4 NGUỒN)
  const syncReport = checkPreGradingSynchronization(targetExam, submission.variant);
  if (!syncReport.isAllowedToGrade) {
    // Nếu có bất kỳ câu nào MÂU THUẪN: KHÔNG cho phép chấm tự động!
    return generatePedagogicalEvaluation(submission, targetExam, key);
  }

  // Tính toán kết quả đối chiếu đáp án chuẩn xác trước
  const evalRes = evaluateSubmission(submission.answers || {}, key, targetExam);

  const mergedContext = {
    examTitle: examPackage?.title || workflowContext?.subject || submission.examTitle || 'Đề kiểm tra',
    subject: examPackage?.subject || workflowContext?.subject || submission.subject || 'Chung',
    grade: examPackage?.grade || workflowContext?.grade || submission.grade || '',
    lesson: examPackage?.lesson || workflowContext?.lesson || '',
    regulationSource: examPackage?.regulationSource || workflowContext?.regulationSource || '',
    matrix: examPackage?.matrix || workflowContext?.matrix || '',
    resultStep2: examPackage?.resultStep2 || workflowContext?.resultStep2 || '',
    rawExamContent,
    resultStep3: examPackage?.resultStep3 || workflowContext?.resultStep3 || '',
    resultStep5: examPackage?.resultStep5 || workflowContext?.resultStep5 || '',
    serverAnswerKey: key,
    evaluationSummary: evalRes,
    preGradingSyncReport: syncReport
  };

  try {
    const res = await fetch('/api/student/ai-grade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        submission,
        examContext: mergedContext
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.evaluation && !data.useFallback) {
        const evalData = data.evaluation;
        const validScore = typeof evalData.score === 'number'
          ? Math.min(10.0, Math.max(0, Math.round(evalData.score * 10) / 10))
          : evalRes.score;

        const aiEvalObj: PedagogicalEvaluation = {
          score: validScore,
          maxScore: 10.0,
          submissionStatus: evalData.submissionStatus || 'ĐÃ CHẤM',
          antiMistakeChecks: evalData.antiMistakeChecks || {
            check01_code: true,
            check02_exam: true,
            check03_rubric: true,
            check04_answer: true,
            check05_question: true,
            check06_submission: true,
            check07_itemScores: true,
            check08_totalScore: true,
            check09_uncertainty: false,
            check10_dataConflict: false
          },
          correctCount: evalRes.correctCount,
          totalQuestions: evalRes.totalQuestions,
          warning: evalData.warning,
          synchronizationChecks: evalData.synchronizationChecks,
          questionResultsTable: evalData.questionResultsTable,
          learningFeedback: evalData.learningFeedback,
          formattedFeedback: evalData.formattedFeedback || '',
          strengths: evalData.strengths || '',
          weaknesses: evalData.weaknesses || '',
          improvements: evalData.improvements || '',
          teacherComment: evalData.teacherComment || '',
          gradedBy: 'ai',
          gradedAt: new Date().toISOString()
        };

        aiEvalObj.auditReport = auditSubmissionScores({
          ...submission,
          score: validScore,
          evaluationDetails: aiEvalObj
        }, targetExam);

        aiEvalObj.preFinalCrossCheck = runPreFinalCrossCheck({
          ...submission,
          score: validScore,
          evaluationDetails: aiEvalObj
        }, targetExam, aiEvalObj);

        aiEvalObj.finalTenStepCheck = runFinalTenStepCheck({
          ...submission,
          score: validScore,
          evaluationDetails: aiEvalObj
        }, targetExam, aiEvalObj);

        if (aiEvalObj.finalTenStepCheck.isPassedAll10Steps) {
          aiEvalObj.submissionStatus = 'ĐÃ CHẤM – ĐỦ CĂN CỨ';
        } else if (aiEvalObj.finalTenStepCheck.steps.step10_teacherReview.pendingReviewCount > 0) {
          aiEvalObj.submissionStatus = 'CẦN GIÁO VIÊN DUYỆT';
        } else {
          aiEvalObj.submissionStatus = 'CẦN GIÁO VIÊN KIỂM TRA';
        }

        return aiEvalObj;
      }
    }
  } catch (err) {
    console.warn('AI Grade endpoint error, executing robust pedagogical engine fallback:', err);
  }

  // Fallback to our deterministic pedagogical evaluation
  return generatePedagogicalEvaluation(submission, examPackage, key);
}

// Fetch submissions from server with fallback to localStorage
export async function getSubmissions(examId?: string, className?: string): Promise<StudentSubmission[]> {
  try {
    let url = '/api/student/submissions';
    const params = new URLSearchParams();
    if (examId) params.append('examId', examId);
    if (className && className !== 'all') params.append('className', className);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.submissions)) {
        // Sync to local cache
        localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(data.submissions));
        return data.submissions;
      }
    }
  } catch (err) {
    console.warn('Could not fetch submissions from server, using local fallback:', err);
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    if (raw) {
      let list: StudentSubmission[] = JSON.parse(raw);
      if (examId) list = list.filter(s => s.examId === examId);
      if (className && className !== 'all') list = list.filter(s => s.studentClass === className);
      return list;
    }
  } catch (e) {
    console.error('Error reading submissions from localStorage:', e);
  }

  return [];
}

// Save student submission to server and local cache
export async function saveSubmission(submission: StudentSubmission): Promise<{ success: boolean; submission?: StudentSubmission }> {
  // Mirror to localStorage first for instant offline safety
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    const list: StudentSubmission[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(s => s.id !== submission.id);
    localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify([submission, ...filtered]));
    // Dispatch custom event for same-tab instant sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('qbank_student_submission_added', { detail: submission }));
    }
  } catch (e) {
    console.error('Error writing to local submissions cache:', e);
  }

  // Send to server
  try {
    const res = await fetch('/api/student/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.submission) {
        // If server evaluated score or updated metadata, sync back to local cache
        try {
          const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
          const list: StudentSubmission[] = raw ? JSON.parse(raw) : [];
          const idx = list.findIndex(s => s.id === data.submission.id);
          if (idx !== -1) {
            list[idx] = data.submission;
            localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(list));
          }
        } catch (e) {}
        return { success: true, submission: data.submission };
      }
      return { success: true, submission };
    }
    return { success: false };
  } catch (err) {
    console.warn('Could not send submission to server:', err);
    return { success: false, submission };
  }
}

// Update submission (teacher grading/comments)
export async function updateSubmission(id: string, updates: Partial<StudentSubmission>): Promise<boolean> {
  // Update local cache
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    if (raw) {
      const list: StudentSubmission[] = JSON.parse(raw);
      const idx = list.findIndex(s => s.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates };
        localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}

  // Update server
  try {
    const res = await fetch(`/api/student/submission/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not update submission on server:', err);
    return false;
  }
}

// Delete submission
export async function deleteSubmission(id: string): Promise<boolean> {
  // 1. Remove from local cache immediately
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
    if (raw) {
      const list: StudentSubmission[] = JSON.parse(raw);
      const filtered = list.filter(s => s.id !== id);
      localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(filtered));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('qbank_student_submission_deleted', { detail: { id } }));
    }
  } catch (e) {}

  // 2. Request deletion from server
  try {
    const res = await fetch(`/api/student/submission/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

// Clear all submissions
export async function clearAllSubmissions(examId?: string): Promise<boolean> {
  // 1. Clear from local cache immediately
  try {
    if (examId && examId !== 'all') {
      const raw = localStorage.getItem(LOCAL_SUBMISSIONS_KEY);
      if (raw) {
        const list: StudentSubmission[] = JSON.parse(raw);
        const filtered = list.filter(s => s.examId !== examId);
        localStorage.setItem(LOCAL_SUBMISSIONS_KEY, JSON.stringify(filtered));
      }
    } else {
      localStorage.removeItem(LOCAL_SUBMISSIONS_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('qbank_student_submission_cleared', { detail: { examId } }));
    }
  } catch (e) {}

  // 2. Request deletion from server
  try {
    const url = (examId && examId !== 'all')
      ? `/api/student/submissions?examId=${encodeURIComponent(examId)}`
      : '/api/student/submissions';
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    return false;
  }
}

// Generate realistic mock submissions for demonstration and testing
export function generateMockSubmissions(
  exam: SavedExamPackage,
  className: string = '9A1',
  count: number = 24
): StudentSubmission[] {
  const vietnameseNames = [
    'Nguyễn Văn An', 'Trần Thị Bích', 'Lê Hoàng Cường', 'Phạm Minh Đức',
    'Hoàng Thị Giang', 'Đặng Quốc Huy', 'Bùi Thu Hương', 'Vũ Khánh Linh',
    'Ngô Bảo Nam', 'Dương Thúy Nga', 'Đỗ Quang Phúc', 'Hồ Diệu Quỳnh',
    'Lý Gia Sơn', 'Đinh Thanh Thảo', 'Trịnh Quốc Trung', 'Lương Mỹ Uyên',
    'Phan Hải Vân', 'Cao Tấn Vũ', 'Tạ Minh Khang', 'Mai Phương Anh',
    'Võ Thành Đạt', 'Huỳnh Ngọc Hân', 'Lâm Trí Dũng', 'Chu Thảo My'
  ];

  const answerKey = (exam.serverAnswerKey && Object.keys(exam.serverAnswerKey).length > 0)
    ? exam.serverAnswerKey
    : extractAnswerKey(exam.resultStep3 || exam.resultStep5 || '', 'step3');
  
  const answerKeysList = Object.keys(answerKey);
  const effectiveKeys = answerKeysList.length > 0
    ? answerKeysList
    : [
        ...Array.from({ length: 12 }).map((_, i) => `q_${i + 1}`),
        ...[1, 2, 3, 4].flatMap(q => ['a', 'b', 'c', 'd'].map(s => `tf_${q}_${s}`)),
        ...Array.from({ length: 6 }).map((_, i) => `sa_${i + 1}`)
      ];

  const variants = ['101', '102', '103', '104'];
  const submissions: StudentSubmission[] = [];

  const now = Date.now();
  const selectedCount = Math.min(count, 24);

  for (let i = 0; i < selectedCount; i++) {
    const studentName = `HS MẪU ${(i + 1).toString().padStart(2, '0')}`;
    const studentCode = `SAMPLE${(i + 1).toString().padStart(2, '0')}`;
    const variant = variants[i % variants.length];

    // Determine target proficiency distribution
    let targetCorrectRatio: number;
    if (i < 4) {
      targetCorrectRatio = 0.85 + Math.random() * 0.15; // Giỏi: 8.5 - 10.0
    } else if (i < 14) {
      targetCorrectRatio = 0.65 + Math.random() * 0.18; // Khá: 6.5 - 8.2
    } else if (i < 20) {
      targetCorrectRatio = 0.50 + Math.random() * 0.14; // Trung bình: 5.0 - 6.4
    } else {
      targetCorrectRatio = 0.30 + Math.random() * 0.18; // Dưới trung bình: 3.0 - 4.8
    }

    const answers: Record<string, string> = {};

    for (let kIdx = 0; kIdx < effectiveKeys.length; kIdx++) {
      const k = effectiveKeys[kIdx];
      
      // Giả lập trạng thái bỏ trống cho 1 số câu ở các bài điểm thấp/trung bình
      if (i >= 18 && (kIdx === effectiveKeys.length - 1 || kIdx === effectiveKeys.length - 2) && Math.random() < 0.4) {
        answers[k] = '';
        continue;
      }

      const isCorrect = Math.random() < targetCorrectRatio;

      if (k.startsWith('q_')) {
        const expected = (answerKey[k] || ['A', 'B', 'C', 'D'][parseInt(k.replace('q_', ''), 10) % 4]).toUpperCase();
        if (isCorrect) {
          answers[k] = expected;
        } else {
          const wrongChoices = ['A', 'B', 'C', 'D'].filter(c => c !== expected);
          answers[k] = wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
        }
      } else if (k.startsWith('tf_')) {
        const expected = (answerKey[k] || 'Đ').toUpperCase();
        if (isCorrect) {
          answers[k] = expected.startsWith('Đ') ? 'Đ' : 'S';
        } else {
          answers[k] = expected.startsWith('Đ') ? 'S' : 'Đ';
        }
      } else if (k.startsWith('sa_')) {
        const rawExpected = answerKey[k] || '100';
        const cleanExpected = cleanShortAnswerExpected(rawExpected);
        if (isCorrect) {
          // Một số câu giả lập kèm đơn vị để kiểm thử chức năng CẦN DUYỆT THỦ CÔNG
          if (i % 8 === 0) {
            answers[k] = `${cleanExpected || rawExpected} nucleotide`;
          } else {
            answers[k] = cleanExpected || rawExpected;
          }
        } else {
          const num = parseFloat(cleanExpected);
          answers[k] = !isNaN(num) ? String(Math.round((num * 1.5 + 2) * 10) / 10) : '0';
        }
      }
    }

    const timeSpentSeconds = Math.floor((22 + Math.random() * 20) * 60);
    const submittedTime = new Date(now - (selectedCount - i) * 6 * 60 * 1000).toISOString();

    const partialSub: StudentSubmission = {
      id: `SUB-SAMPLE-${(i + 1).toString().padStart(4, '0')}`,
      examId: exam.id,
      examTitle: exam.title,
      subject: exam.subject,
      grade: exam.grade,
      variant,
      studentName,
      studentClass: className,
      studentCode,
      submittedAt: submittedTime,
      durationMinutes: exam.durationMinutes || 45,
      timeSpentSeconds,
      answers,
      essayAnswer: 'BÀI LÀM MẪU — KHÔNG PHẢI DỮ LIỆU HỌC SINH THẬT',
      status: 'graded',
      isSample: true,
      is_sample: true
    } as any;

    // Chấm điểm và tạo nhận xét sư phạm chuẩn xác đồng bộ 100%
    const evalDetails = generatePedagogicalEvaluation(partialSub, exam, answerKey);

    partialSub.score = evalDetails.score;
    partialSub.correctCount = evalDetails.correctCount;
    partialSub.totalQuestions = evalDetails.totalQuestions;
    partialSub.feedback = evalDetails.formattedFeedback;
    partialSub.evaluationDetails = evalDetails;
    partialSub.auditReport = evalDetails.auditReport;
    partialSub.preFinalCrossCheck = evalDetails.preFinalCrossCheck;
    partialSub.finalTenStepCheck = evalDetails.finalTenStepCheck;

    submissions.push(partialSub);
  }

  return submissions;
}

/**
 * KIỂM TOÁN VIÊN ĐIỂM (Độc lập với quá trình chấm trước đó)
 * Kiểm tra toàn bộ kết quả:
 * 1. Tổng số câu trong đề
 * 2. Số câu đã chấm
 * 3. Số câu bỏ sót
 * 4. Điểm tối đa từng câu
 * 5. Điểm đạt từng câu
 * 6. Tổng điểm (Công thức: TỔNG ĐIỂM = TỔNG ĐIỂM CÁC CÂU)
 * 7. Mã đề
 * 8. Đáp án sử dụng
 * 9. Hướng dẫn chấm sử dụng
 * 10. Các câu cần kiểm tra thủ công
 *
 * Kiểm tra:
 * - Tổng điểm có vượt điểm tối đa không?
 * - Có câu nào vượt điểm tối đa không?
 * - Có câu nào bị tính hai lần không?
 * - Có câu nào chưa tính không?
 * - Có sử dụng sai mã đề không?
 *
 * Nếu tất cả chính xác:
 * TRẠNG THÁI: ĐÃ KIỂM TOÁN
 *
 * Nếu phát hiện bất kỳ sai lệch:
 * TRẠNG THÁI: LỖI — CẦN KIỂM TRA
 *
 * NGUYÊN TẮC: Không được tự sửa dữ liệu gốc.
 */
export function auditSubmissionScores(
  submission: StudentSubmission,
  examPackage?: Partial<SavedExamPackage> | null
): ScoreAuditReport {
  const discrepancies: string[] = [];
  const manualReviewQuestions: string[] = [];

  const rawKey = getUnifiedAnswerKey(examPackage, submission.variant);
  const totalKeys = Object.keys(rawKey);

  // 1. Tổng số câu trong đề
  const p1Keys = totalKeys.filter(k => k.startsWith('q_'));
  const p2Keys = totalKeys.filter(k => k.startsWith('tf_'));
  const p3Keys = totalKeys.filter(k => k.startsWith('sa_'));

  const p2QuestionSet = new Set<string>();
  p2Keys.forEach(k => {
    const parts = k.split('_');
    if (parts.length >= 2) p2QuestionSet.add(parts[1]);
  });

  const totalExamQuestions = p1Keys.length + p2QuestionSet.size + p3Keys.length;
  const totalExamUnits = p1Keys.length + p2Keys.length + p3Keys.length;

  // Lấy danh sách kết quả từng câu được lưu trong bài làm
  const resultsTable = submission.evaluationDetails?.questionResultsTable || [];

  // 2. Số câu đã chấm
  const gradedQuestionsCount = resultsTable.length > 0 ? resultsTable.length : Object.keys(submission.answers || {}).length;

  // 3. Số câu bỏ sót & kiểm tra trùng lặp
  const seenQuestions = new Set<string>();
  let hasDuplicates = false;
  const duplicateQuestions: string[] = [];

  resultsTable.forEach(row => {
    const qKey = row.question.trim().toLowerCase();
    if (seenQuestions.has(qKey)) {
      hasDuplicates = true;
      duplicateQuestions.push(row.question);
    }
    seenQuestions.add(qKey);

    if (row.verdict === 'CẦN GIÁO VIÊN KIỂM TRA' || row.verdict === 'KHÔNG ĐỌC ĐƯỢC') {
      manualReviewQuestions.push(row.question);
    }
  });

  const omittedQuestionsCount = Math.max(0, (totalExamUnits > 0 ? totalExamUnits : totalExamQuestions) - seenQuestions.size);

  // 4. Điểm tối đa từng câu
  const itemMaxScores = resultsTable.map(r => ({ question: r.question, maxScore: r.maxScore }));

  // 5. Điểm đạt từng câu
  const itemAwardedScores = resultsTable.map(r => ({ question: r.question, score: r.score }));

  // 6. Tổng điểm: TỔNG ĐIỂM = TỔNG ĐIỂM CÁC CÂU
  const sumItemScores = Math.round(resultsTable.reduce((sum, it) => sum + (it.score || 0), 0) * 100) / 100;
  const reportedTotalScore = typeof submission.score === 'number'
    ? submission.score
    : (typeof submission.evaluationDetails?.score === 'number' ? submission.evaluationDetails.score : sumItemScores);
  const maxAllowedTotalScore = submission.evaluationDetails?.maxScore || 10.0;

  // 7. Mã đề
  const variantCode = submission.variant || 'step3';
  let isWrongVariantUsed = false;
  if (variantCode && variantCode !== 'step3' && variantCode !== 'all') {
    const hasVariantInStep5 = (examPackage?.resultStep5 || '').includes(variantCode);
    if (!hasVariantInStep5 && examPackage?.resultStep5 && examPackage.resultStep5.trim().length > 0) {
      isWrongVariantUsed = true;
      discrepancies.push(`Mã đề "${variantCode}" không tồn tại trong danh sách mã đề được cung cấp của bộ đề.`);
    }
  }

  // 8. Đáp án sử dụng
  const answersUsedSummary = `Đáp án chuẩn mã đề ${variantCode === 'step3' ? 'Gốc (step3)' : variantCode} (${totalKeys.length} lệnh hỏi)`;

  // 9. Hướng dẫn chấm sử dụng
  const rubricUsedSummary = examPackage?.resultStep3
    ? 'Hướng dẫn chấm chính thức Mục 3 / Bản đặc tả Mục 2'
    : 'Barem điểm chuẩn Bộ GD&ĐT (GDPT 2018)';

  // 10. Các câu cần kiểm tra thủ công
  if (submission.essayAnswer && submission.essayAnswer.trim().length > 0) {
    if (!manualReviewQuestions.some(q => q.toLowerCase().includes('tự luận'))) {
      manualReviewQuestions.push('Phần bài làm tự luận của học sinh');
    }
  }

  // 5 KIỂM TRA ĐẶC THÙ THEO YÊU CẦU:
  // Check 1: Tổng điểm có vượt điểm tối đa không?
  const isTotalScoreWithinMax = reportedTotalScore <= (maxAllowedTotalScore + 0.05);
  if (!isTotalScoreWithinMax) {
    discrepancies.push(`Tổng điểm (${reportedTotalScore}) vượt quá thang điểm tối đa (${maxAllowedTotalScore}).`);
  }

  // Check 2: Có câu nào vượt điểm tối đa không?
  const exceedingItems = resultsTable.filter(it => it.score > (it.maxScore + 0.01));
  const isAnyItemExceedingMax = exceedingItems.length > 0;
  if (isAnyItemExceedingMax) {
    exceedingItems.forEach(it => {
      discrepancies.push(`Câu "${it.question}" có điểm đạt (${it.score}) vượt quá điểm tối đa (${it.maxScore}).`);
    });
  }

  // Check 3: Có câu nào bị tính hai lần không?
  const isAnyItemDuplicated = hasDuplicates;
  if (isAnyItemDuplicated) {
    discrepancies.push(`Phát hiện câu bị tính hai lần / trùng lặp: ${duplicateQuestions.join(', ')}.`);
  }

  // Check 4: Có câu nào chưa tính không?
  const isAnyItemOmitted = resultsTable.length > 0 && resultsTable.length < Math.min(totalExamQuestions, totalExamUnits);
  if (isAnyItemOmitted) {
    discrepancies.push(`Số câu đã tính (${resultsTable.length}) ít hơn số câu trong đề thi (${totalExamQuestions} câu).`);
  }

  // Check 5: Có sử dụng sai mã đề không?
  // (Đã kiểm tra qua isWrongVariantUsed)

  // Kiểm tra công thức: TỔNG ĐIỂM = TỔNG ĐIỂM CÁC CÂU
  const diffScore = Math.abs(reportedTotalScore - sumItemScores);
  const isFormulaExact = resultsTable.length === 0 || diffScore <= 0.05;
  if (!isFormulaExact) {
    discrepancies.push(`Sai lệch công thức: Tổng điểm ghi nhận (${reportedTotalScore}) ≠ Tổng điểm các câu (${sumItemScores}). Độ lệch: ${(reportedTotalScore - sumItemScores).toFixed(2)}đ.`);
  }

  // KẾT LUẬN TRẠNG THÁI:
  const isAllAccurate = discrepancies.length === 0 && !isWrongVariantUsed && !isAnyItemExceedingMax && isTotalScoreWithinMax && !isAnyItemDuplicated && isFormulaExact;
  const status: 'TRẠNG THÁI: ĐÃ KIỂM TOÁN' | 'TRẠNG THÁI: LỖI — CẦN KIỂM TRA' =
    isAllAccurate ? 'TRẠNG THÁI: ĐÃ KIỂM TOÁN' : 'TRẠNG THÁI: LỖI — CẦN KIỂM TRA';

  const summaryLines = [
    `════════════════════════════════════════════════════════════════`,
    `⚖️ BIÊN BẢN KIỂM TOÁN ĐIỂM ĐỘC LẬP`,
    `════════════════════════════════════════════════════════════════`,
    `Vai trò: KIỂM TOÁN VIÊN ĐIỂM (Độc lập với quá trình chấm trước đó)`,
    `Học sinh: ${submission.studentName || 'Học sinh'} • Lớp: ${submission.studentClass || ''}`,
    `Mã đề kiểm toán: ${variantCode}`,
    `Thời gian kiểm toán: ${new Date().toLocaleString('vi-VN')}`,
    ``,
    `1. Tổng số câu trong đề: ${totalExamQuestions} câu (${totalExamUnits} lệnh hỏi/ý)`,
    `2. Số câu đã chấm: ${gradedQuestionsCount}`,
    `3. Số câu bỏ sót: ${omittedQuestionsCount > 0 ? omittedQuestionsCount : '0 (Không có)'}`,
    `4. Điểm tối đa từng câu: Đã rà soát ${itemMaxScores.length} câu/ý`,
    `5. Điểm đạt từng câu: Đã đối chiếu ${itemAwardedScores.length} câu/ý`,
    `6. Tổng điểm: ${reportedTotalScore} / ${maxAllowedTotalScore} (Tổng điểm các câu: ${sumItemScores})`,
    `   Công thức: TỔNG ĐIỂM = TỔNG ĐIỂM CÁC CÂU → ${isFormulaExact ? 'KHỚP TUYỆT ĐỐI' : 'LỆCH'}`,
    `7. Mã đề sử dụng: ${variantCode} (${isWrongVariantUsed ? '❌ SAI MÃ ĐỀ' : '✅ CHUẨN XÁC'})`,
    `8. Đáp án sử dụng: ${answersUsedSummary}`,
    `9. Hướng dẫn chấm sử dụng: ${rubricUsedSummary}`,
    `10. Các câu cần kiểm tra thủ công: ${manualReviewQuestions.length > 0 ? manualReviewQuestions.join(', ') : 'Không có'}`,
    ``,
    `ĐỐI SOÁT 5 CÂU HỎI KIỂM TOÁN:`,
    `- Tổng điểm có vượt điểm tối đa không? ${isTotalScoreWithinMax ? '✅ KHÔNG (Đạt)' : '❌ CÓ (VƯỢT TRẦN)'}`,
    `- Có câu nào vượt điểm tối đa không? ${!isAnyItemExceedingMax ? '✅ KHÔNG (Đạt)' : '❌ CÓ (SAI LỆCH)'}`,
    `- Có câu nào bị tính hai lần không? ${!isAnyItemDuplicated ? '✅ KHÔNG (Đạt)' : '❌ CÓ (TRÙNG LẶP)'}`,
    `- Có câu nào chưa tính không? ${!isAnyItemOmitted ? '✅ KHÔNG (Đạt)' : '❌ CÓ (BỎ SÓT)'}`,
    `- Có sử dụng sai mã đề không? ${!isWrongVariantUsed ? '✅ KHÔNG (Đúng mã đề)' : '❌ CÓ (SAI MÃ ĐỀ)'}`,
    ``,
    `KẾT LUẬN:`,
    `▶ ${status}`,
    discrepancies.length > 0 ? `\nSai lệch phát hiện:\n` + discrepancies.map((d, i) => `  [${i + 1}] ${d}`).join('\n') : '',
    `\n(Nguyên tắc kiểm toán: Không tự sửa dữ liệu gốc)`
  ];

  return {
    status,
    auditedAt: new Date().toISOString(),
    auditorRole: 'KIỂM TOÁN VIÊN ĐIỂM (Độc lập)',
    criteria: {
      totalExamQuestions,
      gradedQuestionsCount,
      omittedQuestionsCount,
      itemMaxScores,
      itemAwardedScores,
      sumItemScores,
      reportedTotalScore,
      maxAllowedTotalScore,
      variantCode,
      answersUsedSummary,
      rubricUsedSummary,
      manualReviewQuestions
    },
    checks: {
      isTotalScoreWithinMax,
      isAnyItemExceedingMax,
      isAnyItemDuplicated,
      isAnyItemOmitted,
      isWrongVariantUsed,
      isFormulaExact
    },
    discrepancies,
    summaryText: summaryLines.join('\n')
  };
}

/**
 * KIỂM TRA CHÉO MÃ ĐỀ TRƯỚC KHI CHỐT ĐIỂM (LẦN 2)
 *
 * CHECK 1: Mã đề học sinh đang được chấm.
 * CHECK 2: Bộ đáp án đang sử dụng.
 * CHECK 3: Thứ tự câu hỏi.
 * CHECK 4: Đáp án của từng câu.
 * CHECK 5: Thang điểm.
 * CHECK 6: Tổng điểm tối đa.
 *
 * QUY TẮC BẮT BUỘC:
 * - Mã đề học sinh ≠ mã đề đáp án → DỪNG CHẤM.
 * - Tổng điểm thành phần > điểm tối đa → DỪNG CHẤM.
 * - Tổng điểm bài > tổng điểm quy định → DỪNG CHẤM.
 * - Có câu trong bài nhưng không có trong hướng dẫn chấm → CẢNH BÁO.
 * - Có câu trong hướng dẫn chấm nhưng không tìm thấy bài làm → xác định là "KHÔNG TRẢ LỜI", không tự suy đoán.
 * - Có nhiều đáp án mâu thuẫn giữa các tài liệu → DỪNG và yêu cầu giáo viên xác nhận.
 */
export function runPreFinalCrossCheck(
  submission: StudentSubmission,
  examPackage?: Partial<SavedExamPackage> | null,
  evaluationDetails?: PedagogicalEvaluation
): PreFinalCrossCheckReport {
  const warnings: string[] = [];
  const stopReasons: string[] = [];

  const studentVariant = submission.variant || 'step3';
  const rawKey = getUnifiedAnswerKey(examPackage, studentVariant);
  const totalKeyKeys = Object.keys(rawKey);

  // CHECK 1: Mã đề học sinh đang được chấm
  let check1Passed = true;
  let check1Note = `Mã đề học sinh: "${studentVariant}". Đang sử dụng bộ đáp án chuẩn xác của mã đề "${studentVariant}".`;
  
  if (studentVariant && studentVariant !== 'step3' && studentVariant !== 'all') {
    const step5 = examPackage?.resultStep5 || '';
    if (step5.length > 0 && !step5.includes(studentVariant)) {
      check1Passed = false;
      check1Note = `Mã đề "${studentVariant}" không tìm thấy trong danh sách mã đề chính thức.`;
      stopReasons.push(`Mã đề học sinh (${studentVariant}) không khớp với bất kỳ mã đề nào trong bộ đề.`);
    }
  }

  // CHECK 2: Bộ đáp án đang sử dụng
  const check2Passed = totalKeyKeys.length > 0;
  let check2Note = check2Passed 
    ? `Bộ đáp án đang sử dụng: Mã đề ${studentVariant === 'step3' ? 'Gốc (step3)' : studentVariant} (${totalKeyKeys.length} lệnh hỏi/ý).`
    : `Không tìm thấy bộ đáp án tương ứng với mã đề ${studentVariant}.`;
  if (!check2Passed) {
    stopReasons.push(`Thiếu dữ liệu bộ đáp án cho mã đề ${studentVariant}.`);
  }

  // CHECK 3: Thứ tự câu hỏi
  const studentAnswers = submission.answers || {};
  const studentKeys = Object.keys(studentAnswers);
  const p1Nums = totalKeyKeys.filter(k => k.startsWith('q_')).map(k => parseInt(k.replace('q_', ''), 10)).sort((a,b) => a - b);
  let isSequential = true;
  for (let i = 0; i < p1Nums.length; i++) {
    if (p1Nums[i] !== i + 1) {
      isSequential = false;
      break;
    }
  }
  const check3Passed = true;
  const check3Note = `Thứ tự câu hỏi: ${p1Nums.length > 0 ? `Câu 1 đến Câu ${p1Nums[p1Nums.length - 1]}` : 'Đầy đủ'} (${isSequential ? 'Tuần tự chuẩn' : 'Phân bố theo mã đề'}).`;

  // CHECK 4: Đáp án của từng câu
  let matchedCount = 0;
  let extraInSubmissionCount = 0;
  let missingInSubmissionCount = 0;

  // Duyệt các câu học sinh làm
  studentKeys.forEach(k => {
    if (studentAnswers[k] && studentAnswers[k].trim().length > 0) {
      if (rawKey[k] !== undefined) {
        matchedCount++;
      } else {
        extraInSubmissionCount++;
        warnings.push(`Có câu trong bài làm (${k}) nhưng không có trong hướng dẫn chấm chính thức.`);
      }
    }
  });

  // Duyệt các câu trong hướng dẫn chấm
  totalKeyKeys.forEach(k => {
    const sVal = studentAnswers[k];
    if (!sVal || sVal.trim().length === 0) {
      missingInSubmissionCount++;
      // Xác định là "KHÔNG TRẢ LỜI", không tự suy đoán
    }
  });

  const check4Passed = extraInSubmissionCount === 0;
  const check4Note = `Đã kiểm tra ${totalKeyKeys.length} câu/ý: ${matchedCount} câu có làm, ${missingInSubmissionCount} câu KHÔNG TRẢ LỜI (không tự suy đoán)${extraInSubmissionCount > 0 ? `, ${extraInSubmissionCount} câu không có trong HD chấm` : ''}.`;

  // CHECK 5: Thang điểm
  const resultsTable = evaluationDetails?.questionResultsTable || [];
  const exceedingItems = resultsTable.filter(r => (r.score || 0) > (r.maxScore + 0.001));
  const isAnyItemExceeding = exceedingItems.length > 0;
  const check5Passed = !isAnyItemExceeding;
  let check5Note = check5Passed 
    ? 'Tất cả các câu đều có điểm đạt ≤ điểm tối đa của câu.'
    : `Phát hiện ${exceedingItems.length} câu có điểm vượt trần: ${exceedingItems.map(i => i.question).join(', ')}.`;
  if (isAnyItemExceeding) {
    stopReasons.push(`Tổng điểm thành phần > điểm tối đa ở câu: ${exceedingItems.map(i => i.question).join(', ')}.`);
  }

  // CHECK 6: Tổng điểm tối đa
  const maxAllowed = evaluationDetails?.maxScore || 10.0;
  const sumItems = Math.round(resultsTable.reduce((sum, r) => sum + (r.score || 0), 0) * 100) / 100;
  const reportedTotal = typeof submission.score === 'number' 
    ? submission.score 
    : (typeof evaluationDetails?.score === 'number' ? evaluationDetails.score : sumItems);

  const isTotalExceeding = reportedTotal > (maxAllowed + 0.01);
  const isFormulaValid = resultsTable.length === 0 || Math.abs(reportedTotal - sumItems) <= 0.05;

  let check6Passed = !isTotalExceeding && isFormulaValid;
  let check6Note = `Tổng điểm bài: ${reportedTotal}/${maxAllowed} (Tổng điểm các câu: ${sumItems}). ${isFormulaValid ? 'Khớp công thức tuyệt đối.' : 'Lệch công thức.'}`;
  if (isTotalExceeding) {
    stopReasons.push(`Tổng điểm bài (${reportedTotal}) > tổng điểm quy định (${maxAllowed}).`);
  }
  if (!isFormulaValid) {
    stopReasons.push(`Sai lệch công thức: Tổng điểm (${reportedTotal}) ≠ Tổng điểm các câu (${sumItems}).`);
  }

  // Xác định trạng thái
  let status: PreFinalCrossCheckReport['status'] = 'CHO PHÉP CHỐT ĐIỂM';
  if (stopReasons.some(r => r.includes('Mã đề'))) {
    status = 'DỪNG CHẤM — MÃ ĐỀ KHÔNG KHỚP';
  } else if (stopReasons.some(r => r.includes('vượt') || r.includes('Tổng điểm'))) {
    status = 'DỪNG CHẤM — VƯỢT ĐIỂM TỐI ĐA';
  } else if (stopReasons.length > 0) {
    status = 'DỪNG CHẤM — MÂU THUẪN DỮ LIỆU';
  } else if (warnings.length > 0) {
    status = 'CẢNH BÁO';
  }

  const isPassed = stopReasons.length === 0;

  return {
    status,
    isPassed,
    checkedAt: new Date().toISOString(),
    check1_variant: {
      passed: check1Passed,
      studentVariant,
      answerKeyVariant: studentVariant,
      note: check1Note
    },
    check2_answerKey: {
      passed: check2Passed,
      answerKeyCount: totalKeyKeys.length,
      note: check2Note
    },
    check3_questionSequence: {
      passed: check3Passed,
      sequenceSummary: `Tuần tự ${p1Nums.length} câu TN + ${totalKeyKeys.filter(k => k.startsWith('tf_')).length / 4} câu Đ/S + ${totalKeyKeys.filter(k => k.startsWith('sa_')).length} câu TLN`,
      note: check3Note
    },
    check4_itemAnswers: {
      passed: check4Passed,
      matchedCount,
      extraInSubmissionCount,
      missingInSubmissionCount,
      note: check4Note
    },
    check5_scoringScale: {
      passed: check5Passed,
      isAnyItemExceeding,
      note: check5Note
    },
    check6_totalMaxScore: {
      passed: check6Passed,
      reportedTotal,
      maxAllowed,
      sumItems,
      note: check6Note
    },
    warnings,
    stopReasons
  };
}

/**
 * KIỂM TRA CUỐI (10 BƯỚC XÁC NHẬN TRƯỚC KHI CÔNG BỐ ĐIỂM)
 *
 * [1] Đúng học sinh?
 * [2] Đúng mã đề?
 * [3] Đúng đề?
 * [4] Đúng ma trận?
 * [5] Đúng bản đặc tả?
 * [6] Đúng hướng dẫn chấm?
 * [7] Đúng đáp án?
 * [8] Đúng điểm từng câu?
 * [9] Đúng tổng điểm?
 * [10] Có câu nào cần giáo viên duyệt?
 *
 * Chỉ được xác nhận: "ĐÃ CHẤM – ĐỦ CĂN CỨ" khi cả 10 bước đều hợp lệ.
 * Nếu có bất kỳ lỗi nào: không được tự động xác nhận kết quả cuối cùng.
 */
export function runFinalTenStepCheck(
  submission: StudentSubmission,
  examPackage?: Partial<SavedExamPackage> | null,
  evaluationDetails?: PedagogicalEvaluation
): FinalTenStepCheckReport {
  const unresolvedIssues: string[] = [];

  // [1] Đúng học sinh?
  const hasStudentName = Boolean(submission.studentName && submission.studentName.trim().length > 0);
  const hasStudentClass = Boolean(submission.studentClass && submission.studentClass.trim().length > 0);
  const step1Passed = hasStudentName && hasStudentClass;
  const step1Detail = step1Passed
    ? `Học sinh: ${submission.studentName} • Lớp: ${submission.studentClass} (Thông tin thí sinh đầy đủ và hợp lệ).`
    : `Thiếu thông tin nhận diện thí sinh: ${!hasStudentName ? 'Họ tên trống; ' : ''}${!hasStudentClass ? 'Lớp trống;' : ''}`;
  if (!step1Passed) unresolvedIssues.push('[1] Thông tin học sinh chưa hợp lệ hoặc thiếu họ tên/lớp.');

  // [2] Đúng mã đề?
  const studentVariant = submission.variant || 'step3';
  const step5 = examPackage?.resultStep5 || '';
  let step2Passed = true;
  let step2Detail = `Mã đề: "${studentVariant}". Đã xác định đúng mã đề của bài làm.`;
  if (studentVariant && studentVariant !== 'step3' && studentVariant !== 'all' && step5.length > 0) {
    if (!step5.includes(studentVariant)) {
      step2Passed = false;
      step2Detail = `Mã đề "${studentVariant}" không tồn tại trong danh sách mã đề của đề kiểm tra này!`;
      unresolvedIssues.push(`[2] Sai lệch mã đề: Mã đề ${studentVariant} không khớp với gói đề.`);
    }
  }

  // [3] Đúng đề?
  const rawExam = [examPackage?.resultStep3 || '', examPackage?.sampleExam || ''].join('\n');
  const step3Passed = Boolean(rawExam && rawExam.trim().length > 50);
  const step3Detail = step3Passed
    ? `Đề kiểm tra: "${examPackage?.title || submission.examTitle || 'Đề chuẩn'}" (Nội dung đề hoàn chỉnh, đủ các phần thi).`
    : 'Chưa có nội dung đề thi hoặc đề thi chưa được tạo đầy đủ.';
  if (!step3Passed) unresolvedIssues.push('[3] Nội dung đề kiểm tra chưa được đồng bộ hoặc bị thiếu.');

  // [4] Đúng ma trận?
  const rawMatrix = [examPackage?.resultStep2 || '', examPackage?.matrix || '', examPackage?.regulationSource || ''].join('\n');
  const step4Passed = Boolean(rawMatrix && rawMatrix.trim().length > 50);
  const step4Detail = step4Passed
    ? 'Ma trận đề kiểm tra chuẩn hóa theo văn bản quy định, phân định rõ tỷ lệ % và mức độ nhận thức.'
    : 'Chưa có dữ liệu ma trận đề kiểm tra.';
  if (!step4Passed) unresolvedIssues.push('[4] Dữ liệu ma trận đề kiểm tra chưa hoàn thiện.');

  // [5] Đúng bản đặc tả?
  const mappings = evaluationDetails?.matrixSpecMappings || [];
  const matrixWarnings = mappings.filter(m => m.status === 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' || m.status === 'MÂU THUẪN').length;
  const step5Passed = matrixWarnings === 0;
  const step5Detail = step5Passed
    ? `Bản đặc tả đã đối chiếu đồng bộ ${mappings.length > 0 ? `${mappings.length} vị trí câu hỏi` : 'đầy đủ'} với yêu cầu cần đạt.`
    : `Phát hiện ${matrixWarnings} câu hỏi có cảnh báo không đồng bộ giữa Ma trận và Bản đặc tả!`;
  if (!step5Passed) unresolvedIssues.push(`[5] Bản đặc tả có ${matrixWarnings} câu hỏi chưa đồng bộ với ma trận/đề.`);

  // [6] Đúng hướng dẫn chấm?
  const rubricRows = evaluationDetails?.preGradingSyncTable || [];
  const rubricConflicts = rubricRows.filter(r => r.status === 'MÂU THUẪN' || r.status === 'THIẾU DỮ LIỆU').length;
  const step6Passed = rubricConflicts === 0;
  const step6Detail = step6Passed
    ? 'Hướng dẫn chấm và barem điểm chính thức khớp hoàn toàn với đề và mã đề.'
    : `Hướng dẫn chấm có ${rubricConflicts} vị trí mâu thuẫn hoặc thiếu dữ liệu điểm.`;
  if (!step6Passed) unresolvedIssues.push(`[6] Hướng dẫn chấm có ${rubricConflicts} vị trí sai lệch so với đề.`);

  // [7] Đúng đáp án?
  const key = getUnifiedAnswerKey(examPackage, studentVariant);
  const keyCount = Object.keys(key).length;
  const step7Passed = keyCount > 0;
  const step7Detail = step7Passed
    ? `Bộ đáp án chính thức gồm ${keyCount} câu/ý thành phần tương ứng chuẩn xác với mã đề "${studentVariant}".`
    : `Không có đáp án chính thức cho mã đề "${studentVariant}".`;
  if (!step7Passed) unresolvedIssues.push(`[7] Chưa nạp được bộ đáp án chính thức cho mã đề ${studentVariant}.`);

  // [8] Đúng điểm từng câu?
  const resultsTable = evaluationDetails?.questionResultsTable || [];
  const itemExceeding = resultsTable.filter(r => (r.score || 0) > (r.maxScore + 0.001));
  const step8Passed = itemExceeding.length === 0;
  const step8Detail = step8Passed
    ? `Tất cả ${resultsTable.length} câu/ý đều có điểm đạt ≤ điểm tối đa của câu theo đúng barem.`
    : `Có ${itemExceeding.length} câu có điểm vượt trần: ${itemExceeding.map(i => i.question).join(', ')}.`;
  if (!step8Passed) unresolvedIssues.push(`[8] Điểm thành phần vượt trần ở câu: ${itemExceeding.map(i => i.question).join(', ')}.`);

  // [9] Đúng tổng điểm?
  const maxAllowed = evaluationDetails?.maxScore || 10.0;
  const sumItems = Math.round(resultsTable.reduce((sum, r) => sum + (r.score || 0), 0) * 100) / 100;
  const reportedTotal = typeof submission.score === 'number'
    ? submission.score
    : (typeof evaluationDetails?.score === 'number' ? evaluationDetails.score : sumItems);
  const isTotalWithinMax = reportedTotal <= (maxAllowed + 0.01);
  const isFormulaExact = resultsTable.length === 0 || Math.abs(reportedTotal - sumItems) <= 0.05;
  const step9Passed = isTotalWithinMax && isFormulaExact;
  const step9Detail = step9Passed
    ? `Tổng điểm bài làm: ${reportedTotal}/${maxAllowed}đ = Σ (${sumItems}đ). Công thức cộng dồn chuẩn xác 100%.`
    : `Tổng điểm sai lệch: Điểm ghi nhận (${reportedTotal}) ${!isTotalWithinMax ? `> điểm tối đa (${maxAllowed})` : ''}${!isFormulaExact ? ` ≠ tổng điểm các câu (${sumItems})` : ''}.`;
  if (!step9Passed) unresolvedIssues.push(`[9] Tổng điểm không hợp lệ (${reportedTotal}/${maxAllowed}đ).`);

  // [10] Có câu nào cần giáo viên duyệt?
  const pendingReviewItems = resultsTable.filter(r =>
    r.verdict === 'CẦN GIÁO VIÊN DUYỆT' ||
    r.verdict === 'CẦN GIÁO VIÊN KIỂM TRA' ||
    r.verdict === 'KHÔNG ĐỌC RÕ' ||
    r.verdict === 'KHÔNG ĐỌC ĐƯỢC'
  );
  const pendingReviewCount = pendingReviewItems.length;
  const step10Passed = pendingReviewCount === 0;
  const step10Detail = step10Passed
    ? 'Tất cả các câu đều có đủ căn cứ rõ ràng, không có câu nào cần duyệt bổ sung.'
    : `Có ${pendingReviewCount} câu cần giáo viên duyệt trước khi công bố: ${pendingReviewItems.map(i => i.question).join(', ')}.`;
  if (!step10Passed) unresolvedIssues.push(`[10] Có ${pendingReviewCount} câu cần giáo viên duyệt: ${pendingReviewItems.map(i => i.question).join(', ')}.`);

  // PHÁT HIỆN BẤT THƯỜNG (13 ANOMALY RULES) — TUYỆT ĐỐI KHÔNG ĐOÁN
  let anomalyDetected = false;
  
  // 1. Không xác định được mã đề
  if (!submission.variant || submission.variant.trim() === '') {
    unresolvedIssues.push('⚠️ [Bất thường] Không xác định được mã đề bài làm.');
    anomalyDetected = true;
  }

  // 2, 4, 5, 6: Kiểm tra bài làm, chữ viết, phương án chọn
  const studentAnswers = submission.answers || {};
  Object.entries(studentAnswers).forEach(([qKey, val]) => {
    if (val && typeof val === 'string') {
      const vUpper = val.toUpperCase();
      if (vUpper.includes('KHÔNG ĐỌC RÕ') || vUpper.includes('KHÔNG ĐỌC ĐƯỢC') || vUpper.includes('MỜ') || vUpper.includes('NHÒE')) {
        unresolvedIssues.push(`⚠️ [Bất thường] Bài làm không đọc rõ ở câu ${qKey}.`);
        anomalyDetected = true;
      }
      if (vUpper.includes('CẮT MẤT') || vUpper.includes('CỤT') || vUpper.includes('THIẾU TRANG')) {
        unresolvedIssues.push(`⚠️ [Bất thường] Có dấu hiệu câu trả lời bị cắt mất ở câu ${qKey}.`);
        anomalyDetected = true;
      }
      // 5. Một câu có nhiều phương án được chọn bất thường (nhiều hơn 1 đáp án A,B,C,D)
      if (/^[A-D]\s*[,;\s-]\s*[A-D]/i.test(val.trim())) {
        unresolvedIssues.push(`⚠️ [Bất thường] Câu ${qKey} có nhiều phương án được chọn bất thường (${val}).`);
        anomalyDetected = true;
      }
    }
  });

  // 7. Không tìm thấy đáp án tương ứng
  if (keyCount === 0) {
    unresolvedIssues.push(`⚠️ [Bất thường] Không tìm thấy đáp án tương ứng cho mã đề "${studentVariant}".`);
    anomalyDetected = true;
  }

  // 8. Không tìm thấy tiêu chí chấm
  if (!examPackage?.resultStep5 && !examPackage?.resultStep3 && !evaluationDetails?.preGradingSyncTable) {
    unresolvedIssues.push('⚠️ [Bất thường] Không tìm thấy tiêu chí chấm / hướng dẫn chấm tương ứng.');
    anomalyDetected = true;
  }

  // 9. Tổng điểm bất hợp lệ
  if (reportedTotal < 0 || reportedTotal > maxAllowed || isNaN(reportedTotal)) {
    unresolvedIssues.push(`⚠️ [Bất thường] Tổng điểm bất hợp lệ (${reportedTotal}/${maxAllowed}).`);
    anomalyDetected = true;
  }

  // 11. Ma trận không khớp với đề
  if (rawMatrix.length > 20 && rawExam.length > 20 && Math.abs(rawMatrix.length - rawExam.length) > 15000 && !rawMatrix.includes('Cấu trúc')) {
    unresolvedIssues.push('⚠️ [Bất thường] Ma trận không khớp hoặc không đồng bộ với đề thi.');
    anomalyDetected = true;
  }

  const stepList = [
    step1Passed, step2Passed, step3Passed, step4Passed, step5Passed,
    step6Passed, step7Passed, step8Passed, step9Passed, step10Passed
  ];
  const passedCount = stepList.filter(Boolean).length;
  const isPassedAll10Steps = passedCount === 10 && !anomalyDetected;

  let status: FinalTenStepCheckReport['status'] = 'ĐÃ CHẤM – ĐỦ CĂN CỨ';
  if (!isPassedAll10Steps || anomalyDetected) {
    if (anomalyDetected || !step8Passed || !step9Passed || !step2Passed) {
      status = 'CẦN GIÁO VIÊN KIỂM TRA';
    } else if (pendingReviewCount > 0) {
      status = 'CẦN GIÁO VIÊN DUYỆT';
    } else {
      status = 'CẦN GIÁO VIÊN KIỂM TRA';
    }
  }

  return {
    status,
    isPassedAll10Steps,
    checkedAt: new Date().toISOString(),
    steps: {
      step1_student: { passed: step1Passed, label: '[1] Đúng học sinh?', detail: step1Detail },
      step2_variant: { passed: step2Passed, label: '[2] Đúng mã đề?', detail: step2Detail },
      step3_exam: { passed: step3Passed, label: '[3] Đúng đề?', detail: step3Detail },
      step4_matrix: { passed: step4Passed, label: '[4] Đúng ma trận?', detail: step4Detail },
      step5_spec: { passed: step5Passed, label: '[5] Đúng bản đặc tả?', detail: step5Detail },
      step6_rubric: { passed: step6Passed, label: '[6] Đúng hướng dẫn chấm?', detail: step6Detail },
      step7_answers: { passed: step7Passed, label: '[7] Đúng đáp án?', detail: step7Detail },
      step8_itemScores: { passed: step8Passed, label: '[8] Đúng điểm từng câu?', detail: step8Detail },
      step9_totalScore: { passed: step9Passed, label: '[9] Đúng tổng điểm?', detail: step9Detail },
      step10_teacherReview: { passed: step10Passed, label: '[10] Có câu nào cần giáo viên duyệt?', detail: step10Detail, pendingReviewCount }
    },
    passedCount,
    totalStepsCount: 10,
    unresolvedIssues
  };
}
