
/**
 * exportUtils.ts - Senior Export Upgrade
 */
export const exportToWord = (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Tạo một bản sao sạch để xử lý
  const clone = element.cloneNode(true) as HTMLElement;

  // 1. Chuyển đổi toàn bộ các thẻ input, select thành text thực tế để Word hiển thị chuẩn
  const origInputs = element.querySelectorAll('input, select, textarea');
  const cloneInputs = clone.querySelectorAll('input, select, textarea');
  origInputs.forEach((orig, idx) => {
    const cl = cloneInputs[idx];
    if (!cl) return;
    const span = document.createElement('span');
    span.style.fontFamily = "'Times New Roman', serif";
    span.style.fontWeight = "bold";
    if (orig instanceof HTMLInputElement || orig instanceof HTMLTextAreaElement) {
      span.textContent = orig.value || '0';
    } else if (orig instanceof HTMLSelectElement) {
      span.textContent = orig.options[orig.selectedIndex]?.text || orig.value || '';
    }
    cl.parentNode?.replaceChild(span, cl);
  });

  // 2. Xóa các nút bấm hoặc thành phần không in ấn (no-print, buttons)
  clone.querySelectorAll('.no-print, button').forEach(el => el.remove());

  // 3. Xử lý các khối KaTeX
  const katexMathML = clone.querySelectorAll('.katex-mathml');
  katexMathML.forEach(el => el.remove());

  const content = clone.innerHTML;
  
  // Header HTML theo quy chuẩn văn bản hành chính sư phạm Việt Nam
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${filename}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page { 
          size: 21.0cm 29.7cm; 
          margin: 2.0cm 2.0cm 2.0cm 3.0cm; /* Chuẩn Nghị định 30/2020/NĐ-CP: Trái 3cm, Trên-Dưới-Phải 2cm */
        }
        body { 
          font-family: 'Times New Roman', Times, serif; 
          font-size: 13pt; 
          line-height: 1.35; 
          color: #000000; 
          background-color: #ffffff;
        }
        table { 
          border-collapse: collapse; 
          width: 100%; 
          border: 1pt solid #000000; 
          margin: 12pt 0; 
        }
        th, td { 
          border: 1pt solid #000000; 
          padding: 6pt 8pt; 
          font-family: 'Times New Roman', Times, serif; 
          font-size: 11pt; 
          text-align: left; 
          vertical-align: middle; 
        }
        th { 
          background-color: #f2f2f2; 
          font-weight: bold; 
          text-align: center; 
        }
        h1, h2, h3 { 
          font-family: 'Times New Roman', Times, serif; 
          text-align: center; 
          font-weight: bold; 
          margin: 10pt 0; 
        }
        h1 { font-size: 16pt; text-transform: uppercase; }
        h2 { font-size: 14pt; }
        .font-bold { font-weight: bold; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .question-block { margin-bottom: 16pt; page-break-inside: avoid; }
        .figure-container { text-align: center; margin: 12pt 0; }
        .katex { font-family: 'Times New Roman', serif; }
      </style>
    </head>
    <body>
  `;
  const footer = "</body></html>";
  const sourceHTML = header + content + footer;

  const blob = new Blob(['\ufeff', sourceHTML], {
    type: 'application/msword;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeFilename = filename.replace(/[/\\?%*:|"<>]/g, '_');
  link.download = safeFilename.endsWith('.doc') ? safeFilename : `${safeFilename}.doc`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Chuyển đổi sang Markdown cho Pandoc
 */
export const getPandocMarkdown = (questions: any[]) => {
  return questions.map((q, idx) => {
    let md = `**Câu ${idx + 1}:** ${q.noiDung}\n\n`;
    
    // Convert markers chuẩn Pandoc: \( \) -> $ và \[ \] -> $$
    md = md.replace(/\\\[/g, '$$$$').replace(/\\\]/g, '$$$$');
    md = md.replace(/\\\(/g, '$').replace(/\\\)/g, '$');
    
    // Xóa marker figure trong MD vì Pandoc xử lý SVG theo cách khác
    md = md.replace(/\[FIGURE type="svg"\][\s\S]*?\[\/FIGURE\]/g, '\n*(Hình minh họa)*\n');
    
    if (q.luaChon && Object.keys(q.luaChon).length > 0) {
      Object.entries(q.luaChon).forEach(([k, v]) => {
        md += `- **${k}.** ${v}\n`;
      });
    }
    return md;
  }).join('\n\n---\n\n');
};
