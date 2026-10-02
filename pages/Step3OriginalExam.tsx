import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Play, 
  Loader2, 
  PlusCircle, 
  Eye, 
  Edit3, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Settings,
  ChevronDown,
  Clock
} from 'lucide-react';
import ContentRenderer from '../components/ContentRenderer';
import { isValidSourceText } from '../utils/sourceValidation';

interface Step3OriginalExamProps {
  lesson: string;
  regulationSource: string;
  sampleExam: string;
  matrix: string;
  step1Result: string;
  step2Result: string;
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

const Step3OriginalExam: React.FC<Step3OriginalExamProps> = ({
  lesson,
  regulationSource,
  sampleExam,
  matrix,
  step1Result,
  step2Result,
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
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>(result ? 'preview' : 'edit');
  const [showPromptConfig, setShowPromptConfig] = useState(false); // Collapsed by default!

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunGemini = async () => {
    if (!isValidSourceText(regulationSource)) {
      setErrorMsg("CẢNH BÁO: Mục '2. Văn bản quy định' là nguồn bắt buộc do người dùng cung cấp. Vui lòng quay lại Bước 0 để cung cấp văn bản quy định trước khi tạo Đề kiểm tra định kì!");
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    try {
      const response = await fetch("/api/generate/step3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson, regulationSource, sampleExam, matrix, step1Result, step2Result, prompt, examDuration, durationMinutes: examDuration, subject, grade }),
      });
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        if (response.status === 413) {
          throw new Error("Dung lượng tài liệu quá lớn so với giới hạn xử lý. Thầy cô vui lòng chia nhỏ thông tin đầu vào!");
        }
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`Máy chủ AI đang bận hoặc quá tải tạm thời (Lỗi ${response.status}). Thầy cô vui lòng bấm nút "Chạy lại" sau vài giây.`);
        }
        throw new Error(`Lỗi phản hồi từ hệ thống (Lỗi ${response.status}). Hãy thử lại.`);
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Gặp lỗi khi tạo đề kiểm tra định kì.");
      }
      let cleanedResult = (data.result || "").trim();
      // Strip any conversational AI preambles like "Dưới đây là Đề kiểm tra..." or "Sau đây là..."
      cleanedResult = cleanedResult.replace(/^(Dưới đây là|Sau đây là|Đây là)[^\n]*\n+/i, "").trim();
      setResult(cleanedResult);
      setViewMode('preview');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Không thể kết nối đến server. Vui lòng kiểm tra lại cấu hình API hoặc kết nối mạng.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 shrink-0">
          <PlusCircle size={24} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-indigo-600 font-bold text-xs uppercase tracking-wider">QUY TRÌNH RA ĐỀ - BƯỚC 3</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs shadow-xs">
                Môn: {subject || 'Sinh học'} • {grade ? `Lớp ${grade}` : 'Lớp 9'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs shadow-xs">
                <Clock size={13} className="text-amber-600" />
                Thời lượng bài kiểm tra: {examDuration} phút
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Bước 3. Tạo Đề kiểm tra định kì chuẩn xác
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-0.5">
            Biên soạn đề kiểm tra định kì hoàn chỉnh, đáp án chính thức và hướng dẫn chấm chi tiết ứng với Tỉ lệ Ma trận và Bản đặc tả đã lập.
          </p>
        </div>
      </div>

      {/* Main flow interaction */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-500" />
              Tạo Đề kiểm tra & Hướng dẫn chấm tự động
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Hệ thống sẽ tổng hợp Đặc tả và Ma trận, số hóa toàn bộ công thức toán và phản ứng hóa học sang LaTeX chuẩn chỉ.
            </p>
          </div>
          <button
            onClick={handleRunGemini}
            disabled={isRunning}
            className="w-full md:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-300 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
            {isRunning ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Đang tạo đề kiểm tra...
              </>
            ) : (
              <>
                <Play fill="currentColor" size={12} />
                Chạy tạo đề kiểm tra với Gemini
              </>
            )}
          </button>
        </div>

        {/* Collapsible Prompt Advanced Config */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
          <button
            onClick={() => setShowPromptConfig(!showPromptConfig)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-600 hover:bg-slate-100/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Settings size={14} className="text-slate-400" />
              Cấu hình câu lệnh tạo đề kiểm tra nâng cao
            </span>
            <ChevronDown size={14} className={`transform transition-transform ${showPromptConfig ? 'rotate-180' : ''}`} />
          </button>
          
          {showPromptConfig && (
            <div className="p-5 border-t border-slate-200 bg-white space-y-4 animate-fade-in">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Bạn có thể tự chỉnh sửa câu lệnh hệ thống gửi đi gửi cho AI:</span>
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
                className="w-full h-64 p-4 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-y font-mono bg-slate-900 text-slate-100 leading-relaxed custom-scrollbar"
                placeholder="Câu lệnh tạo đề thi..."
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

      {/* Results Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500 animate-pulse" />
            Đề kiểm tra định kì và Đáp án chính thức
          </h3>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('preview')}
              disabled={!result}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'preview' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800 disabled:opacity-50'
              }`}
            >
              <Eye size={14} /> Xem dạng văn bản đẹp
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'edit' 
                ? 'bg-white text-slate-800 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Edit3 size={14} /> Sửa thủ công
            </button>
          </div>
        </div>
        
        <div className="p-8 flex-1 bg-white">
          {viewMode === 'edit' ? (
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="Nội dung đề kiểm tra định kì đầy đủ của bạn sẽ hiển thị ở đây..."
              className="w-full h-[500px] p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none text-sm font-sans"
            />
          ) : (
            <div className="prose max-w-none text-slate-750 text-sm leading-relaxed overflow-x-auto print-friendly">
              {result ? (
                <ContentRenderer content={result} />
              ) : (
                <div className="text-center py-20 text-slate-400 font-medium select-none">
                  Chưa có đề kiểm tra. Hãy nhấn nút <strong className="font-bold text-indigo-600">"Chạy tạo đề kiểm tra với Gemini"</strong> ở phía trên để bắt đầu!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Steps control row */}
      <div className="flex justify-between border-t border-slate-100 pt-6">
        <button
          onClick={onPrev}
          className="px-6 py-3 border border-slate-300 text-slate-755 hover:bg-slate-50 rounded-xl font-bold transition-all text-sm"
        >
          Trở lại Bước 2
        </button>
        <button
          onClick={onNext}
          disabled={!result.trim()}
          className={`px-8 py-3.5 rounded-xl font-extrabold flex items-center gap-1.5 transition-all text-sm ${
            !result.trim() 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100'
          }`}
        >
          Tiến hành Bước 4: Xuất bản đề thi <ChevronRight size={16} />
        </button>
      </div>

    </div>
  );
};

export default Step3OriginalExam;
