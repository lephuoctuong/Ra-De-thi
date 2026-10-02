import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle, 
  PageBreak,
  Footer,
  PageNumber,
  ImageRun
} from 'docx';
import { SavedExamPackage } from '../types';

/**
 * Chuẩn hóa ký tự khoa học, công thức LaTeX và loại bỏ các ký tự điều khiển XML không hợp lệ
 * Đảm bảo file Word không bao giờ bị lỗi corrupt file khi mở trên MS Word
 */
export const normalizeScientificText = (input: string): string => {
  if (!input) return "";

  // 1. Loại bỏ toàn bộ ký tự điều khiển ASCII < 0x20 ngoại trừ \t, \n, \r
  let text = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Chuyển đổi các toán tử và ký hiệu LaTeX phổ biến sang Unicode chuẩn tiếng Việt
  text = text
    .replace(/\\(?:leq|le)\b/g, "≤")
    .replace(/\\(?:geq|ge)\b/g, "≥")
    .replace(/\\(?:neq|ne)\b/g, "≠")
    .replace(/\\pm\b/g, "±")
    .replace(/\\times\b/g, "×")
    .replace(/\\div\b/g, "÷")
    .replace(/\\approx\b/g, "≈")
    .replace(/\\cdot\b/g, "·")
    .replace(/\\circ\b/g, "°")
    .replace(/\\degree\b/g, "°")
    .replace(/\\Delta\b/g, "Δ")
    .replace(/\\pi\b/g, "π")
    .replace(/\\alpha\b/g, "α")
    .replace(/\\beta\b/g, "β")
    .replace(/\\gamma\b/g, "γ")
    .replace(/\\lambda\b/g, "λ")
    .replace(/\\mu\b/g, "μ")
    .replace(/\\omega\b/g, "ω")
    .replace(/\\Omega\b/g, "Ω")
    .replace(/\\(?:to|rightarrow)\b/g, "→")
    .replace(/\\leftarrow\b/g, "←")
    .replace(/\\Rightarrow\b/g, "⇒")
    .replace(/\\Leftrightarrow\b/g, "⇔")
    .replace(/\\in\b/g, "∈")
    .replace(/\\notin\b/g, "∉")
    .replace(/\\subset\b/g, "⊂")
    .replace(/\\cup\b/g, "∪")
    .replace(/\\cap\b/g, "∩")
    .replace(/\\infty\b/g, "∞")
    .replace(/\\forall\b/g, "∀")
    .replace(/\\exists\b/g, "∃");

  // 3. Chuẩn hóa phân số \frac{a}{b} -> (a/b)
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1/$2)");

  // 4. Chuẩn hóa căn bậc hai \sqrt{x} -> √(x)
  text = text.replace(/\\sqrt\{([^}]+)\}/g, "√($1)");

  // 5. Loại bỏ các bao đóng LaTeX văn bản
  text = text
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathbf\{([^}]+)\}/g, "$1")
    .replace(/\\mathit\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\left/g, "")
    .replace(/\\right/g, "");

  return text;
};

// Math text-run parsing helper for subscript and superscript (e.g., ^2, _n)
const createTextRunsFromMath = (
  text: string, 
  isItalic: boolean, 
  defaultSize: number = 26, 
  isBold: boolean = false
): TextRun[] => {
  const runs: TextRun[] = [];
  let currentText = "";
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '^') {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, font: "Times New Roman", size: defaultSize, italics: isItalic, bold: isBold }));
        currentText = "";
      }
      i++;
      if (i < text.length) {
        let superContent = "";
        if (text[i] === '{') {
          i++;
          while (i < text.length && text[i] !== '}') {
            superContent += text[i];
            i++;
          }
        } else {
          superContent = text[i];
        }
        if (superContent) {
          runs.push(new TextRun({ text: superContent, font: "Times New Roman", size: defaultSize, italics: isItalic, bold: isBold, superScript: true }));
        }
      }
    } else if (text[i] === '_') {
      if (currentText) {
        runs.push(new TextRun({ text: currentText, font: "Times New Roman", size: defaultSize, italics: isItalic, bold: isBold }));
        currentText = "";
      }
      i++;
      if (i < text.length) {
        let subContent = "";
        if (text[i] === '{') {
          i++;
          while (i < text.length && text[i] !== '}') {
            subContent += text[i];
            i++;
          }
        } else {
          subContent = text[i];
        }
        if (subContent) {
          runs.push(new TextRun({ text: subContent, font: "Times New Roman", size: defaultSize, italics: isItalic, bold: isBold, subScript: true }));
        }
      }
    } else {
      currentText += text[i];
    }
  }
  
  if (currentText) {
    runs.push(new TextRun({ text: currentText, font: "Times New Roman", size: defaultSize, italics: isItalic, bold: isBold }));
  }
  
  return runs;
};

// Parser of combined Markdown formatting & inline LaTeX wrappers
export const parseFormattedText = (
  text: string, 
  defaultSize: number = 26, // 13pt chuẩn GDPT 2018
  forceBold: boolean = false
): TextRun[] => {
  let processed = normalizeScientificText(text);
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
  
  interface Token {
    text: string;
    bold?: boolean;
    italic?: boolean;
    isMath?: boolean;
  }
  
  let tokens: Token[] = [{ text: processed }];
  
  // 1. Process LaTeX inline: \(...\) -> italics math
  tokens = tokens.flatMap(tok => {
    if (tok.bold || tok.italic) return [tok];
    const parts = tok.text.split(/\\\(([\s\S]*?)\\\)/g);
    return parts.map((str, idx) => {
      if (idx % 2 === 1) return { text: str, italic: true, isMath: true };
      return { text: str };
    });
  });

  // 2. Process Bold: **...**
  tokens = tokens.flatMap(tok => {
    if (tok.bold || tok.italic) return [tok];
    const parts = tok.text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((str, idx) => {
      if (idx % 2 === 1) return { text: str, bold: true };
      return { text: str };
    });
  });

  // 3. Process Bold alternative: __...__
  tokens = tokens.flatMap(tok => {
    if (tok.bold || tok.italic) return [tok];
    const parts = tok.text.split(/__([\s\S]*?)__/g);
    return parts.map((str, idx) => {
      if (idx % 2 === 1) return { text: str, bold: true };
      return { text: str };
    });
  });

  // 4. Process Italic: *...*
  tokens = tokens.flatMap(tok => {
    if (tok.bold || tok.italic) return [tok];
    const parts = tok.text.split(/\*([^\*\s][^\*]*?[^\*\s]|[^\*\s])\*/g);
    return parts.map((str, idx) => {
      if (idx % 2 === 1) return { text: str, italic: true };
      return { text: str };
    });
  });

  const runs: TextRun[] = [];
  tokens.forEach(tok => {
    if (!tok.text) return;
    const isBold = forceBold || !!tok.bold;
    const isItalic = !!tok.italic;
    const cleanTokText = tok.text;

    if (tok.isMath || cleanTokText.includes('^') || cleanTokText.includes('_')) {
      runs.push(...createTextRunsFromMath(cleanTokText, isItalic, defaultSize, isBold));
    } else {
      runs.push(new TextRun({
        text: cleanTokText,
        font: "Times New Roman",
        size: defaultSize,
        bold: isBold,
        italics: isItalic,
      }));
    }
  });

  return runs;
};

const isTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
};

const isTableDivider = (line: string): boolean => {
  const trimmed = line.trim();
  return /^\|[\s\-:|]+\|$/.test(trimmed);
};

// Create a robust docx Table conforming to Vietnamese pedagogical styling
const createDocxTable = (tableLines: string[]): Table | null => {
  const validLines = tableLines.filter(l => !isTableDivider(l) && l.trim().length > 0);
  if (validLines.length === 0) return null;

  const parsedRows = validLines.map(line => {
    const trimmed = line.trim();
    const rawCells = (trimmed.startsWith('|') && trimmed.endsWith('|'))
      ? trimmed.slice(1, -1).split('|')
      : trimmed.split('|');
    return rawCells.map(c => c.trim());
  });

  const maxCols = Math.max(...parsedRows.map(r => r.length), 1);
  const rows: TableRow[] = [];

  parsedRows.forEach((cells, rowIndex) => {
    const isHeader = rowIndex === 0;
    while (cells.length < maxCols) {
      cells.push('');
    }

    const tableCells = cells.map(cellText => {
      const runs = parseFormattedText(cellText, 22, isHeader); // 11pt cho bảng biểu
      return new TableCell({
        children: [
          new Paragraph({
            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { before: 80, after: 80, line: 240 },
            children: runs.length > 0 ? runs : [new TextRun({ text: "", font: "Times New Roman", size: 22 })],
          }),
        ],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        },
      });
    });

    rows.push(new TableRow({ children: tableCells }));
  });

  if (rows.length === 0) return null;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
};

// Parse multiple choices on a single line (e.g. A. ... B. ... C. ... D. ...)
const parseMultipleChoices = (line: string): { label: string; text: string }[] | null => {
  const regex = /(?:^|\s{2,}|\t|\s+)(?:\*\*|\*)?([A-D])[\.\)](?:\*\*|\*)?\s+/g;
  const matches = [...line.matchAll(regex)];
  if (matches.length < 2) return null;

  const results: { label: string; text: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1] + ".";
    const startPos = matches[i].index! + matches[i][0].length;
    const endPos = (i + 1 < matches.length) ? matches[i + 1].index! : line.length;
    let choiceText = line.substring(startPos, endPos).trim();
    if (choiceText.endsWith("**")) choiceText = choiceText.slice(0, -2).trim();
    else if (choiceText.endsWith("*")) choiceText = choiceText.slice(0, -1).trim();
    results.push({ label, text: choiceText });
  }
  return results;
};

// Convert markdown string to docx Children with full Vietnamese exam typography
export const convertMarkdownToDocxChildren = (sourceText: string): any[] => {
  const docxChildren: any[] = [];
  const lines = sourceText.split("\n");
  let tableBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // 1. Xử lý khối hình ảnh Base64 [FIGURE type="cropped_img"]...[/FIGURE]
    if (line.includes('[FIGURE type="cropped_img"]') || line.startsWith('[FIGURE')) {
      let figContent = "";
      if (line.includes('[/FIGURE]')) {
        figContent = line.replace(/\[FIGURE[^\]]*\]/i, '').replace(/\[\/FIGURE\]/i, '').trim();
      } else {
        i++;
        while (i < lines.length && !lines[i].includes('[/FIGURE]')) {
          figContent += lines[i].trim();
          i++;
        }
      }

      const base64Clean = figContent.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();
      if (base64Clean) {
        try {
          const buf = Buffer.from(base64Clean, 'base64');
          const uint8 = new Uint8Array(buf);
          const imgType = (figContent.includes('data:image/jpeg') || figContent.includes('data:image/jpg')) ? 'jpg' : 'png';
          docxChildren.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 140, after: 140 },
              children: [
                new ImageRun({
                  type: imgType,
                  data: uint8,
                  transformation: { width: 380, height: 220 },
                }),
              ],
            })
          );
          continue;
        } catch (e) {
          console.warn("Không thể giải mã hình ảnh Base64 cho Word:", e);
        }
      }
      continue;
    }

    // 2. Xử lý khối [FIGURE type="svg"]...[/FIGURE] (tránh đổ mã SVG thô vào Word)
    if (line.includes('[FIGURE type="svg"]')) {
      if (!line.includes('[/FIGURE]')) {
        while (i < lines.length && !lines[i].includes('[/FIGURE]')) {
          i++;
        }
      }
      docxChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({
              text: "*(Hình vẽ minh họa đề thi)*",
              font: "Times New Roman",
              size: 22,
              italics: true,
              color: "555555",
            }),
          ],
        })
      );
      continue;
    }

    // 3. Xử lý bảng dữ liệu Markdown
    if (isTableRow(line)) {
      tableBuffer.push(line);
      continue;
    } else if (tableBuffer.length > 0) {
      const docxTable = createDocxTable(tableBuffer);
      if (docxTable) {
        docxChildren.push(docxTable);
        docxChildren.push(
          new Paragraph({
            spacing: { before: 60, after: 60, line: 240 },
            children: [new TextRun({ text: "", font: "Times New Roman" })],
          })
        );
      }
      tableBuffer = [];
    }

    // 4. Dòng trống
    if (line === "") {
      docxChildren.push(
        new Paragraph({
          spacing: { before: 40, after: 40, line: 240 },
          children: [new TextRun({ text: "", font: "Times New Roman" })],
        })
      );
      continue;
    }

    // 5. Đường phân trang ---
    if (line === "---") {
      docxChildren.push(new Paragraph({ children: [new PageBreak()] }));
      continue;
    }

    // 6. Tiêu đề Markdown (# hoặc ## hoặc ###)
    if (line.startsWith("#")) {
      const headingText = line.replace(/#+/g, "").trim();
      const level = (line.match(/^#+/) || [""])[0].length;
      docxChildren.push(
        new Paragraph({
          alignment: level <= 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: 200, after: 100, line: 288 },
          children: parseFormattedText(headingText, level <= 2 ? 28 : 26, true), // 14pt hoặc 13pt đậm
        })
      );
      continue;
    }

    // 7. Chuẩn hóa tiền tố gạch đầu dòng
    let cleanText = line;
    while (
      cleanText.startsWith("- ") || 
      cleanText.startsWith("* ") || 
      cleanText.startsWith("+ ") || 
      cleanText.startsWith("• ") ||
      cleanText.startsWith("– ") ||
      cleanText.startsWith("— ")
    ) {
      cleanText = cleanText.substring(2).trim();
    }

    // 8. Định dạng Câu hỏi: **Câu 1:** hoặc Câu 1: hoặc Câu 1.
    const cleanForMatching = cleanText.replace(/^(\*\*|\*|__|_)/, '').trim();
    const questionMatch = cleanForMatching.match(/^(Câu\s+\d+[:.]?)(.*)$/i) || cleanForMatching.match(/^(Câu\s+\d+\s*\()(.*)$/i);
    if (questionMatch) {
      const label = questionMatch[1];
      let remainder = questionMatch[2].trim();
      
      if (remainder.startsWith("**")) remainder = remainder.substring(2).trim();
      else if (remainder.startsWith("*")) remainder = remainder.substring(1).trim();
      if (remainder.endsWith("**")) remainder = remainder.slice(0, -2).trim();
      else if (remainder.endsWith("*")) remainder = remainder.slice(0, -1).trim();

      docxChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 140, after: 60, line: 288 },
          children: [
            new TextRun({
              text: label + " ",
              font: "Times New Roman",
              size: 26, // 13pt
              bold: true,
            }),
            ...parseFormattedText(remainder, 26)
          ],
        })
      );
      continue;
    }

    // 9. Bốn đáp án trên 1 dòng: A. ... B. ... C. ... D. ...
    const inlineChoices = parseMultipleChoices(cleanText);
    if (inlineChoices && inlineChoices.length > 1) {
      const runs: TextRun[] = [];
      inlineChoices.forEach((ch, idx) => {
        runs.push(
          new TextRun({
            text: (idx > 0 ? "        " : "") + ch.label + " ",
            font: "Times New Roman",
            size: 26, // 13pt
            bold: true,
          })
        );
        runs.push(...parseFormattedText(ch.text, 26));
      });
      docxChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 50, after: 50, line: 288 },
          indent: { left: 360 }, // Thụt dòng 0.63cm chuẩn đề thi
          children: runs,
        })
      );
      continue;
    }

    // 10. Từng đáp án trắc nghiệm riêng dòng (A. / B. / C. / D.)
    const cleanChoiceText = cleanText.replace(/^(\*\*|\*|__|_)/, '').trim();
    const singleChoiceMatch = cleanChoiceText.match(/^([A-D]\.)(.*)$/);
    if (singleChoiceMatch) {
      const label = singleChoiceMatch[1];
      let value = singleChoiceMatch[2].trim();
      if (value.startsWith("**")) value = value.substring(2).trim();
      else if (value.startsWith("*")) value = value.substring(1).trim();
      if (value.endsWith("**")) value = value.slice(0, -2).trim();
      else if (value.endsWith("*")) value = value.slice(0, -1).trim();

      docxChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 40, after: 40, line: 288 },
          indent: { left: 360 }, // Thụt dòng 0.63cm
          children: [
            new TextRun({ text: label + " ", font: "Times New Roman", size: 26, bold: true }),
            ...parseFormattedText(value, 26)
          ],
        })
      );
      continue;
    }

    // 11. Ý trắc nghiệm Đúng - Sai (a) / b) / c) / d))
    const subChoiceMatch = cleanText.match(/^([a-d]\))\s*(.*)$/);
    if (subChoiceMatch) {
      const label = subChoiceMatch[1];
      let value = subChoiceMatch[2].trim();
      if (value.startsWith("**")) value = value.substring(2).trim();
      else if (value.startsWith("*")) value = value.substring(1).trim();
      if (value.endsWith("**")) value = value.slice(0, -2).trim();
      else if (value.endsWith("*")) value = value.slice(0, -1).trim();

      docxChildren.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 40, after: 40, line: 288 },
          indent: { left: 360 },
          children: [
            new TextRun({ text: label + " ", font: "Times New Roman", size: 26, bold: true }),
            ...parseFormattedText(value, 26)
          ],
        })
      );
      continue;
    }

    // 12. Đoạn văn bản thường
    docxChildren.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 60, after: 60, line: 288 },
        children: parseFormattedText(cleanText, 26),
      })
    );
  }

  // Đóng bảng còn tồn đọng ở cuối tệp
  if (tableBuffer.length > 0) {
    const docxTable = createDocxTable(tableBuffer);
    if (docxTable) {
      docxChildren.push(docxTable);
    }
  }

  return docxChildren;
};

/**
 * Tải văn bản đề thi dưới dạng tệp Microsoft Word (.docx) chuẩn thể thức Bộ GD&ĐT
 * Thể thức theo Nghị định 30/2020/NĐ-CP:
 * - Font: Times New Roman
 * - Cỡ chữ: 13pt - 14pt
 * - Khổ giấy: A4
 * - Lề trang: Trên 20mm, Dưới 20mm, Trái 30mm (đóng gáy), Phải 20mm
 * - Đánh số trang: Trang X / Y
 */
export const downloadTextAsDocx = async (text: string, filename: string = "De_Kiem_Tra.docx") => {
  if (!text || !text.trim()) {
    alert("Không có nội dung đề thi để xuất tệp Word.");
    return;
  }
  try {
    const docxChildren = convertMarkdownToDocxChildren(text);
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { 
                top: 1134,    // 20mm
                bottom: 1134, // 20mm
                left: 1701,   // 30mm (chuẩn đóng gáy đề thi)
                right: 1134   // 20mm
              },
            },
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "Trang ",
                      font: "Times New Roman",
                      size: 20, // 10pt
                      color: "555555",
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      font: "Times New Roman",
                      size: 20,
                      bold: true,
                      color: "333333",
                    }),
                    new TextRun({
                      text: " / ",
                      font: "Times New Roman",
                      size: 20,
                      color: "555555",
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      font: "Times New Roman",
                      size: 20,
                      color: "555555",
                    }),
                  ],
                }),
              ],
            }),
          },
          children: docxChildren,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = filename.replace(/[/\\?%*:|"<>]/g, '_');
    link.download = safeName.endsWith(".docx") ? safeName : `${safeName}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error("Lỗi xuất tệp Word:", err);
    alert("Không thể tạo tệp Word (.docx): " + (err.message || err));
  }
};

/**
 * Tải trọn gói đề thi (Đề gốc + 4 Mã đề hoán đổi + Ma trận bản đặc tả)
 */
export const downloadPackageAsDocx = async (pkg: SavedExamPackage) => {
  const sections: string[] = [];

  if (pkg.resultStep3) {
    sections.push(`# ĐỀ KIỂM TRA ĐỊNH KÌ GỐC\n${pkg.title}\n\n${pkg.resultStep3}`);
  }

  if (pkg.resultStep5) {
    sections.push(`---\n# CÁC MÃ ĐỀ HOÁN ĐỔI TƯƠNG ĐƯƠNG (101 - 104)\n\n${pkg.resultStep5}`);
  }

  if (pkg.resultStep2) {
    sections.push(`---\n# MA TRẬN & BẢN ĐẶC TẢ ĐỀ THI (CHUẨN văn bản quy định)\n\n${pkg.resultStep2}`);
  }

  const combined = sections.join('\n\n');
  const safeTitle = (pkg.title || 'Bo_De_Thi').replace(/[/\\?%*:|"<>]/g, '_');
  await downloadTextAsDocx(combined, `${safeTitle}_Tron_Goi.docx`);
};

/**
 * In ấn đề thi chuẩn khổ giấy A4
 */
export const printExamText = (title: string, text: string) => {
  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: A4 portrait; margin: 20mm 15mm 20mm 25mm; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      line-height: 1.45;
      color: #000;
      background: #fff;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1, h2, h3 { text-align: center; margin: 12px 0; }
    h1 { font-size: 16pt; font-weight: bold; text-transform: uppercase; }
    h2 { font-size: 14pt; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    th, td { border: 1px solid #000; padding: 6px 10px; font-size: 12pt; }
    th { background: #f2f2f2; text-align: center; }
    .choice-row { margin: 6px 0 6px 18px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; padding: 12px; background: #e0f2fe; border: 1px solid #0284c7; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <strong>Bản in ấn tiêu chuẩn A4 - ${title}</strong>
    <button onclick="window.print()" style="padding: 8px 18px; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
      In ngay (Ctrl + P)
    </button>
  </div>
  <div style="white-space: pre-wrap; font-family: 'Times New Roman', serif;">
    ${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </div>
  <script>
    setTimeout(() => { window.print(); }, 500);
  </script>
</body>
</html>`;

  let printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Invisible iframe fallback
    const oldFrame = document.getElementById('exam-print-frame') as HTMLIFrameElement;
    if (oldFrame) oldFrame.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'exam-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    printWindow = iframe.contentWindow;
  }

  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};
