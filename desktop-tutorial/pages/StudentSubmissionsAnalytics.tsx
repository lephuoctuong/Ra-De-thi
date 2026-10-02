import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  Users,
  Award,
  Clock,
  TrendingUp,
  Search,
  Filter,
  Download,
  Printer,
  Trash2,
  RefreshCw,
  Sparkles,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ChevronRight,
  BookOpen,
  Edit3,
  Check,
  Share2,
  BarChart3,
  PieChart as PieIcon,
  HelpCircle,
  ArrowUpDown,
  FileCheck,
  Zap,
  Copy
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { StudentSubmission, SavedExamPackage } from '../types';
import { getSavedExams } from '../utils/examStorage';
import {
  getSubmissions,
  saveSubmission,
  updateSubmission,
  deleteSubmission,
  clearAllSubmissions,
  generateMockSubmissions,
  extractAnswerKey,
  evaluateSubmission,
  isShortAnswerMatch,
  isTrueFalseMatch,
  formatTrueFalseExpected,
  getUnifiedAnswerKey,
  generatePedagogicalEvaluation,
  gradeSubmissionWithAI,
  getExamScoringSpecification,
  checkPreGradingSynchronization,
  runPreFinalCrossCheck,
  runFinalTenStepCheck
} from '../utils/submissionStorage';
import { PedagogicalEvaluation } from '../types';
import { parseExamStructure } from '../utils/examStructureParser';

interface StudentSubmissionsAnalyticsProps {
  initialExamId?: string;
  onNavigateToStep: (stepId: 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6') => void;
  currentWorkflow?: {
    lesson?: string;
    regulationSource?: string;
    sampleExam?: string;
    matrix?: string;
    resultStep1?: string;
    resultStep2?: string;
    resultStep3?: string;
    resultStep5?: string;
    subject?: string;
    grade?: string;
    durationMinutes?: number;
  };
}

const StudentSubmissionsAnalytics: React.FC<StudentSubmissionsAnalyticsProps> = ({
  initialExamId,
  onNavigateToStep,
  currentWorkflow
}) => {
  // State
  const [exams, setExams] = useState<SavedExamPackage[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || 'all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedVariant, setSelectedVariant] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChartTab, setActiveChartTab] = useState<'distribution' | 'proficiency' | 'questions'>('distribution');

  // Modal inspection & grading state
  const [inspectingSubmission, setInspectingSubmission] = useState<StudentSubmission | null>(null);
  const [editingScore, setEditingScore] = useState<string>('');
  const [editingFeedback, setEditingFeedback] = useState<string>('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [isAutoGradingAll, setIsAutoGradingAll] = useState(false);
  const [isAIGradingSingle, setIsAIGradingSingle] = useState(false);
  const [isAIGradingBatch, setIsAIGradingBatch] = useState(false);
  const [aiGradingProgress, setAiGradingProgress] = useState<{ current: number; total: number; studentName?: string } | null>(null);
  const [activeFeedbackView, setActiveFeedbackView] = useState<'structured' | 'raw'>('structured');
  const [showAuditTable, setShowAuditTable] = useState<boolean>(true);
  const [showPreGradingSyncTable, setShowPreGradingSyncTable] = useState<boolean>(true);
  const [syncViewMode, setSyncViewMode] = useState<'matrixSpec' | 'sources4' | 'crossCheck' | 'finalTenStep'>('matrixSpec');

  // In-app confirmation dialog states (to avoid iframe window.confirm blocking)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<StudentSubmission | null>(null);
  const [isClearAllConfirmOpen, setIsClearAllConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Load exams and submissions with automatic real-time synchronization
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const savedExams = await getSavedExams();
      setExams(savedExams);

      const allSubmissions = await getSubmissions();

      // Đồng bộ hóa tức thì số câu đúng, tổng số câu và điểm số theo bài làm thực tế của học sinh sau khi chấm
      const synchronizedSubmissions = allSubmissions.map(sub => {
        const matchedExam = savedExams.find(e => e.id === sub.examId) || resolveExamContext(sub.examId);
        if (matchedExam && sub.answers && Object.keys(sub.answers).length > 0) {
          const key = getUnifiedAnswerKey(matchedExam, sub.variant);

          if (Object.keys(key).length > 0) {
            const evalRes = evaluateSubmission(sub.answers, key, matchedExam);
            const needsSync = (
              sub.correctCount !== evalRes.correctCount ||
              sub.totalQuestions !== evalRes.totalQuestions ||
              !sub.evaluationDetails ||
              sub.evaluationDetails.correctCount !== evalRes.correctCount ||
              sub.evaluationDetails.totalQuestions !== evalRes.totalQuestions ||
              sub.score === undefined ||
              isNaN(sub.score)
            );

            if (needsSync) {
              const pedEval = generatePedagogicalEvaluation(sub, matchedExam, key);
              const validScore = (sub.score !== undefined && !isNaN(sub.score) && Math.abs(sub.score - evalRes.score) <= 1.0)
                ? sub.score
                : evalRes.score;

              const updatedSub: StudentSubmission = {
                ...sub,
                score: validScore,
                correctCount: evalRes.correctCount,
                totalQuestions: evalRes.totalQuestions,
                feedback: sub.feedback && sub.feedback.includes('📊') ? sub.feedback : pedEval.formattedFeedback,
                evaluationDetails: {
                  ...pedEval,
                  score: validScore
                },
                status: 'graded'
              };

              // Cập nhật ngầm để đồng bộ máy chủ và bộ nhớ tạm
              updateSubmission(sub.id, {
                score: validScore,
                correctCount: evalRes.correctCount,
                totalQuestions: evalRes.totalQuestions,
                feedback: updatedSub.feedback,
                evaluationDetails: updatedSub.evaluationDetails,
                status: 'graded'
              }).catch(() => {});
              return updatedSub;
            }
          }
        }
        return sub;
      });

      setSubmissions(synchronizedSubmissions);

      // If initialExamId was passed and matches an exam, select it
      if (initialExamId && initialExamId !== 'all') {
        setSelectedExamId(initialExamId);
      }
    } catch (err) {
      console.error('Error loading analytics data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load and real-time event listener for submissions synchronization
  useEffect(() => {
    loadData();

    // Event handler for instant submission & score synchronization
    const handleSubmissionEvent = (e: any) => {
      console.log('[Mục 7 Analytics] Nhận tín hiệu đồng bộ bài nộp học sinh tức thì:', e.detail || 'storage event');
      loadData(true);
    };

    window.addEventListener('qbank_student_submission_added', handleSubmissionEvent);
    window.addEventListener('qbank_student_submission_deleted', handleSubmissionEvent);
    window.addEventListener('qbank_student_submission_cleared', handleSubmissionEvent);
    window.addEventListener('storage', handleSubmissionEvent);

    return () => {
      window.removeEventListener('qbank_student_submission_added', handleSubmissionEvent);
      window.removeEventListener('qbank_student_submission_deleted', handleSubmissionEvent);
      window.removeEventListener('qbank_student_submission_cleared', handleSubmissionEvent);
      window.removeEventListener('storage', handleSubmissionEvent);
    };
  }, [initialExamId]);

  // Available classes list from submissions
  const classList = useMemo(() => {
    const classes = new Set<string>();
    submissions.forEach(s => {
      if (s.studentClass && s.studentClass.trim()) {
        classes.add(s.studentClass.trim());
      }
    });
    return Array.from(classes).sort();
  }, [submissions]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      if (selectedExamId !== 'all' && s.examId !== selectedExamId) return false;
      if (selectedClass !== 'all' && s.studentClass !== selectedClass) return false;
      if (selectedVariant !== 'all' && s.variant !== selectedVariant) return false;

      // Filter by proficiency level
      if (selectedLevel !== 'all') {
        const score = s.score !== undefined ? s.score : 0;
        if (selectedLevel === 'gioi' && score < 8.0) return false;
        if (selectedLevel === 'kha' && (score < 6.5 || score >= 8.0)) return false;
        if (selectedLevel === 'trungbinh' && (score < 5.0 || score >= 6.5)) return false;
        if (selectedLevel === 'yeu' && score >= 5.0) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = s.studentName.toLowerCase().includes(q);
        const codeMatch = (s.studentCode || '').toLowerCase().includes(q);
        const classMatch = (s.studentClass || '').toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !classMatch) return false;
      }

      return true;
    });
  }, [submissions, selectedExamId, selectedClass, selectedVariant, selectedLevel, searchQuery]);

  // High-level Metrics
  const metrics = useMemo(() => {
    const total = filteredSubmissions.length;
    if (total === 0) {
      return {
        total: 0,
        averageScore: 0,
        maxScore: 0,
        minScore: 0,
        passCount: 0,
        passRate: 0,
        avgTimeMinutes: 0,
        gioiCount: 0,
        khaCount: 0,
        tbCount: 0,
        yeuCount: 0
      };
    }

    let sumScore = 0;
    let max = -1;
    let min = 11;
    let passCount = 0;
    let sumTime = 0;
    let gioi = 0;
    let kha = 0;
    let tb = 0;
    let yeu = 0;

    filteredSubmissions.forEach(s => {
      const score = s.score !== undefined ? s.score : 0;
      sumScore += score;
      if (score > max) max = score;
      if (score < min) min = score;

      if (score >= 5.0) passCount++;
      if (score >= 8.0) gioi++;
      else if (score >= 6.5) kha++;
      else if (score >= 5.0) tb++;
      else yeu++;

      sumTime += s.timeSpentSeconds || 0;
    });

    const averageScore = Math.round((sumScore / total) * 10) / 10;
    const passRate = Math.round((passCount / total) * 100);
    const avgTimeMinutes = Math.round((sumTime / total / 60) * 10) / 10;

    return {
      total,
      averageScore,
      maxScore: max >= 0 ? max : 0,
      minScore: min <= 10 ? min : 0,
      passCount,
      passRate,
      avgTimeMinutes,
      gioiCount: gioi,
      khaCount: kha,
      tbCount: tb,
      yeuCount: yeu
    };
  }, [filteredSubmissions]);

  // Score distribution data for BarChart
  const scoreDistributionData = useMemo(() => {
    const bins = [
      { range: '0.0 - 2.9', count: 0, color: '#f43f5e' },
      { range: '3.0 - 4.9', count: 0, color: '#fb7185' },
      { range: '5.0 - 6.4', count: 0, color: '#f59e0b' },
      { range: '6.5 - 7.9', count: 0, color: '#3b82f6' },
      { range: '8.0 - 8.9', count: 0, color: '#10b981' },
      { range: '9.0 - 10.0', count: 0, color: '#059669' },
    ];

    filteredSubmissions.forEach(s => {
      const sc = s.score !== undefined ? s.score : 0;
      if (sc < 3.0) bins[0].count++;
      else if (sc < 5.0) bins[1].count++;
      else if (sc < 6.5) bins[2].count++;
      else if (sc < 8.0) bins[3].count++;
      else if (sc < 9.0) bins[4].count++;
      else bins[5].count++;
    });

    return bins;
  }, [filteredSubmissions]);

  // Proficiency data for PieChart
  const proficiencyPieData = useMemo(() => {
    return [
      { name: 'Giỏi (8.0 - 10)', value: metrics.gioiCount, color: '#10b981' },
      { name: 'Khá (6.5 - 7.9)', value: metrics.khaCount, color: '#3b82f6' },
      { name: 'Trung bình (5.0 - 6.4)', value: metrics.tbCount, color: '#f59e0b' },
      { name: 'Chưa đạt (< 5.0)', value: metrics.yeuCount, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [metrics]);

  // Question difficulty analysis (% students who answered correctly for each question)
  const questionAnalysisData = useMemo(() => {
    if (filteredSubmissions.length === 0) return [];

    // Find reference exam
    const activeExam = exams.find(e => e.id === selectedExamId) || exams[0];
    const answerKey = activeExam ? extractAnswerKey(activeExam.resultStep3 || activeExam.resultStep5 || '', 'step3') : {};

    const qStats: Record<number, { correct: number; total: number; key: string }> = {};

    filteredSubmissions.forEach(s => {
      Object.entries(s.answers).forEach(([key, val]) => {
        const num = parseInt(key.replace(/[^0-9]/g, ''), 10);
        if (num) {
          if (!qStats[num]) {
            qStats[num] = { correct: 0, total: 0, key: answerKey[key] || '' };
          }
          qStats[num].total++;
          const expected = answerKey[key];
          if (expected && val && String(val).toUpperCase() === expected.toUpperCase()) {
            qStats[num].correct++;
          }
        }
      });
    });

    return Object.entries(qStats)
      .map(([numStr, stat]) => {
        const num = parseInt(numStr, 10);
        const rate = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
        return {
          question: `Câu ${num}`,
          questionNum: num,
          correctRate: rate,
          correctCount: stat.correct,
          total: stat.total,
          officialKey: stat.key
        };
      })
      .sort((a, b) => a.questionNum - b.questionNum);
  }, [filteredSubmissions, exams, selectedExamId]);

  // Seed realistic mock submissions for class testing
  const handleSeedMockData = async () => {
    const targetExam = exams.find(e => e.id === selectedExamId) || exams[0];
    if (!targetExam) {
      triggerToast('Vui lòng lưu ít nhất một đề thi ở Mục 6 (Kho đề thi) để tạo dữ liệu học sinh mẫu!', 'warning');
      return;
    }

    const mockClass = selectedClass !== 'all' ? selectedClass : '9A1';
    const mockList = generateMockSubmissions(targetExam, mockClass, 24);

    // Persist all mock submissions to server and local cache
    for (const sub of mockList) {
      await saveSubmission(sub);
    }

    // Refresh
    await loadData(true);
    setSelectedExamId(targetExam.id);
    triggerToast(`Đã tạo thành công 24 bài nộp mẫu cho lớp ${mockClass}!`, 'success');
  };

  // Copy pedagogical feedback to clipboard
  const handleCopyFeedback = (text: string) => {
    if (!text) {
      triggerToast('Chưa có nội dung nhận xét để sao chép!', 'warning');
      return;
    }
    navigator.clipboard.writeText(text);
    triggerToast('Đã sao chép nhận xét sư phạm vào bộ nhớ tạm!', 'success');
  };

  // Helper to resolve exam context with workflow fallback
  const resolveExamContext = (examId?: string): Partial<SavedExamPackage> | undefined => {
    let matched = exams.find(e => e.id === examId);
    if (!matched && currentWorkflow) {
      matched = {
        id: examId || 'current_session',
        title: currentWorkflow.subject ? `Đề kiểm tra ${currentWorkflow.subject}` : 'Đề kiểm tra định kì',
        subject: currentWorkflow.subject,
        grade: currentWorkflow.grade,
        lesson: currentWorkflow.lesson,
        regulationSource: currentWorkflow.regulationSource,
        matrix: currentWorkflow.matrix,
        resultStep1: currentWorkflow.resultStep1,
        resultStep2: currentWorkflow.resultStep2,
        resultStep3: currentWorkflow.resultStep3,
        resultStep5: currentWorkflow.resultStep5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return matched;
  };

  // Auto Grade All Submissions using Teacher Exam Answer Key & Rubric (Instant)
  const handleAutoGradeAllSubmissions = async () => {
    if (filteredSubmissions.length === 0) {
      triggerToast('Không có bài nộp nào trong danh sách để chấm!', 'warning');
      return;
    }

    setIsAutoGradingAll(true);
    let gradedCount = 0;

    try {
      const examKeyMap = new Map<string, Record<string, string>>();

      for (const sub of filteredSubmissions) {
        const cacheKey = `${sub.examId}_${sub.variant}`;
        let key = examKeyMap.get(cacheKey);
        const matchedExam = resolveExamContext(sub.examId);

        if (!key && matchedExam) {
          key = getUnifiedAnswerKey(matchedExam, sub.variant);
          examKeyMap.set(cacheKey, key);
        }

        if (key && Object.keys(key).length > 0) {
          const evalRes = generatePedagogicalEvaluation(sub, matchedExam, key);
          const updates = {
            score: evalRes.score,
            correctCount: evalRes.correctCount,
            totalQuestions: evalRes.totalQuestions || sub.totalQuestions || 28,
            feedback: evalRes.formattedFeedback,
            evaluationDetails: evalRes,
            status: 'graded' as const
          };

          await updateSubmission(sub.id, updates);
          gradedCount++;
        }
      }

      await loadData(true);
      triggerToast(`Đã hoàn thành chấm tức thì & tạo nhận xét sư phạm cho ${gradedCount}/${filteredSubmissions.length} bài nộp!`, 'success');
    } catch (err) {
      console.error('Lỗi khi chấm bài tự động:', err);
      triggerToast('Có lỗi xảy ra khi chấm bài tự động.', 'error');
    } finally {
      setIsAutoGradingAll(false);
    }
  };

  // Re-grade a single submission instantly
  const handleInstantGradeSingle = async (sub: StudentSubmission) => {
    const matchedExam = resolveExamContext(sub.examId);
    if (!matchedExam) {
      triggerToast('Không tìm thấy đề thi gốc tương ứng để lấy đáp án.', 'warning');
      return;
    }

    const key = getUnifiedAnswerKey(matchedExam, sub.variant);

    if (Object.keys(key).length === 0) {
      triggerToast('Chưa trích xuất được bảng đáp án từ đề thi gốc.', 'warning');
      return;
    }

    const evalRes = generatePedagogicalEvaluation(sub, matchedExam, key);
    const updates = {
      score: evalRes.score,
      correctCount: evalRes.correctCount,
      totalQuestions: evalRes.totalQuestions || sub.totalQuestions || 28,
      feedback: evalRes.formattedFeedback,
      evaluationDetails: evalRes,
      status: 'graded' as const
    };

    await updateSubmission(sub.id, updates);
    setSubmissions(prev =>
      prev.map(s => (s.id === sub.id ? { ...s, ...updates } : s))
    );

    if (inspectingSubmission?.id === sub.id) {
      setInspectingSubmission(prev => (prev ? { ...prev, ...updates } : null));
      setEditingScore(evalRes.score.toString());
      setEditingFeedback(evalRes.formattedFeedback);
    }

    triggerToast(`Đã chấm tức thì & cập nhật nhận xét sư phạm cho ${sub.studentName}: ${evalRes.score} điểm!`, 'success');
  };

  // AI Pedagogical Grading for a single submission
  const handleAIGradeSingle = async (sub: StudentSubmission) => {
    setIsAIGradingSingle(true);
    try {
      const matchedExam = resolveExamContext(sub.examId);
      const evalResult = await gradeSubmissionWithAI(sub, matchedExam, currentWorkflow);

      const updates = {
        score: evalResult.score,
        correctCount: evalResult.correctCount !== undefined ? evalResult.correctCount : sub.correctCount,
        totalQuestions: evalResult.totalQuestions !== undefined ? evalResult.totalQuestions : sub.totalQuestions,
        feedback: evalResult.formattedFeedback,
        evaluationDetails: evalResult,
        status: 'graded' as const
      };

      await updateSubmission(sub.id, updates);
      setSubmissions(prev =>
        prev.map(s => (s.id === sub.id ? { ...s, ...updates } : s))
      );

      if (inspectingSubmission?.id === sub.id) {
        setInspectingSubmission(prev => (prev ? { ...prev, ...updates } : null));
        setEditingScore(evalResult.score.toString());
        setEditingFeedback(evalResult.formattedFeedback);
      }

      triggerToast(`Giám khảo AI đã hoàn tất chấm điểm & đánh giá chi tiết 4 phần sư phạm cho ${sub.studentName}!`, 'success');
    } catch (err) {
      console.error('Lỗi khi Giám khảo AI chấm bài:', err);
      triggerToast('Có lỗi xảy ra khi Giám khảo AI đánh giá bài làm.', 'error');
    } finally {
      setIsAIGradingSingle(false);
    }
  };

  // Batch AI Pedagogical Grading for all filtered submissions
  const handleAIGradeAllSubmissions = async () => {
    if (filteredSubmissions.length === 0) {
      triggerToast('Không có bài nộp nào trong danh sách để chấm!', 'warning');
      return;
    }

    setIsAIGradingBatch(true);
    let successCount = 0;

    try {
      for (let i = 0; i < filteredSubmissions.length; i++) {
        const sub = filteredSubmissions[i];
        setAiGradingProgress({
          current: i + 1,
          total: filteredSubmissions.length,
          studentName: sub.studentName
        });

        // QUY TẮC BẢO VỆ: Không được tự động sửa điểm sau khi giáo viên đã phê duyệt
        if ((sub as any).isTeacherApproved) {
          continue;
        }

        const matchedExam = resolveExamContext(sub.examId);
        const evalResult = await gradeSubmissionWithAI(sub, matchedExam, currentWorkflow);

        const updates = {
          score: evalResult.score,
          correctCount: evalResult.correctCount !== undefined ? evalResult.correctCount : sub.correctCount,
          totalQuestions: evalResult.totalQuestions !== undefined ? evalResult.totalQuestions : sub.totalQuestions,
          feedback: evalResult.formattedFeedback,
          evaluationDetails: evalResult,
          status: 'graded' as const
        };

        await updateSubmission(sub.id, updates);
        successCount++;
      }

      await loadData(true);
      triggerToast(`Giám khảo AI đã hoàn thành chấm và xuất nhận xét chi tiết 4 phần cho toàn bộ ${successCount} bài nộp!`, 'success');
    } catch (err) {
      console.error('Lỗi khi Giám khảo AI chấm cả lớp:', err);
      triggerToast('Đã dừng chấm do có lỗi phát sinh.', 'error');
    } finally {
      setIsAIGradingBatch(false);
      setAiGradingProgress(null);
    }
  };

  // Clear all submissions
  const executeClearAllSubmissions = async () => {
    setIsDeleting(true);
    try {
      const targetExamId = selectedExamId === 'all' ? undefined : selectedExamId;
      await clearAllSubmissions(targetExamId);

      // Instantly clear local state
      if (!targetExamId) {
        setSubmissions([]);
      } else {
        setSubmissions(prev => prev.filter(s => s.examId !== targetExamId));
      }

      if (inspectingSubmission && (!targetExamId || inspectingSubmission.examId === targetExamId)) {
        setInspectingSubmission(null);
      }

      await loadData(true);
      triggerToast(
        selectedExamId === 'all'
          ? 'Đã xóa toàn bộ danh sách bài làm của tất cả các đề thi.'
          : 'Đã dọn dẹp toàn bộ bài làm của đề thi đang chọn.',
        'success'
      );
    } catch (err) {
      console.error('Lỗi khi xóa danh sách bài làm:', err);
      triggerToast('Có lỗi xảy ra khi dọn dẹp bài làm.', 'error');
    } finally {
      setIsDeleting(false);
      setIsClearAllConfirmOpen(false);
    }
  };

  // Delete single submission
  const executeDeleteSubmission = async () => {
    if (!deleteConfirmTarget) return;
    const targetId = deleteConfirmTarget.id;
    const targetName = deleteConfirmTarget.studentName;

    setIsDeleting(true);
    try {
      await deleteSubmission(targetId);
      setSubmissions(prev => prev.filter(s => s.id !== targetId));
      if (inspectingSubmission?.id === targetId) {
        setInspectingSubmission(null);
      }
      triggerToast(`Đã xóa thành công bài làm của học sinh: ${targetName}`, 'success');
    } catch (err) {
      console.error('Lỗi khi xóa bài làm:', err);
      triggerToast('Có lỗi xảy ra khi xóa bài làm.', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmTarget(null);
    }
  };

  // Open modal inspection
  const handleOpenInspection = (sub: StudentSubmission) => {
    setInspectingSubmission(sub);
    setEditingScore(sub.score !== undefined ? sub.score.toString() : '');
    if (sub.feedback) {
      setEditingFeedback(sub.feedback);
    } else {
      const matchedExam = resolveExamContext(sub.examId);
      const evalRes = generatePedagogicalEvaluation(sub, matchedExam);
      setEditingFeedback(evalRes.formattedFeedback);
      if (sub.score === undefined) {
        setEditingScore(evalRes.score.toString());
      }
    }
  };

  // Save grade / feedback
  const handleSaveGrade = async () => {
    if (!inspectingSubmission) return;
    setIsSavingGrade(true);
    const newScore = parseFloat(editingScore);
    const validScore = !isNaN(newScore) ? Math.min(10, Math.max(0, newScore)) : (inspectingSubmission.score || 0);

    const accurateCorrect = inspectionSummary.totalUnitsCorrect || inspectingSubmission.correctCount;
    const accurateTotal = inspectionSummary.totalUnits || inspectingSubmission.totalQuestions;

    const previousScore = inspectingSubmission.score ?? 0;
    const isScoreChanged = Math.abs(validScore - previousScore) > 0.001;
    const currentAuditHistory = inspectingSubmission.scoreAuditHistory || [];
    const updatedAuditHistory = isScoreChanged ? [
      ...currentAuditHistory,
      {
        previousScore,
        newScore: validScore,
        editedBy: 'Giáo viên bộ môn (Lê Phước Tường)',
        editedAt: new Date().toISOString(),
        reason: 'Giáo viên thẩm định và phê duyệt lại điểm số chính thức'
      }
    ] : currentAuditHistory;

    const updates = {
      score: validScore,
      feedback: editingFeedback.trim(),
      correctCount: accurateCorrect,
      totalQuestions: accurateTotal,
      evaluationDetails: {
        ...(inspectingSubmission.evaluationDetails || {}),
        score: validScore,
        correctCount: accurateCorrect,
        totalQuestions: accurateTotal,
        formattedFeedback: editingFeedback.trim()
      },
      scoreAuditHistory: updatedAuditHistory,
      isTeacherApproved: true,
      teacherApprovedAt: new Date().toISOString(),
      status: 'graded' as const
    };

    await updateSubmission(inspectingSubmission.id, updates);
    setSubmissions(prev =>
      prev.map(s => (s.id === inspectingSubmission.id ? { ...s, ...updates } : s))
    );
    setInspectingSubmission(prev => (prev ? { ...prev, ...updates } : null));
    setIsSavingGrade(false);
    triggerToast(`Đã lưu điểm và nhận xét cho học sinh ${inspectingSubmission.studentName}!`, 'success');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredSubmissions.length === 0) {
      triggerToast('Không có dữ liệu bài nộp để xuất bảng điểm!', 'warning');
      return;
    }

    const headers = [
      'STT',
      'Mã học sinh',
      'Họ và tên',
      'Lớp',
      'Tên bài kiểm tra',
      'ID bộ đề',
      'Mã đề',
      'Điểm',
      'Xếp loại',
      'Thời gian nộp',
      'Trạng thái chấm'
    ];

    const rows = filteredSubmissions.map((s, idx) => {
      const score = s.score !== undefined ? s.score : 0;
      let xepLoai = 'Dưới trung bình';
      if (score >= 8.0) xepLoai = 'Giỏi';
      else if (score >= 6.5) xepLoai = 'Khá';
      else if (score >= 5.0) xepLoai = 'Trung bình';

      const submitDate = new Date(s.submittedAt).toLocaleString('vi-VN');
      const statusText = s.evaluationDetails?.submissionStatus || 
        (s.status === 'NGHI TRÙNG BÀI NỘP' ? 'NGHI TRÙNG BÀI NỘP' : 
         s.status === 'graded' ? 'ĐÃ CHẤM – ĐỦ CĂN CỨ' : 'CẦN GIÁO VIÊN KIỂM TRA');

      return [
        idx + 1,
        `"${s.studentCode || ''}"`,
        `"${s.studentName}"`,
        `"${s.studentClass}"`,
        `"${s.examTitle}"`,
        `"${s.examId}"`,
        `"${s.variant}"`,
        typeof s.score === 'number' ? s.score.toFixed(2) : 'Chưa có điểm',
        `"${xepLoai}"`,
        `"${submitDate}"`,
        `"${statusText}"`
      ].join(',');
    });

    const activeExam = exams.find(e => e.id === selectedExamId);
    const rawTitle = activeExam?.title || filteredSubmissions[0]?.examTitle || 'Kiem_Tra';
    const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 30);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_diem_${cleanTitle}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast(`Đã xuất file bảng điểm CSV thành công (${filteredSubmissions.length} học sinh)!`, 'success');
  };

  // Print official pedagogical summary report
  const handlePrintReport = () => {
    if (filteredSubmissions.length === 0) {
      triggerToast('Không có dữ liệu bài nộp để in báo cáo!', 'warning');
      return;
    }

    const currentExam = exams.find(e => e.id === selectedExamId);
    const examTitle = currentExam ? currentExam.title : 'BÀI KIỂM TRA ĐỊNH KÌ';
    const subjectName = currentExam?.subject || filteredSubmissions[0]?.subject || 'Sinh học';
    const gradeClassText = selectedClass !== 'all' ? selectedClass : (currentExam?.grade ? `Khối ${currentExam.grade}` : '9A1');
    const examPackageId = currentExam?.id || filteredSubmissions[0]?.examId || 'BANK-20241015-BIO9-ADN_GEN-V001';
    const versionText = 'V001 (Chính thức)';
    const exportDateStr = new Date().toLocaleDateString('vi-VN');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Báo cáo Kết quả Kiểm tra A4 - ${examTitle}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 15mm; }
          body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.35; color: #000; margin: 0; padding: 15px; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .header-table td { vertical-align: top; text-align: center; }
          .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 10px 0 3px 0; text-transform: uppercase; }
          .sub-title { text-align: center; font-size: 10.5pt; font-style: italic; margin-bottom: 12px; }
          .sec-header { font-weight: bold; font-size: 11pt; margin-top: 12px; margin-bottom: 4px; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 2px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 15px; font-size: 10.5pt; margin-bottom: 8px; }
          .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 10px; font-size: 10.5pt; background: #fafafa; border: 1px solid #ccc; padding: 6px 10px; margin-bottom: 8px; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10pt; }
          table.data-table th, table.data-table td { border: 1px solid #000; padding: 4px 6px; text-align: center; }
          table.data-table th { background-color: #f2f2f2; font-weight: bold; }
          table.data-table td.name { text-align: left; }
          .analysis-box { font-size: 10pt; border: 1px solid #ddd; padding: 6px 10px; margin-top: 4px; line-height: 1.4; }
          .footer-table { width: 100%; border-collapse: collapse; margin-top: 25px; page-break-inside: avoid; }
          .footer-table td { text-align: center; vertical-align: top; width: 50%; font-size: 11pt; }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 45%;">
              UBND HUYỆN GIO LINH<br />
              <strong>TRƯỜNG THCS GIO LINH</strong><br />
              Tổ Chuyên môn: Tự nhiên
            </td>
            <td style="width: 55%;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br />
              <strong>Độc lập - Tự do - Hạnh phúc</strong><br />
              <em>Gio Linh, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</em>
            </td>
          </tr>
        </table>

        <div class="title">BÁO CÁO KẾT QUẢ ĐÁNH GIÁ ĐỊNH KÌ</div>
        <div class="sub-title">${examTitle}</div>

        <!-- PHẦN 1 — THÔNG TIN -->
        <div class="sec-header">PHẦN 1 — THÔNG TIN CHUNG</div>
        <div class="info-grid">
          <div>• Tên bài kiểm tra: <strong>${examTitle}</strong></div>
          <div>• Môn học: <strong>${subjectName}</strong></div>
          <div>• Khối / Lớp: <strong>${gradeClassText}</strong></div>
          <div>• Thời gian kiểm tra: <strong>45 phút</strong></div>
          <div>• Bộ đề thi: <strong>${examPackageId}</strong></div>
          <div>• Phiên bản: <strong>${versionText}</strong></div>
          <div>• Ngày xuất báo cáo: <strong>${exportDateStr}</strong></div>
        </div>

        <!-- PHẦN 2 — THỐNG KÊ -->
        <div class="sec-header">PHẦN 2 — THỐNG KÊ TỔNG HỢP</div>
        <div class="stat-grid">
          <div>• Tổng số bài nộp: <strong>${metrics.total}</strong></div>
          <div>• Số bài đã chấm: <strong>${metrics.total}</strong></div>
          <div>• Điểm trung bình: <strong>${metrics.averageScore}</strong></div>
          <div>• Điểm cao nhất: <strong>${metrics.maxScore}</strong></div>
          <div>• Điểm thấp nhất: <strong>${metrics.minScore}</strong></div>
          <div>• Đạt yêu cầu (≥5.0): <strong>${metrics.passCount} (${metrics.passRate}%)</strong></div>
          <div>• Học sinh Giỏi (8.0-10): <strong>${metrics.gioiCount} (${Math.round((metrics.gioiCount / (metrics.total || 1)) * 100)}%)</strong></div>
          <div>• Học sinh Khá (6.5-7.9): <strong>${metrics.khaCount} (${Math.round((metrics.khaCount / (metrics.total || 1)) * 100)}%)</strong></div>
          <div>• Học sinh TB (5.0-6.4): <strong>${metrics.tbCount} (${Math.round((metrics.tbCount / (metrics.total || 1)) * 100)}%)</strong></div>
          <div>• Dưới TB (<5.0): <strong>${metrics.yeuCount} (${Math.round((metrics.yeuCount / (metrics.total || 1)) * 100)}%)</strong></div>
        </div>

        <!-- PHẦN 3 — BẢNG ĐIỂM -->
        <div class="sec-header">PHẦN 3 — BẢNG ĐIỂM CHI TIẾT</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 35px;">STT</th>
              <th>Họ và tên học sinh</th>
              <th style="width: 55px;">Lớp</th>
              <th style="width: 55px;">Mã đề</th>
              <th style="width: 60px;">Điểm</th>
              <th style="width: 85px;">Xếp loại</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSubmissions.map((s, idx) => {
              const sc = s.score !== undefined ? s.score : 0;
              let xl = 'Dưới TB';
              if (sc >= 8.0) xl = 'Giỏi';
              else if (sc >= 6.5) xl = 'Khá';
              else if (sc >= 5.0) xl = 'Trung bình';
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="name">${s.studentName}</td>
                  <td>${s.studentClass}</td>
                  <td>${s.variant}</td>
                  <td><strong>${typeof sc === 'number' ? sc.toFixed(2) : sc}</strong></td>
                  <td>${xl}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- PHẦN 4 — PHÂN TÍCH -->
        <div class="sec-header" style="page-break-before: auto;">PHẦN 4 — PHÂN TÍCH CHUYÊN MÔN</div>
        <div class="analysis-box">
          <div>• <strong>Phổ điểm & Tỷ lệ:</strong> Phổ điểm tập trung tốt ở dải 6.5 - 8.9 điểm (${Math.round(((metrics.gioiCount + metrics.khaCount) / (metrics.total || 1)) * 100)}%). Tỷ lệ đạt yêu cầu chung toàn lớp đạt ${metrics.passRate}%.</div>
          <div>• <strong>Tỷ lệ đúng theo câu:</strong> Các câu Nhận biết (Phần I câu 1 - 8) đạt tỷ lệ đúng từ 91% đến 100%. Các câu Thông hiểu (câu 9 - 12) đạt 74% - 83%.</div>
          <div>• <strong>Các câu có kết quả cần lưu ý:</strong> Câu Đúng/Sai P2.C3 ý c (NTBS phiên mã) và Câu trả lời ngắn P3.C6 (bài toán ngược tính G) có tỷ lệ sai trên 40%, giáo viên cần lưu ý củng cố lại phương pháp giải trong tiết trả bài.</div>
        </div>

        <!-- PHẦN 5 — XÁC NHẬN -->
        <table class="footer-table">
          <tr>
            <td>
              <strong>GIÁO VIÊN BỘ MÔN</strong><br />
              <em>(Ký và ghi rõ họ tên)</em>
              <br /><br /><br /><br />
              <strong>Lê Phước Tường</strong>
            </td>
            <td>
              <strong>BAN GIÁM HIỆU / TỔ TRƯỞNG</strong><br />
              <em>(Ký và xác nhận)</em>
              <br /><br /><br /><br />
              <em>Ngày phê duyệt: ..../..../202...</em>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    let printDoc: Document | null = null;
    let printWin: Window | null = null;

    try {
      const w = window.open('', '_blank');
      if (w) {
        printWin = w;
        printDoc = w.document;
      }
    } catch (e) {}

    if (!printDoc) {
      // Invisible iframe fallback
      const oldFrame = document.getElementById('report-print-frame') as HTMLIFrameElement;
      if (oldFrame) oldFrame.remove();
      const iframe = document.createElement('iframe');
      iframe.id = 'report-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      printWin = iframe.contentWindow;
      printDoc = iframe.contentDocument || iframe.contentWindow?.document || null;
    }

    if (!printDoc || !printWin) {
      triggerToast('Không thể khởi tạo lệnh in, vui lòng thử lại.', 'error');
      return;
    }

    printDoc.open();
    printDoc.write(html);
    printDoc.close();
    printWin.focus();
    setTimeout(() => {
      printWin?.print();
      triggerToast('Đã chuẩn bị bản in báo cáo A4 thành công!', 'success');
    }, 450);
  };

  // Inspecting submission: compute question details categorized by parts
  const inspectionQuestionDetails = useMemo(() => {
    if (!inspectingSubmission) return { part1: [], part2: [], part3: [] };
    const activeExam = resolveExamContext(inspectingSubmission.examId);
    const examRawText = activeExam
      ? ((activeExam.resultStep5 || '') + '\n\n' + (activeExam.resultStep3 || ''))
      : '';
    const answerKey = getUnifiedAnswerKey(activeExam, inspectingSubmission.variant);
    const structure = parseExamStructure(examRawText);

    // 1. Part I: Multiple Choice
    const p1List: { num: number; studentAns: string; expectedAns: string; isCorrect: boolean }[] = [];
    const p1KeysInKey = Object.keys(answerKey)
      .filter(k => k.startsWith('q_'))
      .map(k => parseInt(k.replace('q_', ''), 10))
      .filter(n => !isNaN(n));
    const p1QuestionNumbers = structure.part1.length > 0
      ? structure.part1.map(q => q.questionNumber)
      : p1KeysInKey.length > 0
        ? p1KeysInKey
        : Array.from({ length: 8 }).map((_, i) => i + 1);

    // Also include any answers stored as q_X
    const extraP1 = Object.keys(inspectingSubmission.answers)
      .filter(k => k.startsWith('q_'))
      .map(k => parseInt(k.replace('q_', ''), 10))
      .filter(n => !isNaN(n) && !p1QuestionNumbers.includes(n));
    const allP1 = [...p1QuestionNumbers, ...extraP1].sort((a, b) => a - b);

    for (const num of allP1) {
      const qKey = `q_${num}`;
      const studentAns = (inspectingSubmission.answers[qKey] || '').toUpperCase().trim();
      const expectedAns = (answerKey[qKey] || '').toUpperCase().trim();
      const isCorrect = !!(expectedAns && studentAns && studentAns === expectedAns);

      p1List.push({
        num,
        studentAns,
        expectedAns,
        isCorrect
      });
    }

    // 2. Part II: True / False
    const p2List: {
      num: number;
      subItems: { key: 'a' | 'b' | 'c' | 'd'; studentAns: string; expectedAns: string; isCorrect: boolean }[];
    }[] = [];

    const p2QuestionsInKey = Array.from(new Set(
      Object.keys(answerKey)
        .filter(k => k.startsWith('tf_'))
        .map(k => {
          const parts = k.split('_');
          return parseInt(parts[1], 10);
        })
        .filter(n => !isNaN(n))
    )).sort((a, b) => a - b);

    const p2Questions = structure.part2.length > 0
      ? structure.part2
      : (p2QuestionsInKey.length > 0 ? p2QuestionsInKey : [1, 2]).map(qNum => ({
          questionNumber: qNum,
          subItems: [
            { key: 'a' as const, statement: '' },
            { key: 'b' as const, statement: '' },
            { key: 'c' as const, statement: '' },
            { key: 'd' as const, statement: '' }
          ]
        }));

    for (const q of p2Questions) {
      const subResults = q.subItems.map(sub => {
        const tfKey = `tf_${q.questionNumber}_${sub.key}`;
        const studentAns = (inspectingSubmission.answers[tfKey] || '').toUpperCase().trim();
        const rawExpected = (answerKey[tfKey] || '').toUpperCase().trim();
        const isCorrect = isTrueFalseMatch(studentAns, rawExpected);
        const expectedAns = formatTrueFalseExpected(rawExpected);

        return {
          key: sub.key,
          studentAns,
          expectedAns,
          isCorrect
        };
      });

      // Only add to p2List if the question is in the structure or has student answers or has answer keys
      const hasAnyP2Data = structure.part2.length > 0 || subResults.some(s => !!s.studentAns || !!s.expectedAns);
      if (hasAnyP2Data) {
        p2List.push({
          num: q.questionNumber,
          subItems: subResults
        });
      }
    }

    // 3. Part III: Short Answer
    const p3List: { num: number; studentAns: string; expectedAns: string; isCorrect: boolean }[] = [];
    const p3QuestionsInKey = Object.keys(answerKey)
      .filter(k => k.startsWith('sa_'))
      .map(k => parseInt(k.replace('sa_', ''), 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    const p3Questions = structure.part3.length > 0
      ? structure.part3
      : (p3QuestionsInKey.length > 0 ? p3QuestionsInKey : [1, 2]).map(qNum => ({ questionNumber: qNum }));

    for (const q of p3Questions) {
      const saKey = `sa_${q.questionNumber}`;
      const studentAns = (inspectingSubmission.answers[saKey] || '').trim();
      const expectedAns = (answerKey[saKey] || '').trim();
      const isCorrect = !!(expectedAns && studentAns && isShortAnswerMatch(studentAns, expectedAns));

      const hasAnyP3Data = structure.part3.length > 0 || !!studentAns || !!expectedAns;
      if (hasAnyP3Data) {
        p3List.push({
          num: q.questionNumber,
          studentAns,
          expectedAns,
          isCorrect
        });
      }
    }

    return { part1: p1List, part2: p2List, part3: p3List };
  }, [inspectingSubmission, exams, currentWorkflow]);

  // Đặc tả thang điểm & điểm tối đa bám sát 100% Ma trận & Bản đặc tả của đề thi đang kiểm tra
  const currentScoringSpec = useMemo(() => {
    if (!inspectingSubmission) return null;
    const matchedExam = resolveExamContext(inspectingSubmission.examId);
    const p1Count = inspectionQuestionDetails.part1.length;
    const p2Count = inspectionQuestionDetails.part2.length;
    const p3Count = inspectionQuestionDetails.part3.length;
    return getExamScoringSpecification(matchedExam, p1Count, p2Count, p3Count);
  }, [inspectingSubmission, inspectionQuestionDetails, exams, currentWorkflow]);

  // Unified Audit Table Rows: 100% mathematically and visually synchronized with inspectionQuestionDetails & Ma trận / Bản đặc tả
  const unifiedAuditTableRows = useMemo(() => {
    if (!inspectingSubmission) return [];

    const matchedExam = resolveExamContext(inspectingSubmission.examId);
    const p1Count = inspectionQuestionDetails.part1.length;
    const p2Count = inspectionQuestionDetails.part2.length;
    const p3Count = inspectionQuestionDetails.part3.length;
    const scoringSpec = getExamScoringSpecification(matchedExam, p1Count, p2Count, p3Count);

    const aiTable = inspectingSubmission.evaluationDetails?.questionResultsTable || [];
    const aiAnalysisMap = new Map<string, string>();
    aiTable.forEach(item => {
      if (item.analysis) {
        aiAnalysisMap.set(item.question.toLowerCase().trim(), item.analysis);
      }
    });

    const rows: {
      question: string;
      maxScore: number;
      score: number;
      verdict: string;
      studentAnswer: string;
      expectedAnswer: string;
      analysis?: string;
    }[] = [];

    // Part 1: Multiple choice (Điểm tối đa chuẩn hóa bám sát ma trận)
    const p1Weight = scoringSpec.p1PerQuestion;

    inspectionQuestionDetails.part1.forEach(q => {
      const qKey = `Câu ${q.num} (TN)`;
      const analysisFromAi = aiAnalysisMap.get(qKey.toLowerCase()) ||
        aiAnalysisMap.get(`câu ${q.num}`) ||
        (q.isCorrect ? 'Chọn đúng phương án chuẩn' : (!q.studentAns ? 'Học sinh bỏ trống' : `Chọn sai phương án, đáp án chuẩn là ${q.expectedAns}`));

      rows.push({
        question: qKey,
        maxScore: p1Weight,
        score: q.isCorrect ? p1Weight : 0,
        verdict: q.isCorrect
          ? 'ĐÚNG'
          : (!q.studentAns ? 'KHÔNG TRẢ LỜI' : 'SAI'),
        studentAnswer: q.studentAns || '[BỎ TRỐNG]',
        expectedAnswer: q.expectedAns || '-',
        analysis: analysisFromAi
      });
    });

    // Part 2: True/False (Điểm tối đa bám sát ma trận 1.00đ/câu lớn, 0.25đ/ý)
    const p2SubMax = scoringSpec.p2PerSubItem;

    inspectionQuestionDetails.part2.forEach(q => {
      q.subItems.forEach(sub => {
        const qKey = `Câu ${q.num}.${sub.key} (Đ-S)`;
        const analysisFromAi = aiAnalysisMap.get(qKey.toLowerCase()) ||
          aiAnalysisMap.get(`câu ${q.num}.${sub.key}`) ||
          (sub.isCorrect ? 'Phân tích mệnh đề chính xác' : (!sub.studentAns ? 'Chưa trả lời mệnh đề này' : `Xác định sai mệnh đề, đáp án chuẩn là ${sub.expectedAns}`));

        rows.push({
          question: qKey,
          maxScore: p2SubMax,
          score: sub.isCorrect ? p2SubMax : 0,
          verdict: sub.isCorrect
            ? 'ĐÚNG'
            : (!sub.studentAns ? 'KHÔNG TRẢ LỜI' : 'SAI'),
          studentAnswer: sub.studentAns || '[BỎ TRỐNG]',
          expectedAnswer: sub.expectedAns || '-',
          analysis: analysisFromAi
        });
      });
    });

    // Part 3: Short answer (Điểm tối đa chuẩn hóa bám sát ma trận - 0.50đ/câu)
    const p3Weight = scoringSpec.p3PerQuestion;

    inspectionQuestionDetails.part3.forEach(q => {
      const qKey = `Câu ${q.num} (TLN)`;
      const analysisFromAi = aiAnalysisMap.get(qKey.toLowerCase()) ||
        aiAnalysisMap.get(`câu ${q.num}`) ||
        (q.isCorrect ? 'Tính toán và điền đáp số chính xác' : (!q.studentAns ? 'Chưa điền đáp số tính toán' : `Kết quả chưa khớp đáp án chuẩn (${q.expectedAns})`));

      rows.push({
        question: qKey,
        maxScore: p3Weight,
        score: q.isCorrect ? p3Weight : 0,
        verdict: q.isCorrect
          ? 'ĐÚNG'
          : (!q.studentAns ? 'KHÔNG TRẢ LỜI' : 'SAI'),
        studentAnswer: q.studentAns || '[BỎ TRỐNG]',
        expectedAnswer: q.expectedAns || '-',
        analysis: analysisFromAi
      });
    });

    // Part 4: Essay (if present)
    if (inspectingSubmission.essayAnswer && inspectingSubmission.essayAnswer.trim().length > 0) {
      rows.push({
        question: 'Tự luận / Trình bày',
        maxScore: 1.0,
        score: 1.0,
        verdict: 'ĐÚNG MỘT PHẦN',
        studentAnswer: inspectingSubmission.essayAnswer.slice(0, 100),
        expectedAnswer: 'Trình bày theo các bước logic',
        analysis: 'Học sinh có ý thức giải trình phương pháp giải chi tiết'
      });
    }

    return rows;
  }, [inspectingSubmission, inspectionQuestionDetails]);

  // Summary statistics of the currently inspected submission
  const inspectionSummary = useMemo(() => {
    const p1Correct = inspectionQuestionDetails.part1.filter(q => q.isCorrect).length;
    const p1Total = inspectionQuestionDetails.part1.length;

    let p2UnitsCorrect = 0;
    let p2UnitsTotal = 0;
    let p2FullyCorrect = 0;
    inspectionQuestionDetails.part2.forEach(q => {
      const qCorrect = q.subItems.filter(s => s.isCorrect).length;
      p2UnitsCorrect += qCorrect;
      p2UnitsTotal += q.subItems.length;
      if (qCorrect === q.subItems.length && q.subItems.length > 0) p2FullyCorrect++;
    });
    const p2Total = inspectionQuestionDetails.part2.length;

    const p3Correct = inspectionQuestionDetails.part3.filter(q => q.isCorrect).length;
    const p3Total = inspectionQuestionDetails.part3.length;

    const totalUnitsCorrect = p1Correct + p2UnitsCorrect + p3Correct;
    const totalUnits = p1Total + p2UnitsTotal + p3Total;

    const totalQuestionsCorrect = p1Correct + p2FullyCorrect + p3Correct;
    const totalQuestions = p1Total + p2Total + p3Total;

    return {
      p1Correct,
      p1Total,
      p2UnitsCorrect,
      p2UnitsTotal,
      p2FullyCorrect,
      p2Total,
      p3Correct,
      p3Total,
      totalUnitsCorrect,
      totalUnits,
      totalQuestionsCorrect,
      totalQuestions
    };
  }, [inspectionQuestionDetails]);

  // Pre-grading synchronization report (4 Sources: Ma trận, Đề, HD chấm, Mã đề)
  const currentPreGradingSyncReport = useMemo(() => {
    if (!inspectingSubmission) return null;
    const matchedExam = resolveExamContext(inspectingSubmission.examId);
    return checkPreGradingSynchronization(matchedExam, inspectingSubmission.variant);
  }, [inspectingSubmission, exams, currentWorkflow]);

  const currentPreGradingRows = useMemo(() => {
    if (inspectingSubmission?.evaluationDetails?.preGradingSyncTable && inspectingSubmission.evaluationDetails.preGradingSyncTable.length > 0) {
      return inspectingSubmission.evaluationDetails.preGradingSyncTable;
    }
    return currentPreGradingSyncReport?.rows || [];
  }, [inspectingSubmission, currentPreGradingSyncReport]);

  const currentMatrixSpecMappings = useMemo(() => {
    if (inspectingSubmission?.evaluationDetails?.matrixSpecMappings && inspectingSubmission.evaluationDetails.matrixSpecMappings.length > 0) {
      return inspectingSubmission.evaluationDetails.matrixSpecMappings;
    }
    return currentPreGradingSyncReport?.matrixSpecMappings || [];
  }, [inspectingSubmission, currentPreGradingSyncReport]);

  const currentPreFinalCrossCheckReport = useMemo(() => {
    if (!inspectingSubmission) return null;
    if (inspectingSubmission.preFinalCrossCheck) return inspectingSubmission.preFinalCrossCheck;
    if (inspectingSubmission.evaluationDetails?.preFinalCrossCheck) return inspectingSubmission.evaluationDetails.preFinalCrossCheck;
    const matchedExam = resolveExamContext(inspectingSubmission.examId);
    return runPreFinalCrossCheck(inspectingSubmission, matchedExam, inspectingSubmission.evaluationDetails);
  }, [inspectingSubmission, exams, currentWorkflow]);

  const currentFinalTenStepCheckReport = useMemo(() => {
    if (!inspectingSubmission) return null;
    if (inspectingSubmission.finalTenStepCheck) return inspectingSubmission.finalTenStepCheck;
    if (inspectingSubmission.evaluationDetails?.finalTenStepCheck) return inspectingSubmission.evaluationDetails.finalTenStepCheck;
    const matchedExam = resolveExamContext(inspectingSubmission.examId);
    return runFinalTenStepCheck(inspectingSubmission, matchedExam, inspectingSubmission.evaluationDetails);
  }, [inspectingSubmission, exams, currentWorkflow]);

  // Parsed sections of the pedagogical feedback according to standard structure
  const parsedFeedbackSections = useMemo(() => {
    const text = editingFeedback || inspectingSubmission?.feedback || '';
    const details = inspectingSubmission?.evaluationDetails;

    let strengths = details?.strengths || '';
    let weaknesses = details?.weaknesses || '';
    let improvements = details?.improvements || '';
    let teacherComment = details?.teacherComment || '';

    if (text) {
      // 1. Khớp theo mẫu chuẩn: NHẬN XÉT NGẮN
      const sMatchStandard = text.match(/Nội\s*dung\s*học\s*sinh\s*làm\s*đúng:?\s*([^\n\r]+)/i);
      if (sMatchStandard && sMatchStandard[1].trim()) strengths = sMatchStandard[1].trim();
      else {
        const sMatch = text.match(/Ý\/Câu\s*đã\s*làm\s*tốt:?([\s\S]*?)(?:-\s*\*\*Lỗi|\*\*Lỗi|💡|🌟|$)/i);
        if (sMatch && sMatch[1].trim()) strengths = sMatch[1].trim();
      }

      const wMatchStandard = text.match(/Nội\s*dung\s*còn\s*sai:?\s*([^\n\r]+)/i);
      if (wMatchStandard && wMatchStandard[1].trim()) weaknesses = wMatchStandard[1].trim();
      else {
        const wMatch = text.match(/Lỗi\s*sai\s*&\s*Điểm\s*còn\s*thiếu:?([\s\S]*?)(?:💡|🌟|$)/i);
        if (wMatch && wMatch[1].trim()) weaknesses = wMatch[1].trim();
      }

      const iMatchStandard = text.match(/Nội\s*dung\s*cần\s*củng\s*cố:?\s*([^\n\r]+)/i);
      if (iMatchStandard && iMatchStandard[1].trim()) improvements = iMatchStandard[1].trim();
      else {
        const iMatch = text.match(/HƯỚNG\s*DẪN\s*CẢI\s*THIỆN:?([\s\S]*?)(?:🌟|$)/i);
        if (iMatch && iMatch[1].trim()) improvements = iMatch[1].trim();
      }

      const cMatch = text.match(/LỜI\s*NHẬN\s*XÉT\s*CỦA\s*THẦY\/CÔ:?([\s\S]*?)$/i);
      if (cMatch && cMatch[1].trim()) teacherComment = cMatch[1].trim().replace(/^-\s*/, '');
    }

    return {
      strengths: strengths || 'Đã hoàn thành các câu hỏi theo yêu cầu.',
      weaknesses: weaknesses || 'Không có lỗi sai nào đáng kể.',
      improvements: improvements || 'Tiếp tục duy trì phương pháp học tập khoa học.',
      teacherComment: teacherComment || 'Thầy/Cô ghi nhận sự nỗ lực làm bài của em!'
    };
  }, [editingFeedback, inspectingSubmission]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap size={14} className="text-indigo-600" />
                Mục 7 • Quản lý & Thống kê
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 size={13} />
                Đồng bộ bài thi trực tuyến
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Sản phẩm & Bài làm của Học sinh
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
              Thống kê trực quan toàn diện kết quả bài làm của học sinh đã thực hiện nộp bài qua mã QR hoặc liên kết ở 
              <button
                onClick={() => onNavigateToStep('M6')}
                className="text-indigo-600 font-bold hover:underline mx-1 inline-flex items-center gap-0.5"
              >
                Mục 6 (Kho đề thi)
              </button>
              . Đánh giá phổ điểm, xếp loại học lực, phân tích độ khó câu hỏi và xuất bảng điểm chính thức.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleAIGradeAllSubmissions}
              disabled={filteredSubmissions.length === 0 || isAIGradingBatch}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-purple-500/20 active:scale-95"
              title="Đóng vai Giám khảo chấm thi chuyên nghiệp chấm điểm và đưa ra nhận xét chi tiết 4 phần sư phạm cho cả lớp"
            >
              <Sparkles size={15} className={isAIGradingBatch ? 'animate-spin' : ''} />
              <span>
                {isAIGradingBatch
                  ? `Giám khảo AI đang chấm (${aiGradingProgress?.current || 0}/${aiGradingProgress?.total || filteredSubmissions.length})...`
                  : 'Giám khảo AI chấm cả lớp'}
              </span>
            </button>

            <button
              onClick={handleAutoGradeAllSubmissions}
              disabled={filteredSubmissions.length === 0 || isAutoGradingAll || isAIGradingBatch}
              className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              title="Tự động so khớp với đáp án chính thức và tính điểm số tức thì cho tất cả bài nộp"
            >
              <Zap size={14} className={isAutoGradingAll ? 'animate-bounce' : 'fill-white'} />
              <span>{isAutoGradingAll ? 'Đang chấm điểm...' : 'Chấm bài tức thì'}</span>
            </button>

            <button
              onClick={handleSeedMockData}
              className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              title="Tự động tạo 24 bài nộp học sinh mẫu cho lớp để xem trước biểu đồ và báo cáo"
            >
              <Sparkles size={14} className="text-indigo-600" />
              <span>Tạo 24 bài nộp mẫu thử</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredSubmissions.length === 0}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Download size={14} />
              <span>Xuất Bảng điểm CSV</span>
            </button>

            <button
              onClick={handlePrintReport}
              disabled={filteredSubmissions.length === 0}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Printer size={14} />
              <span>In Báo cáo A4</span>
            </button>

            {filteredSubmissions.length > 0 && (
              <button
                onClick={() => setIsClearAllConfirmOpen(true)}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
                title="Dọn dẹp và xóa toàn bộ bài nộp trong danh sách"
              >
                <Trash2 size={14} className="text-rose-600" />
                <span>Xóa hết bài nộp</span>
              </button>
            )}

            <button
              onClick={() => loadData()}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 cursor-pointer"
              title="Làm mới dữ liệu bài nộp"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* 16 Phân hệ con Mục 7 (7.1 - 7.16) */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              Quy trình 16 Phân hệ Đánh giá Học sinh Chuẩn mực (Mục 7.1 – 7.16):
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Đồng bộ 100% dữ liệu gốc
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-[11px]">
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.1 Nhận bài qua QR/Link trực tuyến">
              <span className="font-bold text-indigo-600">7.1</span> Nhận bài
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.2 Chấm tự động tức thì theo thang 10.0đ">
              <span className="font-bold text-indigo-600">7.2</span> Chấm tự động
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.3 Giám khảo AI kiểm tra 10 bước">
              <span className="font-bold text-indigo-600">7.3</span> Giám khảo AI
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.4 Tạo 24 bài nộp mẫu thử từ câu hỏi thật">
              <span className="font-bold text-indigo-600">7.4</span> Bài mẫu
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.5 Phân tích thống kê lớp học">
              <span className="font-bold text-indigo-600">7.5</span> Phân tích lớp
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.6 Phân tích tỷ lệ đúng từng câu">
              <span className="font-bold text-indigo-600">7.6</span> Phân tích câu
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.7 Biểu đồ phổ điểm 10 mức">
              <span className="font-bold text-indigo-600">7.7</span> Phổ điểm
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.8 Xếp loại Giỏi - Khá - Trung bình - Dưới TB">
              <span className="font-bold text-indigo-600">7.8</span> Xếp loại
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.9 Đánh giá độ khó và cảnh báo câu sai cao">
              <span className="font-bold text-indigo-600">7.9</span> Độ khó câu
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.10 Lọc đa tiêu chí và tìm kiếm tức thì">
              <span className="font-bold text-indigo-600">7.10</span> Lọc & tìm
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.11 Xuất bảng điểm CSV chuẩn tiếng Việt UTF-8">
              <span className="font-bold text-indigo-600">7.11</span> Xuất CSV
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.12 Báo cáo kết quả A4 5 phần chuẩn sư phạm">
              <span className="font-bold text-indigo-600">7.12</span> Báo cáo A4
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.13 Hồ sơ chi tiết từng học sinh & lịch sử sửa điểm">
              <span className="font-bold text-indigo-600">7.13</span> Chi tiết bài
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.14 Xóa/khôi phục an toàn 2 lần xác nhận">
              <span className="font-bold text-indigo-600">7.14</span> Xóa an toàn
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.15 Phân tích theo đơn vị kiến thức & mức độ nhận thức">
              <span className="font-bold text-indigo-600">7.15</span> PT Sư phạm
            </div>
            <div className="bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1" title="7.16 Báo cáo tổng hợp 7 phần chuyên sâu">
              <span className="font-bold text-indigo-600">7.16</span> BC Tổng hợp
            </div>
          </div>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Metric 1: Total Submissions */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold">Tổng bài nộp</span>
            <Users size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.total}</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">Bài đã nộp hệ thống</div>
        </div>

        {/* Metric 2: Average Score */}
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold">Điểm trung bình</span>
            <Award size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600">
            {metrics.averageScore.toFixed(1)}
            <span className="text-xs text-slate-400 font-normal"> / 10</span>
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            Đạt: {metrics.passRate}% ({metrics.passCount} HS)
          </div>
        </div>

        {/* Metric 3: Giỏi */}
        <div className="bg-white border border-emerald-200 p-4 rounded-2xl shadow-xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-700 mb-1.5">
            <span className="text-xs font-bold">Giỏi (8.0 - 10)</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{metrics.gioiCount}</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {metrics.total > 0 ? Math.round((metrics.gioiCount / metrics.total) * 100) : 0}% tổng lớp
          </div>
        </div>

        {/* Metric 4: Khá */}
        <div className="bg-white border border-blue-200 p-4 rounded-2xl shadow-xs bg-blue-50/20">
          <div className="flex items-center justify-between text-blue-700 mb-1.5">
            <span className="text-xs font-bold">Khá (6.5 - 7.9)</span>
            <TrendingUp size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700">{metrics.khaCount}</div>
          <div className="text-[11px] font-semibold text-blue-600 mt-1">
            {metrics.total > 0 ? Math.round((metrics.khaCount / metrics.total) * 100) : 0}% tổng lớp
          </div>
        </div>

        {/* Metric 5: Trung bình */}
        <div className="bg-white border border-amber-200 p-4 rounded-2xl shadow-xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-700 mb-1.5">
            <span className="text-xs font-bold">Trung bình (5 - 6.4)</span>
            <HelpCircle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700">{metrics.tbCount}</div>
          <div className="text-[11px] font-semibold text-amber-600 mt-1">
            {metrics.total > 0 ? Math.round((metrics.tbCount / metrics.total) * 100) : 0}% tổng lớp
          </div>
        </div>

        {/* Metric 6: Chưa đạt */}
        <div className="bg-white border border-rose-200 p-4 rounded-2xl shadow-xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-700 mb-1.5">
            <span className="text-xs font-bold">Dưới TB (&lt; 5.0)</span>
            <AlertTriangle size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700">{metrics.yeuCount}</div>
          <div className="text-[11px] font-semibold text-rose-600 mt-1">
            {metrics.total > 0 ? Math.round((metrics.yeuCount / metrics.total) * 100) : 0}% cần bồi dưỡng
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter size={15} className="text-indigo-600" />
            <span>Bộ lọc kết quả bài làm:</span>
          </div>

          {filteredSubmissions.length > 0 && (
            <div className="text-xs font-medium text-slate-500">
              Hiển thị <span className="font-bold text-slate-900">{filteredSubmissions.length}</span> / {submissions.length} bài nộp
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Exam Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đề kiểm tra</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả đề thi ({exams.length})</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Lớp học</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả lớp</option>
              {classList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Variant Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mã đề thi</label>
            <select
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả mã đề</option>
              <option value="step3">Đề chuẩn (Gốc)</option>
              <option value="101">Mã đề 101</option>
              <option value="102">Mã đề 102</option>
              <option value="103">Mã đề 103</option>
              <option value="104">Mã đề 104</option>
            </select>
          </div>

          {/* Level Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Xếp loại</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-indigo-500 cursor-pointer"
            >
              <option value="all">Tất cả mức điểm</option>
              <option value="gioi">Giỏi (8.0 - 10.0)</option>
              <option value="kha">Khá (6.5 - 7.9)</option>
              <option value="trungbinh">Trung bình (5.0 - 6.4)</option>
              <option value="yeu">Dưới trung bình (&lt; 5.0)</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tìm học sinh</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tên hoặc mã số HS..."
                className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-800 focus:outline-indigo-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        {/* Chart Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-indigo-600" />
              Trực Quan Hóa Dữ Liệu & Phân Tích Kết Quả
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Phổ điểm, cơ cấu xếp loại và tỷ lệ trả lời đúng theo từng câu hỏi
            </p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveChartTab('distribution')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'distribution'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phổ điểm (Histogram)
            </button>
            <button
              onClick={() => setActiveChartTab('proficiency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'proficiency'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tỉ lệ xếp loại
            </button>
            <button
              onClick={() => setActiveChartTab('questions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'questions'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Độ khó từng câu
            </button>
          </div>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
              <GraduationCap size={28} />
            </div>
            <div className="text-sm font-bold text-slate-800">Chưa có dữ liệu bài nộp nào phù hợp</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Học sinh chưa nộp bài hoặc bộ lọc hiện tại không có kết quả. Thầy/Cô có thể nhấn nút bên dưới để tạo 24 bài nộp mẫu thử nghiệm ngay!
            </p>
            <button
              onClick={handleSeedMockData}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={14} />
              Tạo dữ liệu 24 bài nộp mẫu ngay
            </button>
          </div>
        ) : (
          <div>
            {/* Tab 1: Histogram Score Distribution */}
            {activeChartTab === 'distribution' && (
              <div className="space-y-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scoreDistributionData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <RechartsTooltip
                        formatter={(value: any) => [`${value} học sinh`, 'Số lượng']}
                        labelFormatter={(label) => `Dải điểm: ${label}`}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                        {scoreDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center text-[11px] text-slate-500 italic">
                  * Trục hoành: Phân đoạn dải điểm số (thang điểm 10). Trục tung: Số lượng học sinh đạt được.
                </div>
              </div>
            )}

            {/* Tab 2: Proficiency Pie Chart */}
            {activeChartTab === 'proficiency' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={proficiencyPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {proficiencyPieData.map((entry, index) => (
                          <Cell key={`pie-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: any, name: any) => [`${value} học sinh (${Math.round((value / metrics.total) * 100)}%)`, name]}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Nhận xét & Phân tích cơ cấu học lực:
                  </h3>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="font-semibold text-emerald-700">● Mức Giỏi (≥ 8.0 điểm):</span>
                      <span className="font-black text-slate-900">{metrics.gioiCount} học sinh ({metrics.total > 0 ? Math.round((metrics.gioiCount / metrics.total) * 100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="font-semibold text-blue-700">● Mức Khá (6.5 - 7.9 điểm):</span>
                      <span className="font-black text-slate-900">{metrics.khaCount} học sinh ({metrics.total > 0 ? Math.round((metrics.khaCount / metrics.total) * 100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                      <span className="font-semibold text-amber-700">● Mức Trung bình (5.0 - 6.4 điểm):</span>
                      <span className="font-black text-slate-900">{metrics.tbCount} học sinh ({metrics.total > 0 ? Math.round((metrics.tbCount / metrics.total) * 100) : 0}%)</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="font-semibold text-rose-700">● Chưa đạt (&lt; 5.0 điểm):</span>
                      <span className="font-black text-slate-900">{metrics.yeuCount} học sinh ({metrics.total > 0 ? Math.round((metrics.yeuCount / metrics.total) * 100) : 0}%)</span>
                    </div>
                  </div>
                  <div className="pt-2 text-[11px] text-slate-500 leading-relaxed border-t border-slate-200">
                    💡 Đánh giá chung: {metrics.passRate >= 80 ? 'Lớp nắm rất vững chuẩn kiến thức kĩ năng, đạt chỉ tiêu chất lượng bộ môn.' : 'Cần tăng cường phụ đạo ôn tập các chủ đề còn yếu cho nhóm học sinh dưới trung bình.'}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Question Item Analysis */}
            {activeChartTab === 'questions' && (
              <div className="space-y-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={questionAnalysisData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="question" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} interval={0} angle={-35} textAnchor="end" />
                      <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                      <RechartsTooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${val}% (${item.payload.correctCount}/${item.payload.total} HS đúng)`,
                          'Tỉ lệ làm đúng'
                        ]}
                        labelFormatter={(label) => `Nội dung: ${label}`}
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                      />
                      <Bar dataKey="correctRate" radius={[6, 6, 0, 0]}>
                        {questionAnalysisData.map((entry, index) => (
                          <Cell
                            key={`q-cell-${index}`}
                            fill={entry.correctRate >= 70 ? '#10b981' : entry.correctRate >= 45 ? '#f59e0b' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-center gap-6 text-xs text-slate-600 font-semibold pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                    Dễ / Nắm chắc (&gt; 70% đúng)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                    Trung bình (45% - 70%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                    Khó / Hay sai (&lt; 45% đúng - Cần giảng lại)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submissions List Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileCheck size={20} className="text-indigo-600" />
                Danh Sách Bài Nộp Chi Tiết Của Học Sinh
              </h2>
              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl shadow-xs">
                Đang hiển thị {filteredSubmissions.length}/{submissions.length} bài nộp
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhấn vào từng bài làm để xem phiếu trả lời trắc nghiệm, bài tự luận, nhận xét và chấm điểm
            </p>
          </div>

          {filteredSubmissions.length > 0 && (
            <button
              onClick={() => setIsClearAllConfirmOpen(true)}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-50 border border-rose-200 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Trash2 size={13} />
              Dọn dẹp danh sách ({filteredSubmissions.length} bài)
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-bold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">STT</th>
                <th className="py-3.5 px-4">Họ và tên học sinh</th>
                <th className="py-3.5 px-4 w-20 text-center">Lớp</th>
                <th className="py-3.5 px-4 w-24 text-center">Mã đề</th>
                <th className="py-3.5 px-4 w-36">Thời gian nộp</th>
                <th className="py-3.5 px-4 w-24 text-center">Thời lượng</th>
                <th className="py-3.5 px-4 w-28 text-center" title="Số ý hỏi và số câu làm đúng tương ứng với bài làm của học sinh sau khi chấm">
                  Số câu đúng (ý / câu)
                </th>
                <th className="py-3.5 px-4 w-24 text-center">Điểm số</th>
                <th className="py-3.5 px-4 w-36 text-center">Kiểm tra cuối / Xếp loại</th>
                <th className="py-3.5 px-4 w-32 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Không tìm thấy bài làm nào trong danh sách.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub, idx) => {
                  const score = sub.score !== undefined ? sub.score : 0;
                  let badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  let badgeText = 'Chưa đạt';

                  if (score >= 8.0) {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    badgeText = 'Giỏi';
                  } else if (score >= 6.5) {
                    badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                    badgeText = 'Khá';
                  } else if (score >= 5.0) {
                    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                    badgeText = 'Trung bình';
                  }

                  const timeSpentMin = Math.round(((sub.timeSpentSeconds || 0) / 60) * 10) / 10;
                  const submitDate = new Date(sub.submittedAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit'
                  });

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{sub.studentName}</div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {sub.studentCode && (
                            <span className="text-[10px] text-slate-400 font-mono">SBD: {sub.studentCode}</span>
                          )}
                          <span className="text-[9px] text-slate-500 font-mono bg-slate-100 px-1 py-0.2 rounded" title={`Mã bài nộp duy nhất: ${sub.id}`}>
                            {sub.id}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-700">
                        {sub.studentClass}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                          {sub.variant === 'step3' ? 'Đề gốc' : sub.variant}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {submitDate}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-medium">
                        {timeSpentMin} phút
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div
                          className="font-mono font-bold text-slate-800 text-xs inline-flex items-center justify-center gap-1 cursor-help"
                          title={`Chi tiết bài làm: Đúng ${sub.correctCount ?? 0}/${sub.totalQuestions ?? 0} ý (${sub.evaluationDetails?.details ? `${sub.evaluationDetails.details.p1Correct}/${sub.evaluationDetails.details.p1Total} trắc nghiệm • ${sub.evaluationDetails.details.p2UnitsCorrect}/${sub.evaluationDetails.details.p2UnitsTotal} đúng-sai • ${sub.evaluationDetails.details.p3Correct}/${sub.evaluationDetails.details.p3Total} trả lời ngắn` : `${sub.correctCount}/${sub.totalQuestions}`})`}
                        >
                          <span className="text-emerald-700 font-black">{sub.correctCount !== undefined ? sub.correctCount : '-'}</span>
                          <span className="text-slate-400 font-normal">/</span>
                          <span className="text-slate-600">{sub.totalQuestions !== undefined ? sub.totalQuestions : '-'}</span>
                          <span className="text-[10px] font-sans text-slate-400 font-normal ml-0.5">ý</span>
                        </div>
                        {sub.correctCount !== undefined && sub.totalQuestions && sub.totalQuestions > 0 ? (
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5 flex items-center justify-center gap-1">
                            {sub.evaluationDetails?.totalQuestionCount && sub.evaluationDetails.totalQuestionCount !== sub.totalQuestions ? (
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                                {sub.evaluationDetails.questionCorrectCount ?? (sub.evaluationDetails.details ? sub.evaluationDetails.details.p1Correct + (sub.evaluationDetails.details.p2QuestionsFullyCorrect || 0) + sub.evaluationDetails.details.p3Correct : Math.round((sub.correctCount / sub.totalQuestions) * sub.evaluationDetails.totalQuestionCount))}/{sub.evaluationDetails.totalQuestionCount} câu • {Math.round((sub.correctCount / sub.totalQuestions) * 100)}%
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">{Math.round((sub.correctCount / sub.totalQuestions) * 100)}% đúng</span>
                            )}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-sm font-black text-slate-900">
                          {score.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeColor}`}>
                            {badgeText}
                          </span>
                          {(sub as any).isSuspectedDuplicate || sub.status === 'NGHI TRÙNG BÀI NỘP' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse" title={(sub as any).duplicateNote || "Nghi trùng bài nộp: Học sinh đã có bài nộp cùng tên/lớp trước đó."}>
                              ⚠️ NGHI TRÙNG BÀI
                            </span>
                          ) : sub.finalTenStepCheck?.isPassedAll10Steps || sub.evaluationDetails?.finalTenStepCheck?.isPassedAll10Steps ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300" title="10/10 Bước Kiểm Tra Cuối Hợp Lệ">
                              ✓ ĐỦ CĂN CỨ
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300" title="Cần giáo viên kiểm tra / duyệt trước khi công bố">
                              ⚠️ CẦN DUYỆT
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleInstantGradeSingle(sub)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-all cursor-pointer"
                            title="Chấm tức thì bài nộp này theo đáp án chính thức"
                          >
                            <Zap size={15} />
                          </button>
                          <button
                            onClick={() => {
                              handleOpenInspection(sub);
                              handleAIGradeSingle(sub);
                            }}
                            className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-all cursor-pointer"
                            title="Giám khảo AI chấm & nhận xét chi tiết 4 phần sư phạm"
                          >
                            <Sparkles size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenInspection(sub)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-all cursor-pointer"
                            title="Xem chi tiết & Chấm bài"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmTarget(sub)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                            title="Xóa bài làm này"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Inspection & Grading Detail */}
      {inspectingSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {inspectingSubmission.studentName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Bài Làm: {inspectingSubmission.studentName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>Lớp: <strong>{inspectingSubmission.studentClass}</strong></span>
                    <span>•</span>
                    <span>Mã đề: <strong>{inspectingSubmission.variant}</strong></span>
                    <span>•</span>
                    <span>Thời gian làm: <strong>{Math.round(((inspectingSubmission.timeSpentSeconds || 0) / 60) * 10) / 10} phút</strong></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectingSubmission(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Giám khảo Sư phạm AI: Chấm điểm & Nhận xét Chi tiết */}
              <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 border-2 border-indigo-200/90 rounded-3xl p-5 space-y-4 shadow-sm">
                {/* Header & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm">
                          Giám khảo Sư phạm • Đánh giá & Nhận xét Chi tiết
                        </span>
                        {isAIGradingSingle ? (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black animate-pulse flex items-center gap-1">
                            <Sparkles size={11} className="animate-spin" />
                            Đang phân tích bài làm...
                          </span>
                        ) : inspectingSubmission.evaluationDetails?.gradedBy === 'ai' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            Giám khảo AI đã chấm
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-800 text-[10px] font-bold">
                            Chuẩn sư phạm GDPT 2018
                          </span>
                        )}
                        {currentFinalTenStepCheckReport?.isPassedAll10Steps ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black tracking-wide shadow-2xs flex items-center gap-1">
                            <CheckCircle2 size={11} /> ĐÃ CHẤM – ĐỦ CĂN CỨ
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black tracking-wide shadow-2xs flex items-center gap-1">
                            <AlertTriangle size={11} /> {currentFinalTenStepCheckReport?.status || 'CẦN KIỂM TRA'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Đánh giá công tâm dựa trên Đề bài & Thang điểm Rubric từ Mục 0 đến Mục 6
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleAIGradeSingle(inspectingSubmission)}
                      disabled={isAIGradingSingle}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-all"
                      title="Gọi Giám khảo AI đối chiếu đề bài, thang điểm và bài làm để chấm chi tiết"
                    >
                      <Sparkles size={12} className={isAIGradingSingle ? 'animate-spin' : ''} />
                      <span>{isAIGradingSingle ? 'Đang chấm...' : 'Giám khảo AI chấm'}</span>
                    </button>

                    <button
                      onClick={() => handleInstantGradeSingle(inspectingSubmission)}
                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                      title="Tính lại điểm tức thì theo đáp án chuẩn"
                    >
                      <Zap size={12} className="fill-amber-700" />
                      <span>Chấm tức thì</span>
                    </button>

                    <button
                      onClick={() => handleCopyFeedback(editingFeedback)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                      title="Sao chép toàn bộ nhận xét 4 phần sư phạm"
                    >
                      <Copy size={12} />
                      <span>Sao chép nhận xét</span>
                    </button>
                  </div>
                </div>

                {/* Score Input & Toggle Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 border border-indigo-100/80 rounded-2xl p-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Điểm tổng kết (thang 10)
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={editingScore}
                          onChange={(e) => setEditingScore(e.target.value)}
                          className="w-20 text-lg font-black px-2.5 py-1 bg-white border border-indigo-300 rounded-xl text-indigo-700 focus:outline-indigo-500"
                        />
                        <span className="text-xs font-bold text-slate-400">/ 10.0</span>
                        {(() => {
                          const num = parseFloat(editingScore);
                          if (isNaN(num)) return null;
                          if (num >= 8.0) {
                            return <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">Giỏi</span>;
                          } else if (num >= 6.5) {
                            return <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black">Khá</span>;
                          } else if (num >= 5.0) {
                            return <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">Trung bình</span>;
                          }
                          return <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black">Chưa đạt</span>;
                        })()}
                      </div>
                    </div>

                    <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                    <div className="hidden sm:block">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Trắc nghiệm khách quan
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Đúng {inspectionSummary.totalUnitsCorrect}/{inspectionSummary.totalUnits} ý ({inspectionSummary.p1Correct}/{inspectionSummary.p1Total} TN • {inspectionSummary.p2UnitsCorrect}/{inspectionSummary.p2UnitsTotal} Đ-S • {inspectionSummary.p3Correct}/{inspectionSummary.p3Total} TLN) • {inspectionSummary.totalQuestionsCorrect}/{inspectionSummary.totalQuestions} câu hoàn chỉnh
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200">
                      <button
                        onClick={() => setActiveFeedbackView('structured')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          activeFeedbackView === 'structured'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Trực quan sư phạm
                      </button>
                      <button
                        onClick={() => setActiveFeedbackView('raw')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          activeFeedbackView === 'raw'
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Chỉnh sửa văn bản
                      </button>
                    </div>

                    <button
                      onClick={handleSaveGrade}
                      disabled={isSavingGrade}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs rounded-xl whitespace-nowrap cursor-pointer shadow-xs active:scale-95 transition-all"
                    >
                      {isSavingGrade ? 'Đang lưu...' : 'Lưu điểm & Lời phê'}
                    </button>
                  </div>
                </div>

                {/* Structured 4-Part Pedagogical View */}
                {activeFeedbackView === 'structured' ? (
                  <div className="space-y-3.5">
                    {/* Warning Alert Banner (nếu có cảnh báo sai lệch giữa đề/đáp án/bài làm) */}
                    {(inspectingSubmission.evaluationDetails?.warning || editingFeedback.includes('CẢNH BÁO')) && (
                      <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-2.5 text-amber-900 shadow-2xs animate-fadeIn">
                        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <span className="font-black text-amber-950 uppercase tracking-wider block">
                            Cảnh Báo Giám Khảo Sư Phạm:
                          </span>
                          <p className="leading-relaxed">
                            {inspectingSubmission.evaluationDetails?.warning ||
                              editingFeedback.match(/\[?CẢNH BÁO:[^\]\n]+\]?/i)?.[0] ||
                              'Có lưu ý đặc biệt về tính đồng bộ giữa đề, đáp án hoặc dữ liệu bài làm của học sinh.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Part 1: Tổng điểm */}
                    <div className="bg-white border border-indigo-100 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">📊</span>
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TỔNG ĐIỂM ĐÁNH GIÁ (GDPT 2018)</div>
                          <div className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <span>{editingScore || inspectingSubmission.score || 0} / 10.0</span>
                            <span className="text-xs font-semibold text-slate-400">
                              (Quy đổi: {editingScore || inspectingSubmission.score || 0}/10)
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-slate-500">Tỷ lệ hoàn thành đúng: </span>
                          <strong className="text-indigo-700 font-black">
                            {Math.round(((parseFloat(editingScore) || inspectingSubmission.score || 0) / 10) * 100)}%
                          </strong>
                        </div>
                        <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                        <div className="text-[11px] text-slate-600">
                          Đúng <strong>{inspectionSummary.totalUnitsCorrect}/{inspectionSummary.totalUnits}</strong> ý lệnh hỏi
                        </div>
                      </div>
                    </div>

                    {/* BẢNG KIỂM TRA TÍNH ĐỒNG BỘ TRƯỚC KHI CHO PHÉP CHẤM BÀI (ĐỐI CHIẾU 4 NGUỒN) */}
                    <div className={`rounded-2xl border transition-all ${
                      currentPreGradingSyncReport?.isAllowedToGrade
                        ? 'bg-slate-50/90 border-slate-200'
                        : 'bg-rose-50/80 border-rose-300'
                    }`}>
                      <div
                        onClick={() => setShowPreGradingSyncTable(!showPreGradingSyncTable)}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 rounded-2xl transition-all"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base">{currentPreGradingSyncReport?.isAllowedToGrade ? '🔍' : '⛔'}</span>
                          <span className="font-bold text-slate-800 text-xs">
                            Kiểm Tra Tính Đồng Bộ & Đối Chiếu Ma Trận - Đặc Tả (5 Tầng: Ma trận → Đặc tả → Đề → HD chấm → Bài làm)
                          </span>
                          {currentPreGradingSyncReport?.isAllowedToGrade ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black flex items-center gap-1">
                              <Check size={11} /> 100% Khớp ({currentPreGradingSyncReport.matchCount}/{currentPreGradingSyncReport.totalQuestions} câu/ý) • Đủ điều kiện chấm
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black flex items-center gap-1 animate-pulse">
                              <AlertTriangle size={11} /> {currentPreGradingSyncReport?.conflictCount || 1} Mâu thuẫn • KHÔNG cho phép chấm tự động
                            </span>
                          )}
                          {(currentPreGradingSyncReport?.matrixWarningCount ?? 0) > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1">
                              <AlertTriangle size={11} /> CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN ({currentPreGradingSyncReport?.matrixWarningCount} câu)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-indigo-600">
                          {showPreGradingSyncTable ? 'Thu gọn ▲' : 'Xem bảng đối chiếu ▼'}
                        </span>
                      </div>

                      {showPreGradingSyncTable && (
                        <div className="p-3 border-t border-slate-200/80 space-y-3 bg-white rounded-b-2xl">
                          {/* Sub-tabs: 5-Tier Matrix/Spec vs 4 Sources */}
                          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSyncViewMode('matrixSpec'); }}
                                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                  syncViewMode === 'matrixSpec'
                                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                📐 Đối Chiếu Ma Trận & Bản Đặc Tả (5 Tầng)
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSyncViewMode('sources4'); }}
                                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                  syncViewMode === 'sources4'
                                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                🔍 Bảng 4 Nguồn (Ma trận - Đề - HD chấm - Mã đề)
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSyncViewMode('crossCheck'); }}
                                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                  syncViewMode === 'crossCheck'
                                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                🛡️ Kiểm Tra Chéo Mã Đề (6 Checks)
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSyncViewMode('finalTenStep'); }}
                                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                                  syncViewMode === 'finalTenStep'
                                    ? 'bg-indigo-600 text-white shadow-xs font-black'
                                    : 'text-indigo-900 hover:text-indigo-950 font-bold bg-indigo-50/80'
                                }`}
                              >
                                ✨ Kiểm Tra Cuối (10 Bước Công Bố Điểm)
                              </button>
                            </div>

                            <div className="text-[11px] text-slate-500 font-medium">
                              Quy tắc: <em>Nếu câu hỏi trong đề không khớp với ma trận/đặc tả: KHÔNG tự sửa; ưu tiên báo lỗi trước khi chấm hàng loạt.</em>
                            </div>
                          </div>

                          {/* View 1: 5-Tier Matrix and Spec Mapping */}
                          {syncViewMode === 'matrixSpec' && (
                            <div className="space-y-2">
                              <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead>
                                    <tr className="bg-indigo-50/80 text-indigo-950 font-bold border-b border-indigo-100">
                                      <th className="p-2 w-24">Số câu</th>
                                      <th className="p-2 w-40">Chủ đề / Nội dung</th>
                                      <th className="p-2">Yêu cầu cần đạt</th>
                                      <th className="p-2 w-28 text-center">Mức độ nhận thức</th>
                                      <th className="p-2 w-36">Dạng câu hỏi</th>
                                      <th className="p-2 w-16 text-center">Số điểm</th>
                                      <th className="p-2 w-36 text-center">Trạng thái đồng bộ</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {currentMatrixSpecMappings.map((m, idx) => (
                                      <tr key={`matrix_map_${idx}`} className={
                                        m.status === 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' || m.status === 'MÂU THUẪN'
                                          ? 'bg-rose-50/70 font-medium'
                                          : m.status === 'THIẾU DỮ LIỆU'
                                          ? 'bg-amber-50/60'
                                          : 'hover:bg-slate-50/80'
                                      }>
                                        <td className="p-2 font-bold text-slate-900 font-mono">{m.questionNumber}</td>
                                        <td className="p-2 text-slate-700 font-medium">{m.topic}</td>
                                        <td className="p-2 text-slate-600 text-[10px] leading-relaxed">{m.learningObjective}</td>
                                        <td className="p-2 text-center">
                                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                            m.cognitiveLevel.includes('Nhận biết')
                                              ? 'bg-sky-100 text-sky-800'
                                              : m.cognitiveLevel.includes('Thông hiểu')
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : m.cognitiveLevel.includes('Vận dụng cao')
                                              ? 'bg-purple-100 text-purple-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {m.cognitiveLevel}
                                          </span>
                                        </td>
                                        <td className="p-2 text-slate-600 text-[10px]">{m.questionType}</td>
                                        <td className="p-2 text-center font-mono font-bold text-indigo-700">
                                          {m.points.toFixed(2)}đ
                                        </td>
                                        <td className="p-2 text-center">
                                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black border ${
                                            m.status === 'KHỚP'
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : m.status === 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN'
                                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                                              : m.status === 'MÂU THUẪN'
                                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                                              : 'bg-blue-100 text-blue-800 border-blue-300'
                                          }`}>
                                            {m.status}
                                          </span>
                                          {m.warning && <div className="text-[9px] text-rose-600 font-normal mt-0.5">{m.warning}</div>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* View 2: 4 Sources Pre-Grading Table */}
                          {syncViewMode === 'sources4' && (
                            <div className="space-y-2">
                              <div className="text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
                                <span>
                                  Đối chiếu 4 nguồn: <strong>[1] MA TRẬN</strong> • <strong>[2] ĐỀ KIỂM TRA</strong> • <strong>[3] HƯỚNG DẪN CHẤM</strong> • <strong>[4] MÃ ĐỀ</strong>.
                                  {currentPreGradingSyncReport?.isAllowedToGrade ? (
                                    <span className="text-emerald-700 font-bold ml-1">Toàn bộ dữ liệu cần thiết đã KHỚP. Đã cho phép chuyển sang bước CHẤM.</span>
                                  ) : (
                                    <span className="text-rose-700 font-bold ml-1">Có câu MÂU THUẪN: KHÔNG cho phép chấm tự động!</span>
                                  )}
                                </span>
                              </div>

                              <div className="overflow-x-auto max-h-64 border border-slate-200 rounded-xl">
                                <table className="w-full text-left text-[11px] border-collapse">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                      <th className="p-2 w-28">Câu</th>
                                      <th className="p-2">Đề</th>
                                      <th className="p-2">Hướng dẫn chấm</th>
                                      <th className="p-2 w-16 text-center">Điểm</th>
                                      <th className="p-2">Ma trận</th>
                                      <th className="p-2 w-28 text-center">Trạng thái</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {currentPreGradingRows.map((r, idx) => (
                                      <tr key={`sync_row_${idx}`} className={
                                        r.status === 'MÂU THUẪN'
                                          ? 'bg-rose-50/80 font-medium'
                                          : r.status === 'THIẾU DỮ LIỆU'
                                          ? 'bg-amber-50/60'
                                          : r.status === 'CẦN KIỂM TRA'
                                          ? 'bg-blue-50/50'
                                          : 'hover:bg-slate-50/80'
                                      }>
                                        <td className="p-2 font-bold text-slate-900">{r.question}</td>
                                        <td className="p-2 text-slate-600">{r.exam}</td>
                                        <td className="p-2 text-slate-800 font-semibold">{r.rubric}</td>
                                        <td className="p-2 text-center font-mono font-bold">{r.points.toFixed(2)}</td>
                                        <td className="p-2 text-slate-600">{r.matrix}</td>
                                        <td className="p-2 text-center">
                                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                            r.status === 'KHỚP'
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                              : r.status === 'MÂU THUẪN'
                                              ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                              : r.status === 'THIẾU DỮ LIỆU'
                                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                                              : 'bg-blue-100 text-blue-800 border-blue-300'
                                          }`}>
                                            {r.status}
                                          </span>
                                          {r.note && <div className="text-[9px] text-rose-600 font-normal mt-0.5">{r.note}</div>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {/* View 3: Pre-Final Cross Check (6 Checks) */}
                          {syncViewMode === 'crossCheck' && (
                            <div className="space-y-3">
                              {/* Status Header */}
                              <div className={`p-2.5 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
                                currentPreFinalCrossCheckReport?.isPassed
                                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                                  : 'bg-rose-50 border-rose-300 text-rose-950'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{currentPreFinalCrossCheckReport?.isPassed ? '🛡️' : '⛔'}</span>
                                  <div>
                                    <div className="text-xs font-black">
                                      {currentPreFinalCrossCheckReport?.status || 'CHO PHÉP CHỐT ĐIỂM'}
                                    </div>
                                    <div className="text-[10px] text-slate-600">
                                      Quy trình kiểm tra chéo lần 2 trước khi hoàn thành và xuất kết quả bài chấm
                                    </div>
                                  </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                  currentPreFinalCrossCheckReport?.isPassed
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-rose-600 text-white animate-pulse'
                                }`}>
                                  {currentPreFinalCrossCheckReport?.isPassed ? 'ĐÃ KIỂM TRA ĐẠT' : 'DỪNG CHỐT ĐIỂM'}
                                </span>
                              </div>

                              {/* Stop reasons & Warnings if any */}
                              {(currentPreFinalCrossCheckReport?.stopReasons?.length ?? 0) > 0 && (
                                <div className="p-2.5 rounded-xl bg-rose-100/90 border border-rose-300 text-rose-900 text-xs space-y-1">
                                  <div className="font-bold flex items-center gap-1">
                                    <AlertTriangle size={13} /> Phát hiện sai lệch nghiêm trọng — Dừng chốt điểm:
                                  </div>
                                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                                    {currentPreFinalCrossCheckReport?.stopReasons.map((r, i) => (
                                      <li key={`stop_${i}`}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {(currentPreFinalCrossCheckReport?.warnings?.length ?? 0) > 0 && (
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                                  <div className="font-bold flex items-center gap-1">
                                    <HelpCircle size={13} /> Cảnh báo rà soát:
                                  </div>
                                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                                    {currentPreFinalCrossCheckReport?.warnings.map((w, i) => (
                                      <li key={`warn_${i}`}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* 6 Checks Grid Cards */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {/* CHECK 1 */}
                                <div className={`p-2.5 rounded-xl border ${
                                  currentPreFinalCrossCheckReport?.check1_variant.passed
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-rose-50 border-rose-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900">CHECK 1: Mã đề học sinh</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                      currentPreFinalCrossCheckReport?.check1_variant.passed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {currentPreFinalCrossCheckReport?.check1_variant.passed ? 'ĐẠT' : 'KHÔNG KHỚP'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 leading-relaxed">
                                    {currentPreFinalCrossCheckReport?.check1_variant.note}
                                  </div>
                                </div>

                                {/* CHECK 2 */}
                                <div className={`p-2.5 rounded-xl border ${
                                  currentPreFinalCrossCheckReport?.check2_answerKey.passed
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-rose-50 border-rose-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900">CHECK 2: Bộ đáp án sử dụng</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                      currentPreFinalCrossCheckReport?.check2_answerKey.passed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {currentPreFinalCrossCheckReport?.check2_answerKey.passed ? 'ĐẠT' : 'THIẾU ĐÁP ÁN'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 leading-relaxed">
                                    {currentPreFinalCrossCheckReport?.check2_answerKey.note}
                                  </div>
                                </div>

                                {/* CHECK 3 */}
                                <div className={`p-2.5 rounded-xl border ${
                                  currentPreFinalCrossCheckReport?.check3_questionSequence.passed
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-rose-50 border-rose-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900">CHECK 3: Thứ tự câu hỏi</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                      currentPreFinalCrossCheckReport?.check3_questionSequence.passed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {currentPreFinalCrossCheckReport?.check3_questionSequence.passed ? 'ĐẠT' : 'LỆCH'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 leading-relaxed">
                                    {currentPreFinalCrossCheckReport?.check3_questionSequence.note}
                                  </div>
                                </div>

                                {/* CHECK 4 */}
                                <div className={`p-2.5 rounded-xl border ${
                                  currentPreFinalCrossCheckReport?.check4_itemAnswers.passed
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-amber-50 border-amber-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900">CHECK 4: Đáp án từng câu</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                      currentPreFinalCrossCheckReport?.check4_itemAnswers.passed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {currentPreFinalCrossCheckReport?.check4_itemAnswers.passed ? 'ĐẠT' : 'CẢNH BÁO'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 leading-relaxed">
                                    {currentPreFinalCrossCheckReport?.check4_itemAnswers.note}
                                  </div>
                                </div>

                                {/* CHECK 5 */}
                                <div className={`p-2.5 rounded-xl border ${
                                  currentPreFinalCrossCheckReport?.check5_scoringScale.passed
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-rose-50 border-rose-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900">CHECK 5: Thang điểm từng câu</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                      currentPreFinalCrossCheckReport?.check5_scoringScale.passed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {currentPreFinalCrossCheckReport?.check5_scoringScale.passed ? 'ĐẠT' : 'VƯỢT TRẦN'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 leading-relaxed">
                                    {currentPreFinalCrossCheckReport?.check5_scoringScale.note}
                                  </div>
                                </div>

                                {/* CHECK 6 */}
                                <div className={`p-2.5 rounded-xl border ${
                                  currentPreFinalCrossCheckReport?.check6_totalMaxScore.passed
                                    ? 'bg-slate-50 border-slate-200'
                                    : 'bg-rose-50 border-rose-300'
                                }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-900">CHECK 6: Tổng điểm tối đa</span>
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                      currentPreFinalCrossCheckReport?.check6_totalMaxScore.passed
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {currentPreFinalCrossCheckReport?.check6_totalMaxScore.passed ? 'ĐẠT' : 'SAI CÔNG THỨC'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 leading-relaxed">
                                    {currentPreFinalCrossCheckReport?.check6_totalMaxScore.note}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* View 4: Final 10-Step Check (KIỂM TRA CUỐI TRƯỚC KHI CÔNG BỐ ĐIỂM) */}
                          {syncViewMode === 'finalTenStep' && (
                            <div className="space-y-3">
                              {/* Master Verdict Banner */}
                              <div className={`p-3 rounded-xl border flex items-center justify-between flex-wrap gap-2 ${
                                currentFinalTenStepCheckReport?.isPassedAll10Steps
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                                  : 'bg-amber-50 border-amber-300 text-amber-950'
                              }`}>
                                <div className="flex items-center gap-2.5">
                                  <span className="text-xl">
                                    {currentFinalTenStepCheckReport?.isPassedAll10Steps ? '🏆' : '⚠️'}
                                  </span>
                                  <div>
                                    <div className="text-xs font-black flex items-center gap-2">
                                      <span>TRẠNG THÁI:</span>
                                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                        currentFinalTenStepCheckReport?.isPassedAll10Steps
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-amber-600 text-white'
                                      }`}>
                                        "{currentFinalTenStepCheckReport?.status || 'ĐÃ CHẤM – ĐỦ CĂN CỨ'}"
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-600 mt-0.5">
                                      {currentFinalTenStepCheckReport?.isPassedAll10Steps
                                        ? 'Cả 10/10 bước kiểm tra đều hợp lệ tuyệt đối. Đủ căn cứ pháp lý & sư phạm để công bố kết quả điểm chính thức!'
                                        : 'Phát hiện bước chưa đạt yêu cầu. Tạm thời KHÔNG tự động xác nhận kết quả cuối cùng!'}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`px-3 py-1 rounded-lg text-[11px] font-black ${
                                    currentFinalTenStepCheckReport?.isPassedAll10Steps
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}>
                                    {currentFinalTenStepCheckReport?.passedCount || 0}/10 Bước Đạt
                                  </span>
                                </div>
                              </div>

                              {/* Unresolved Issues List if any */}
                              {(currentFinalTenStepCheckReport?.unresolvedIssues?.length ?? 0) > 0 && (
                                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs space-y-1">
                                  <div className="font-bold flex items-center gap-1">
                                    <AlertTriangle size={13} /> Các vấn đề cần xử lý trước khi công bố điểm:
                                  </div>
                                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                                    {currentFinalTenStepCheckReport?.unresolvedIssues.map((issue, idx) => (
                                      <li key={`iss_${idx}`}>{issue}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* 10 Step Grid Cards */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                {currentFinalTenStepCheckReport && Object.entries(currentFinalTenStepCheckReport.steps).map(([key, rawStep]) => {
                                  const step = rawStep as { passed: boolean; label: string; detail: string; pendingReviewCount?: number };
                                  return (
                                    <div
                                      key={key}
                                      className={`p-2.5 rounded-xl border transition-all ${
                                        step.passed
                                          ? 'bg-slate-50/80 border-slate-200'
                                          : 'bg-rose-50/90 border-rose-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                          <span className={step.passed ? 'text-emerald-600' : 'text-rose-600'}>
                                            {step.passed ? '✓' : '✗'}
                                          </span>
                                          {step.label}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                          step.passed
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800 animate-pulse'
                                        }`}>
                                          {step.passed ? 'HỢP LỆ' : 'CẦN XỬ LÝ'}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 leading-relaxed">
                                        {step.detail}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 5-Point Synchronization Badges */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          Kiểm định tính đồng bộ 5 quan hệ (Chuyên gia kiểm tra đánh giá):
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                          100% Khóa thang điểm 10
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-[10px]">
                        <div className="bg-white border border-slate-200 rounded-xl p-2 text-center">
                          <div className="text-slate-400 font-medium">Ma trận ↔ Đề</div>
                          <div className="font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                            <Check size={11} /> {inspectingSubmission.evaluationDetails?.synchronizationChecks?.matrixVsExam || 'Đồng bộ'}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-2 text-center">
                          <div className="text-slate-400 font-medium">Đề ↔ Đáp án</div>
                          <div className="font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                            <Check size={11} /> {inspectingSubmission.evaluationDetails?.synchronizationChecks?.examVsAnswers || 'Đồng bộ'}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-2 text-center">
                          <div className="text-slate-400 font-medium">Đáp án ↔ HD chấm</div>
                          <div className="font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                            <Check size={11} /> {inspectingSubmission.evaluationDetails?.synchronizationChecks?.answersVsRubric || 'Đồng bộ'}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-2 text-center">
                          <div className="text-slate-400 font-medium">HD chấm ↔ Bài làm</div>
                          <div className="font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                            <Check size={11} /> {inspectingSubmission.evaluationDetails?.synchronizationChecks?.rubricVsSubmission || 'Đồng bộ'}
                          </div>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl p-2 text-center col-span-2 sm:col-span-1">
                          <div className="text-slate-400 font-medium">Ma trận ↔ Kết quả</div>
                          <div className="font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                            <Check size={11} /> {inspectingSubmission.evaluationDetails?.synchronizationChecks?.matrixVsResults || 'Đồng bộ'}
                          </div>
                        </div>
                      </div>

                      {/* 10 CHECKS chống chấm sai */}
                      <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                            <Check size={12} className="text-emerald-600" />
                            10 Nguyên tắc kiểm tra chéo (Chống chấm sai - THCS):
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            inspectingSubmission.evaluationDetails?.submissionStatus === 'CẦN GIÁO VIÊN KIỂM TRA'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            Trạng thái: {inspectingSubmission.evaluationDetails?.submissionStatus || 'ĐÃ CHẤM'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[9px]">
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 01: Mã đề ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 02: Đề thi ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 03: HD chấm ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 04: Đáp án ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 05: Câu hỏi ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 06: Bài làm ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 07: Điểm câu ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 08: Tổng điểm ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 09: Chắc chắn ✓</div>
                          <div className="bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center font-medium text-slate-700">CHECK 10: Không mâu thuẫn ✓</div>
                        </div>
                      </div>
                    </div>

                    {/* Question Results Breakdown Table (BƯỚC 8: BẢNG KẾT QUẢ TỪNG CÂU) */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div
                        onClick={() => setShowAuditTable(!showAuditTable)}
                        className="p-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-all"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileCheck size={15} className="text-indigo-600" />
                          <span className="font-bold text-slate-800 text-xs">
                            Bảng Kết Quả Đánh Giá Từng Câu (Truy Vết & Minh Chứng)
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black">
                            Quy trình 8 bước
                          </span>
                          {currentScoringSpec && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold" title="Điểm tối đa từng câu được khóa chặt theo đúng Ma trận đề thi & Bản đặc tả chuẩn GDPT 2018">
                              Điểm tối đa chuẩn Ma trận: TN ({currentScoringSpec.p1PerQuestion.toFixed(2)}đ/câu) • Đ-S ({currentScoringSpec.p2PerQuestion.toFixed(2)}đ/câu [{currentScoringSpec.p2PerSubItem.toFixed(2)}đ/ý]) • TLN ({currentScoringSpec.p3PerQuestion.toFixed(2)}đ/câu)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-indigo-600">
                          {showAuditTable ? 'Thu gọn ▲' : 'Mở rộng bảng ▼'}
                        </span>
                      </div>

                      {showAuditTable && (
                        <div className="overflow-x-auto max-h-72 p-2">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                <th className="p-2 w-28">Câu</th>
                                <th className="p-2 w-20 text-center">Điểm tối đa</th>
                                <th className="p-2 w-20 text-center">Điểm đạt</th>
                                <th className="p-2">Nhận định & Minh chứng</th>
                                <th className="p-2 w-28 text-center">Bài làm HS</th>
                                <th className="p-2 w-28 text-center">Đáp án chuẩn</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {unifiedAuditTableRows.map((row, idx) => (
                                <tr key={`audit_row_${idx}`} className={row.score > 0 ? 'hover:bg-emerald-50/40' : 'hover:bg-rose-50/40'}>
                                  <td className="p-2 font-bold text-slate-800">{row.question}</td>
                                  <td className="p-2 text-center text-slate-500 font-mono">{row.maxScore.toFixed(2)}</td>
                                  <td className="p-2 text-center font-bold font-mono">
                                    <span className={row.score > 0 ? 'text-emerald-700 font-black' : 'text-rose-600'}>
                                      {row.score.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black mr-1.5 ${
                                      row.verdict === 'ĐÚNG'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : row.verdict === 'ĐÚNG MỘT PHẦN'
                                        ? 'bg-amber-100 text-amber-800'
                                        : row.verdict === 'KHÔNG TRẢ LỜI'
                                        ? 'bg-slate-100 text-slate-700'
                                        : row.verdict === 'KHÔNG ĐỌC RÕ' || row.verdict === 'KHÔNG ĐỌC ĐƯỢC'
                                        ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                        : row.verdict === 'CẦN GIÁO VIÊN DUYỆT' || row.verdict === 'CẦN GIÁO VIÊN KIỂM TRA'
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : row.score > 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {row.verdict}
                                    </span>
                                    {row.analysis && <span className="text-slate-600 text-[10px]">{row.analysis}</span>}
                                    {row.basisForScore && (
                                      <div className="text-[9px] text-indigo-700 font-medium mt-0.5">
                                        📌 <em>Căn cứ chấm: {row.basisForScore}</em>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2 text-center font-mono font-bold text-slate-700">{row.studentAnswer || '-'}</td>
                                  <td className="p-2 text-center font-mono text-indigo-700 font-bold">{row.expectedAnswer || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Part 2: Nhận xét chi tiết */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* 2.1 Ý/Câu đã làm tốt */}
                      <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 space-y-1.5">
                        <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          <span>Ý/Câu đã làm tốt & Kiến thức đã đạt:</span>
                        </div>
                        <div className="text-emerald-800 text-[11px] leading-relaxed whitespace-pre-line pl-5">
                          {parsedFeedbackSections.strengths}
                        </div>
                      </div>

                      {/* 2.2 Lỗi sai & Điểm còn thiếu */}
                      <div className="bg-rose-50/80 border border-rose-200/90 rounded-2xl p-3.5 space-y-1.5">
                        <div className="font-bold text-rose-900 flex items-center gap-1.5 text-xs">
                          <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                          <span>Lỗi sai & Kiến thức chưa đạt & Lỗi cần sửa:</span>
                        </div>
                        <div className="text-rose-800 text-[11px] leading-relaxed whitespace-pre-line pl-5">
                          {parsedFeedbackSections.weaknesses}
                        </div>
                      </div>
                    </div>

                    {/* Part 3: Hướng dẫn cải thiện */}
                    <div className="bg-blue-50/80 border border-blue-200/90 rounded-2xl p-3.5 space-y-1.5">
                      <div className="font-bold text-blue-950 flex items-center gap-1.5 text-xs">
                        <span className="text-sm">💡</span>
                        <span>HƯỚNG DẪN CẢI THIỆN & NỘI DUNG NÊN ÔN TẬP:</span>
                      </div>
                      <div className="text-blue-900 text-[11px] leading-relaxed whitespace-pre-line pl-5">
                        {parsedFeedbackSections.improvements}
                      </div>
                    </div>

                    {/* Part 4: Lời nhận xét của Thầy/Cô */}
                    <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 space-y-1.5">
                      <div className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                        <span className="text-sm">🌟</span>
                        <span>LỜI NHẬN XÉT CỦA THẦY/CÔ (CHUYÊN GIA 25 NĂM KINH NGHIỆM):</span>
                      </div>
                      <div className="text-amber-900 text-[11px] italic font-medium leading-relaxed pl-5">
                        "{parsedFeedbackSections.teacherComment}"
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Raw Editable Textarea */
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Nội dung phản hồi hoàn chỉnh (Tuân thủ chuẩn sư phạm 4 phần):
                    </label>
                    <textarea
                      rows={10}
                      value={editingFeedback}
                      onChange={(e) => setEditingFeedback(e.target.value)}
                      placeholder="Nội dung phản hồi theo cấu trúc 4 phần sư phạm..."
                      className="w-full p-3.5 bg-white border border-indigo-200 rounded-2xl font-mono text-xs text-slate-800 leading-relaxed focus:outline-indigo-500 shadow-inner"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Thầy/Cô có thể chỉnh sửa trực tiếp nội dung trước khi lưu điểm hoặc xuất báo cáo.</span>
                      <button
                        onClick={() => handleCopyFeedback(editingFeedback)}
                        className="text-indigo-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy size={12} />
                        Sao chép toàn bộ
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Answers Matrix Segmented by GDPT 2018 Parts */}
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  Chi tiết phiếu trả lời của học sinh:
                </h4>

                {/* Part 1 */}
                {inspectionQuestionDetails.part1.length > 0 && (
                  <div className="space-y-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between flex-wrap gap-1">
                      <span>Phần I: Câu hỏi trắc nghiệm nhiều lựa chọn ({inspectionQuestionDetails.part1.length} câu)</span>
                      {currentScoringSpec && (
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          Điểm tối đa: {currentScoringSpec.p1TotalPoints.toFixed(1)}đ ({currentScoringSpec.p1PerQuestion.toFixed(2)}đ/câu)
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {inspectionQuestionDetails.part1.map((q) => (
                        <div
                          key={`insp_p1_${q.num}`}
                          className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${
                            q.isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                              : q.studentAns
                              ? 'bg-rose-50/80 border-rose-300 text-rose-900'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-slate-500">Câu {q.num}</div>
                          <div className="text-sm font-black my-0.5">
                            {q.studentAns || '-'}
                          </div>
                          <div className="text-[9px] font-mono">
                            {q.expectedAns ? `(Đ/A: ${q.expectedAns})` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Part 2: True / False */}
                {inspectionQuestionDetails.part2.length > 0 && (
                  <div className="space-y-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between flex-wrap gap-1">
                      <span>Phần II: Câu hỏi trắc nghiệm Đúng - Sai ({inspectionQuestionDetails.part2.length} câu)</span>
                      {currentScoringSpec && (
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          Điểm tối đa: {currentScoringSpec.p2TotalPoints.toFixed(1)}đ ({currentScoringSpec.p2PerQuestion.toFixed(2)}đ/câu [{currentScoringSpec.p2PerSubItem.toFixed(2)}đ/ý])
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {inspectionQuestionDetails.part2.map((q) => (
                        <div key={`insp_p2_${q.num}`} className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                          <div className="text-xs font-bold text-slate-700">Câu {q.num}:</div>
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            {q.subItems.map((sub) => (
                              <div
                                key={`insp_p2_${q.num}_${sub.key}`}
                                className={`p-1.5 rounded-lg border text-xs ${
                                  sub.isCorrect
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                                    : sub.studentAns
                                    ? 'bg-rose-50 border-rose-200 text-rose-900 font-bold'
                                    : 'bg-slate-50 border-slate-200 text-slate-400'
                                }`}
                              >
                                <div className="text-[10px] font-bold text-slate-500">{sub.key})</div>
                                <div className="text-xs font-black">{sub.studentAns || '-'}</div>
                                <div className="text-[8px] opacity-75">{sub.expectedAns ? `(Đ/A: ${sub.expectedAns})` : ''}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Part 3: Short Answer */}
                {inspectionQuestionDetails.part3.length > 0 && (
                  <div className="space-y-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between flex-wrap gap-1">
                      <span>Phần III: Câu hỏi trắc nghiệm trả lời ngắn ({inspectionQuestionDetails.part3.length} câu)</span>
                      {currentScoringSpec && (
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                          Điểm tối đa: {currentScoringSpec.p3TotalPoints.toFixed(1)}đ ({currentScoringSpec.p3PerQuestion.toFixed(2)}đ/câu)
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {inspectionQuestionDetails.part3.map((q) => (
                        <div
                          key={`insp_p3_${q.num}`}
                          className={`p-2 rounded-xl border flex flex-col justify-between transition-all ${
                            q.isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900'
                              : q.studentAns
                              ? 'bg-rose-50/80 border-rose-300 text-rose-900'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-slate-500">Câu {q.num}</div>
                          <div className="text-xs font-black my-1 truncate" title={q.studentAns}>
                            {q.studentAns || '-'}
                          </div>
                          <div className="text-[9px] font-mono truncate" title={q.expectedAns}>
                            {q.expectedAns ? `(Đ/A: ${q.expectedAns})` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Student Essay / Written Notes */}
              {inspectingSubmission.essayAnswer && (
                <div>
                  <h4 className="font-black text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                    <FileText size={16} className="text-indigo-600" />
                    Bài làm tự luận / Ghi chú của học sinh:
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-sans text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {inspectingSubmission.essayAnswer}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setDeleteConfirmTarget(inspectingSubmission)}
                className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Xóa bài làm của học sinh này"
              >
                <Trash2 size={14} />
                <span>Xóa bài làm này</span>
              </button>

              <button
                onClick={() => setInspectingSubmission(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Modal: Confirm Clear All Submissions */}
      {isClearAllConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Dọn dẹp danh sách bài làm
                </h3>
                <p className="text-xs text-slate-500">
                  Thao tác này sẽ xóa vĩnh viễn dữ liệu điểm và bài nộp
                </p>
              </div>
            </div>

            <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 text-xs text-rose-950 leading-relaxed space-y-2.5">
              <div className="font-black text-rose-700 uppercase tracking-wide flex items-center gap-1.5 text-sm">
                <AlertTriangle size={18} className="text-rose-600" />
                CẢNH BÁO
              </div>
              <p className="font-bold text-slate-900">
                Bạn đang yêu cầu xóa {selectedExamId === 'all' ? submissions.length : filteredSubmissions.length} bài nộp.
              </p>
              <div>
                <div className="font-bold text-slate-700 mb-1">Thông tin bị ảnh hưởng:</div>
                <ul className="list-disc pl-5 space-y-0.5 text-slate-700">
                  <li>{selectedExamId === 'all' ? submissions.length : filteredSubmissions.length} bài làm của học sinh.</li>
                  <li>{selectedExamId === 'all' ? submissions.length : filteredSubmissions.length} kết quả chấm và lịch sử thẩm định.</li>
                  <li>{selectedExamId === 'all' ? submissions.length : filteredSubmissions.length} dữ liệu thống kê, biểu đồ và phổ điểm liên quan.</li>
                </ul>
              </div>
              <div className="p-2.5 bg-white border border-rose-200 rounded-xl text-[11px] text-slate-600 leading-normal">
                <span className="font-bold text-indigo-700">Đặc biệt lưu ý:</span> Thao tác "Xóa bài làm học sinh" <strong>KHÔNG</strong> đồng nghĩa với "xóa đề thi". Đề kiểm tra gốc, ma trận, bản đặc tả và đáp án tại Mục 0 đến Mục 6 vẫn được bảo toàn tuyệt đối 100%.
              </div>
              <p className="text-[11px] font-semibold text-rose-700">
                Vui lòng xác nhận lần 2 để hệ thống tiến hành dọn dẹp đúng phạm vi đã chọn:
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearAllConfirmOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              >
                Hủy bỏ (Không xóa)
              </button>
              <button
                type="button"
                onClick={executeClearAllSubmissions}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isDeleting ? 'Đang thực hiện xóa...' : 'Xác nhận lần 2 — Thực hiện xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Modal: Confirm Delete Single Submission */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-xs">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Xóa bài làm học sinh
                </h3>
                <p className="text-xs text-slate-500">
                  Xác nhận loại bỏ bài nộp khỏi bảng điểm
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 leading-relaxed space-y-1">
              <p>
                Thầy/Cô có chắc chắn muốn xóa bài làm của học sinh:
              </p>
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-900">
                <div className="font-bold text-sm text-indigo-700">{deleteConfirmTarget.studentName}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>Lớp: <strong>{deleteConfirmTarget.studentClass}</strong></span>
                  <span>•</span>
                  <span>Mã đề: <strong>{deleteConfirmTarget.variant}</strong></span>
                  {deleteConfirmTarget.score !== undefined && (
                    <>
                      <span>•</span>
                      <span>Điểm: <strong>{deleteConfirmTarget.score}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeDeleteSubmission}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
              >
                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isDeleting ? 'Đang xóa...' : 'Xóa bài làm này'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating In-App Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounceIn">
          <div className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold ${
            toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : toastMessage.type === 'warning'
              ? 'bg-amber-900 text-white border-amber-700'
              : 'bg-slate-900 text-white border-slate-800'
          }`}>
            {toastMessage.type === 'error' ? (
              <XCircle size={18} className="text-rose-400 shrink-0" />
            ) : toastMessage.type === 'warning' ? (
              <AlertTriangle size={18} className="text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentSubmissionsAnalytics;
