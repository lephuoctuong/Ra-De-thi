import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Copy, 
  Check, 
  Download, 
  FileCode, 
  Sparkles, 
  HelpCircle,
  FolderLock,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Eye,
  RefreshCw,
  Edit3,
  AlertCircle,
  Clock,
  Archive,
  FolderArchive,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import ContentRenderer from '../components/ContentRenderer';
import { saveExamToVault, inferExamMetadata } from '../utils/examStorage';
import { downloadTextAsDocx } from '../utils/docxExporter';
import { SavedExamPackage } from '../types';

// Robust multiple choices parser on a single line (avoids truncating letters A-D)
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

// Check if a line is a markdown table row
const isTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
};

// Check if a line is a table divider like |---|---|
const isTableDivider = (line: string): boolean => {
  const trimmed = line.trim();
  return /^\|[\s\-:|]+\|$/.test(trimmed);
};

// Convert markdown to clean, styled HTML for print and download
const convertMarkdownToExamHtml = (text: string): string => {
  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const validLines = tableRows.filter(l => !isTableDivider(l));
    let htmlTable = '<table style="width:100%; border-collapse:collapse; margin:14px 0; font-size:12pt;">\n';
    validLines.forEach((line, idx) => {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      htmlTable += '  <tr>\n';
      cells.forEach(cell => {
        if (idx === 0) {
          htmlTable += `    <th style="border:1px solid #000; padding:6px 10px; background:#f2f2f2; text-align:center; font-weight:bold;">${cell}</th>\n`;
        } else {
          htmlTable += `    <td style="border:1px solid #000; padding:6px 10px; text-align:left;">${cell}</td>\n`;
        }
      });
      htmlTable += '  </tr>\n';
    });
    htmlTable += '</table>\n';
    result.push(htmlTable);
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isTableRow(trimmed)) {
      inTable = true;
      tableRows.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
      inTable = false;
    }

    if (trimmed === '') {
      result.push('<div style="height: 8px;"></div>');
      continue;
    }

    if (trimmed === '---') {
      result.push('<div class="page-break" style="page-break-before: always; margin: 24px 0;"></div>');
      continue;
    }

    if (trimmed.startsWith('#')) {
      const headingText = trimmed.replace(/#+/g, '').trim();
      const level = (trimmed.match(/^#+/) || [''])[0].length;
      if (level <= 2) {
        result.push(`<h2 style="text-align:center; font-size:14pt; font-weight:bold; margin:16px 0 10px 0; text-transform:uppercase;">${headingText}</h2>`);
      } else {
        result.push(`<h3 style="font-size:13pt; font-weight:bold; margin:12px 0 6px 0;">${headingText}</h3>`);
      }
      continue;
    }

    if (trimmed.match(/^(Câu\s+\d+[:.]?)/i) || trimmed.match(/^(Câu\s+\d+\s*\()/i)) {
      result.push(`<div class="question" style="font-weight:bold; margin: 12px 0 6px 0;">${trimmed}</div>`);
      continue;
    }

    const choices = parseMultipleChoices(trimmed);
    if (choices && choices.length > 1) {
      const choiceItems = choices.map(c => `<div style="display:inline-block; margin-right: 28px; margin-bottom: 6px;"><strong>${c.label}</strong> ${c.text}</div>`).join('');
      result.push(`<div class="choices-row" style="margin: 6px 0 8px 16px;">${choiceItems}</div>`);
      continue;
    }

    if (trimmed.match(/^[A-D]\./)) {
      result.push(`<div class="choice-item" style="margin-left: 20px; margin-bottom: 4px;"><strong>${trimmed.substring(0, 2)}</strong>${trimmed.substring(2)}</div>`);
      continue;
    }

    if (trimmed.match(/^[a-d]\)/)) {
      result.push(`<div class="sub-choice-item" style="margin-left: 24px; margin-bottom: 4px;"><strong>${trimmed.substring(0, 2)}</strong>${trimmed.substring(2)}</div>`);
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      result.push(`<div style="margin-left: 20px; margin-bottom: 4px;">&bull; ${trimmed.substring(2)}</div>`);
      continue;
    }

    result.push(`<p style="margin-bottom: 6px; line-height: 1.5;">${trimmed}</p>`);
  }

  if (inTable) {
    flushTable();
  }

  return result.join('\n');
};

interface Step4ExportProps {
  resultUi: string; // From Step 3 original exam
  setResultUi?: (val: string) => void;
  lesson?: string;
  regulationSource?: string;
  sampleExam?: string;
  matrix?: string;
  step1Result?: string;
  step2Result?: string;
  step5Result?: string;
  examDuration?: number;
  subject?: string;
  grade?: string;
  onNext: () => void;
  onPrev: () => void;
  onNavigateToVault?: () => void;
}

const Step4Export: React.FC<Step4ExportProps> = ({
  resultUi,
  setResultUi,
  lesson = '',
  regulationSource = '',
  sampleExam = '',
  matrix = '',
  step1Result = '',
  step2Result = '',
  step5Result = '',
  examDuration = 45,
  subject,
  grade,
  onNext,
  onPrev,
  onNavigateToVault
}) => {
  // Synchronized state between Step 3 and Step 4
  const [content, setContent] = useState<string>(() => {
    return resultUi || localStorage.getItem('qbank_result_step3') || '';
  });
  const [syncNotice, setSyncNotice] = useState<string>('');
  const [isSyncingVault, setIsSyncingVault] = useState<boolean>(false);
  const [syncVaultToast, setSyncVaultToast] = useState<string | null>(null);

  // Keep in sync whenever resultUi prop changes from Step 3
  useEffect(() => {
    if (resultUi) {
      setContent(resultUi);
    } else {
      const stored = localStorage.getItem('qbank_result_step3');
      if (stored) {
        setContent(stored);
        if (setResultUi) setResultUi(stored);
      }
    }
  }, [resultUi, setResultUi]);

  // Handle direct edits in Step 4 with 2-way sync to Step 3 and localStorage
  const handleContentChange = (newVal: string) => {
    setContent(newVal);
    localStorage.setItem('qbank_result_step3', newVal);
    if (setResultUi) {
      setResultUi(newVal);
    }
  };

  // Manual reload / sync from Step 3
  const handleManualSync = () => {
    const stored = localStorage.getItem('qbank_result_step3') || resultUi || '';
    setContent(stored);
    if (setResultUi) setResultUi(stored);
    setSyncNotice('Đã đồng bộ đầy đủ dữ liệu mới nhất từ Mục 3!');
    setTimeout(() => setSyncNotice(''), 3000);
  };

  // Đồng bộ đề thi hoàn thiện từ Bước 4 sang Mục 6 (Kho đề thi)
  const handleSyncToVault = async (andNavigate: boolean = false) => {
    if (!content.trim()) {
      alert('Chưa có nội dung đề kiểm tra để đồng bộ vào Kho đề thi.');
      return;
    }
    setIsSyncingVault(true);
    try {
      const effectiveDuration = Number(examDuration) || 45;
      const meta = inferExamMetadata({
        resultStep3: content,
        resultStep2: step2Result,
        sampleExam,
        lesson,
        resultStep1: step1Result,
        subject,
        grade,
        durationMinutes: effectiveDuration
      });

      const effectiveStep5 = step5Result || localStorage.getItem('qbank_result_step5') || '';

      const newPackage: SavedExamPackage = {
        id: 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: meta.title || 'Đề kiểm tra định kì (Hoàn thiện Bước 4)',
        subject: subject || meta.subject || 'Chung',
        grade: grade || meta.grade || '',
        semester: meta.semester || 'Định kì',
        schoolYear: meta.schoolYear || '2024 - 2025',
        durationMinutes: effectiveDuration,
        lesson: lesson || localStorage.getItem('qbank_lesson') || '',
        regulationSource: regulationSource || localStorage.getItem('qbank_regulation_source') || '',
        sampleExam: sampleExam || localStorage.getItem('qbank_sample_exam') || '',
        matrix: matrix || localStorage.getItem('qbank_matrix') || '',
        resultStep1: step1Result || localStorage.getItem('qbank_result_step1') || '',
        resultStep2: step2Result || localStorage.getItem('qbank_result_step2') || '',
        resultStep3: content,
        resultStep5: effectiveStep5,
        notes: `Đồng bộ từ Bước 4 (Xuất bản đề thi) lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveExamToVault(newPackage);
      setSyncVaultToast(`Đã đồng bộ thành công đề thi "${newPackage.title}" vào Mục 6 (Kho đề thi)!`);
      setTimeout(() => setSyncVaultToast(null), 4000);

      if (andNavigate && onNavigateToVault) {
        setTimeout(() => {
          onNavigateToVault();
        }, 500);
      }
    } catch (err) {
      console.error('Lỗi khi đồng bộ sang Kho đề thi:', err);
      alert('Không thể lưu vào Kho đề thi. Vui lòng thử lại.');
    } finally {
      setIsSyncingVault(false);
    }
  };

  const [copiedDoc, setCopiedDoc] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'editor' | 'html_source' | 'cropper'>('preview');

  // Advanced AI Image Cropper & Digitizer States
  const [uploadedImgSrc, setUploadedImgSrc] = useState<string | null>(null);
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [detectedBoxes, setDetectedBoxes] = useState<{ coord: number[]; coordNorm?: number[]; label: string }[]>([]);
  const [cropEditContent, setCropEditContent] = useState<string>("");
  const [copiedCrop, setCopiedCrop] = useState(false);

  const handleDownloadDocx = async () => {
    const sourceText = content || resultUi || localStorage.getItem('qbank_result_step3') || '';
    if (!sourceText.trim()) {
      alert("Chưa có dữ liệu Đề kiểm tra từ Mục 3 để xuất file Word. Vui lòng quay lại Mục 3 tạo đề hoặc dán nội dung vào tab Chỉnh sửa!");
      return;
    }

    try {
      const safeSubject = (subject || 'Kiem_Tra').replace(/[/\\?%*:|"<>]/g, '_');
      const safeGrade = grade ? `_Lop_${grade}` : '';
      await downloadTextAsDocx(sourceText, `De_${safeSubject}${safeGrade}_Chuan_Bo_GDDT.docx`);
    } catch (err: any) {
      console.error("Lỗi xuất tệp DOCX:", err);
      alert("Gặp lỗi khi tạo tệp Word (.docx): " + (err.message || err));
    }
  };

  // Chuyển kết quả sang cấu trúc HTML hoàn chỉnh sử dụng CSS chuẩn A4
  const buildExamHtml = () => {
    const sourceText = content || resultUi || localStorage.getItem('qbank_result_step3') || '';
    const bodyHtml = convertMarkdownToExamHtml(sourceText);

    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ĐỀ KIỂM TRA ĐỊNH KÌ KHỚP FORM CHUẨN</title>
<style> 
  @page { size: A4 portrait; margin: 2cm 1.5cm 2cm 2.5cm; } 
  body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.45; color: #000; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
  h1, h2, h3 { text-align: center; margin: 12px 0; font-family: "Times New Roman", Times, serif; } 
  h1 { font-size: 16pt; text-transform: uppercase; font-weight: bold; }
  h2 { font-size: 14pt; margin-top: 24px; text-transform: uppercase; font-weight: bold; } 
  h3 { font-size: 13pt; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; table-layout: fixed; } 
  th, td { border: 1px solid #000; padding: 6px; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; font-family: "Times New Roman", Times, serif; } 
  th { text-align: center; font-weight: bold; background: #f2f2f2; } 
  .center { text-align: center; } 
  .right { text-align: right; } 
  .bold { font-weight: bold; } 
  .question { margin-top: 12px; margin-bottom: 8px; font-weight: bold; } 
  .choices-row { margin: 6px 0 8px 16px; }
  .choice-item { margin-bottom: 4px; margin-left: 20px; }
  .sub-choice-item { margin-bottom: 4px; margin-left: 24px; }
  .page-break { page-break-before: always; } 
</style>
</head>
<body>

<div class="content">
${bodyHtml}
</div>

</body>
</html>`;
    return fullHtml;
  };

  const handleDownloadHtml = () => {
    const sourceText = content || resultUi || localStorage.getItem('qbank_result_step3') || '';
    if (!sourceText.trim()) {
      alert("Chưa có dữ liệu Đề kiểm tra từ Mục 3 để xuất file HTML.");
      return;
    }
    const htmlContent = buildExamHtml();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `De_Kiem_Tra_Dinh_Ki_HTML_In_An.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyGoogleDoc = () => {
    const sourceText = content || resultUi || localStorage.getItem('qbank_result_step3') || '';
    if (!sourceText.trim()) {
      alert("Chưa có dữ liệu Đề kiểm tra từ Mục 3 để sao chép.");
      return;
    }
    navigator.clipboard.writeText(sourceText);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleCopyHtmlSource = () => {
    navigator.clipboard.writeText(buildExamHtml());
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const handlePrint = () => {
    const sourceText = content || resultUi || localStorage.getItem('qbank_result_step3') || '';
    if (!sourceText.trim()) {
      alert("Chưa có dữ liệu Đề kiểm tra từ Mục 3 để in ấn.");
      return;
    }
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(buildExamHtml());
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const handleCropUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingCrop(true);
    setCropError(null);
    setUploadedImgSrc(null);
    setDetectedBoxes([]);
    setCropEditContent("");

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Content = reader.result as string;
      const rawBase64 = base64Content.split(',')[1];
      const mime = file.type;

      try {
        const res = await fetch("/api/detect-figures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: rawBase64, mimeType: mime }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gặp lỗi khi gửi tệp đến hệ thống phân tích AI.");
        }

        const data = await res.json();
        const { figures, transcribed_text } = data;

        const img = new Image();
        img.src = base64Content;
        img.onload = () => {
          const width = img.width;
          const height = img.height;

          // Tính toán khoảng 1mm pixel dựa trên chuẩn A4 của Bộ GD (210mm x 297mm)
          const padWidthPx = Math.max(4, Math.round(width / 210)); 
          const padHeightPx = Math.max(4, Math.round(height / 297));

          let updatedText = transcribed_text;
          const boxesToSave: any[] = [];

          figures.forEach((fig: any, index: number) => {
            const [yminNorm, xminNorm, ymaxNorm, xmaxNorm] = fig.box_2d;

            // Bất đối xứng tọa độ normalized [0, 1000] sang pixels
            let ymin = Math.round((yminNorm / 1000) * height);
            let xmin = Math.round((xminNorm / 1000) * width);
            let ymax = Math.round((ymaxNorm / 1000) * height);
            let xmax = Math.round((xmaxNorm / 1000) * width);

            // Tự động mở rộng vùng cắt thêm đúng 1mm padding mỗi bên bảo vệ mất nét
            ymin = Math.max(0, ymin - padHeightPx);
            xmin = Math.max(0, xmin - padWidthPx);
            ymax = Math.min(height, ymax + padHeightPx);
            xmax = Math.min(width, xmax + padWidthPx);

            const cropW = xmax - xmin;
            const cropH = ymax - ymin;

            if (cropW > 0 && cropH > 0) {
              const canvas = document.createElement("canvas");
              canvas.width = cropW;
              canvas.height = cropH;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, xmin, ymin, cropW, cropH, 0, 0, cropW, cropH);
                const croppedBase64 = canvas.toDataURL("image/png");

                // Replacement placeholder inside HTML block with gorgeous styling
                const imgTag = `\n[FIGURE type="cropped_img"]\n${croppedBase64}\n[/FIGURE]\n`;
                updatedText = updatedText.replace(new RegExp(`\\[IMAGE_PLACEHOLDER_${index}\\]`, 'g'), imgTag);
              }
            }
            
            boxesToSave.push({
              coord: [ymin, xmin, ymax, xmax],
              coordNorm: fig.box_2d,
              label: fig.label || `Hình vẽ ${index + 1}`
            });
          });

          setUploadedImgSrc(base64Content);
          setDetectedBoxes(boxesToSave);
          setCropEditContent(updatedText);
          setIsProcessingCrop(false);
        };
      } catch (err: any) {
        console.error("Lỗi số hóa thông minh:", err);
        setCropError(err.message || "Không thể phân tích hoặc số hóa tệp tải lên.");
        setIsProcessingCrop(false);
      }
    };
    reader.onerror = () => {
      setCropError("Không thể đọc tệp tin.");
      setIsProcessingCrop(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100 shrink-0">
            <Printer size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-emerald-600 font-bold text-xs uppercase tracking-wider">QUY TRÌNH RA ĐỀ - BƯỚC 4</div>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs shadow-xs">
                Môn: {subject || 'Sinh học'} • {grade ? `Lớp ${grade}` : 'Lớp 9'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs shadow-xs">
                <Clock size={12} className="text-amber-600" />
                {examDuration} phút
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Xuất bản Đề kiểm tra định kì
            </h1>
            <p className="text-slate-500 font-medium text-sm mt-0.5">
              Hỗ trợ xuất file Word (.docx), file HTML in ấn chuẩn A4, sao chép hoặc chỉnh sửa đồng bộ với Mục 3.
            </p>
          </div>
        </div>

        {/* Quick Save Action Row */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSyncToVault(false)}
            disabled={isSyncingVault || !content.trim()}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-md shadow-blue-100"
          >
            <Archive size={15} /> {isSyncingVault ? 'Đang đồng bộ...' : 'Đồng bộ vào Kho đề (Mục 6)'}
          </button>
          <button
            onClick={handleDownloadDocx}
            className="px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-md shadow-indigo-100"
          >
            <FileText size={15} /> Tải file Word (.docx) chuẩn
          </button>
          <button
            onClick={handleDownloadHtml}
            className="px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-md shadow-emerald-50"
          >
            <Download size={15} /> Tải file HTML in ấn A4
          </button>
          <button
            onClick={handleCopyGoogleDoc}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 border ${
              copiedDoc
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {copiedDoc ? <Check size={14} /> : <Copy size={14} />}
            {copiedDoc ? 'Đã sao chép' : 'Sao chép dạng Google Doc (4.1)'}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 shadow-md shadow-blue-50"
          >
            <Printer size={15} /> Thiết lập trang in
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {syncVaultToast && (
        <div className="fixed bottom-8 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-cyan-500/50 flex items-center gap-3 animate-bounce">
          <CheckCircle2 size={20} className="text-cyan-400" />
          <span className="text-sm font-semibold">{syncVaultToast}</span>
          {onNavigateToVault && (
            <button
              onClick={onNavigateToVault}
              className="ml-2 px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1"
            >
              Mở Kho đề <ExternalLink size={12} />
            </button>
          )}
        </div>
      )}

      {/* Synchronization Status Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${content.trim() ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <div>
            <span className="text-xs font-bold text-slate-800">
              {content.trim() 
                ? `Dữ liệu đề kiểm tra: Đã kết nối & đồng bộ với Mục 3 (${content.length.toLocaleString('vi-VN')} ký tự, ${content.split('\n').filter(Boolean).length} dòng)` 
                : 'Chưa có dữ liệu đề kiểm tra từ Mục 3'}
            </span>
            {syncNotice && (
              <span className="ml-2 text-xs font-bold text-emerald-600 animate-fade-in">
                ✓ {syncNotice}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleSyncToVault(false)}
            disabled={isSyncingVault || !content.trim()}
            title="Đồng bộ ngay đề kiểm tra hoàn thiện này sang Mục 6 (Kho đề thi)"
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Archive size={13} /> Đồng bộ sang Mục 6
          </button>
          <button
            onClick={handleManualSync}
            title="Đồng bộ lại nội dung mới nhất từ Mục 3"
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={13} className="text-indigo-600" /> Đồng bộ từ Mục 3
          </button>
          <button
            onClick={onPrev}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ChevronLeft size={13} /> Quay lại Mục 3
          </button>
        </div>
      </div>

      {!content.trim() && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3 text-amber-900">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h5 className="font-bold text-sm">Chưa có dữ liệu đề kiểm tra để xuất file</h5>
            <p className="leading-relaxed">
              Bạn có thể nhấn <strong className="font-bold text-indigo-700 cursor-pointer" onClick={onPrev}>"Quay lại Mục 3"</strong> để chạy tạo đề hoặc chuyển sang tab <strong className="font-bold text-indigo-700 cursor-pointer" onClick={() => setActiveTab('editor')}>"Chỉnh sửa & Đồng bộ"</strong> để dán trực tiếp nội dung đề thi vào đây.
            </p>
          </div>
        </div>
      )}

      {/* Tabs of Exports */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'preview'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Eye size={14} /> Xem thử nội dung in
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'editor'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Edit3 size={14} /> Chỉnh sửa & Đồng bộ (Mục 3 & 4)
            </button>
            <button
              onClick={() => setActiveTab('html_source')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'html_source'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <FileCode size={14} /> Mã nguồn HTML in ấn (4.0)
            </button>
            <button
              onClick={() => setActiveTab('cropper')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'cropper'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sparkles size={14} className="text-amber-500 animate-pulse" /> Trích xuất & Cắt hình tự động (4.2)
            </button>
          </div>

          {activeTab === 'html_source' && (
            <button
              onClick={handleCopyHtmlSource}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                copiedHtml 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {copiedHtml ? <Check size={14} /> : <Copy size={13} />}
              {copiedHtml ? 'Đã sao chép' : 'Sao chép mã nguồn'}
            </button>
          )}

          {activeTab === 'cropper' && cropEditContent && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(cropEditContent);
                setCopiedCrop(true);
                setTimeout(() => setCopiedCrop(false), 2000);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                copiedCrop 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {copiedCrop ? <Check size={14} /> : <Copy size={13} />}
              {copiedCrop ? 'Đã sao chép kết quả' : 'Sao chép văn bản số hóa'}
            </button>
          )}
        </div>

        {/* Tab display pane */}
        <div className="p-8">
          {activeTab === 'preview' ? (
            <div className="border border-slate-100 rounded-2xl p-8 bg-slate-50 shadow-inner max-h-[600px] overflow-y-auto">
              <div className="bg-white p-12 shadow-md rounded-lg max-w-[800px] mx-auto min-h-[500px] prose">
                {content.trim() ? (
                  <ContentRenderer content={content} />
                ) : (
                  <div className="text-center py-20 text-slate-400 space-y-3">
                    <p>Chưa có dữ liệu đề kiểm tra từ Mục 3.</p>
                    <button
                      onClick={onPrev}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                    >
                      Quay lại Mục 3 tạo đề
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'editor' ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 font-medium bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
                <span>
                  💡 Thay đổi tại đây được <strong className="text-indigo-900 font-bold">tự động đồng bộ 2 chiều</strong> về Mục 3 và lưu trữ an toàn. Khi xuất file Word (.docx) hoặc HTML, dữ liệu này sẽ được dùng.
                </span>
                <span className="font-mono font-bold text-indigo-800 flex-shrink-0">
                  {content.length.toLocaleString('vi-VN')} ký tự
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Dán hoặc chỉnh sửa nội dung đề kiểm tra từ Mục 3 tại đây..."
                className="w-full h-[520px] p-5 bg-white border border-slate-300 text-slate-900 font-mono text-xs rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none shadow-inner leading-relaxed"
              />
            </div>
          ) : activeTab === 'html_source' ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed">
                ℹ️ Đây là mã nguồn HTML hoàn chỉnh được đóng gói sẵn với CSS lề A4, phông chữ chân thực và căn lề đúng 2cm theo quy chuẩn để giáo viên nạp trực tiếp vào ChatGPT hoặc in ấn ngoại tuyến.
              </p>
              <textarea
                readOnly
                value={buildExamHtml()}
                className="w-full h-[400px] p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-2xl focus:outline-none resize-none custom-scrollbar shadow-inner leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Introduction bar */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl flex-shrink-0">
                  <Sparkles size={18} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-indigo-950 text-sm">Bộ số hóa đề thi thông minh (Chống trích xuất chữ trong ảnh & Cắt padding 1mm)</h4>
                  <ul className="text-indigo-800 text-xs space-y-1.5 list-disc pl-4 leading-relaxed font-medium">
                    <li><strong className="font-bold">Tuyệt đối không trích xuất văn bản nằm trong hình vẽ</strong> hoặc biểu đồ phức tạp, bảo lưu và định vị dưới dạng hình ảnh chất lượng cao.</li>
                    <li><strong className="font-bold">Công thức toán học</strong> tự động được định dạng hoàn hảo sang LaTeX và được bọc chuẩn chỉ trong dấu <code className="px-1 py-0.5 bg-indigo-100 border border-indigo-200 rounded text-indigo-900">$...$</code> (ví dụ: $E=mc^2$).</li>
                    <li><strong className="font-bold">Căn lề vật lý 1mm chuẩn xác:</strong> Sử dụng tỷ lệ thực tế của khổ giấy tiêu chuẩn A4 (210mm x 297mm) để tự động mở rộng viền cắt thêm 1mm mỗi chiều, tránh triệt để tình trạng lệch viền hoặc đứt nét.</li>
                  </ul>
                </div>
              </div>

              {/* Upload or Results Render */}
              {!uploadedImgSrc && !isProcessingCrop ? (
                <div className="flex justify-center py-6">
                  <label className="w-full max-w-xl h-64 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-slate-50/50 rounded-3xl flex flex-col items-center justify-center cursor-pointer transition-all gap-4 p-8 select-none bg-slate-50/30 shadow-inner group">
                    <div className="w-14 h-14 bg-white border border-slate-200 text-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-slate-100 group-hover:scale-105 transition-transform duration-300">
                      <Sparkles size={24} className="text-indigo-600 animate-pulse" />
                    </div>
                    <div className="text-center space-y-1">
                      <span className="text-sm font-bold text-slate-800 block">Tải ảnh trang đề thi thô lên hệ thống</span>
                      <span className="text-xs text-slate-400 block leading-relaxed max-w-sm mx-auto">Hỗ trợ định dạng PNG, JPG, JPEG, WebP. Hệ thống sẽ tự động quét, xác định bounding box và trả về LaTeX chuẩn xác.</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleCropUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              ) : isProcessingCrop ? (
                <div className="py-20 text-center space-y-6">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                    <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="space-y-1 select-none">
                    <p className="text-sm font-bold text-slate-800 animate-pulse">Hệ thống AI Gemini 3.8 Flash đang phân tích sơ đồ hình học...</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">Đang quét sơ đồ, phân định Bounding Box, tính toán sai số khoảng cách lề và tách phương trình toán sangLaTeX.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Status header */}
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-2 select-none">
                       <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                       <span className="text-xs font-bold text-slate-700">Tìm thấy {detectedBoxes.length} vùng chứa ảnh vẽ minh họa thành công</span>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedImgSrc(null);
                        setDetectedBoxes([]);
                        setCropEditContent("");
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 border border-rose-200 bg-white hover:bg-rose-50 px-3.5 py-2 rounded-xl transition-all shadow-sm"
                    >
                      Xóa và tải tệp tin khác
                    </button>
                  </div>

                  {/* Interactive Split Panels */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Visual Overlay representation */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Trang đề nguồn và vùng crop AI</span>
                         <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-lg font-bold">Lưới 1000 DPI</span>
                      </div>
                      <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-slate-900/95 flex items-center justify-center p-3 min-h-[400px] shadow-sm">
                        <img 
                          src={uploadedImgSrc || undefined} 
                          alt="Source Preview" 
                          className="max-h-[500px] w-auto object-contain rounded-xl opacity-85 select-none"
                        />
                        {/* ABSOLUTE BOXES OVERLAID */}
                        {detectedBoxes.map((box, idx) => {
                          const [ymin, xmin, ymax, xmax] = box.coordNorm || [0, 0, 1000, 1000];
                          return (
                            <div
                              key={idx}
                              className="absolute bg-emerald-500/15 border-2 border-emerald-400 rounded-xl flex items-start justify-start p-1.5 cursor-crosshair group transition-all duration-200 hover:bg-emerald-500/30 hover:border-emerald-300"
                              style={{
                                top: `${ymin / 10}%`,
                                left: `${xmin / 10}%`,
                                width: `${(xmax - xmin) / 10}%`,
                                height: `${(ymax - ymin) / 10}%`,
                              }}
                              title={box.label}
                            >
                              <div className="px-1.5 py-0.5 rounded bg-emerald-600 text-[10px] font-mono text-white leading-none font-extrabold tracking-tight border border-emerald-400/50 shadow-md">
                                {idx + 1}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Transcribed live result */}
                    <div className="space-y-3">
                      <span className="font-bold text-xs text-slate-500 uppercase tracking-wider block">Bản số hóa trực tuyến bọc LaTeX & Nhúng ảnh crop</span>
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col bg-white">
                        <div className="bg-slate-50/50 border-b border-slate-100 p-3 flex justify-between items-center">
                          <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest pl-2">Xem thử nội dung biên soạn</span>
                        </div>
                        <div className="p-8 max-h-[460px] overflow-y-auto select-text prose prose-slate">
                          {cropEditContent ? (
                            <ContentRenderer content={cropEditContent} />
                          ) : (
                            <p className="text-slate-400 text-xs text-center py-10">Bản preview đang trống.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {cropError && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center text-xs font-bold text-rose-700 leading-normal max-w-md mx-auto">
                  ⚠️ Có lỗi xảy ra: {cropError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Guide Note Box */}
      <div className="bg-amber-50/50 border border-amber-100 rounded-3xl p-6 flex gap-4">
        <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-xl flex items-center justify-center font-bold flex-shrink-0 animate-pulse">
          💡
        </div>
        <div>
          <h4 className="font-bold text-amber-900 text-sm mb-1">Mẹo in ấn chuẩn từ Lê Phước Tường</h4>
          <p className="text-amber-800 text-xs leading-relaxed">
            Khi click <strong className="font-bold">"Thiết lập trang in"</strong>, trình in ấn của trình duyệt sẽ kích hoạt. Hãy chọn <strong className="font-bold">"Save as PDF"</strong> hoặc chọn máy in của bạn. Ở mục <strong className="font-bold">More Settings / Cài đặt khác</strong>, hãy bỏ tích chọn <strong className="font-bold">"Headers and footers / Tiêu đề đầu trang và chân trang"</strong> để đảm bảo lề giấy bóng sạch, cực kì giống văn bản in giấy thi truyền thống!
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-6">
        <button
          onClick={onPrev}
          className="w-full sm:w-auto px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-bold transition-all text-sm"
        >
          Trở lại Bước 3 (Đề kiểm tra gốc)
        </button>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => handleSyncToVault(true)}
            disabled={isSyncingVault || !content.trim()}
            title="Lưu đồng bộ bộ đề hoàn thiện này và chuyển đến Kho đề thi"
            className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm transition-all text-sm flex items-center justify-center gap-2"
          >
            <Archive size={16} className="text-cyan-400" />
            Đồng bộ & Mở Kho đề thi (Mục 6)
          </button>
          <button
            onClick={onNext}
            className="w-full sm:w-auto px-7 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-100 transition-all text-sm flex items-center justify-center gap-1.5"
          >
            Tiến hành Bước 5: Tạo mã đề gộp <ChevronRight size={16} />
          </button>
        </div>
      </div>

    </div>
  );
};

export default Step4Export;
