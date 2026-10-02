import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import GuideModal from './components/GuideModal';
import { ViewState, SavedExamPackage } from './types';
import {
  Check,
  Home,
  BookOpen,
  Layers,
  PlusCircle,
  Printer,
  Copy,
  Archive,
  GraduationCap,
  AlertTriangle
} from 'lucide-react';

// Importing Steps
import SourceSetup from './pages/SourceSetup';
import Step1Analysis from './pages/Step1Analysis';
import Step2Matrix from './pages/Step2Matrix';
import Step3OriginalExam from './pages/Step3OriginalExam';
import Step4Export from './pages/Step4Export';
import Step5Equivalents from './pages/Step5Equivalents';
import ExamVault from './pages/ExamVault';
import StudentSubmissionsAnalytics from './pages/StudentSubmissionsAnalytics';
import BackupRestore from './pages/BackupRestore';
import StudentExamPortal from './pages/StudentExamPortal';
import { getExamById } from './utils/examStorage';
import { isValidSourceText, sanitizeSourceText } from './utils/sourceValidation';

// Importing Constants
import {
  DEFAULT_LESSON,
  DEFAULT_SAMPLE_EXAM,
  DEFAULT_MATRIX_TEMPLATE,
  PROMPT_STEP1,
  PROMPT_STEP2,
  PROMPT_STEP3,
  PROMPT_STEP5
} from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('M0');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedExamForSubmissions, setSelectedExamForSubmissions] = useState<string | undefined>();

  // V6 source invariant: sanitize persisted source data synchronously BEFORE any
  // useState initializer runs. This removes the possibility of an old deployment
  // leaving a fallback sentence in state for the first render. Valid teacher data
  // is never deleted.
  const SOURCE_SCHEMA_VERSION = '2026-10-source-validation-v6';
  const SOURCE_KEYS = { lesson: 'qbank_source_v6_lesson', regulation: 'qbank_source_v6_regulation' } as const;
  const sanitizePersistedSources = () => {
    // V6 deliberately uses fresh keys so no stale value from an older deployment
    // can be rehydrated into the source fields. Valid legacy user content is migrated.
    const legacyLesson = localStorage.getItem('qbank_lesson');
    const legacyRegulation = localStorage.getItem('qbank_regulation_source');
    const v6Lesson = localStorage.getItem(SOURCE_KEYS.lesson);
    const v6Regulation = localStorage.getItem(SOURCE_KEYS.regulation);

    const cleanLesson = sanitizeSourceText(v6Lesson ?? legacyLesson ?? '');
    const cleanRegulation = sanitizeSourceText(v6Regulation ?? legacyRegulation ?? '');

    if (cleanLesson) localStorage.setItem(SOURCE_KEYS.lesson, cleanLesson);
    else localStorage.removeItem(SOURCE_KEYS.lesson);
    if (cleanRegulation) localStorage.setItem(SOURCE_KEYS.regulation, cleanRegulation);
    else localStorage.removeItem(SOURCE_KEYS.regulation);

    // Remove legacy keys so older code paths cannot rehydrate stale fallback text.
    localStorage.removeItem('qbank_lesson');
    localStorage.removeItem('qbank_regulation_source');

    if (!cleanRegulation) {
      localStorage.removeItem('qbank_result_step1');
      localStorage.removeItem('qbank_result_step2');
      localStorage.removeItem('qbank_result_step3');
      localStorage.removeItem('qbank_result_step5');
    }
    localStorage.setItem('qbank_source_schema_version', SOURCE_SCHEMA_VERSION);
  };

  sanitizePersistedSources();

  // Read state with fallbacks on bootup
  const [lesson, setLesson] = useState(() => {
    const stored = localStorage.getItem(SOURCE_KEYS.lesson);

    // No saved value on a fresh installation: keep the existing built-in
    // teaching template. If a key exists but contains an invalid/old
    // extraction fallback, clear it instead of displaying it as source data.
    if (stored === null) return DEFAULT_LESSON;
    if (!isValidSourceText(stored)) {
      localStorage.removeItem(SOURCE_KEYS.lesson);
      return '';
    }
    const sanitized = sanitizeSourceText(stored);
    if (!sanitized) {
      localStorage.removeItem(SOURCE_KEYS.lesson);
      return '';
    }
    if (stored.includes('TOÁN LỚP 10') || stored.includes('PHƯƠNG TRÌNH BẬC HAI')) {
      localStorage.setItem(SOURCE_KEYS.lesson, DEFAULT_LESSON);
      return DEFAULT_LESSON;
    }
    return sanitized;
  });

  // Văn bản quy định là nguồn bắt buộc do người dùng cung cấp - tuyệt đối không có nguồn mặc định.
  // Invalid extraction/error messages from older versions are discarded on boot.
  const [regulationSource, setRegulationSource] = useState<string>(() => {
    const stored = localStorage.getItem(SOURCE_KEYS.regulation);
    if (stored === null) return '';
    const sanitized = sanitizeSourceText(stored);
    if (!sanitized) {
      localStorage.removeItem(SOURCE_KEYS.regulation);
      return '';
    }
    return sanitized;
  });

  // Parent-level setters are also sanitized. Any child component, restore flow,
  // or future code path that attempts to write extraction fallback text is converted
  // to the empty source immediately.
  const updateLesson = (value: string) => {
    const safe = sanitizeSourceText(value);
    setLesson(safe);
    localStorage.setItem(SOURCE_KEYS.lesson, safe);
  };

  const updateRegulationSource = (value: string) => {
    const safe = sanitizeSourceText(value);
    setRegulationSource(safe);
    localStorage.setItem(SOURCE_KEYS.regulation, safe);
    if (!safe) {
      localStorage.removeItem('qbank_result_step1');
      localStorage.removeItem('qbank_result_step2');
      localStorage.removeItem('qbank_result_step3');
      localStorage.removeItem('qbank_result_step5');
    }
  };

  // Absolute invariant: regulationSource is either valid user source or empty.
  // This is intentionally redundant with SourceSetup so imported/session data cannot
  // reintroduce the old extraction fallback into the workflow.
  useEffect(() => {
    if (regulationSource && !isValidSourceText(regulationSource)) {
      setRegulationSource('');
      localStorage.removeItem(SOURCE_KEYS.regulation);
    }
  }, [regulationSource]);

  const [sampleExam, setSampleExam] = useState(() => {
    const stored = localStorage.getItem('qbank_sample_exam');
    if (!stored) return DEFAULT_SAMPLE_EXAM;
    if (stored.includes('ĐỒNG NAI') || stored.includes('LƯƠNG THẾ VINH') || stored.includes('TOÁN LỚP 10')) {
      localStorage.setItem('qbank_sample_exam', DEFAULT_SAMPLE_EXAM);
      return DEFAULT_SAMPLE_EXAM;
    }
    if (stored.includes('TỈNH QUẢNG TRỊ') && !stored.includes('SỞ GD & ĐT')) {
      const updated = stored.replace(/TỈNH QUẢNG TRỊ/g, 'SỞ GD & ĐT TỈNH QUẢNG TRỊ');
      localStorage.setItem('qbank_sample_exam', updated);
      return updated;
    }
    return stored;
  });

  const [matrix, setMatrix] = useState(() => {
    const stored = localStorage.getItem('qbank_matrix');
    if (!stored) return DEFAULT_MATRIX_TEMPLATE;
    if (stored.includes('MÔN TOÁN 10') || stored.includes('Vi-ét')) {
      localStorage.setItem('qbank_matrix', DEFAULT_MATRIX_TEMPLATE);
      return DEFAULT_MATRIX_TEMPLATE;
    }
    return stored;
  });

  const [promptStep1, setPromptStep1] = useState(() => {
    const stored = localStorage.getItem('qbank_prompt_step1');
    if (!stored || stored.includes('ĐỒNG NAI') || stored.includes('LƯƠNG THẾ VINH')) {
      localStorage.setItem('qbank_prompt_step1', PROMPT_STEP1);
      return PROMPT_STEP1;
    }
    if (stored.includes('TỈNH QUẢNG TRỊ') && !stored.includes('SỞ GD & ĐT')) {
      const updated = stored.replace(/TỈNH QUẢNG TRỊ/g, 'SỞ GD & ĐT TỈNH QUẢNG TRỊ');
      localStorage.setItem('qbank_prompt_step1', updated);
      return updated;
    }
    return stored;
  });

  const [promptStep2, setPromptStep2] = useState(() => {
    const stored = localStorage.getItem('qbank_prompt_step2');
    if (!stored || !stored.includes('# VAI TRÒ')) {
      localStorage.setItem('qbank_prompt_step2', PROMPT_STEP2);
      return PROMPT_STEP2;
    }
    return stored;
  });

  const [promptStep3, setPromptStep3] = useState(() => {
    const stored = localStorage.getItem('qbank_prompt_step3');
    if (!stored || stored.includes('ĐỒNG NAI') || stored.includes('LƯƠNG THẾ VINH')) {
      localStorage.setItem('qbank_prompt_step3', PROMPT_STEP3);
      return PROMPT_STEP3;
    }
    if (stored.includes('TỈNH QUẢNG TRỊ') && !stored.includes('SỞ GD & ĐT')) {
      const updated = stored.replace(/TỈNH QUẢNG TRỊ/g, 'SỞ GD & ĐT TỈNH QUẢNG TRỊ');
      localStorage.setItem('qbank_prompt_step3', updated);
      return updated;
    }
    return stored;
  });
  const [promptStep5, setPromptStep5] = useState(() => localStorage.getItem('qbank_prompt_step5') || PROMPT_STEP5);

  const [resultStep1, setResultStep1] = useState(() => {
    const source = localStorage.getItem(SOURCE_KEYS.regulation) || '';
    return isValidSourceText(source) ? (localStorage.getItem('qbank_result_step1') || '') : '';
  });
  const [resultStep2, setResultStep2] = useState(() => {
    const source = localStorage.getItem(SOURCE_KEYS.regulation) || '';
    return isValidSourceText(source) ? (localStorage.getItem('qbank_result_step2') || '') : '';
  });
  const [resultStep3, setResultStep3] = useState(() => {
    const source = localStorage.getItem(SOURCE_KEYS.regulation) || '';
    return isValidSourceText(source) ? (localStorage.getItem('qbank_result_step3') || '') : '';
  });
  const [resultStep5, setResultStep5] = useState(() => {
    const source = localStorage.getItem(SOURCE_KEYS.regulation) || '';
    return isValidSourceText(source) ? (localStorage.getItem('qbank_result_step5') || '') : '';
  });
  const [subject, setSubject] = useState<string>(() => localStorage.getItem('qbank_subject') || 'Sinh học');
  const [grade, setGrade] = useState<string>(() => localStorage.getItem('qbank_grade') || '9');
  const [examDuration, setExamDuration] = useState<number>(() => {
    const stored = localStorage.getItem('qbank_exam_duration');
    return stored ? Number(stored) : 45;
  });

  // Persists states in localStorage
  useEffect(() => {
    localStorage.setItem(SOURCE_KEYS.lesson, isValidSourceText(lesson) ? lesson : '');
  }, [lesson]);
  
  // Khi người dùng thay văn bản quy định: phải vô hiệu hóa các kết quả được tạo từ văn bản quy định cũ, không trộn dữ liệu cũ
  const prevRegulationSourceRef = useRef<string>(regulationSource);
  useEffect(() => {
    const regulationChanged =
      prevRegulationSourceRef.current &&
      prevRegulationSourceRef.current.trim() !== '' &&
      prevRegulationSourceRef.current !== regulationSource;

    // If the saved regulation source was invalid/empty (including an old
    // extraction fallback), dependent AI results must not survive boot.
    // This prevents stale Step 1–5 outputs from being reused with no valid
    // mandatory regulation source.
    const regulationIsInvalid = !isValidSourceText(regulationSource);

    if (regulationChanged || regulationIsInvalid) {
      setResultStep1('');
      setResultStep2('');
      setResultStep3('');
      setResultStep5('');
      localStorage.removeItem('qbank_result_step1');
      localStorage.removeItem('qbank_result_step2');
      localStorage.removeItem('qbank_result_step3');
      localStorage.removeItem('qbank_result_step5');
    }

    prevRegulationSourceRef.current = regulationSource;
    localStorage.setItem(SOURCE_KEYS.regulation, isValidSourceText(regulationSource) ? regulationSource : '');
  }, [regulationSource]);

  useEffect(() => { localStorage.setItem('qbank_sample_exam', sampleExam); }, [sampleExam]);
  useEffect(() => { localStorage.setItem('qbank_matrix', matrix); }, [matrix]);
  useEffect(() => { localStorage.setItem('qbank_subject', subject); }, [subject]);
  useEffect(() => { localStorage.setItem('qbank_grade', grade); }, [grade]);
  useEffect(() => { localStorage.setItem('qbank_exam_duration', String(examDuration)); }, [examDuration]);

  useEffect(() => { localStorage.setItem('qbank_prompt_step1', promptStep1); }, [promptStep1]);
  useEffect(() => { localStorage.setItem('qbank_prompt_step2', promptStep2); }, [promptStep2]);
  useEffect(() => { localStorage.setItem('qbank_prompt_step3', promptStep3); }, [promptStep3]);
  useEffect(() => { localStorage.setItem('qbank_prompt_step5', promptStep5); }, [promptStep5]);

  useEffect(() => { localStorage.setItem('qbank_result_step1', resultStep1); }, [resultStep1]);
  useEffect(() => { localStorage.setItem('qbank_result_step2', resultStep2); }, [resultStep2]);
  useEffect(() => { localStorage.setItem('qbank_result_step3', resultStep3); }, [resultStep3]);
  useEffect(() => { localStorage.setItem('qbank_result_step5', resultStep5); }, [resultStep5]);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('qbank_seen_guide');
    if (!hasSeenGuide) {
      setIsGuideOpen(true);
      localStorage.setItem('qbank_seen_guide', 'true');
    }
  }, []);

  // Student Direct Access Mode (via scanned QR code or Email link ?view=student&examId=...)
  const isStudentRoute = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('view') === 'student' ||
    new URLSearchParams(window.location.search).has('examId')
  );

  const [studentViewActive, setStudentViewActive] = useState<boolean>(isStudentRoute);
  const [studentLoading, setStudentLoading] = useState<boolean>(isStudentRoute);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [studentExamData, setStudentExamData] = useState<SavedExamPackage | null>(null);
  const [studentVariant, setStudentVariant] = useState<'step3' | '101' | '102' | '103' | '104' | 'all'>('step3');
  const [studentDuration, setStudentDuration] = useState(45);
  const [studentClass, setStudentClass] = useState('Lớp học');
  const studentAllowSolution = false; // Pedagogical constraint: 100% questions only

  useEffect(() => {
    if (!studentViewActive) return;

    let isMounted = true;
    const loadStudentExam = async () => {
      setStudentLoading(true);
      setStudentError(null);
      try {
        const params = new URLSearchParams(window.location.search);
        const examId = params.get('examId');
        const variantParam = (params.get('variant') as any) || 'step3';
        const classParam = params.get('class') || 'Lớp học';
        const durationParam = Number(params.get('duration')) || 45;

        setStudentVariant(variantParam);
        setStudentClass(classParam);
        setStudentDuration(durationParam);

        if (!examId) {
          if (isMounted) {
            setStudentError('Không tìm thấy mã đề thi trong đường dẫn liên kết.');
            setStudentLoading(false);
          }
          return;
        }

        // 1. Priority: Fetch from server published exams API (Allows ANY device/phone scanning QR to receive questions)
        try {
          const res = await fetch(`/api/student/exam/${encodeURIComponent(examId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && (data.questionsOnlyContent || data.resultStep3)) {
              const cleanContent = data.questionsOnlyContent || data.resultStep3 || '';
              const pkg: SavedExamPackage = {
                id: data.id || examId,
                title: data.title || 'Đề kiểm tra định kì',
                subject: data.subject || 'Chung',
                grade: data.grade || '',
                durationMinutes: data.durationMinutes || durationParam,
                resultStep3: cleanContent, // Guaranteed questions only
                resultStep5: cleanContent,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || new Date().toISOString()
              };
              if (isMounted) {
                setStudentExamData(pkg);
                if (data.durationMinutes) setStudentDuration(data.durationMinutes);
                if (data.className) setStudentClass(data.className);
                setStudentLoading(false);
              }
              return;
            }
          }
        } catch (serverErr) {
          console.warn('Could not load from server API, attempting local fallback:', serverErr);
        }

        // 2. Secondary fallback: Local storage cache (if opened on same computer)
        const localPkg = await getExamById(examId);
        if (localPkg && isMounted) {
          setStudentExamData(localPkg);
          setStudentDuration(durationParam || localPkg.durationMinutes || 45);
          setStudentLoading(false);
          return;
        }

        if (isMounted) {
          setStudentError('Không tìm thấy đề thi trên hệ thống hoặc liên kết đã hết hạn. Vui lòng kiểm tra lại với Thầy/Cô.');
        }
      } catch (err: any) {
        console.error('Error loading student exam:', err);
        if (isMounted) {
          setStudentError('Đã xảy ra lỗi khi tải đề thi: ' + (err.message || String(err)));
        }
      } finally {
        if (isMounted) setStudentLoading(false);
      }
    };

    loadStudentExam();
    return () => { isMounted = false; };
  }, [studentViewActive]);


  const handleExportAll = async () => {
    const fullData = {
      lesson,
      regulationSource,
      sampleExam,
      matrix,
      subject,
      grade,
      examDuration,
      resultStep1,
      resultStep2,
      resultStep3,
      resultStep5,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quy_Trinh_Tao_De_Kiem_Tra_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearAllData = async () => {
    if (confirm('CẢNH BÁO: Hành động này sẽ xóa sạch TOÀN BỘ dữ liệu bài soạn của bạn trên trình duyệt này. Bạn có chắc chắn?')) {
      localStorage.clear();
      updateLesson('');
      updateRegulationSource('');
      setSampleExam('');
      setMatrix('');
      setSubject('Sinh học');
      setGrade('9');
      setExamDuration(45);
      setResultStep1('');
      setResultStep2('');
      setResultStep3('');
      setResultStep5('');
      alert('Đã xóa sạch bộ nhớ tạm.');
      window.location.reload();
    }
  };

  // Nạp lại gói đề thi từ Kho đề thi vào các bước biên soạn
  const handleLoadExamIntoWorkflow = (pkg: SavedExamPackage) => {
    if (pkg.lesson && isValidSourceText(pkg.lesson)) updateLesson(sanitizeSourceText(pkg.lesson));
    if (pkg.regulationSource && isValidSourceText(pkg.regulationSource)) updateRegulationSource(sanitizeSourceText(pkg.regulationSource));
    if (pkg.sampleExam) setSampleExam(pkg.sampleExam);
    if (pkg.matrix) setMatrix(pkg.matrix);
    if (pkg.subject) setSubject(pkg.subject);
    if (pkg.grade) setGrade(pkg.grade);
    if (pkg.durationMinutes) setExamDuration(pkg.durationMinutes);
    if (pkg.resultStep1) setResultStep1(pkg.resultStep1);
    if (pkg.resultStep2) setResultStep2(pkg.resultStep2);
    if (pkg.resultStep3) setResultStep3(pkg.resultStep3);
    if (pkg.resultStep5) setResultStep5(pkg.resultStep5);
  };

  const handleClearDependentResults = () => {
    setResultStep1('');
    setResultStep2('');
    setResultStep3('');
    setResultStep5('');
    localStorage.removeItem('qbank_result_step1');
    localStorage.removeItem('qbank_result_step2');
    localStorage.removeItem('qbank_result_step3');
    localStorage.removeItem('qbank_result_step5');
  };

  const handleNavigate = (targetView: ViewState) => {
    if (['M1', 'M2', 'M3', 'M4', 'M5'].includes(targetView) && !isValidSourceText(regulationSource)) {
      alert("Mục '2. Văn bản quy định' là nguồn bắt buộc do người dùng cung cấp.\n\nThầy/Cô vui lòng cung cấp văn bản quy định tại Bước 0 trước khi chuyển sang Bước 1!");
      setCurrentView('M0');
      return;
    }
    setCurrentView(targetView);
  };

  const renderContent = () => {
    // Chặn tuyệt đối không cho chuyển sang các bước xử lý nếu chưa cung cấp văn bản quy định
    if (['M1', 'M2', 'M3', 'M4', 'M5'].includes(currentView) && !isValidSourceText(regulationSource)) {
      return (
        <div className="p-8 max-w-4xl mx-auto my-12 bg-white rounded-3xl border border-rose-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-extrabold text-2xl">
            ⚠️
          </div>
          <h2 className="text-2xl font-black text-slate-800">Chưa cung cấp văn bản quy định</h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Mục <strong>"2. Văn bản quy định (văn bản quy định)"</strong> là nguồn bắt buộc do người dùng cung cấp. Hệ thống không sử dụng nguồn quy định mặc định và bắt buộc phải có văn bản quy định mới được chuyển sang Bước 1.
          </p>
          <button
            onClick={() => setCurrentView('M0')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md"
          >
            Quay lại Bước 0 để cung cấp văn bản quy định
          </button>
        </div>
      );
    }

    switch (currentView) {
      case 'M0':
        return (
          <SourceSetup
            lesson={lesson}
            setLesson={updateLesson}
            regulationSource={regulationSource}
            setRegulationSource={updateRegulationSource}
            sampleExam={sampleExam}
            setSampleExam={setSampleExam}
            matrix={matrix}
            setMatrix={setMatrix}
            examDuration={examDuration}
            setExamDuration={setExamDuration}
            subject={subject}
            setSubject={setSubject}
            grade={grade}
            setGrade={setGrade}
            onClearDependentResults={handleClearDependentResults}
            onNext={() => handleNavigate('M1')}
          />
        );
      case 'M1':
        return (
          <Step1Analysis
            lesson={lesson}
            regulationSource={regulationSource}
            sampleExam={sampleExam}
            matrix={matrix}
            examDuration={examDuration}
            subject={subject}
            grade={grade}
            prompt={promptStep1}
            setPrompt={setPromptStep1}
            result={resultStep1}
            setResult={setResultStep1}
            onNext={() => setCurrentView('M2')}
            onPrev={() => setCurrentView('M0')}
          />
        );
      case 'M2':
        return (
          <Step2Matrix
            lesson={lesson}
            regulationSource={regulationSource}
            sampleExam={sampleExam}
            matrix={matrix}
            step1Result={resultStep1}
            examDuration={examDuration}
            subject={subject}
            grade={grade}
            prompt={promptStep2}
            setPrompt={setPromptStep2}
            result={resultStep2}
            setResult={setResultStep2}
            onNext={() => setCurrentView('M3')}
            onPrev={() => setCurrentView('M1')}
          />
        );
      case 'M3':
        return (
          <Step3OriginalExam
            lesson={lesson}
            regulationSource={regulationSource}
            sampleExam={sampleExam}
            matrix={matrix}
            step1Result={resultStep1}
            step2Result={resultStep2}
            examDuration={examDuration}
            subject={subject}
            grade={grade}
            prompt={promptStep3}
            setPrompt={setPromptStep3}
            result={resultStep3}
            setResult={setResultStep3}
            onNext={() => setCurrentView('M4')}
            onPrev={() => setCurrentView('M2')}
          />
        );
      case 'M4':
        return (
          <Step4Export
            resultUi={resultStep3}
            setResultUi={setResultStep3}
            lesson={lesson}
            regulationSource={regulationSource}
            sampleExam={sampleExam}
            matrix={matrix}
            step1Result={resultStep1}
            step2Result={resultStep2}
            step5Result={resultStep5}
            examDuration={examDuration}
            subject={subject}
            grade={grade}
            onNext={() => setCurrentView('M5')}
            onPrev={() => setCurrentView('M3')}
            onNavigateToVault={() => setCurrentView('M6')}
          />
        );
      case 'M5':
        return (
          <Step5Equivalents
            lesson={lesson}
            regulationSource={regulationSource}
            sampleExam={sampleExam}
            step1Result={resultStep1}
            step2Result={resultStep2}
            step3Result={resultStep3}
            examDuration={examDuration}
            subject={subject}
            grade={grade}
            prompt={promptStep5}
            setPrompt={setPromptStep5}
            result={resultStep5}
            setResult={setResultStep5}
            onPrev={() => setCurrentView('M4')}
            onNext={() => setCurrentView('M6')}
            onNavigateToVault={() => setCurrentView('M6')}
          />
        );
      case 'M6':
        return (
          <ExamVault
            currentSession={{
              lesson,
              regulationSource,
              sampleExam,
              matrix,
              resultStep1,
              resultStep2,
              resultStep3,
              resultStep5,
              subject,
              grade,
              durationMinutes: examDuration
            }}
            examDuration={examDuration}
            onLoadExamIntoWorkflow={handleLoadExamIntoWorkflow}
            onNavigateToStep={(stepId, examId) => {
              if (examId) setSelectedExamForSubmissions(examId);
              setCurrentView(stepId as ViewState);
            }}
          />
        );
      case 'M7':
        return (
          <StudentSubmissionsAnalytics
            initialExamId={selectedExamForSubmissions}
            onNavigateToStep={(stepId) => setCurrentView(stepId as ViewState)}
            currentWorkflow={{
              lesson,
              regulationSource,
              sampleExam,
              matrix,
              resultStep1,
              resultStep2,
              resultStep3,
              resultStep5,
              subject,
              grade,
              durationMinutes: examDuration
            }}
          />
        );
      case 'M8':
        return (
          <BackupRestore
            onExportAll={handleExportAll}
            onClearAllData={handleClearAllData}
          />
        );
      default:
        return (
          <div className="p-8 text-center text-slate-400">
            Chương trình không tồn tại.
          </div>
        );
    }
  };

  const steps = [
    { id: 'M0', title: 'Bước 0', subtitle: 'Nạp tệp nguồn', icon: Home, isCompleted: !!(isValidSourceText(regulationSource) && (isValidSourceText(lesson) || sampleExam.trim())) },
    { id: 'M1', title: 'Bước 1', subtitle: 'Phân tích tài liệu', icon: BookOpen, isCompleted: !!resultStep1.trim() },
    { id: 'M2', title: 'Bước 2', subtitle: 'Ma trận & Đặc tả', icon: Layers, isCompleted: !!resultStep2.trim() },
    { id: 'M3', title: 'Bước 3', subtitle: 'Tạo đề kiểm tra gốc', icon: PlusCircle, isCompleted: !!resultStep3.trim() },
    { id: 'M4', title: 'Bước 4', subtitle: 'Xuất bản đề thi', icon: Printer, isCompleted: !!resultStep3.trim() },
    { id: 'M5', title: 'Bước 5', subtitle: 'Tạo mã đề gộp', icon: Copy, isCompleted: !!resultStep5.trim() },
    { id: 'M6', title: 'Bước 6', subtitle: 'Kho đề thi', icon: Archive, isCompleted: false },
    { id: 'M7', title: 'Bước 7', subtitle: 'Sản phẩm học sinh', icon: GraduationCap, isCompleted: false },
  ];

  // STUDENT VIEW INTERCEPTOR:
  // When accessed via QR code or student link (?view=student or ?examId=), NEVER render the teacher application!
  if (studentViewActive) {
    if (studentLoading) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
          <div className="bg-slate-800/90 border border-slate-700 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center animate-pulse text-indigo-400">
              <GraduationCap size={36} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                Trường THCS Gio Linh • Cổng Làm Bài Trực Tuyến
              </div>
              <h2 className="text-xl font-black text-white mt-1">Đang nạp đề kiểm tra...</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Hệ thống đang bảo mật tải đề bài thi dành cho học sinh. Vui lòng chờ trong giây lát!
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping"></div>
              <span className="text-xs font-semibold text-slate-400">Chế độ: Đề bài làm (Không kèm đáp án)</span>
            </div>
          </div>
        </div>
      );
    }

    if (studentError || !studentExamData) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/30 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle size={36} />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-red-400">
                Cổng bài thi trực tuyến
              </div>
              <h2 className="text-xl font-black text-white mt-1">Không tải được đề thi</h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {studentError || 'Không tìm thấy dữ liệu đề thi trên hệ thống.'}
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Học sinh hãy kiểm tra lại mã QR hoặc báo lại Thầy/Cô để được cấp mã đề bài mới.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                Thử tải lại bài thi
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <StudentExamPortal
        exam={studentExamData}
        variant={studentVariant}
        className={studentClass}
        durationMinutes={studentDuration}
        allowSolutionView={false}
        onExit={() => {
          setStudentViewActive(false);
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch (e) {
            // ignore
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex pb-8">
      <Sidebar 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        onOpenGuide={() => setIsGuideOpen(true)}
      />
      
      <main className="flex-1 ml-64 min-h-screen overflow-x-hidden transition-all duration-300 flex flex-col">
        {/* Wizard Progress Stepper Header */}
        {currentView !== 'M8' && (
          <div className="bg-white border-b border-slate-250 py-4 px-8 sticky top-0 z-30 shadow-xs no-print select-none">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = currentView === step.id;
                const isCompleted = step.isCompleted;
                
                return (
                  <React.Fragment key={step.id}>
                    {/* Step Item */}
                    <button
                      onClick={() => handleNavigate(step.id as ViewState)}
                      className="flex items-center gap-3 group text-left outline-none transition-all cursor-pointer"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                        isActive 
                          ? 'bg-blue-600 text-white ring-4 ring-blue-50 shadow-md scale-105' 
                          : isCompleted 
                          ? 'bg-emerald-50 text-emerald-650 border border-emerald-200 hover:bg-emerald-100' 
                          : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                      }`}>
                        {isCompleted && !isActive ? (
                          <Check size={16} strokeWidth={2.5} />
                        ) : (
                          <Icon size={16} />
                        )}
                      </div>
                      <div className="hidden lg:block">
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                          {step.title}
                        </div>
                        <div className={`text-xs font-extrabold ${isActive ? 'text-slate-800' : 'text-slate-550 group-hover:text-slate-800'} transition-colors`}>
                          {step.subtitle}
                        </div>
                      </div>
                    </button>

                    {/* Connector line */}
                    {idx < steps.length - 1 && (
                      <div className="flex-1 h-[2px] mx-4 max-w-[60px] bg-slate-200 relative rounded-full hidden sm:block">
                        <div className={`absolute top-0 left-0 h-full transition-all duration-300 ${
                          isCompleted ? 'w-full bg-emerald-500' : isActive ? 'w-1/2 bg-blue-500' : 'w-0 bg-slate-250'
                        }`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1">
          {renderContent()}
        </div>
      </main>

      <GuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />
    </div>
  );
};

export default App;
