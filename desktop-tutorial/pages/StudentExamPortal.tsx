import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Printer,
  ChevronLeft,
  User,
  GraduationCap,
  Sparkles,
  Award,
  HelpCircle,
  Eye,
  RotateCcw,
  BookOpen,
  FileCheck,
  ShieldCheck,
  ListChecks,
  CheckSquare,
  HelpCircle as QuestionIcon,
  FileText
} from 'lucide-react';
import { SavedExamPackage } from '../types';
import ContentRenderer from '../components/ContentRenderer';
import { getStudentExamQuestionsOnly } from '../utils/examSanitizer';
import { saveSubmission, extractAnswerKey, evaluateSubmission, getUnifiedAnswerKey, checkPreGradingSynchronization, extractChoiceSet } from '../utils/submissionStorage';
import { parseExamStructure } from '../utils/examStructureParser';

interface StudentExamPortalProps {
  exam: SavedExamPackage;
  variant?: 'step3' | '101' | '102' | '103' | '104' | 'all';
  className?: string;
  durationMinutes?: number;
  allowSolutionView?: boolean;
  onExit: () => void;
  isPreviewMode?: boolean;
}

const StudentExamPortal: React.FC<StudentExamPortalProps> = ({
  exam,
  variant = 'step3',
  className = 'Lớp học',
  durationMinutes = 45,
  allowSolutionView = false,
  onExit,
  isPreviewMode = false
}) => {
  // Student info state
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState(className || '');
  const [studentId, setStudentId] = useState('');

  // Active exam content variant
  const [activeVariant, setActiveVariant] = useState<'step3' | '101' | '102' | '103' | '104'>(
    variant === 'all' ? '101' : variant
  );

  // Active section tab in answer sheet ('all' | 'part1' | 'part2' | 'part3' | 'part4')
  const [activeSheetTab, setActiveSheetTab] = useState<'all' | 'part1' | 'part2' | 'part3' | 'part4'>('all');

  // Countdown timer state
  const totalSeconds = (durationMinutes || exam.durationMinutes || 45) * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Student interactive answers map:
  // - Part I: "q_1": "A"
  // - Part II: "tf_1_a": "Đ"
  // - Part III: "sa_1": "480"
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayAnswer, setEssayAnswer] = useState<string>('');

  // Instant score calculation result upon submission
  const [instantScoreResult, setInstantScoreResult] = useState<{
    score: number;
    correctCount: number;
    totalQuestions: number;
  } | null>(null);

  // Timer tick
  useEffect(() => {
    if (!isTimerRunning || submitted) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsTimerRunning(false);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, submitted]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine active exam content to display (Strictly questions only, 100% stripped of answers and grading rubrics)
  const currentExamContent = useMemo(() => {
    return getStudentExamQuestionsOnly(exam, activeVariant);
  }, [exam, activeVariant]);

  // Parse structure of current exam content to strictly synchronize the answer sheet
  const parsedStructure = useMemo(() => {
    return parseExamStructure(currentExamContent);
  }, [currentExamContent]);

  // Ensure Part III (Short Answer) is always ready and synchronized on the online answer sheet:
  // Uses parsedStructure.part3 if available; if empty, provides standard 6 short answer questions (GDPT 2018 standard)
  const effectivePart3 = useMemo(() => {
    if (parsedStructure.part3.length > 0) return parsedStructure.part3;
    return Array.from({ length: 6 }).map((_, i) => ({
      questionNumber: i + 1,
      label: `Câu ${i + 1}`,
      promptSnippet: ''
    }));
  }, [parsedStructure.part3]);

  // Compute answers metrics
  const p1Answered = useMemo(() => {
    return parsedStructure.part1.filter((q) => !!answers[`q_${q.questionNumber}`]).length;
  }, [parsedStructure.part1, answers]);

  const p2TotalUnits = useMemo(() => {
    return parsedStructure.part2.reduce((acc, q) => acc + (q.subItems.length || 4), 0);
  }, [parsedStructure.part2]);

  const p2Answered = useMemo(() => {
    return parsedStructure.part2.reduce((acc, q) => {
      const answeredInQ = q.subItems.filter((sub) => !!answers[`tf_${q.questionNumber}_${sub.key}`]).length;
      return acc + answeredInQ;
    }, 0);
  }, [parsedStructure.part2, answers]);

  const p3Answered = useMemo(() => {
    return effectivePart3.filter((q) => !!answers[`sa_${q.questionNumber}`]?.trim()).length;
  }, [effectivePart3, answers]);

  const hasEssay = parsedStructure.part4.length > 0;
  const isEssayAnswered = !!essayAnswer.trim();

  const totalAnswerUnits = useMemo(() => {
    const p1Count = parsedStructure.part1.length;
    const p2Units = parsedStructure.part2.reduce((acc, q) => acc + (q.subItems.length || 4), 0);
    const p3Count = effectivePart3.length;
    const p4Count = parsedStructure.part4.length;
    return p1Count + p2Units + p3Count + p4Count;
  }, [parsedStructure, effectivePart3]);

  const totalAnsweredCount = p1Answered + p2Answered + p3Answered + (isEssayAnswered ? 1 : 0);
  const completionPercent = totalAnswerUnits > 0 ? Math.round((totalAnsweredCount / totalAnswerUnits) * 100) : 0;

  const processAndSaveSubmission = async () => {
    setIsSubmitting(true);
    const timeSpent = Math.max(10, totalSeconds - secondsLeft);
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSubmittedAt(nowTime);

    // KIỂM TRA TÍNH ĐỒNG BỘ TRƯỚC KHI CHO PHÉP CHẤM BÀI (4 NGUỒN: MA TRẬN - ĐỀ - HD CHẤM - MÃ ĐỀ)
    const syncReport = checkPreGradingSynchronization(exam, activeVariant);
    const answerKey = getUnifiedAnswerKey(exam, activeVariant);
    
    // Chỉ cho phép chuyển sang bước CHẤM khi toàn bộ dữ liệu cần thiết đã KHỚP
    const canAutoGrade = syncReport.isAllowedToGrade && Object.keys(answerKey).length > 0;
    const evalResult = canAutoGrade ? evaluateSubmission(answers, answerKey, exam) : null;

    const submissionData = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      examId: exam.id,
      examTitle: exam.title,
      subject: exam.subject,
      grade: exam.grade,
      variant: activeVariant,
      studentName: studentName.trim() || 'Học sinh chưa đặt tên',
      studentClass: studentClass.trim() || className || 'Lớp học',
      studentCode: studentId.trim(),
      submittedAt: new Date().toISOString(),
      durationMinutes: durationMinutes || exam.durationMinutes || 45,
      timeSpentSeconds: timeSpent,
      answers,
      essayAnswer: essayAnswer.trim(),
      score: canAutoGrade && evalResult ? evalResult.score : undefined,
      totalQuestions: evalResult?.totalQuestions || totalAnswerUnits,
      correctCount: evalResult?.correctCount,
      status: 'submitted' as const
    };

    try {
      const saveRes = await saveSubmission(submissionData);
      const finalScore = saveRes?.submission?.score !== undefined ? saveRes.submission.score : (canAutoGrade && evalResult ? evalResult.score : undefined);
      const finalCorrect = saveRes?.submission?.correctCount !== undefined ? saveRes.submission.correctCount : evalResult?.correctCount;
      const finalTotal = saveRes?.submission?.totalQuestions || evalResult?.totalQuestions || totalAnswerUnits;

      if (finalScore !== undefined) {
        setInstantScoreResult({
          score: finalScore,
          correctCount: finalCorrect,
          totalQuestions: finalTotal
        });
      }
    } catch (e) {
      console.warn('Could not save submission to server:', e);
      if (canAutoGrade && evalResult) {
        setInstantScoreResult({
          score: evalResult.score,
          correctCount: evalResult.correctCount,
          totalQuestions: evalResult.totalQuestions || totalAnswerUnits
        });
      }
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
      setIsTimerRunning(false);
    }
  };

  const handleAutoSubmit = () => {
    processAndSaveSubmission();
  };

  const handleManualSubmit = () => {
    setShowConfirmModal(false);
    processAndSaveSubmission();
  };

  // Format timer HH:MM:SS or MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerColorClass = useMemo(() => {
    if (secondsLeft <= 60) return 'bg-red-500 text-white animate-pulse';
    if (secondsLeft <= 300) return 'bg-amber-500 text-slate-950 font-black';
    return 'bg-slate-900 text-cyan-300';
  }, [secondsLeft]);

  // Answer selection helpers (hỗ trợ cả trắc nghiệm 1 lựa chọn và câu hỏi nhiều lựa chọn)
  const handleSelectPart1 = (questionNum: number, choice: string, event?: React.MouseEvent) => {
    if (submitted) return;
    const isMultiClick = event?.shiftKey || event?.ctrlKey || event?.metaKey;
    setAnswers((prev) => {
      const current = prev[`q_${questionNum}`] || '';
      const set = extractChoiceSet(current);

      if (isMultiClick) {
        if (set.has(choice)) {
          set.delete(choice);
        } else {
          set.add(choice);
        }
        return {
          ...prev,
          [`q_${questionNum}`]: Array.from(set).sort().join(', ')
        };
      }

      // Nhấp thường: Nếu đã có nhiều lựa chọn, toggle lựa chọn; nếu chưa có thì chọn 1
      if (set.size > 1) {
        if (set.has(choice)) {
          set.delete(choice);
        } else {
          set.add(choice);
        }
        return {
          ...prev,
          [`q_${questionNum}`]: Array.from(set).sort().join(', ')
        };
      }

      return {
        ...prev,
        [`q_${questionNum}`]: current === choice ? '' : choice
      };
    });
  };

  const handleSelectPart2 = (questionNum: number, subKey: 'a' | 'b' | 'c' | 'd', choice: 'Đ' | 'S') => {
    if (submitted) return;
    const key = `tf_${questionNum}_${subKey}`;
    setAnswers((prev) => ({
      ...prev,
      [key]: prev[key] === choice ? '' : choice
    }));
  };

  const handleShortAnswerChange = (questionNum: number, val: string) => {
    if (submitted) return;
    setAnswers((prev) => ({
      ...prev,
      [`sa_${questionNum}`]: val
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      
      {/* Top Banner if in Teacher Preview Mode */}
      {isPreviewMode && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            <span>Chế độ Xem trước dành cho Giáo viên (Student Experience Preview)</span>
          </div>
          <button
            onClick={onExit}
            className="px-3 py-1 bg-slate-950 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
          >
            <ChevronLeft size={14} /> Thoát xem trước / Trở lại Kho đề
          </button>
        </div>
      )}

      {/* Main App Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
              title="Quay lại"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  {exam.subject || 'Bài kiểm tra'}
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  {studentClass || className}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-800 line-clamp-1">
                {exam.title}
              </h1>
            </div>
          </div>

          {/* Countdown Clock & Submit CTA */}
          <div className="flex items-center gap-2">
            <div className={`px-3 sm:px-4 py-2 rounded-2xl flex items-center gap-2 font-mono text-sm sm:text-base font-bold shadow-sm transition-all ${timerColorClass}`}>
              <Clock size={16} className="animate-spin-slow" />
              <span>{formatTime(secondsLeft)}</span>
            </div>

            {!submitted && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-100 transition-all hover:scale-[1.02]"
              >
                <Send size={14} />
                <span className="hidden sm:inline">Nộp bài</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
        
        {/* Student Identification Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <User size={18} className="text-indigo-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Thông tin học sinh làm bài
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Họ và tên học sinh: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={submitted}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn An"
                className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Lớp: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={submitted}
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                placeholder="Ví dụ: 10A1"
                className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Số báo danh / Mã định danh:
              </label>
              <input
                type="text"
                disabled={submitted}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Ví dụ: SBD-015"
                className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Variant Selector if package has multiple codes */}
          {exam.resultStep5?.trim() && !submitted && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen size={14} className="text-indigo-600" />
                {variant === 'all' ? 'Chọn mã đề thi của em:' : 'Mã đề thi được giao:'}
              </span>
              {variant === 'all' ? (
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveVariant('step3')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeVariant === 'step3'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Đề chuẩn
                  </button>
                  {(['101', '102', '103', '104'] as const).map((code) => (
                    <button
                      key={code}
                      onClick={() => setActiveVariant(code)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        activeVariant === code
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Mã đề {code}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded-xl">
                  {activeVariant === 'step3' ? 'Đề thi chuẩn (Gốc)' : `Mã đề ${activeVariant}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Submission Celebration Banner */}
        {submitted && (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl p-6 shadow-xl space-y-3 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                <Award size={28} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-black leading-tight">
                    Chúc mừng em đã hoàn thành và nộp bài thi thành công!
                  </h3>
                  {instantScoreResult && (
                    <div className="flex items-center gap-2 bg-white text-emerald-900 px-3.5 py-1.5 rounded-2xl shadow-sm border border-emerald-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Điểm chấm tức thì:</span>
                      <span className="text-xl font-black text-emerald-600 leading-none">
                        {instantScoreResult.score.toFixed(1)}/10
                      </span>
                      <span className="text-[11px] font-medium text-slate-500">
                        ({instantScoreResult.correctCount}/{instantScoreResult.totalQuestions} đúng)
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-emerald-100 mt-1">
                  Thời gian nộp: <strong>{submittedAt}</strong> • Học sinh: <strong>{studentName || 'Học sinh'}</strong> • Lớp: <strong>{studentClass}</strong>
                </p>
                <p className="text-[11px] text-emerald-100/90 mt-0.5">
                  Bài làm và điểm số đã được tự động chấm và đồng bộ trực tiếp vào <strong>Mục 7. Sản phẩm của học sinh</strong> của Thầy/Cô.
                </p>
              </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-3.5 text-xs text-emerald-50 flex items-center justify-between flex-wrap gap-3 border border-white/20">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 font-bold">
                  <FileCheck size={16} /> Tiến độ hoàn thành: {totalAnsweredCount}/{totalAnswerUnits} lệnh hỏi ({completionPercent}%)
                </span>
                <span className="text-emerald-200 text-[11px]">
                  (P.I: {p1Answered}/{parsedStructure.part1.length} | P.II: {p2Answered}/{p2TotalUnits} | P.III: {p3Answered}/{effectivePart3.length})
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-white text-slate-900 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all flex items-center gap-1"
              >
                <Printer size={13} /> In kết quả bài làm
              </button>
            </div>
          </div>
        )}

        {/* Two Columns: Exam Content & Interactive Answer Sheet */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Column Left: Exam Paper */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Nội dung đề bài
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Chế độ bảo mật: Đề bài học sinh (Đã ẩn đáp án)
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                {exam.title}
                {activeVariant !== 'step3' && ` - MÃ ĐỀ ${activeVariant}`}
              </h2>
            </div>

            <div className="prose max-w-none text-sm text-slate-800 leading-relaxed">
              {currentExamContent ? (
                <ContentRenderer content={currentExamContent} />
              ) : (
                <div className="text-center py-12 text-slate-400 font-medium">
                  Chưa có nội dung bài thi.
                </div>
              )}
            </div>
          </div>

          {/* Column Right: Interactive Student Answer Sheet (Standardized Bubble Sheet & Fast Navigation) */}
          <div className="lg:col-span-5 space-y-4 sticky top-20">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
              
              {/* Answer Sheet Header */}
              <div className="border-b border-slate-100 pb-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <FileCheck size={16} className="text-indigo-600" />
                    Phiếu trả lời trực tuyến
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg">
                      Đã làm: {totalAnsweredCount}/{totalAnswerUnits} ({completionPercent}%)
                    </span>
                    {totalAnswerUnits - totalAnsweredCount > 0 ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg" title="Số câu/lệnh hỏi chưa làm">
                        Còn {totalAnswerUnits - totalAnsweredCount} câu
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                        Đã xong 100%
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      completionPercent === 100 ? 'bg-emerald-600' : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
                    }`}
                    style={{ width: `${completionPercent}%` }}
                  ></div>
                </div>

                {/* Quick Question Navigator Palette (Lưới theo dõi nhanh các câu hỏi) */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold px-0.5">
                    <span className="uppercase tracking-wider">Ma trận câu hỏi nhanh:</span>
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Đã chọn
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-300"></span> Chưa chọn
                      </span>
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {/* Part I buttons */}
                    {parsedStructure.part1.map((q) => {
                      const isAnswered = !!answers[`q_${q.questionNumber}`];
                      return (
                        <button
                          key={`palette_p1_${q.questionNumber}`}
                          type="button"
                          onClick={() => {
                            setActiveSheetTab('all');
                            const el = document.getElementById(`sheet_item_p1_${q.questionNumber}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className={`w-6 h-6 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                            isAnswered
                              ? 'bg-indigo-600 text-white shadow-2xs scale-105'
                              : 'bg-white text-slate-600 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                          }`}
                          title={`Câu ${q.questionNumber} (Phần I): ${isAnswered ? 'Đã làm' : 'Chưa làm'}`}
                        >
                          {q.questionNumber}
                        </button>
                      );
                    })}

                    {/* Part II buttons */}
                    {parsedStructure.part2.map((q) => {
                      const answeredInQ = q.subItems.filter(sub => !!answers[`tf_${q.questionNumber}_${sub.key}`]).length;
                      const isFull = answeredInQ === q.subItems.length;
                      const isPartial = answeredInQ > 0 && !isFull;
                      return (
                        <button
                          key={`palette_p2_${q.questionNumber}`}
                          type="button"
                          onClick={() => {
                            setActiveSheetTab('all');
                            const el = document.getElementById(`sheet_item_p2_${q.questionNumber}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className={`min-w-6 h-6 px-1 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                            isFull
                              ? 'bg-emerald-600 text-white shadow-2xs scale-105'
                              : isPartial
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-400'
                              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                          }`}
                          title={`Câu ${q.questionNumber} (Đ-S): ${answeredInQ}/${q.subItems.length} ý`}
                        >
                          II.{q.questionNumber}
                        </button>
                      );
                    })}

                    {/* Part III buttons */}
                    {effectivePart3.map((q) => {
                      const isAnswered = !!answers[`sa_${q.questionNumber}`]?.trim();
                      return (
                        <button
                          key={`palette_p3_${q.questionNumber}`}
                          type="button"
                          onClick={() => {
                            setActiveSheetTab('all');
                            const el = document.getElementById(`sheet_item_p3_${q.questionNumber}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className={`min-w-6 h-6 px-1 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                            isAnswered
                              ? 'bg-amber-600 text-white shadow-2xs scale-105'
                              : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
                          }`}
                          title={`Câu ${q.questionNumber} (Trả lời ngắn): ${isAnswered ? 'Đã điền' : 'Chưa điền'}`}
                        >
                          III.{q.questionNumber}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pt-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setActiveSheetTab('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                      activeSheetTab === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({totalAnsweredCount}/{totalAnswerUnits})
                  </button>

                  {parsedStructure.part1.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveSheetTab('part1')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                        activeSheetTab === 'part1'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      <span>P.I</span>
                      <span className="text-[10px] opacity-85">({p1Answered}/{parsedStructure.part1.length})</span>
                    </button>
                  )}

                  {parsedStructure.part2.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveSheetTab('part2')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                        activeSheetTab === 'part2'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      <span>P.II</span>
                      <span className="text-[10px] opacity-85">({p2Answered}/{p2TotalUnits})</span>
                    </button>
                  )}

                  {effectivePart3.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveSheetTab('part3')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                        activeSheetTab === 'part3'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      <span>P.III</span>
                      <span className="text-[10px] opacity-85">({p3Answered}/{effectivePart3.length})</span>
                    </button>
                  )}

                  {hasEssay && (
                    <button
                      type="button"
                      onClick={() => setActiveSheetTab('part4')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                        activeSheetTab === 'part4'
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      Tự luận
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Answers Sections */}
              <div className="max-h-[500px] overflow-y-auto space-y-4 pr-1">
                
                {/* 1. PHẦN I: TRẮC NGHIỆM NHIỀU LỰA CHỌN (CHUẨN LƯỚI PHIẾU TÔ BỘ GD&ĐT) */}
                {(activeSheetTab === 'all' || activeSheetTab === 'part1') && parsedStructure.part1.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-100 px-3 py-1.5 rounded-xl">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
                        <ListChecks size={14} className="text-indigo-600" />
                        <span>PHẦN I: Trắc nghiệm ({parsedStructure.part1.length} câu)</span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700">
                        {p1Answered}/{parsedStructure.part1.length} câu đã chọn
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {parsedStructure.part1.map((q) => {
                        const selected = answers[`q_${q.questionNumber}`] || '';
                        const selectedSet = extractChoiceSet(selected);
                        const isAnswered = selectedSet.size > 0;
                        return (
                          <div
                            key={`p1_${q.questionNumber}`}
                            id={`sheet_item_p1_${q.questionNumber}`}
                            className={`p-2.5 rounded-2xl border transition-all ${
                              isAnswered
                                ? 'bg-indigo-50/40 border-indigo-200/90 shadow-2xs'
                                : 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-black text-slate-800 text-xs flex items-center gap-1">
                                Câu {q.questionNumber}
                              </span>
                              {isAnswered && (
                                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded-md">
                                  Đã chọn
                                </span>
                              )}
                            </div>

                            {/* Standard 4-Option Bubble Buttons (A, B, C, D) */}
                            <div className="flex items-center justify-between gap-1 pt-0.5">
                              {q.options.map((opt) => {
                                const isOptSelected = selectedSet.has(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    disabled={submitted}
                                    onClick={(e) => handleSelectPart1(q.questionNumber, opt, e)}
                                    className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                                      isOptSelected
                                        ? 'bg-indigo-600 text-white font-black shadow-sm ring-2 ring-indigo-300 scale-105'
                                        : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/60'
                                    } disabled:opacity-80 disabled:cursor-not-allowed`}
                                    title={`Câu ${q.questionNumber} - Chọn đáp án ${opt}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. PHẦN II: TRẮC NGHIỆM ĐÚNG - SAI */}
                {(activeSheetTab === 'all' || activeSheetTab === 'part2') && parsedStructure.part2.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-100 px-3 py-1.5 rounded-xl">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                        <CheckSquare size={14} className="text-emerald-600" />
                        <span>PHẦN II: Đúng - Sai ({parsedStructure.part2.length} câu / {p2TotalUnits} ý)</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700">
                        {p2Answered}/{p2TotalUnits} ý đã chọn
                      </span>
                    </div>

                    <div className="space-y-3">
                      {parsedStructure.part2.map((q) => (
                        <div
                          key={`p2_${q.questionNumber}`}
                          id={`sheet_item_p2_${q.questionNumber}`}
                          className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs font-black text-slate-800">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                                II
                              </span>
                              Câu {q.questionNumber}:
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Chọn [Đ] Đúng hoặc [S] Sai)
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.subItems.map((sub) => {
                              const key = `tf_${q.questionNumber}_${sub.key}`;
                              const val = answers[key];
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between p-2 px-2.5 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs"
                                >
                                  <span className="font-black text-slate-800 mr-2 text-xs">
                                    {sub.key})
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={submitted}
                                      onClick={() => handleSelectPart2(q.questionNumber, sub.key, 'Đ')}
                                      className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                                        val === 'Đ'
                                          ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300 scale-105'
                                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                                      } disabled:opacity-80 disabled:cursor-not-allowed`}
                                      title="Chọn Đúng"
                                    >
                                      Đ
                                    </button>
                                    <button
                                      type="button"
                                      disabled={submitted}
                                      onClick={() => handleSelectPart2(q.questionNumber, sub.key, 'S')}
                                      className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                                        val === 'S'
                                          ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300 scale-105'
                                          : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                                      } disabled:opacity-80 disabled:cursor-not-allowed`}
                                      title="Chọn Sai"
                                    >
                                      S
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. PHẦN III: TRẢ LỜI NGẮN */}
                {(activeSheetTab === 'all' || activeSheetTab === 'part3') && effectivePart3.length > 0 && (
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between bg-amber-50/80 border border-amber-200/80 px-3.5 py-2 rounded-2xl">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-950">
                        <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">
                          III
                        </div>
                        <div>
                          <span>PHẦN III: Trả lời ngắn ({effectivePart3.length} câu)</span>
                          <span className="text-[10px] text-amber-700 font-medium block">
                            Nhập kết quả ngắn gọn vào từng ô tương ứng
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-amber-800 bg-amber-100/90 border border-amber-200 px-2.5 py-1 rounded-xl shrink-0">
                        {p3Answered}/{effectivePart3.length} câu đã điền
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {effectivePart3.map((q) => {
                        const val = answers[`sa_${q.questionNumber}`] || '';
                        const isFilled = !!val.trim();
                        return (
                          <div
                            key={`p3_${q.questionNumber}`}
                            id={`sheet_item_p3_${q.questionNumber}`}
                            className={`p-3 rounded-2xl border transition-all ${
                              isFilled
                                ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                                : 'bg-slate-50/80 border-slate-200/90 hover:border-amber-200'
                            } space-y-2`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5 font-black text-slate-800">
                                <span className="w-5 h-5 rounded-md bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-[10px]">
                                  {q.questionNumber}
                                </span>
                                <span>Câu {q.questionNumber}</span>
                                {q.unitHint && (
                                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 border border-amber-200/60 px-1.5 py-0.5 rounded-md">
                                    [{q.unitHint}]
                                  </span>
                                )}
                              </div>
                              {isFilled ? (
                                <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                  <CheckCircle2 size={12} className="text-emerald-600" />
                                  Đã điền
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Chưa nhập</span>
                              )}
                            </div>

                            {q.promptSnippet && (
                              <p className="text-[11px] text-slate-600 italic line-clamp-2 px-1 border-l-2 border-amber-300 pl-2">
                                {q.promptSnippet}
                              </p>
                            )}

                            <div className="relative flex items-center">
                              <input
                                type="text"
                                inputMode="decimal"
                                disabled={submitted}
                                value={val}
                                onChange={(e) => handleShortAnswerChange(q.questionNumber, e.target.value)}
                                placeholder={
                                  q.unitHint
                                    ? `Nhập đáp số [${q.unitHint}]...`
                                    : 'Nhập số hoặc kết quả ngắn gọn (VD: 300, 25%, 12.5)...'
                                }
                                className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all disabled:bg-slate-100 pr-14"
                              />
                              {q.unitHint ? (
                                <span className="absolute right-2.5 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md pointer-events-none">
                                  {q.unitHint}
                                </span>
                              ) : isFilled && !submitted ? (
                                <button
                                  type="button"
                                  onClick={() => handleShortAnswerChange(q.questionNumber, '')}
                                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded-md hover:bg-slate-100 cursor-pointer"
                                  title="Xóa câu trả lời"
                                >
                                  ✕
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. PHẦN TỰ LUẬN / GHI CHÚ BÀI LÀM */}
                {(activeSheetTab === 'all' || activeSheetTab === 'part4') && (
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between bg-purple-50/70 border border-purple-100 px-3 py-1.5 rounded-xl">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                        <FileText size={14} className="text-purple-600" />
                        <span>Phần Tự luận / Ghi chú bài làm:</span>
                      </div>
                      {isEssayAnswered && (
                        <span className="text-[10px] text-purple-700 font-bold">✓ Đã có bài làm</span>
                      )}
                    </div>

                    <textarea
                      rows={4}
                      disabled={submitted}
                      value={essayAnswer}
                      onChange={(e) => setEssayAnswer(e.target.value)}
                      placeholder="Học sinh có thể nhập câu trả lời tự luận hoặc lời giải chi tiết vào đây..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none leading-relaxed disabled:bg-slate-100"
                    />
                  </div>
                )}

              </div>

              {/* Submit CTA Button */}
              {!submitted ? (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-100 transition-all hover:scale-[1.01] cursor-pointer"
                >
                  <Send size={15} />
                  <span>Xác nhận Nộp bài thi ({totalAnsweredCount}/{totalAnswerUnits})</span>
                </button>
              ) : (
                <div className="text-center p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700">
                  <CheckCircle2 size={16} className="inline mr-1 text-emerald-600" />
                  Đã ghi nhận bài nộp lúc {submittedAt}
                </div>
              )}

            </div>
          </div>

        </div>

      </main>

      {/* Confirmation Modal Before Submit */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Xác nhận nộp bài thi
                </h3>
                <p className="text-xs text-slate-500">
                  Kiểm tra lại số lượng câu đã trả lời trước khi gửi
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-700 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Học sinh:</span>
                <strong className="text-slate-900">{studentName || 'Chưa nhập họ tên'}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Lớp:</span>
                <strong className="text-slate-900">{studentClass || 'Chưa nhập lớp'}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Mã đề:</span>
                <strong className="text-indigo-600">{activeVariant === 'step3' ? 'Đề gốc' : activeVariant}</strong>
              </div>

              {/* Detailed Breakdown per Part */}
              <div className="pt-1 space-y-1">
                <div className="font-bold text-slate-800 text-[11px] mb-1">Chi tiết câu hỏi đã làm:</div>
                
                {parsedStructure.part1.length > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>• Phần I (Trắc nghiệm):</span>
                    <strong className={p1Answered === parsedStructure.part1.length ? 'text-emerald-600' : 'text-amber-600'}>
                      {p1Answered} / {parsedStructure.part1.length} câu
                    </strong>
                  </div>
                )}

                {parsedStructure.part2.length > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>• Phần II (Đúng - Sai):</span>
                    <strong className={p2Answered === p2TotalUnits ? 'text-emerald-600' : 'text-amber-600'}>
                      {p2Answered} / {p2TotalUnits} ý
                    </strong>
                  </div>
                )}

                {effectivePart3.length > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>• Phần III (Trả lời ngắn):</span>
                    <strong className={p3Answered === effectivePart3.length ? 'text-emerald-600' : 'text-amber-600'}>
                      {p3Answered} / {effectivePart3.length} câu
                    </strong>
                  </div>
                )}

                {hasEssay && (
                  <div className="flex justify-between text-slate-600">
                    <span>• Phần Tự luận:</span>
                    <strong className={isEssayAnswered ? 'text-emerald-600' : 'text-slate-400'}>
                      {isEssayAnswered ? 'Đã nhập bài giải' : 'Chưa nhập'}
                    </strong>
                  </div>
                )}

                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900">
                  <span>Tổng tiến độ:</span>
                  <span className="text-indigo-600">{totalAnsweredCount} / {totalAnswerUnits} ({completionPercent}%)</span>
                </div>
              </div>

              <div className="flex justify-between pt-1 text-slate-500">
                <span>Thời gian còn lại:</span>
                <strong className="text-slate-700">{formatTime(secondsLeft)}</strong>
              </div>

              {!studentName.trim() && (
                <p className="text-red-600 font-bold pt-1">
                  ⚠️ Em chưa nhập Họ và tên. Vui lòng nhập họ tên trước khi nộp!
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang gửi...' : 'Đồng ý nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentExamPortal;
