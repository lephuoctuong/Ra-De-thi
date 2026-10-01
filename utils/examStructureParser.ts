/**
 * examStructureParser.ts
 * Bộ phân tích cấu trúc đề thi thông minh chuẩn GDPT 2018 & văn bản quy định do người dùng cung cấp.
 * Bóc tách chính xác các phần của đề thi:
 * - PHẦN I: Trắc nghiệm nhiều lựa chọn (chọn 1 trong 4 phương án A, B, C, D)
 * - PHẦN II: Trắc nghiệm Đúng - Sai (mỗi câu gồm các ý a, b, c, d; học sinh chọn Đ hoặc S)
 * - PHẦN III: Trắc nghiệm trả lời ngắn (học sinh nhập kết quả/đáp số ngắn gọn)
 * - PHẦN IV / TỰ LUẬN: Câu hỏi tự luận / trình bày bài tập
 */

import { stripAnswersAndGradingGuide } from './examSanitizer';

export interface MultipleChoiceItem {
  questionNumber: number;
  label: string; // "Câu 1", "Câu 2", ...
  promptSnippet: string;
  options: string[]; // ['A', 'B', 'C', 'D']
}

export interface TrueFalseSubItem {
  key: 'a' | 'b' | 'c' | 'd';
  label: string; // "a)", "b)", "c)", "d)"
  statement: string;
}

export interface TrueFalseItem {
  questionNumber: number;
  label: string; // "Câu 1", "Câu 2", ...
  promptSnippet: string;
  subItems: TrueFalseSubItem[];
}

export interface ShortAnswerItem {
  questionNumber: number;
  label: string; // "Câu 1", "Câu 2", ...
  promptSnippet: string;
  unitHint?: string; // e.g. "cây", "%", "loại", "bộ ba", "amino acid", "gam", "ml"
}

export interface EssayItem {
  questionNumber: number;
  label: string; // "Câu 1", "Câu 2", ...
  promptSnippet: string;
}

export interface ParsedExamStructure {
  hasExplicitParts: boolean;
  part1: MultipleChoiceItem[];
  part2: TrueFalseItem[];
  part3: ShortAnswerItem[];
  part4: EssayItem[];
  totalQuestionCount: number; // Tổng số câu hỏi lớn
  totalAnswerUnits: number; // Tổng số câu/lệnh hỏi học sinh cần thao tác (P1 + P2*4 + P3 + P4)
}

/**
 * Phân tích nội dung văn bản đề thi để bóc tách cấu trúc từng phần chuẩn GDPT 2018
 */
export function parseExamStructure(examText: string): ParsedExamStructure {
  const result: ParsedExamStructure = {
    hasExplicitParts: false,
    part1: [],
    part2: [],
    part3: [],
    part4: [],
    totalQuestionCount: 0,
    totalAnswerUnits: 0
  };

  if (!examText || typeof examText !== 'string' || examText.trim().length === 0) {
    // Fallback mặc định chuẩn GDPT 2018 nếu chưa có nội dung đề
    result.part1 = Array.from({ length: 12 }).map((_, i) => ({
      questionNumber: i + 1,
      label: `Câu ${i + 1}`,
      promptSnippet: '',
      options: ['A', 'B', 'C', 'D']
    }));
    result.part2 = Array.from({ length: 4 }).map((_, i) => ({
      questionNumber: i + 1,
      label: `Câu ${i + 1}`,
      promptSnippet: '',
      subItems: (['a', 'b', 'c', 'd'] as const).map(k => ({ key: k, label: `${k})`, statement: '' }))
    }));
    result.part3 = Array.from({ length: 6 }).map((_, i) => ({
      questionNumber: i + 1,
      label: `Câu ${i + 1}`,
      promptSnippet: ''
    }));
    result.totalQuestionCount = 22;
    result.totalAnswerUnits = 12 + 16 + 6;
    return result;
  }

  const cleanedExamText = stripAnswersAndGradingGuide(examText);
  const text = (cleanedExamText || examText).trim();

  // 1. Phân chia văn bản thành các khối phần (Sections) dựa trên các tiêu đề PHẦN I, PHẦN II, PHẦN III, PHẦN IV / TỰ LUẬN
  const sectionSplitterRegex = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:PHẦN\s*([0-9IVX]+)|PHẦN\s*TỰ\s*LUẬN|MỤC\s*([0-9IVX]+)|(?:BÀI|PHẦN)\s*([A-D])|(?:[A-DIVX0-9]+)\.\s*(?:PHẦN\s*)?(?:TRẮC\s*NGHIỆM|TỰ\s*LUẬN|CÂU\s*HỎI|TRẢ\s*LỜI|ĐÚNG|ĐIỀN))[^\n]*/gi;

  const sectionMatches: { index: number; title: string; raw: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionSplitterRegex.exec(text)) !== null) {
    sectionMatches.push({
      index: m.index,
      title: m[0].trim(),
      raw: m[0]
    });
  }

  if (sectionMatches.length >= 2) {
    result.hasExplicitParts = true;
    for (let i = 0; i < sectionMatches.length; i++) {
      const current = sectionMatches[i];
      const nextIndex = i + 1 < sectionMatches.length ? sectionMatches[i + 1].index : text.length;
      const sectionContent = text.substring(current.index, nextIndex);
      const titleUpper = current.title.toUpperCase();

      // Kiểm tra Phần 3 trước để tránh xung đột 'PHẦN II' với 'PHẦN III'
      const isP3 = /\b(?:PHẦN|MỤC)\s*(?:III|3)\b|(?:^|\n|\b)(?:III|3)\.\s*(?:TRẮC\s*NGHIỆM|CÂU\s*HỎI|TRẢ\s*LỜI|ĐIỀN)|TRẢ\s*LỜI\s*NGẮN|ĐIỀN\s*KHUYẾT/i.test(titleUpper);
      const isP4 = /\b(?:PHẦN|MỤC)\s*(?:IV|4)\b|(?:^|\n|\b)(?:IV|4)\.\s*(?:TỰ\s*LUẬN|BÀI\s*TẬP)|TỰ\s*LUẬN/i.test(titleUpper);
      const isP2 = !isP3 && !isP4 && (/\b(?:PHẦN|MỤC)\s*(?:II|2)\b|(?:^|\n|\b)(?:II|2)\.\s*(?:TRẮC\s*NGHIỆM|CÂU\s*HỎI|ĐÚNG)|ĐÚNG\s*[-–—]?\s*SAI/i.test(titleUpper));
      const isP1 = !isP2 && !isP3 && !isP4 && (/\b(?:PHẦN|MỤC)\s*(?:I|1)\b|(?:^|\n|\b)(?:I|1)\.\s*(?:TRẮC\s*NGHIỆM|CÂU\s*HỎI)|NHIỀU\s*LỰA\s*CHỌN|TRẮC\s*NGHIỆM\s*KHÁCH\s*QUAN/i.test(titleUpper));

      if (isP3) {
        // PHẦN III: Trả lời ngắn
        result.part3 = parseShortAnswerSection(sectionContent);
      } else if (isP2) {
        // PHẦN II: Đúng - Sai
        result.part2 = parseTrueFalseSection(sectionContent);
      } else if (isP4) {
        // PHẦN IV / Tự luận
        result.part4 = parseEssaySection(sectionContent);
      } else if (isP1) {
        // PHẦN I: Trắc nghiệm nhiều lựa chọn
        result.part1 = parseMultipleChoiceSection(sectionContent);
      }
    }
  }

  // Quét cứu cánh nếu Phần III chưa được nhận diện nhưng có trong văn bản đề thi
  if (result.part3.length === 0) {
    const p3Match = text.match(/(?:^|\n)\s*(?:#{1,4}\s*)?(?:PHẦN\s*(?:III|3)|TRẢ\s*LỜI\s*NGẮN|ĐIỀN\s*KHUYẾT)[^\n]*\n([\s\S]*)/i);
    if (p3Match && p3Match[1]) {
      const p3SubText = p3Match[1].split(/(?:^|\n)\s*(?:#{1,4}\s*)?(?:PHẦN\s*(?:IV|4)|TỰ\s*LUẬN)/i)[0];
      const foundP3 = parseShortAnswerSection(p3SubText);
      if (foundP3.length > 0) {
        result.part3 = foundP3;
      }
    }
  }

  // 2. Nếu không tìm thấy các phần rõ rệt hoặc kết quả trống, thực hiện phân tích tự động toàn văn
  if (result.part1.length === 0 && result.part2.length === 0 && result.part3.length === 0) {
    parseUnstructuredExam(text, result);
  }

  // Khử trùng lặp và chuẩn hóa số thứ tự câu trong Phần I
  if (result.part1.length > 0) {
    // 1. Loại bỏ các câu trùng lặp số
    const seenP1 = new Set<number>();
    const uniqueP1: MultipleChoiceItem[] = [];
    for (const q of result.part1) {
      if (!seenP1.has(q.questionNumber)) {
        seenP1.add(q.questionNumber);
        uniqueP1.push(q);
      }
    }

    // 2. Sắp xếp lại theo số câu tăng dần
    uniqueP1.sort((a, b) => a.questionNumber - b.questionNumber);

    // 3. Nếu số câu bị gián đoạn, bắt đầu sai (ví dụ 4, 5, 6...) hoặc có dấu hiệu bất thường, chuẩn hóa đánh số liên tục 1..N
    const isSequential = uniqueP1.every((q, idx) => q.questionNumber === idx + 1);
    if (!isSequential) {
      result.part1 = uniqueP1.map((q, idx) => ({
        ...q,
        questionNumber: idx + 1,
        label: `Câu ${idx + 1}`
      }));
    } else {
      result.part1 = uniqueP1;
    }
  }

  // Khử trùng lặp và chuẩn hóa số thứ tự câu trong Phần II
  if (result.part2.length > 0) {
    const seenP2 = new Set<number>();
    const uniqueP2: TrueFalseItem[] = [];
    for (const q of result.part2) {
      if (!seenP2.has(q.questionNumber)) {
        seenP2.add(q.questionNumber);
        uniqueP2.push(q);
      }
    }
    uniqueP2.sort((a, b) => a.questionNumber - b.questionNumber);
    result.part2 = uniqueP2;
  }

  // Khử trùng lặp Phần III
  if (result.part3.length > 0) {
    const seenP3 = new Set<number>();
    const uniqueP3: ShortAnswerItem[] = [];
    for (const q of result.part3) {
      if (!seenP3.has(q.questionNumber)) {
        seenP3.add(q.questionNumber);
        uniqueP3.push(q);
      }
    }
    uniqueP3.sort((a, b) => a.questionNumber - b.questionNumber);
    result.part3 = uniqueP3;
  }

  // Đảm bảo nếu Phần 1 vẫn rỗng hoàn toàn, fallback an toàn dựa trên số câu tìm thấy
  if (result.part1.length === 0 && result.part2.length === 0 && result.part3.length === 0 && result.part4.length === 0) {
    result.part1 = Array.from({ length: 12 }).map((_, i) => ({
      questionNumber: i + 1,
      label: `Câu ${i + 1}`,
      promptSnippet: '',
      options: ['A', 'B', 'C', 'D']
    }));
  }

  // Chuẩn GDPT 2018: Nếu đề đã có Phần I và Phần II nhưng Phần III chưa trích xuất được câu nào
  // Tự động cung cấp 6 câu trả lời ngắn mặc định để phiếu trả lời luôn đầy đủ và đồng bộ
  if (result.part1.length > 0 && result.part2.length > 0 && result.part3.length === 0) {
    result.part3 = Array.from({ length: 6 }).map((_, i) => ({
      questionNumber: i + 1,
      label: `Câu ${i + 1}`,
      promptSnippet: ''
    }));
  }

  // Tính tổng số lượng
  const p1Count = result.part1.length;
  const p2Count = result.part2.length;
  const p3Count = result.part3.length;
  const p4Count = result.part4.length;

  result.totalQuestionCount = p1Count + p2Count + p3Count + p4Count;
  // Mỗi câu P2 có 4 ý a, b, c, d
  const p2Units = result.part2.reduce((acc, q) => acc + (q.subItems.length > 0 ? q.subItems.length : 4), 0);
  result.totalAnswerUnits = p1Count + p2Units + p3Count + p4Count;

  return result;
}

/**
 * Bóc tách Phần I: Câu trắc nghiệm nhiều lựa chọn (A, B, C, D)
 */
function parseMultipleChoiceSection(content: string): MultipleChoiceItem[] {
  const items: MultipleChoiceItem[] = [];
  // Regex tìm câu hỏi: Câu 1., Câu 1:, Câu 1 -, **Câu 1**, 1.
  const questionRegex = /(?:^|\n)\s*(?:[*#_]{0,3}\s*)?Câu\s*([0-9]{1,3})\s*[\.:\-)]/gi;
  const matches: { index: number; qNum: number; raw: string }[] = [];
  
  let m: RegExpExecArray | null;
  while ((m = questionRegex.exec(content)) !== null) {
    matches.push({
      index: m.index,
      qNum: parseInt(m[1], 10),
      raw: m[0]
    });
  }

  const seenQNums = new Set<number>();

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (seenQNums.has(current.qNum)) continue;

    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const block = content.substring(current.index, nextIndex).trim();

    // Bỏ qua các dòng chỉ là bảng đáp án, ví dụ: "Câu 1: A", "Câu 1. B", "| Câu 1 | A |"
    if (block.length < 30 && /^Câu\s*[0-9]{1,3}\s*[\.:\-]\s*[A-D]\s*$/i.test(block)) {
      continue;
    }
    if (/^\|?\s*(?:Câu|Đ\/A|Đáp án)\s*\|/i.test(block)) {
      continue;
    }

    // Xác định các lựa chọn A, B, C, D có trong câu hỏi
    const options = ['A', 'B', 'C', 'D'];
    
    // Trích đoạn mô tả ngắn (bỏ tiêu đề Câu X.)
    const firstLine = block.split('\n')[0].replace(/^(?:[*#_]{0,3}\s*)?Câu\s*[0-9]{1,3}\s*[\.:\-)]/i, '').trim();

    seenQNums.add(current.qNum);
    items.push({
      questionNumber: current.qNum,
      label: `Câu ${current.qNum}`,
      promptSnippet: firstLine.slice(0, 80),
      options
    });
  }

  // Sắp xếp lại theo số câu tăng dần
  items.sort((a, b) => a.questionNumber - b.questionNumber);
  return items;
}

/**
 * Bóc tách Phần II: Câu trắc nghiệm Đúng - Sai (Mỗi câu gồm 4 ý a, b, c, d)
 */
function parseTrueFalseSection(content: string): TrueFalseItem[] {
  const items: TrueFalseItem[] = [];
  const questionRegex = /(?:^|\n)\s*(?:[*#_]{0,3}\s*)?Câu\s*([0-9]{1,3})\s*[\.:\-)]/gi;
  const matches: { index: number; qNum: number; raw: string }[] = [];
  
  let m: RegExpExecArray | null;
  while ((m = questionRegex.exec(content)) !== null) {
    matches.push({
      index: m.index,
      qNum: parseInt(m[1], 10),
      raw: m[0]
    });
  }

  const seenQNums = new Set<number>();

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (seenQNums.has(current.qNum)) continue;

    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const block = content.substring(current.index, nextIndex).trim();

    // Bóc tách các ý a), b), c), d)
    const subItems: TrueFalseSubItem[] = [];
    const subRegex = /(?:^|\n)\s*([a-d])\s*[\)\.:\-]\s*([^\n]+)/gi;
    let sm: RegExpExecArray | null;
    while ((sm = subRegex.exec(block)) !== null) {
      const letter = sm[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
      subItems.push({
        key: letter,
        label: `${letter})`,
        statement: sm[2].trim().slice(0, 100)
      });
    }

    // Nếu không tìm thấy đủ 4 ý qua regex, mặc định tạo 4 ý a, b, c, d chuẩn theo GDPT 2018
    if (subItems.length === 0) {
      (['a', 'b', 'c', 'd'] as const).forEach(k => {
        subItems.push({
          key: k,
          label: `${k})`,
          statement: ''
        });
      });
    }

    const firstLine = block.split('\n')[0].replace(/^(?:[*#_]{0,3}\s*)?Câu\s*[0-9]{1,3}\s*[\.:\-)]/i, '').trim();

    seenQNums.add(current.qNum);
    items.push({
      questionNumber: current.qNum,
      label: `Câu ${current.qNum}`,
      promptSnippet: firstLine.slice(0, 80),
      subItems
    });
  }

  items.sort((a, b) => a.questionNumber - b.questionNumber);
  return items;
}

/**
 * Bóc tách Phần III: Câu hỏi trắc nghiệm trả lời ngắn chuẩn GDPT 2018
 */
function parseShortAnswerSection(content: string): ShortAnswerItem[] {
  const items: ShortAnswerItem[] = [];
  const questionRegex = /(?:^|\n)\s*(?:[*#_]{0,3}\s*)?Câu\s*([0-9]{1,3})\s*[\.:\-)]/gi;
  const matches: { index: number; qNum: number; raw: string }[] = [];
  
  let m: RegExpExecArray | null;
  while ((m = questionRegex.exec(content)) !== null) {
    matches.push({
      index: m.index,
      qNum: parseInt(m[1], 10),
      raw: m[0]
    });
  }

  // Nếu không thấy chữ "Câu X", thử tìm các đầu số độc lập "1.", "2."
  if (matches.length === 0) {
    const numRegex = /(?:^|\n)\s*(?:[*#_]{0,3}\s*)?([1-9]|1[0-2])\s*[\.:\-)]\s*(?=[A-ZÀ-Ỹ\*\(0-9])/gi;
    let nm: RegExpExecArray | null;
    while ((nm = numRegex.exec(content)) !== null) {
      matches.push({
        index: nm.index,
        qNum: parseInt(nm[1], 10),
        raw: nm[0]
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const block = content.substring(current.index, nextIndex).trim();

    // Tìm gợi ý đơn vị tính / định dạng đáp số nếu có: e.g. [cây], [%], [loại], [gam], [m/s]
    const unitMatch = block.match(/\[([a-zA-ZÀ-ỹ0-9\s%\/\^\-\_]+)\]\s*(?:\*|$|\n)/i) ||
                      block.match(/(?:đơn vị|đáp số)[^:\n]*[:\.\s]+(?:[\.]{2,}\s*)?\[?([a-zA-ZÀ-ỹ0-9\s%]+)\]?/i);
    const unitHint = unitMatch ? unitMatch[1].trim() : undefined;

    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    let firstLine = '';
    if (lines.length > 0) {
      firstLine = lines[0]
        .replace(/^(?:[*#_]{0,3}\s*)?Câu\s*[0-9]{1,3}\s*[\.:\-)]/i, '')
        .replace(/^[0-9]{1,2}\s*[\.:\-)]/i, '')
        .replace(/^[*#_\s]+/, '')
        .replace(/[*#_\s]+$/, '')
        .trim();
      if (firstLine.length < 15 && lines.length > 1) {
        firstLine += ' ' + lines[1].replace(/^[*#_\s]+/, '').replace(/[*#_\s]+$/, '').trim();
      }
    }

    items.push({
      questionNumber: current.qNum,
      label: `Câu ${current.qNum}`,
      promptSnippet: firstLine.slice(0, 110),
      unitHint
    });
  }

  // Nếu không phân tách được từng câu cụ thể nhưng có tiêu đề phần III, tạo 6 câu mặc định chuẩn GDPT
  if (items.length === 0 && content.length > 10) {
    for (let i = 1; i <= 6; i++) {
      items.push({
        questionNumber: i,
        label: `Câu ${i}`,
        promptSnippet: ''
      });
    }
  }

  items.sort((a, b) => a.questionNumber - b.questionNumber);
  return items;
}

/**
 * Bóc tách Phần Tự luận
 */
function parseEssaySection(content: string): EssayItem[] {
  const items: EssayItem[] = [];
  const questionRegex = /(?:^|\n)\s*(?:[*#]{0,3}\s*)?(?:Câu|Bài)\s*([0-9]{1,3})\s*[\.:\-)]/gi;
  const matches: { index: number; qNum: number; raw: string }[] = [];
  
  let m: RegExpExecArray | null;
  while ((m = questionRegex.exec(content)) !== null) {
    matches.push({
      index: m.index,
      qNum: parseInt(m[1], 10),
      raw: m[0]
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;
    const block = content.substring(current.index, nextIndex).trim();

    const firstLine = block.split('\n')[0].replace(/^(?:[*#]{0,3}\s*)?(?:Câu|Bài)\s*[0-9]{1,3}\s*[\.:\-)]/i, '').trim();

    items.push({
      questionNumber: current.qNum,
      label: `Câu ${current.qNum}`,
      promptSnippet: firstLine.slice(0, 90)
    });
  }

  // Nếu không tìm thấy từng câu rõ ràng mà là một bài tập tự luận tổng hợp
  if (items.length === 0 && content.length > 30) {
    items.push({
      questionNumber: 1,
      label: 'Bài Tự luận',
      promptSnippet: 'Trình bày lời giải bài tự luận'
    });
  }

  items.sort((a, b) => a.questionNumber - b.questionNumber);
  return items;
}

/**
 * Phân tích tự động đề thi tự do (không có phân chia PHẦN I, II, III rõ rệt)
 */
function parseUnstructuredExam(text: string, result: ParsedExamStructure) {
  // Tìm tất cả các "Câu X."
  const questionRegex = /(?:^|\n)\s*(?:[*#_]{0,3}\s*)?Câu\s*([0-9]{1,3})\s*[\.:\-)]/gi;
  const matches: { index: number; qNum: number; raw: string }[] = [];
  
  let m: RegExpExecArray | null;
  while ((m = questionRegex.exec(text)) !== null) {
    matches.push({
      index: m.index,
      qNum: parseInt(m[1], 10),
      raw: m[0]
    });
  }

  if (matches.length === 0) return;

  const seenP1 = new Set<number>();
  const seenP2 = new Set<number>();
  const seenP3 = new Set<number>();

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const block = text.substring(current.index, nextIndex).trim();

    // Bỏ qua các dòng bảng đáp án
    if (block.length < 30 && /^Câu\s*[0-9]{1,3}\s*[\.:\-]\s*[A-D]\s*$/i.test(block)) {
      continue;
    }
    if (/^\|?\s*(?:Câu|Đ\/A|Đáp án)\s*\|/i.test(block)) {
      continue;
    }

    const hasABCD = /[A-D]\s*[\.:\)]/.test(block);
    const hasSubABCD = /(?:^|\n)\s*[a-d]\s*[\)\.:\-]/i.test(block);
    const hasShortAnswer = /Đáp số|kết quả|điền số|\.\.\.\.\.\./i.test(block);

    if (hasSubABCD && /Đúng|Sai/i.test(block)) {
      // Câu Đúng Sai
      if (seenP2.has(current.qNum)) continue;
      seenP2.add(current.qNum);
      const subItems: TrueFalseSubItem[] = (['a', 'b', 'c', 'd'] as const).map(k => ({
        key: k,
        label: `${k})`,
        statement: ''
      }));
      result.part2.push({
        questionNumber: current.qNum,
        label: `Câu ${current.qNum}`,
        promptSnippet: '',
        subItems
      });
    } else if (hasShortAnswer && !hasABCD) {
      // Câu Trả lời ngắn
      if (seenP3.has(current.qNum)) continue;
      seenP3.add(current.qNum);
      result.part3.push({
        questionNumber: current.qNum,
        label: `Câu ${current.qNum}`,
        promptSnippet: ''
      });
    } else {
      // Mặc định là trắc nghiệm nhiều lựa chọn
      if (seenP1.has(current.qNum)) continue;
      seenP1.add(current.qNum);
      result.part1.push({
        questionNumber: current.qNum,
        label: `Câu ${current.qNum}`,
        promptSnippet: '',
        options: ['A', 'B', 'C', 'D']
      });
    }
  }

  result.part1.sort((a, b) => a.questionNumber - b.questionNumber);
  result.part2.sort((a, b) => a.questionNumber - b.questionNumber);
  result.part3.sort((a, b) => a.questionNumber - b.questionNumber);
}
