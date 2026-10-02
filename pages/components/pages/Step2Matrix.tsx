import React, { useState, useEffect, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  Play, 
  Loader2, 
  Layers, 
  CheckCircle, 
  Eye, 
  Edit3, 
  Sparkles,
  ChevronRight,
  Settings,
  ChevronDown,
  GripVertical,
  Trash2,
  Plus,
  Info,
  AlertCircle,
  FileSpreadsheet,
  ListOrdered,
  ClipboardCheck,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Clock
} from 'lucide-react';
import ContentRenderer from '../components/ContentRenderer';

interface Step2MatrixProps {
  lesson: string;
  regulationSource: string;
  sampleExam: string;
  matrix: string;
  step1Result: string;
  examDuration?: number;
  subject?: string;
  grade?: string;
  prompt: string;
  setPrompt: (v: string) => void;
  result: string;
  setResult: (v: string) => void;
  onNext: () => void;
  onPrev: () => void;
}

// Khung Ma trận theo chuẩn văn bản quy định
export interface MatrixRowRegulationSource {
  id: string;
  topic: string;           // Chủ đề / Mạch nội dung
  unit: string;            // Nội dung / Đơn vị kiến thức
  // Nhận biết (NB)
  nbP1: number;            // TN nhiều lựa chọn (Phần I)
  nbP2: number;            // TN Đúng/Sai (Phần II - số ý/lệnh hỏi)
  nbP3: number;            // TN Trả lời ngắn (Phần III)
  nbTL: number;            // Tự luận (số câu)
  nbPoints: number;        // Tổng điểm NB của đơn vị này
  // Thông hiểu (TH)
  thP1: number;
  thP2: number;
  thP3: number;
  thTL: number;
  thPoints: number;
  // Vận dụng (VD)
  vdP1: number;
  vdP2: number;
  vdP3: number;
  vdTL: number;
  vdPoints: number;
  // Vận dụng cao (VDC - nếu có)
  vdcP1: number;
  vdcP2: number;
  vdcP3: number;
  vdcTL: number;
  vdcPoints: number;
}

// Bản đặc tả theo chuẩn văn bản quy định
export interface SpecRowRegulationSource {
  id: string;
  topic: string;           // Chủ đề
  unit: string;            // Đơn vị kiến thức
  level: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao';
  requirement: string;     // Yêu cầu cần đạt (Chỉ báo năng lực từ Mục 1)
  p1Count: number;         // Số câu Phần I (TNKQ 4 lựa chọn)
  p2Count: number;         // Số câu/lệnh hỏi Phần II (Đúng - Sai)
  p3Count: number;         // Số câu Phần III (Trả lời ngắn)
  tlCount: number;         // Số câu Tự luận
  questionNumbers: string; // Câu hỏi số tương ứng trong đề (ví dụ: Câu 1, 2, 3)
}

// Tiêu chí tự rà soát theo văn bản quy định
export interface ChecklistItem {
  criterion: string;
  standard: string;
  status: 'Đạt' | 'Chưa Đạt';
  notes: string;
}

// Hàm trích xuất thông minh các đơn vị kiến thức và yêu cầu cần đạt từ Phân tích nguồn Mục 1
export const extractDataFromStep1 = (step1Text: string, lessonFallback: string) => {
  const units: { topic: string; unit: string; nbReq: string; thReq: string; vdReq: string }[] = [];
  const text = step1Text || lessonFallback || '';

  // Tìm tên chủ đề chính từ nguồn thực tế
  let mainTopic = "Chủ đề bài học";
  const topicMatch = text.match(/Tên bài học\/chủ đề[:\s]+([^\n\r]+)/i) || 
                     text.match(/CHUYÊN ĐỀ[:\s]+([^\n\r]+)/i) ||
                     text.match(/Chủ đề[:\s]+([^\n\r]+)/i);
  if (topicMatch && topicMatch[1]) {
    mainTopic = topicMatch[1].replace(/[*_#]/g, '').trim();
  }

  // Quét các đơn vị kiến thức trong Phần 2 của Phân tích nguồn
  const lines = text.split('\n');
  let currentFoundUnits: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Phát hiện các mục đánh số như: 1. ..., 2. ..., hoặc - Nội dung ..., - Khái niệm ...
    const matchNumbered = line.match(/^(\d+[\.\)]\s+)([^:.\n]{4,80})/);
    if (matchNumbered && matchNumbered[2]) {
      const uName = matchNumbered[2].replace(/[*_#]/g, '').trim();
      if (!currentFoundUnits.includes(uName) && !uName.toLowerCase().includes('phần') && !uName.toLowerCase().includes('mục')) {
        currentFoundUnits.push(uName);
      }
    }
  }

  // Nếu không thấy qua số, tìm theo gạch đầu dòng dưới mục Kiến thức trọng tâm
  if (currentFoundUnits.length === 0) {
    let inKnowledgeSection = false;
    for (let line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('kiến thức trọng tâm') || lower.includes('nội dung bài học') || lower.includes('khái niệm, định lý')) {
        inKnowledgeSection = true;
        continue;
      }
      if (inKnowledgeSection && (lower.includes('phần 3') || lower.includes('phần iii') || lower.includes('dạng bài tập'))) {
        inKnowledgeSection = false;
      }
      if (inKnowledgeSection) {
        const bulletMatch = line.match(/^[-*+•]\s+([^:.\n]{4,80})/);
        if (bulletMatch && bulletMatch[1]) {
          const uName = bulletMatch[1].replace(/[*_#]/g, '').trim();
          if (!currentFoundUnits.includes(uName)) {
            currentFoundUnits.push(uName);
          }
        }
      }
    }
  }

  // Không tự ý thay thế bằng dữ liệu khác (như Phương trình bậc hai hoặc Vi-ét).
  // Nếu không tìm thấy dữ liệu nguồn thì báo thiếu nguồn và để trống.
  if (currentFoundUnits.length === 0) {
    return { mainTopic: mainTopic || "Chưa xác định chủ đề (Thiếu dữ liệu nguồn)", units: [] };
  }

  // Sinh yêu cầu cần đạt theo mức độ cho từng đơn vị kiến thức thực tế tìm được từ nguồn
  currentFoundUnits.forEach((u) => {
    units.push({
      topic: mainTopic,
      unit: u,
      nbReq: `Nhận biết được các kiến thức, khái niệm và định nghĩa cơ bản liên quan đến ${u}.`,
      thReq: `Hiểu rõ bản chất, giải thích và áp dụng thực hiện các câu hỏi/bài tập cơ bản về ${u}.`,
      vdReq: `Vận dụng kiến thức về ${u} để giải quyết vấn đề, bài tập hoặc tình huống thực tế.`
    });
  });

  return { mainTopic, units };
};

// Khởi tạo hàng Ma trận mặc định bám sát chuẩn văn bản quy định từ Mục 1
export const createDefaultMatrixRows = (step1Text: string, lessonFallback: string): MatrixRowRegulationSource[] => {
  const { units } = extractDataFromStep1(step1Text, lessonFallback);

  // Chỉ tạo khung dữ liệu từ nguồn. Không tự áp đặt số câu, dạng câu hay điểm số.
  // Các thông số này phải được lấy từ văn bản quy định, đề mẫu và/hoặc kết quả AI ở Bước 2.
  return units.map((item) => ({
    id: crypto.randomUUID(),
    topic: item.topic,
    unit: item.unit,
    nbP1: 0, nbP2: 0, nbP3: 0, nbTL: 0, nbPoints: 0,
    thP1: 0, thP2: 0, thP3: 0, thTL: 0, thPoints: 0,
    vdP1: 0, vdP2: 0, vdP3: 0, vdTL: 0, vdPoints: 0,
    vdcP1: 0, vdcP2: 0, vdcP3: 0, vdcTL: 0, vdcPoints: 0
  }));
};

// Khởi tạo hàng Bản đặc tả từ Ma trận và nguồn Bước 1
export const createDefaultSpecRows = (matrixRows: MatrixRowRegulationSource[], step1Text: string, lessonFallback: string): SpecRowRegulationSource[] => {
  const { units } = extractDataFromStep1(step1Text, lessonFallback);
  const specRows: SpecRowRegulationSource[] = [];

  let qCountP1 = 1;
  let qCountP2 = 1;
  let qCountP3 = 1;

  matrixRows.forEach((r, rIdx) => {
    const matchedUnit = units[rIdx] || {
      nbReq: `Nhận biết các định nghĩa, tính chất, công thức về ${r.unit}.`,
      thReq: `Hiểu rõ bản chất, tính toán thông thường và áp dụng giải bài tập về ${r.unit}.`,
      vdReq: `Vận dụng định lý để giải quyết bài toán phức tạp và tham số liên quan đến ${r.unit}.`
    };

    // Mức Nhận biết
    if (r.nbP1 > 0 || r.nbP2 > 0 || r.nbP3 > 0 || r.nbTL > 0) {
      let qNums: string[] = [];
      if (r.nbP1 > 0) {
        const start = qCountP1;
        const end = qCountP1 + r.nbP1 - 1;
        qNums.push(start === end ? `C${start}` : `C${start}-C${end}`);
        qCountP1 += r.nbP1;
      }
      specRows.push({
        id: crypto.randomUUID(),
        topic: r.topic,
        unit: r.unit,
        level: 'Nhận biết',
        requirement: matchedUnit.nbReq,
        p1Count: r.nbP1,
        p2Count: r.nbP2,
        p3Count: r.nbP3,
        tlCount: r.nbTL,
        questionNumbers: qNums.join(', ') || `Phần I (C${rIdx + 1})`
      });
    }

    // Mức Thông hiểu
    if (r.thP1 > 0 || r.thP2 > 0 || r.thP3 > 0 || r.thTL > 0) {
      let qNums: string[] = [];
      if (r.thP1 > 0) {
        const start = qCountP1;
        const end = qCountP1 + r.thP1 - 1;
        qNums.push(start === end ? `C${start}` : `C${start}-C${end}`);
        qCountP1 += r.thP1;
      }
      if (r.thP2 > 0) {
        qNums.push(`Phần II (C${qCountP2})`);
        qCountP2 += r.thP2;
      }
      if (r.thP3 > 0) {
        const start = qCountP3;
        const end = qCountP3 + r.thP3 - 1;
        qNums.push(start === end ? `Phần III (C${start})` : `Phần III (C${start}-C${end})`);
        qCountP3 += r.thP3;
      }
      specRows.push({
        id: crypto.randomUUID(),
        topic: r.topic,
        unit: r.unit,
        level: 'Thông hiểu',
        requirement: matchedUnit.thReq,
        p1Count: r.thP1,
        p2Count: r.thP2,
        p3Count: r.thP3,
        tlCount: r.thTL,
        questionNumbers: qNums.join(', ')
      });
    }

    // Mức Vận dụng
    if (r.vdP1 > 0 || r.vdP2 > 0 || r.vdP3 > 0 || r.vdTL > 0) {
      let qNums: string[] = [];
      if (r.vdP2 > 0) {
        qNums.push(`Phần II (C${qCountP2})`);
        qCountP2 += r.vdP2;
      }
      if (r.vdP3 > 0) {
        const start = qCountP3;
        const end = qCountP3 + r.vdP3 - 1;
        qNums.push(start === end ? `Phần III (C${start})` : `Phần III (C${start}-C${end})`);
        qCountP3 += r.vdP3;
      }
      specRows.push({
        id: crypto.randomUUID(),
        topic: r.topic,
        unit: r.unit,
        level: 'Vận dụng',
        requirement: matchedUnit.vdReq,
        p1Count: r.vdP1,
        p2Count: r.vdP2,
        p3Count: r.vdP3,
        tlCount: r.vdTL,
        questionNumbers: qNums.join(', ')
      });
    }

    // Mức Vận dụng cao (nếu có)
    if (r.vdcP1 > 0 || r.vdcP2 > 0 || r.vdcP3 > 0 || r.vdcTL > 0) {
      let qNums: string[] = [];
      if (r.vdcP3 > 0) {
        qNums.push(`Phần III (C${qCountP3})`);
        qCountP3 += r.vdcP3;
      }
      specRows.push({
        id: crypto.randomUUID(),
        topic: r.topic,
        unit: r.unit,
        level: 'Vận dụng cao',
        requirement: `Vận dụng tư duy giải quyết bài toán nâng cao, tìm cực trị hoặc biện luận tham số liên quan đến ${r.unit}.`,
        p1Count: r.vdcP1,
        p2Count: r.vdcP2,
        p3Count: r.vdcP3,
        tlCount: r.vdcTL,
        questionNumbers: qNums.join(', ') || 'Phần III (C6)'
      });
    }
  });

  return specRows;
};

// Chuẩn hóa Checklist mặc định theo văn bản quy định
export const defaultChecklist: ChecklistItem[] = [
  { criterion: "1. Cấu trúc hồ sơ đề kiểm tra định kì", standard: "Đủ các thành phần hồ sơ theo đúng văn bản quy định đã nạp", status: "Chưa Đạt", notes: "Chưa xác thực cho đến khi đối chiếu nguồn chính thức" },
  { criterion: "2. Nguồn gốc dữ liệu kiểm tra", standard: "Dữ liệu kiểm tra phải được truy xuất và đối chiếu từ các nguồn đã cung cấp", status: "Chưa Đạt", notes: "Cần đối chiếu với Bước 1 và văn bản quy định" },
  { criterion: "3. Tổng điểm toàn bài thi", standard: "Tổng điểm đúng theo văn bản quy định đã nạp và ma trận/bản đặc tả", status: "Chưa Đạt", notes: "Không mặc định tổng điểm" },
  { criterion: "4. Định dạng câu hỏi kiểm tra", standard: "Dạng câu, số phần và cách trình bày phải khớp văn bản quy định và đề mẫu đã cung cấp", status: "Chưa Đạt", notes: "Không áp đặt cấu trúc cố định" },
  { criterion: "5. Tính khớp nối Ma trận & Bản đặc tả", standard: "Số câu, dạng câu, mức độ và yêu cầu cần đạt phải khớp giữa các thành phần", status: "Chưa Đạt", notes: "Cần đối chiếu từng trường dữ liệu" },
  { criterion: "6. Phân hóa mức độ đánh giá", standard: "Tỉ lệ và mức độ đánh giá phải đúng theo văn bản quy định đã nạp", status: "Chưa Đạt", notes: "Không tự đặt tỉ lệ mặc định" },
];

// Hàm chuyển đổi dữ liệu từ State thành chuỗi văn bản Markdown hoàn chỉnh chuẩn văn bản quy định
export const serializeRegulationToMarkdown = (
  matrixRows: MatrixRowRegulationSource[], 
  specRows: SpecRowRegulationSource[], 
  checklist: ChecklistItem[]
): string => {
  let md = "# MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KÌ (THEO VĂN BẢN QUY ĐỊNH ĐÃ NẠP)\n";
  md += "*(Dữ liệu bắt buộc trích xuất và kế thừa trực tiếp từ Phân tích nguồn Mục 1)*\n\n";

  // PHẦN 1: KHUNG MA TRẬN
  md += "## PHẦN 1. KHUNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KÌ\n\n";
  md += "| TT | Chủ đề / Mạch nội dung | Nội dung / Đơn vị kiến thức | Nhận biết (NB) | Thông hiểu (TH) | Vận dụng (VD) | Vận dụng cao (VDC) | Tổng số câu | Tổng điểm | Tỉ lệ % |\n";
  md += "| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n";

  let sumNbC = 0, sumNbP = 0;
  let sumThC = 0, sumThP = 0;
  let sumVdC = 0, sumVdP = 0;
  let sumVdcC = 0, sumVdcP = 0;

  matrixRows.forEach((r, idx) => {
    const nbCount = r.nbP1 + r.nbP2 + r.nbP3 + r.nbTL;
    const thCount = r.thP1 + r.thP2 + r.thP3 + r.thTL;
    const vdCount = r.vdP1 + r.vdP2 + r.vdP3 + r.vdTL;
    const vdcCount = r.vdcP1 + r.vdcP2 + r.vdcP3 + r.vdcTL;
    
    const rowTotalC = nbCount + thCount + vdCount + vdcCount;
    const rowTotalP = r.nbPoints + r.thPoints + r.vdPoints + r.vdcPoints;

    sumNbC += nbCount; sumNbP += r.nbPoints;
    sumThC += thCount; sumThP += r.thPoints;
    sumVdC += vdCount; sumVdP += r.vdPoints;
    sumVdcC += vdcCount; sumVdcP += r.vdcPoints;

    const formatCell = (c: number, p: number, p1: number, p2: number, p3: number) => {
      if (c === 0) return "0";
      const parts: string[] = [];
      if (p1 > 0) parts.push(`${p1}c (P.I)`);
      if (p2 > 0) parts.push(`${p2}c (P.II)`);
      if (p3 > 0) parts.push(`${p3}c (P.III)`);
      return `${parts.join(', ')} (${p.toFixed(2)}đ)`;
    };

    const expectedTotalPoints = matrixRows.reduce((sum, row) => sum + row.nbPoints + row.thPoints + row.vdPoints + row.vdcPoints, 0);
    const rowPercent = rowTotalP > 0 && expectedTotalPoints > 0 ? (rowTotalP / expectedTotalPoints) * 100 : 0;

    md += `| ${idx + 1} | ${r.topic} | ${r.unit} | ${formatCell(nbCount, r.nbPoints, r.nbP1, r.nbP2, r.nbP3)} | ${formatCell(thCount, r.thPoints, r.thP1, r.thP2, r.thP3)} | ${formatCell(vdCount, r.vdPoints, r.vdP1, r.vdP2, r.vdP3)} | ${formatCell(vdcCount, r.vdcPoints, r.vdcP1, r.vdcP2, r.vdcP3)} | **${rowTotalC} câu** | **${rowTotalP.toFixed(2)}đ** | **${rowPercent.toFixed(0)}%** |\n`;
  });

  const grandC = sumNbC + sumThC + sumVdC + sumVdcC;
  const grandP = sumNbP + sumThP + sumVdP + sumVdcP;

  md += `| | **Tổng cộng** | | **${sumNbC} câu** (${sumNbP.toFixed(2)}đ) | **${sumThC} câu** (${sumThP.toFixed(2)}đ) | **${sumVdC} câu** (${sumVdP.toFixed(2)}đ) | **${sumVdcC} câu** (${sumVdcP.toFixed(2)}đ) | **${grandC} câu** | **${grandP.toFixed(2)}đ** | **${grandP > 0 ? "100" : "0"}%** |\n`;

  const nbPct = grandP > 0 ? (sumNbP / grandP) * 100 : 0;
  const thPct = grandP > 0 ? (sumThP / grandP) * 100 : 0;
  const vdtPct = grandP > 0 ? (sumVdP / grandP) * 100 : 0;
  const vdcPct = grandP > 0 ? (sumVdcP / grandP) * 100 : 0;

  md += `| | **Tỉ lệ % điểm** | | **${nbPct.toFixed(0)}%** | **${thPct.toFixed(0)}%** | **${vdtPct.toFixed(0)}%** | **${vdcPct.toFixed(0)}%** | | | **${grandP > 0 ? "100" : "0"}%** |\n\n`;

  md += "*Quy ước định dạng câu hỏi và điểm số:*\n";
  md += "- Cấu trúc phần thi, dạng câu hỏi, số câu và điểm số được kế thừa từ văn bản quy định đã nạp, đề mẫu và ma trận/bản đặc tả.\n";
  md += "- Không tự áp đặt số phần, số câu, điểm/câu hoặc tỉ lệ % nếu nguồn chưa xác định.\n\n";

  // PHẦN 2: BẢN ĐẶC TẢ
  md += "## PHẦN 2. BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KÌ\n\n";
  md += "| TT | Chủ đề / Mạch nội dung | Đơn vị kiến thức | Mức độ đánh giá | Yêu cầu cần đạt | Số câu theo từng hình thức | Câu hỏi số tương ứng |\n";
  md += "| :---: | :--- | :--- | :---: | :--- | :---: | :---: |\n";

  specRows.forEach((s, sIdx) => {
    const parts: string[] = [];
    if (s.p1Count > 0) parts.push(`${s.p1Count} TN (P.I)`);
    if (s.p2Count > 0) parts.push(`${s.p2Count} Đ-S (P.II)`);
    if (s.p3Count > 0) parts.push(`${s.p3Count} TLN (P.III)`);
    if (s.tlCount > 0) parts.push(`${s.tlCount} TL`);

    const formattedCounts = parts.join(', ') || "0";
    md += `| ${sIdx + 1} | ${s.topic} | ${s.unit} | **${s.level}** | ${s.requirement.replace(/\|/g, '-')} | ${formattedCounts} | ${s.questionNumbers || '—'} |\n`;
  });

  md += "\n";

  // PHẦN 3: BẢNG TỰ RÀ SOÁT
  md += "## PHẦN 3. BẢNG TỰ RÀ SOÁT THEO VĂN BẢN QUY ĐỊNH ĐÃ NẠP\n\n";
  md += "| TT | Tiêu chí rà soát | Yêu cầu chuẩn quy định | Kết quả tự đánh giá | Ghi chú điều chỉnh |\n";
  md += "| :---: | :--- | :--- | :---: | :--- |\n";

  checklist.forEach((c, cIdx) => {
    md += `| ${cIdx + 1} | ${c.criterion} | ${c.standard} | **${c.status}** | ${c.notes} |\n`;
  });

  return md;
};

// Hàm phân tích Markdown trả về MatrixRows và SpecRows
export const parseRegulationFromMarkdown = (md: string) => {
  if (!md) return { matrixRows: [], specRows: [] };

  const lines = md.split('\n');
  const matrixRows: MatrixRowRegulationSource[] = [];
  const specRows: SpecRowRegulationSource[] = [];

  let currentSection = 0; // 1: Matrix, 2: Spec, 3: Checklist

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('PHẦN 1') && trimmed.includes('MA TRẬN')) {
      currentSection = 1;
      continue;
    }
    if (trimmed.includes('PHẦN 2') && trimmed.includes('BẢN ĐẶC TẢ')) {
      currentSection = 2;
      continue;
    }
    if (trimmed.includes('PHẦN 3') && trimmed.includes('RÀ SOÁT')) {
      currentSection = 3;
      continue;
    }

    if (!trimmed.startsWith('|')) continue;
    const lower = trimmed.toLowerCase();
    if (lower.includes('chủ đề') || lower.includes('đơn vị kiến thức') || lower.includes('tổng cộng') || lower.includes('tỉ lệ') || lower.includes('tiêu chí') || trimmed.includes('| :---')) {
      continue;
    }

    const cells = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length < 4) continue;

    if (currentSection === 1) {
      // Phân tích hàng Ma trận
      // Cột: TT | Chủ đề | Đơn vị | NB | TH | VD | VDC | Tổng câu | Tổng điểm | Tỉ lệ
      const topic = cells.length > 1 ? cells[1] : "Chủ đề";
      const unit = cells.length > 2 ? cells[2] : "Đơn vị kiến thức";

      const extractCounts = (cellStr: string) => {
        const nums = cellStr.match(/\d+(\.\d+)?/g);
        let p1 = 0, p2 = 0, p3 = 0, points = 0;
        if (cellStr.includes('(P.I)')) {
          const match = cellStr.match(/(\d+)\s*c?\s*\(P\.I\)/i);
          if (match) p1 = parseInt(match[1]);
        }
        if (cellStr.includes('(P.II)')) {
          const match = cellStr.match(/(\d+)\s*c?\s*\(P\.II\)/i);
          if (match) p2 = parseInt(match[1]);
        }
        if (cellStr.includes('(P.III)')) {
          const match = cellStr.match(/(\d+)\s*c?\s*\(P\.III\)/i);
          if (match) p3 = parseInt(match[1]);
        }
        const ptsMatch = cellStr.match(/\(([\d\.]+)đ\)/i);
        if (ptsMatch) {
          points = parseFloat(ptsMatch[1]);
        }
        return { p1, p2, p3, points };
      };

      const nb = extractCounts(cells[3] || '');
      const th = extractCounts(cells[4] || '');
      const vd = extractCounts(cells[5] || '');
      const vdc = extractCounts(cells[6] || '');

      matrixRows.push({
        id: crypto.randomUUID(),
        topic: topic || "Chủ đề bài học (Theo nguồn)",
        unit: unit || "Đơn vị kiến thức",
        nbP1: nb.p1, nbP2: nb.p2, nbP3: nb.p3, nbTL: 0, nbPoints: nb.points,
        thP1: th.p1, thP2: th.p2, thP3: th.p3, thTL: 0, thPoints: th.points,
        vdP1: vd.p1, vdP2: vd.p2, vdP3: vd.p3, vdTL: 0, vdPoints: vd.points,
        vdcP1: vdc.p1, vdcP2: vdc.p2, vdcP3: vdc.p3, vdcTL: 0, vdcPoints: vdc.points,
      });
    } else if (currentSection === 2) {
      // Phân tích hàng Bản đặc tả
      // Cột: TT | Chủ đề | Đơn vị | Mức độ | Yêu cầu cần đạt | Số câu | Câu hỏi số
      const topic = cells.length > 1 ? cells[1] : "";
      const unit = cells.length > 2 ? cells[2] : "";
      const levelStr = cells.length > 3 ? cells[3].replace(/[*_]/g, '') : "Nhận biết";
      const req = cells.length > 4 ? cells[4] : "";
      const qTypes = cells.length > 5 ? cells[5] : "";
      const qNums = cells.length > 6 ? cells[6] : "";

      let p1 = 0, p2 = 0, p3 = 0;
      const mP1 = qTypes.match(/(\d+)\s*TN/i);
      if (mP1) p1 = parseInt(mP1[1]);
      const mP2 = qTypes.match(/(\d+)\s*Đ-S/i);
      if (mP2) p2 = parseInt(mP2[1]);
      const mP3 = qTypes.match(/(\d+)\s*TLN/i);
      if (mP3) p3 = parseInt(mP3[1]);

      let validLevel: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao' = 'Nhận biết';
      if (levelStr.includes('Thông hiểu')) validLevel = 'Thông hiểu';
      else if (levelStr.includes('Vận dụng cao')) validLevel = 'Vận dụng cao';
      else if (levelStr.includes('Vận dụng')) validLevel = 'Vận dụng';

      specRows.push({
        id: crypto.randomUUID(),
        topic: topic || "Chủ đề bài học (Theo nguồn)",
        unit: unit || "Đơn vị kiến thức",
        level: validLevel,
        requirement: req || "Yêu cầu cần đạt chuẩn năng lực theo GDPT 2018",
        p1Count: p1,
        p2Count: p2,
        p3Count: p3,
        tlCount: 0,
        questionNumbers: qNums
      });
    }
  }

  return { matrixRows, specRows };
};

const Step2Matrix: React.FC<Step2MatrixProps> = ({
  lesson,
  regulationSource,
  sampleExam,
  matrix,
  step1Result,
  examDuration = 45,
  subject,
  grade,
  prompt,
  setPrompt,
  result,
  setResult,
  onNext,
  onPrev
}) => {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Các chế độ hiển thị chính
  const [viewMode, setViewMode] = useState<'interactive' | 'preview' | 'edit'>('interactive');
  
  // Tab con trong Bộ biên soạn trực quan văn bản quy định
  const [subTab, setSubTab] = useState<'matrix' | 'spec' | 'checklist'>('matrix');

  // Trạng thái mở rộng xem dữ liệu Mục 1 đã nạp
  const [showStep1SourceInspector, setShowStep1SourceInspector] = useState(false);
  
  // Trạng thái cấu hình Prompt
  const [showPromptConfig, setShowPromptConfig] = useState(false);

  // State các bảng tương tác
  const [matrixRows, setMatrixRows] = useState<MatrixRowRegulationSource[]>([]);
  const [specRows, setSpecRows] = useState<SpecRowRegulationSource[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultChecklist);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const hasStep1Data = Boolean(step1Result && step1Result.trim().length > 20);

  // Khởi tạo bảng ban đầu: Ưu tiên parse từ result, nếu chưa có result thì sinh tự động từ Step 1!
  useEffect(() => {
    if (result && result.trim().length > 0) {
      const { matrixRows: parsedM, specRows: parsedS } = parseRegulationFromMarkdown(result);
      if (parsedM.length > 0) {
        setMatrixRows(parsedM);
      }
      if (parsedS.length > 0) {
        setSpecRows(parsedS);
      }
    } else {
      // Nếu chưa có result, tự động sinh Ma trận & Bản đặc tả từ Phân tích Mục 1!
      const initialM = createDefaultMatrixRows(step1Result, lesson);
      const initialS = createDefaultSpecRows(initialM, step1Result, lesson);
      setMatrixRows(initialM);
      setSpecRows(initialS);
      const serialized = serializeRegulationToMarkdown(initialM, initialS, checklist);
      setResult(serialized);
    }
  }, [step1Result]);

  // Cập nhật và lưu lại khi người dùng chỉnh sửa Ma trận
  const updateMatrixRows = (newRows: MatrixRowRegulationSource[]) => {
    setMatrixRows(newRows);
    const serialized = serializeRegulationToMarkdown(newRows, specRows, checklist);
    setResult(serialized);
  };

  // Cập nhật và lưu lại khi người dùng chỉnh sửa Bản đặc tả
  const updateSpecRows = (newSpecs: SpecRowRegulationSource[]) => {
    setSpecRows(newSpecs);
    const serialized = serializeRegulationToMarkdown(matrixRows, newSpecs, checklist);
    setResult(serialized);
  };

  // Cập nhật và lưu lại khi người dùng chỉnh sửa Checklist
  const updateChecklist = (newChecklist: ChecklistItem[]) => {
    setChecklist(newChecklist);
    const serialized = serializeRegulationToMarkdown(matrixRows, specRows, newChecklist);
    setResult(serialized);
  };

  // Xử lý thay đổi từng ô trong Ma trận
  const handleMatrixCellChange = (id: string, field: keyof MatrixRowRegulationSource, val: any) => {
    const updated = matrixRows.map(r => {
      if (r.id !== id) return r;
      const copy = { ...r, [field]: val };

      // Không tự tính điểm theo công thức cố định; điểm phải kế thừa từ văn bản quy định/ma trận đã xác lập.
      return copy;
    });
    updateMatrixRows(updated);
  };

  // Thêm đơn vị kiến thức mới vào Ma trận
  const handleAddMatrixRow = () => {
    const newRow: MatrixRowRegulationSource = {
      id: crypto.randomUUID(),
      topic: matrixRows[0]?.topic || "Chủ đề bài học",
      unit: `Đơn vị kiến thức ${matrixRows.length + 1}`,
      nbP1: 0, nbP2: 0, nbP3: 0, nbTL: 0, nbPoints: 0,
      thP1: 0, thP2: 0, thP3: 0, thTL: 0, thPoints: 0,
      vdP1: 0, vdP2: 0, vdP3: 0, vdTL: 0, vdPoints: 0,
      vdcP1: 0, vdcP2: 0, vdcP3: 0, vdcTL: 0, vdcPoints: 0,
    };
    updateMatrixRows([...matrixRows, newRow]);
  };

  // Xóa hàng trong Ma trận
  const handleDeleteMatrixRow = (id: string) => {
    updateMatrixRows(matrixRows.filter(r => r.id !== id));
  };

  // Thêm mục trong Bản đặc tả
  const handleAddSpecRow = () => {
    const newSpec: SpecRowRegulationSource = {
      id: crypto.randomUUID(),
      topic: matrixRows[0]?.topic || "Chủ đề bài học",
      unit: matrixRows[0]?.unit || "Đơn vị kiến thức",
      level: 'Nhận biết',
      requirement: "Chưa xác định — lấy từ văn bản quy định đã nạp và Phân tích Bước 1.",
      p1Count: 0,
      p2Count: 0,
      p3Count: 0,
      tlCount: 0,
      questionNumbers: "Chưa xác định"
    };
    updateSpecRows([...specRows, newSpec]);
  };

  // Xóa mục trong Bản đặc tả
  const handleDeleteSpecRow = (id: string) => {
    updateSpecRows(specRows.filter(s => s.id !== id));
  };

  // Đồng bộ lại Bản đặc tả từ Ma trận
  const handleSyncSpecFromMatrix = () => {
    const regeneratedSpecs = createDefaultSpecRows(matrixRows, step1Result, lesson);
    updateSpecRows(regeneratedSpecs);
  };

  // Reset và nạp lại toàn bộ dữ liệu từ Phân tích Mục 1
  const handleResetFromStep1 = () => {
    if (confirm("Thầy/Cô có chắc chắn muốn thiết lập lại toàn bộ Ma trận và Bản đặc tả dựa trên dữ liệu Phân tích nguồn của Mục 1 không?")) {
      const freshMatrix = createDefaultMatrixRows(step1Result, lesson);
      const freshSpecs = createDefaultSpecRows(freshMatrix, step1Result, lesson);
      setMatrixRows(freshMatrix);
      setSpecRows(freshSpecs);
      const serialized = serializeRegulationToMarkdown(freshMatrix, freshSpecs, checklist);
      setResult(serialized);
    }
  };

  // Kéo thả sắp xếp hàng trong Ma trận
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const updated = [...matrixRows];
    const dragged = updated[draggedIdx];
    updated.splice(draggedIdx, 1);
    updated.splice(index, 0, dragged);
    setDraggedIdx(index);
    setMatrixRows(updated);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    updateMatrixRows(matrixRows);
  };

  // Sao chép Prompt
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Gọi API sinh Ma trận & Đặc tả với Gemini
  const handleRunGemini = async () => {
    if (!regulationSource || !regulationSource.trim()) {
      alert("CẢNH BÁO: Mục '2. Văn bản quy định' là nguồn bắt buộc do người dùng cung cấp. Vui lòng quay lại Bước 0 để cung cấp văn bản quy định trước khi tạo Ma trận & Bản đặc tả!");
      onPrev();
      return;
    }

    if (!hasStep1Data) {
      alert("CẢNH BÁO: Bắt buộc phải có kết quả từ Mục 1 (Phân tích nguồn) để xây dựng Ma trận & Bản đặc tả theo văn bản quy định. Thầy cô vui lòng quay lại Bước 1 để thực hiện trước!");
      onPrev();
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/generate/step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson, regulationSource, sampleExam, matrix, step1Result, prompt, examDuration, durationMinutes: examDuration, subject, grade }),
      });
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        if (response.status === 413) {
          throw new Error("Dung lượng tài liệu quá lớn. Thầy cô vui lòng tối ưu lại văn bản!");
        }
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`Máy chủ AI đang bận tạm thời (Lỗi ${response.status}). Thầy cô vui lòng bấm thử lại sau giây lát.`);
        }
        throw new Error(`Lỗi phản hồi hệ thống (Mã lỗi ${response.status}).`);
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Gặp lỗi khi tạo ma trận đặc tả.");
      }

      const generatedMd = data.result || "";
      setResult(generatedMd);

      // Phân tích ngược kết quả AI trả về vào các bảng trực quan
      const { matrixRows: parsedM, specRows: parsedS } = parseRegulationFromMarkdown(generatedMd);
      if (parsedM.length > 0) setMatrixRows(parsedM);
      if (parsedS.length > 0) setSpecRows(parsedS);

      setViewMode('preview');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể kết nối đến server AI.");
    } finally {
      setIsRunning(false);
    }
  };

  // Thống kê tổng hợp thời gian thực
  const stats = useMemo(() => {
    let totalNbPoints = 0, totalThPoints = 0, totalVdPoints = 0, totalVdcPoints = 0;
    let totalNbCount = 0, totalThCount = 0, totalVdCount = 0, totalVdcCount = 0;
    let totalP1Count = 0, totalP2Count = 0, totalP3Count = 0, totalTLCount = 0;

    matrixRows.forEach(r => {
      const nbC = r.nbP1 + r.nbP2 + r.nbP3 + r.nbTL;
      const thC = r.thP1 + r.thP2 + r.thP3 + r.thTL;
      const vdC = r.vdP1 + r.vdP2 + r.vdP3 + r.vdTL;
      const vdcC = r.vdcP1 + r.vdcP2 + r.vdcP3 + r.vdcTL;

      totalNbCount += nbC;
      totalThCount += thC;
      totalVdCount += vdC;
      totalVdcCount += vdcC;

      totalNbPoints += r.nbPoints;
      totalThPoints += r.thPoints;
      totalVdPoints += r.vdPoints;
      totalVdcPoints += r.vdcPoints;

      totalP1Count += (r.nbP1 + r.thP1 + r.vdP1 + r.vdcP1);
      totalP2Count += (r.nbP2 + r.thP2 + r.vdP2 + r.vdcP2);
      totalP3Count += (r.nbP3 + r.thP3 + r.vdP3 + r.vdcP3);
      totalTLCount += (r.nbTL + r.thTL + r.vdTL + r.vdcTL);
    });

    const grandPoints = Number((totalNbPoints + totalThPoints + totalVdPoints + totalVdcPoints).toFixed(2));
    const grandQuestions = totalNbCount + totalThCount + totalVdCount + totalVdcCount;

    const isPointsValid = Math.abs(grandPoints - 10.0) < 0.05;
    const nbPct = grandPoints > 0 ? (totalNbPoints / grandPoints) * 100 : 0;
    const thPct = grandPoints > 0 ? (totalThPoints / grandPoints) * 100 : 0;
    const vdtPct = grandPoints > 0 ? ((totalVdPoints + totalVdcPoints) / grandPoints) * 100 : 0;

    return {
      totalNbPoints, totalThPoints, totalVdPoints, totalVdcPoints, grandPoints,
      totalNbCount, totalThCount, totalVdCount, totalVdcCount, grandQuestions,
      totalP1Count, totalP2Count, totalP3Count, totalTLCount,
      isPointsValid, nbPct, thPct, vdtPct
    };
  }, [matrixRows]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="w-12 h-12 bg-teal-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-teal-100 shrink-0">
          <Layers size={24} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-teal-600 font-bold text-xs uppercase tracking-wider">QUY TRÌNH RA ĐỀ - BƯỚC 2</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 font-bold rounded-xl text-xs shadow-xs">
                Môn: {subject || 'Sinh học'} • {grade ? `Lớp ${grade}` : 'Lớp 9'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs shadow-xs">
                <Clock size={13} className="text-amber-600" />
                Thời lượng bài kiểm tra: {examDuration} phút
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Bước 2. Ma trận & Bản đặc tả đề kiểm tra (văn bản quy định)
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-0.5">
            Bắt buộc kế thừa 100% dữ liệu từ Phân tích nguồn Mục 1: chuẩn hóa mạch kiến thức, yêu cầu cần đạt và cấu trúc 3 phần trắc nghiệm GDPT 2018.
          </p>
        </div>
      </div>

      {/* BANNER KẾT NỐI DỮ LIỆU TỪ MỤC 1 (RÀNG BUỘC SỐNG CÒN) */}
      {hasStep1Data ? (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-3xl p-5 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <CheckCircle size={20} />
              </div>
              <div>
                <h4 className="font-extrabold text-emerald-950 text-sm flex items-center gap-2">
                  Đã liên kết thành công dữ liệu từ Mục 1 (Phân tích nguồn)
                </h4>
                <p className="text-xs text-emerald-800 font-medium mt-0.5">
                  Ma trận và Bản đặc tả đã được đồng bộ với các đơn vị kiến thức, yêu cầu cần đạt và cấu trúc đề mẫu từ Mục 1.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => setShowStep1SourceInspector(!showStep1SourceInspector)}
                className="px-3.5 py-2 bg-white hover:bg-emerald-100/50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <BookOpen size={14} />
                {showStep1SourceInspector ? 'Thu gọn dữ liệu Mục 1' : 'Xem dữ liệu Mục 1 đã nạp'}
              </button>
              <button
                onClick={handleResetFromStep1}
                title="Đồng bộ lại cấu trúc ban đầu từ Phân tích nguồn Mục 1"
                className="p-2 bg-white hover:bg-emerald-100/50 text-emerald-700 border border-emerald-200 rounded-xl transition-all shadow-2xs"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          {/* Hộp xem chi tiết dữ liệu Mục 1 đã nạp */}
          {showStep1SourceInspector && (
            <div className="mt-4 pt-4 border-t border-emerald-200/70 space-y-3 animate-fade-in">
              <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={14} /> Trích lục kết quả phân tích nguồn từ Mục 1:
              </div>
              <div className="max-h-60 overflow-y-auto bg-white p-4 rounded-2xl border border-emerald-200 text-xs leading-relaxed text-slate-700 custom-scrollbar font-mono">
                <ContentRenderer content={step1Result} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-start gap-3.5">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h4 className="font-black text-amber-950 text-base">
                ⚠️ BẮT BUỘC: Chưa có kết quả Phân tích nguồn từ Mục 1
              </h4>
              <p className="text-xs text-amber-900 font-semibold mt-1 leading-relaxed max-w-2xl">
                Theo tinh thần văn bản quy định do người dùng cung cấp, việc lập Ma trận và Bản đặc tả <strong>bắt buộc phải lấy dữ liệu từ kết quả Phân tích nguồn của Mục 1</strong>. Thầy/Cô vui lòng quay lại Bước 1 để phân tích SGK và đề mẫu trước!
              </p>
            </div>
          </div>
          <button
            onClick={onPrev}
            className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 shadow-md flex-shrink-0"
          >
            <ArrowLeft size={16} /> Quay lại Bước 1 phân tích nguồn ngay
          </button>
        </div>
      )}

      {/* Main Flow Controller & AI Trigger */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Sparkles size={18} className="text-teal-600" />
              Tự động hóa Ma trận & Bản đặc tả theo văn bản quy định
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Gemini sẽ đọc toàn bộ phân tích Mục 1, lập bảng Ma trận và Bản đặc tả chi tiết với đầy đủ các mức độ Nhận biết, Thông hiểu, Vận dụng.
            </p>
          </div>
          <button
            onClick={handleRunGemini}
            disabled={isRunning}
            className="w-full md:w-auto px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white disabled:bg-slate-300 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-100"
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Đang thiết lập ma trận văn bản quy định...
              </>
            ) : (
              <>
                <Play fill="currentColor" size={12} />
                Chạy sinh ma trận & đặc tả với Gemini
              </>
            )}
          </button>
        </div>

        {/* Cấu hình Prompt nâng cao */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
          <button
            onClick={() => setShowPromptConfig(!showPromptConfig)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-600 hover:bg-slate-100/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings size={14} className="text-slate-400" />
              Cấu hình câu lệnh tạo Ma trận & Bản đặc tả theo văn bản quy định
            </span>
            <ChevronDown size={14} className={`transform transition-transform ${showPromptConfig ? 'rotate-180' : ''}`} />
          </button>
          
          {showPromptConfig && (
            <div className="p-5 border-t border-slate-200 bg-white space-y-4 animate-fade-in">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Câu lệnh ràng buộc chuẩn xác theo văn bản quy định và kết quả Mục 1:</span>
                <button
                  onClick={handleCopyPrompt}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    copied 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Đã sao chép' : 'Sao chép văn bản'}
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-64 p-4 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all resize-y font-mono bg-slate-900 text-slate-100 leading-relaxed custom-scrollbar"
                placeholder="Câu lệnh sinh ma trận..."
              />
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-850 rounded-2xl font-bold text-sm">
          ❌ HỆ THỐNG PHẢN HỒI LỖI: {errorMsg}
        </div>
      )}

      {/* VÙNG LÀM VIỆC CHÍNH - MA TRẬN & BẢN ĐẶC TẢ */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {/* Navigation Bar giữa các chế độ View */}
        <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chế độ xem:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setViewMode('interactive')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'interactive' 
                  ? 'bg-teal-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet size={14} /> Bộ soạn thảo trực quan (RegulationSource)
              </button>
              <button
                onClick={() => setViewMode('preview')}
                disabled={!result}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'preview' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-50'
                }`}
              >
                <Eye size={14} /> Xem văn bản in ấn chuẩn
              </button>
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'edit' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 size={14} /> Sửa mã nguồn Markdown
              </button>
            </div>
          </div>

          {/* Thẻ trạng thái tổng điểm */}
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 ${
              stats.isPointsValid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {stats.isPointsValid ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              Tổng điểm: {stats.grandPoints.toFixed(2)} / 10.0đ
            </div>
            <div className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              Tổng số câu: {stats.grandQuestions} câu
            </div>
          </div>
        </div>

        {/* Nội dung vùng làm việc */}
        <div className="p-6 md:p-8 flex-1 bg-white">
          {viewMode === 'interactive' ? (
            <div className="space-y-6">
              {/* SUB-TABS DÀNH CHO BỘ SOẠN THẢO TRỰC QUAN văn bản quy định */}
              <div className="flex border-b border-slate-200 gap-6">
                <button
                  onClick={() => setSubTab('matrix')}
                  className={`pb-3 text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all ${
                    subTab === 'matrix' 
                    ? 'border-teal-600 text-teal-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileSpreadsheet size={16} /> Khung Ma Trận Đề (Phần 1)
                </button>
                <button
                  onClick={() => setSubTab('spec')}
                  className={`pb-3 text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all ${
                    subTab === 'spec' 
                    ? 'border-teal-600 text-teal-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ListOrdered size={16} /> Bản Đặc Tả Đề (Phần 2)
                </button>
                <button
                  onClick={() => setSubTab('checklist')}
                  className={`pb-3 text-sm font-extrabold flex items-center gap-2 border-b-2 transition-all ${
                    subTab === 'checklist' 
                    ? 'border-teal-600 text-teal-700' 
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ClipboardCheck size={16} /> Tự Rà Soát Theo văn bản quy định (Phần 3)
                </button>
              </div>

              {/* TAB 1: KHUNG MA TRẬN */}
              {subTab === 'matrix' && (
                <div className="space-y-6 animate-fade-in">
                  {/* KPI Indicators theo chuẩn văn bản quy định */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Nhận biết */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nhận biết (NB)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-50 text-orange-700 border border-orange-100">
                          {stats.nbPct.toFixed(0)}% điểm
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-black text-slate-800">{stats.totalNbPoints.toFixed(2)} <span className="text-xs font-semibold text-slate-400">điểm</span></div>
                        <div className="text-xs font-bold text-slate-500 mt-0.5">{stats.totalNbCount} câu hỏi</div>
                      </div>
                      <div className="mt-3 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-orange-500 h-full rounded-full" style={{ width: `${Math.min(stats.nbPct, 100)}%` }} />
                      </div>
                    </div>

                    {/* Thông hiểu */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thông hiểu (TH)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          {stats.thPct.toFixed(0)}% điểm
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-black text-slate-800">{stats.totalThPoints.toFixed(2)} <span className="text-xs font-semibold text-slate-400">điểm</span></div>
                        <div className="text-xs font-bold text-slate-500 mt-0.5">{stats.totalThCount} câu hỏi</div>
                      </div>
                      <div className="mt-3 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(stats.thPct, 100)}%` }} />
                      </div>
                    </div>

                    {/* Vận dụng */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vận dụng (VD & VDC)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {stats.vdtPct.toFixed(0)}% điểm
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="text-xl font-black text-slate-800">{(stats.totalVdPoints + stats.totalVdcPoints).toFixed(2)} <span className="text-xs font-semibold text-slate-400">điểm</span></div>
                        <div className="text-xs font-bold text-slate-500 mt-0.5">{stats.totalVdCount + stats.totalVdcCount} câu hỏi</div>
                      </div>
                      <div className="mt-3 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(stats.vdtPct, 100)}%` }} />
                      </div>
                    </div>

                    {/* Cấu trúc định dạng đề mẫu */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cấu trúc đề GDPT 2018</span>
                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-slate-600">
                          <span>Phần I (Nhiều lựa chọn):</span>
                          <span className="text-teal-700">{stats.totalP1Count} câu</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-600">
                          <span>Phần II (Đúng - Sai):</span>
                          <span className="text-indigo-700">{stats.totalP2Count} câu</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-600">
                          <span>Phần III (Trả lời ngắn):</span>
                          <span className="text-purple-700">{stats.totalP3Count} câu</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bảng tương tác Ma trận văn bản quy định */}
                  <div className="overflow-x-auto border border-slate-200 rounded-3xl shadow-xs bg-white">
                    <table className="w-full text-left text-xs border-collapse matrix-table">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <th className="p-3 text-center w-10 uppercase select-none">Kéo</th>
                          <th className="p-3 text-center w-10 uppercase">TT</th>
                          <th className="p-3 uppercase font-extrabold min-w-[200px]">Nội dung / Đơn vị kiến thức (từ Mục 1)</th>
                          <th className="p-3 text-center uppercase bg-orange-50/40 text-orange-950 min-w-[140px]">Nhận biết (NB)</th>
                          <th className="p-3 text-center uppercase bg-amber-50/40 text-amber-950 min-w-[140px]">Thông hiểu (TH)</th>
                          <th className="p-3 text-center uppercase bg-blue-50/40 text-blue-950 min-w-[140px]">Vận dụng (VD)</th>
                          <th className="p-3 text-center uppercase bg-purple-50/40 text-purple-950 min-w-[140px]">VDC</th>
                          <th className="p-3 text-center uppercase font-black text-indigo-950 w-28">Tổng cộng</th>
                          <th className="p-3 text-center w-14 uppercase">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matrixRows.map((row, idx) => {
                          const rowCount = (row.nbP1 + row.nbP2 + row.nbP3 + row.nbTL) + 
                                           (row.thP1 + row.thP2 + row.thP3 + row.thTL) + 
                                           (row.vdP1 + row.vdP2 + row.vdP3 + row.vdTL) + 
                                           (row.vdcP1 + row.vdcP2 + row.vdcP3 + row.vdcTL);
                          const rowPoints = row.nbPoints + row.thPoints + row.vdPoints + row.vdcPoints;

                          return (
                            <tr 
                              key={row.id}
                              className={`hover:bg-slate-50/50 transition-colors ${draggedIdx === idx ? 'opacity-40 bg-teal-50' : ''}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={(e) => handleDragOver(e, idx)}
                              onDragEnd={handleDragEnd}
                            >
                              <td className="p-3 text-center cursor-grab active:cursor-grabbing select-none text-slate-350 hover:text-teal-600">
                                <GripVertical size={16} className="mx-auto" />
                              </td>
                              <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="p-3">
                                <input 
                                  type="text" 
                                  value={row.unit}
                                  onChange={(e) => handleMatrixCellChange(row.id, 'unit', e.target.value)}
                                  className="w-full bg-slate-50 border border-transparent rounded-lg p-1.5 hover:border-slate-200 focus:border-teal-500 focus:bg-white text-xs font-bold outline-none transition-all"
                                  placeholder="Đơn vị kiến thức..."
                                />
                              </td>

                              {/* NHẬN BIẾT */}
                              <td className="p-3 bg-orange-50/10">
                                <div className="flex flex-col gap-1 text-[10px]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.I:</span>
                                    <input 
                                      type="number" min="0" value={row.nbP1}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'nbP1', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.II:</span>
                                    <input 
                                      type="number" min="0" value={row.nbP2}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'nbP2', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Điểm NB:</span>
                                    <span className="font-extrabold text-orange-700">{row.nbPoints.toFixed(2)}đ</span>
                                  </div>
                                </div>
                              </td>

                              {/* THÔNG HIỂU */}
                              <td className="p-3 bg-amber-50/10">
                                <div className="flex flex-col gap-1 text-[10px]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.I:</span>
                                    <input 
                                      type="number" min="0" value={row.thP1}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'thP1', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.II:</span>
                                    <input 
                                      type="number" min="0" value={row.thP2}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'thP2', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.III:</span>
                                    <input 
                                      type="number" min="0" value={row.thP3}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'thP3', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Điểm TH:</span>
                                    <span className="font-extrabold text-amber-700">{row.thPoints.toFixed(2)}đ</span>
                                  </div>
                                </div>
                              </td>

                              {/* VẬN DỤNG */}
                              <td className="p-3 bg-blue-50/10">
                                <div className="flex flex-col gap-1 text-[10px]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.II:</span>
                                    <input 
                                      type="number" min="0" value={row.vdP2}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'vdP2', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.III:</span>
                                    <input 
                                      type="number" min="0" value={row.vdP3}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'vdP3', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Điểm VD:</span>
                                    <span className="font-extrabold text-blue-700">{row.vdPoints.toFixed(2)}đ</span>
                                  </div>
                                </div>
                              </td>

                              {/* VẬN DỤNG CAO */}
                              <td className="p-3 bg-purple-50/10">
                                <div className="flex flex-col gap-1 text-[10px]">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">P.III:</span>
                                    <input 
                                      type="number" min="0" value={row.vdcP3}
                                      onChange={(e) => handleMatrixCellChange(row.id, 'vdcP3', parseInt(e.target.value) || 0)}
                                      className="w-10 text-center bg-white border border-slate-200 rounded p-0.5 font-bold"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Điểm VDC:</span>
                                    <span className="font-extrabold text-purple-700">{row.vdcPoints.toFixed(2)}đ</span>
                                  </div>
                                </div>
                              </td>

                              {/* TỔNG CỘNG HÀNG */}
                              <td className="p-3 text-center bg-slate-50/40">
                                <div className="font-bold text-slate-700">{rowCount} câu</div>
                                <div className="font-black text-indigo-700 text-xs mt-0.5">{rowPoints.toFixed(2)}đ</div>
                              </td>

                              {/* NÚT XÓA */}
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleDeleteMatrixRow(row.id)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Xóa đơn vị kiến thức này"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-black border-t border-slate-200 text-slate-800">
                          <td colSpan={3} className="p-4 text-xs font-black uppercase">Tổng cộng toàn bài</td>
                          <td className="p-3 text-center text-orange-900">
                            <div>{stats.totalNbCount} câu</div>
                            <div className="text-xs font-black">{stats.totalNbPoints.toFixed(2)}đ</div>
                          </td>
                          <td className="p-3 text-center text-amber-900">
                            <div>{stats.totalThCount} câu</div>
                            <div className="text-xs font-black">{stats.totalThPoints.toFixed(2)}đ</div>
                          </td>
                          <td className="p-3 text-center text-blue-900">
                            <div>{stats.totalVdCount} câu</div>
                            <div className="text-xs font-black">{stats.totalVdPoints.toFixed(2)}đ</div>
                          </td>
                          <td className="p-3 text-center text-purple-900">
                            <div>{stats.totalVdcCount} câu</div>
                            <div className="text-xs font-black">{stats.totalVdcPoints.toFixed(2)}đ</div>
                          </td>
                          <td className="p-3 text-center bg-indigo-50 text-indigo-950 font-black">
                            <div className="text-xs">{stats.grandQuestions} câu</div>
                            <div className="text-sm font-black underline">{stats.grandPoints.toFixed(2)}đ</div>
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={handleAddMatrixRow}
                      className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus size={14} /> Thêm đơn vị kiến thức mới
                    </button>
                    <button
                      onClick={handleSyncSpecFromMatrix}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-2xs"
                    >
                      <RotateCcw size={14} /> Tự động cập nhật sang Bản đặc tả (Phần 2)
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: BẢN ĐẶC TẢ ĐỀ KIỂM TRA */}
              {subTab === 'spec' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500 font-medium">
                      Bản đặc tả chi tiết hóa từng chỉ báo hành vi, chuẩn kiến thức năng lực từ Mục 1 và chỉ rõ vị trí câu hỏi trong đề.
                    </p>
                    <button
                      onClick={handleAddSpecRow}
                      className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus size={14} /> Thêm mục đặc tả
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-3xl shadow-xs bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                          <th className="p-3 text-center w-10">TT</th>
                          <th className="p-3 w-48">Đơn vị kiến thức</th>
                          <th className="p-3 w-28 text-center">Mức độ</th>
                          <th className="p-3 min-w-[280px]">Yêu cầu cần đạt (Chỉ báo năng lực từ Mục 1)</th>
                          <th className="p-3 text-center w-36">Hình thức câu hỏi</th>
                          <th className="p-3 text-center w-28">Câu hỏi số</th>
                          <th className="p-3 text-center w-12">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {specRows.map((spec, sIdx) => (
                          <tr key={spec.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 text-center font-bold text-slate-400">{sIdx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-800">
                              <input 
                                type="text"
                                value={spec.unit}
                                onChange={(e) => {
                                  const updated = [...specRows];
                                  updated[sIdx].unit = e.target.value;
                                  updateSpecRows(updated);
                                }}
                                className="w-full bg-slate-50 border border-transparent rounded p-1 text-xs font-bold hover:border-slate-200 focus:bg-white focus:border-teal-500 outline-none"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <select
                                value={spec.level}
                                onChange={(e) => {
                                  const updated = [...specRows];
                                  updated[sIdx].level = e.target.value as any;
                                  updateSpecRows(updated);
                                }}
                                className={`text-[11px] font-extrabold py-1 px-2 rounded-lg border outline-none ${
                                  spec.level === 'Nhận biết' ? 'bg-orange-50 text-orange-800 border-orange-200' :
                                  spec.level === 'Thông hiểu' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                                  spec.level === 'Vận dụng cao' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                                  'bg-blue-50 text-blue-800 border-blue-200'
                                }`}
                              >
                                <option value="Nhận biết">Nhận biết</option>
                                <option value="Thông hiểu">Thông hiểu</option>
                                <option value="Vận dụng">Vận dụng</option>
                                <option value="Vận dụng cao">Vận dụng cao</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <textarea
                                value={spec.requirement}
                                rows={2}
                                onChange={(e) => {
                                  const updated = [...specRows];
                                  updated[sIdx].requirement = e.target.value;
                                  updateSpecRows(updated);
                                }}
                                className="w-full bg-slate-50 border border-transparent rounded-lg p-2 text-xs hover:border-slate-200 focus:bg-white focus:border-teal-500 outline-none transition-all resize-y leading-relaxed"
                                placeholder="Yêu cầu cần đạt chuẩn năng lực..."
                              />
                            </td>
                            <td className="p-3 text-center">
                              <div className="text-[10px] space-y-1 font-bold text-slate-600">
                                {spec.p1Count > 0 && <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded mr-1">{spec.p1Count} TN P.I</span>}
                                {spec.p2Count > 0 && <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded mr-1">{spec.p2Count} Đ-S P.II</span>}
                                {spec.p3Count > 0 && <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded">{spec.p3Count} TLN P.III</span>}
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-indigo-700">
                              <input 
                                type="text"
                                value={spec.questionNumbers}
                                onChange={(e) => {
                                  const updated = [...specRows];
                                  updated[sIdx].questionNumbers = e.target.value;
                                  updateSpecRows(updated);
                                }}
                                className="w-full text-center bg-slate-50 border border-transparent rounded p-1 text-xs font-bold text-indigo-700 hover:border-slate-200 focus:bg-white focus:border-indigo-500 outline-none"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteSpecRow(spec.id)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                                title="Xóa mục đặc tả"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: BẢNG TỰ RÀ SOÁT THEO VĂN BẢN QUY ĐỊNH ĐÃ NẠP */}
              {subTab === 'checklist' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600">
                    💡 Bảng kiểm tra 6 tiêu chuẩn cốt lõi nhằm đảm bảo hồ sơ kiểm tra đạt chuẩn thanh tra khảo thí theo văn bản quy định do người dùng cung cấp.
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-3xl shadow-xs bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                          <th className="p-3 text-center w-12">#</th>
                          <th className="p-3 w-56">Tiêu chí kiểm định</th>
                          <th className="p-3 min-w-[240px]">Chuẩn quy định theo văn bản quy định</th>
                          <th className="p-3 text-center w-28">Trạng thái</th>
                          <th className="p-3 min-w-[200px]">Ghi chú điều chỉnh</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {checklist.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-extrabold text-slate-800">{item.criterion}</td>
                            <td className="p-3 text-slate-600 font-medium">{item.standard}</td>
                            <td className="p-3 text-center">
                              <select 
                                value={item.status}
                                onChange={(e) => {
                                  const updated = [...checklist];
                                  updated[idx].status = e.target.value as any;
                                  updateChecklist(updated);
                                }}
                                className="py-1 px-2.5 rounded-lg font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              >
                                <option value="Đạt">Đạt ✅</option>
                                <option value="Chưa Đạt">Chưa Đạt ❌</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <input 
                                type="text" 
                                value={item.notes}
                                onChange={(e) => {
                                  const updated = [...checklist];
                                  updated[idx].notes = e.target.value;
                                  updateChecklist(updated);
                                }}
                                className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-xs border border-transparent hover:border-slate-200 focus:border-slate-300 rounded-lg p-1.5 transition-all outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : viewMode === 'preview' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Văn bản Ma trận & Bản đặc tả in ấn (văn bản quy định)
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? 'Đã sao chép văn bản' : 'Sao chép toàn bộ Markdown'}
                </button>
              </div>

              <div className="prose max-w-none text-slate-800 text-xs leading-relaxed overflow-x-auto bg-slate-50/50 p-6 rounded-2xl border border-slate-200/80">
                {result ? (
                  <ContentRenderer content={result} />
                ) : (
                  <div className="text-center py-16 text-slate-400 font-medium">
                    Chưa có nội dung Ma trận & Đặc tả. Hãy nhấn <strong className="text-teal-600">"Chạy sinh ma trận & đặc tả với Gemini"</strong> ở trên để khởi tạo tự động.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Chỉnh sửa trực tiếp mã nguồn Markdown:</span>
                <span className="text-[11px] text-slate-400">Thay đổi sẽ tự động đồng bộ sang bộ soạn thảo trực quan</span>
              </div>
              <textarea
                value={result}
                onChange={(e) => {
                  setResult(e.target.value);
                  const { matrixRows: parsedM, specRows: parsedS } = parseRegulationFromMarkdown(e.target.value);
                  if (parsedM.length > 0) setMatrixRows(parsedM);
                  if (parsedS.length > 0) setSpecRows(parsedS);
                }}
                className="w-full h-[520px] p-4 border border-slate-250 rounded-2xl focus:ring-2 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all resize-y text-xs font-mono leading-relaxed text-slate-850 custom-scrollbar shadow-inner bg-slate-900 text-slate-100"
                placeholder="Nội dung Markdown của Ma trận và Bản đặc tả..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Điều hướng quy trình */}
      <div className="flex justify-between border-t border-slate-100 pt-6">
        <button
          onClick={onPrev}
          className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold transition-all text-sm flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Trở lại Bước 1: Phân tích nguồn
        </button>
        <button
          onClick={onNext}
          disabled={!result.trim()}
          className={`px-8 py-3.5 rounded-xl font-extrabold flex items-center gap-2 transition-all text-sm ${
            !result.trim() 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100'
          }`}
        >
          Tiến hành Bước 3: Tạo đề thi gốc <ChevronRight size={16} />
        </button>
      </div>

    </div>
  );
};

export default Step2Matrix;
