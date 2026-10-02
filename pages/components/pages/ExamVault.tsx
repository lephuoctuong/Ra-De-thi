import React, { useState, useEffect } from 'react';
import { 
  Archive, 
  Download, 
  FileText, 
  Printer, 
  Trash2, 
  Eye, 
  Plus, 
  Search, 
  Filter, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  BookOpen, 
  Copy, 
  Check, 
  ExternalLink,
  Edit3,
  RefreshCw,
  FolderArchive,
  ArrowRight,
  Upload,
  AlertCircle,
  QrCode,
  Mail,
  Send,
  GraduationCap
} from 'lucide-react';
import { SavedExamPackage } from '../types';
import { getSavedExams, saveExamToVault, deleteExamFromVault, inferExamMetadata } from '../utils/examStorage';
import { downloadTextAsDocx, downloadPackageAsDocx, printExamText } from '../utils/docxExporter';
import ContentRenderer from '../components/ContentRenderer';
import AssignExamModal from '../components/AssignExamModal';
import StudentExamPortal from './StudentExamPortal';


interface ExamVaultProps {
  // Dữ liệu phiên hiện tại từ các bước 0 - 5
  currentSession: {
    lesson: string;
    regulationSource: string;
    sampleExam: string;
    matrix: string;
    resultStep1: string;
    resultStep2: string;
    resultStep3: string;
    resultStep5: string;
    subject?: string;
    grade?: string;
    durationMinutes?: number;
  };
  examDuration?: number;
  onLoadExamIntoWorkflow: (pkg: SavedExamPackage) => void;
  onNavigateToStep: (stepId: 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8', examId?: string) => void;
}

const ExamVault: React.FC<ExamVaultProps> = ({
  currentSession,
  examDuration = 45,
  onLoadExamIntoWorkflow,
  onNavigateToStep
}) => {
  const [exams, setExams] = useState<SavedExamPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  
  // Modal states
  const [previewExam, setPreviewExam] = useState<SavedExamPackage | null>(null);
  const [previewTab, setPreviewTab] = useState<'step3' | 'step5' | 'step2' | 'step0'>('step3');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Assignment Modal & Student Preview State
  const [assignModalExam, setAssignModalExam] = useState<SavedExamPackage | null>(null);
  const [studentPreviewExam, setStudentPreviewExam] = useState<SavedExamPackage | null>(null);
  const [studentPreviewVariant, setStudentPreviewVariant] = useState<'step3' | '101' | '102' | '103' | '104' | 'all'>('step3');

  // In-app confirmation dialog states (to avoid iframe window.confirm blocking)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; title: string } | null>(null);
  const [loadConfirmTarget, setLoadConfirmTarget] = useState<SavedExamPackage | null>(null);

  // New exam form state
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [formSchoolYear, setFormSchoolYear] = useState('2024 - 2025');
  const [formDuration, setFormDuration] = useState(examDuration || 45);
  const [formNotes, setFormNotes] = useState('');

  // Load saved exams from storage
  const loadExams = async () => {
    setLoading(true);
    try {
      const data = await getSavedExams();
      setExams(data);
    } catch (err) {
      console.error('Lỗi tải danh sách kho đề:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Has active exam in current session?
  const hasActiveSessionData = !!(
    currentSession.resultStep3.trim() || 
    currentSession.resultStep5.trim() || 
    currentSession.resultStep2.trim()
  );

  // Open save modal with auto-inferred metadata
  const handleOpenSaveModal = () => {
    const meta = inferExamMetadata(currentSession);
    setFormTitle(meta.title);
    setFormSubject(meta.subject);
    setFormGrade(meta.grade);
    setFormSemester(meta.semester);
    setFormSchoolYear(meta.schoolYear);
    setFormDuration(examDuration || meta.durationMinutes || 45);
    setFormNotes('');
    setIsSaveModalOpen(true);
  };

  // Handle saving current session into vault
  const handleSaveCurrentExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('Vui lòng nhập tên cho bộ đề thi.');
      return;
    }

    const newPackage: SavedExamPackage = {
      id: 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: formTitle.trim(),
      subject: formSubject.trim() || 'Chung',
      grade: formGrade.trim(),
      semester: formSemester.trim(),
      schoolYear: formSchoolYear.trim(),
      durationMinutes: Number(formDuration) || examDuration || 45,
      lesson: currentSession.lesson,
      regulationSource: currentSession.regulationSource,
      sampleExam: currentSession.sampleExam,
      matrix: currentSession.matrix,
      resultStep1: currentSession.resultStep1,
      resultStep2: currentSession.resultStep2,
      resultStep3: currentSession.resultStep3,
      resultStep5: currentSession.resultStep5,
      notes: formNotes.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveExamToVault(newPackage);
    setIsSaveModalOpen(false);
    await loadExams();
    triggerToast(`Đã lưu thành công bộ đề "${newPackage.title}" vào Kho đề thi!`);
  };

  // Quick direct sync from Step 4 & Step 5
  const handleQuickSyncStepsToVault = async () => {
    if (!currentSession.resultStep3 && !currentSession.resultStep5) {
      alert('Chưa có dữ liệu từ Bước 4 hoặc Bước 5 để đồng bộ.');
      return;
    }
    const meta = inferExamMetadata(currentSession);
    const titleSuffix = currentSession.resultStep5 ? ' (Kèm 4 mã đề hoán đổi)' : ' (Đề thi hoàn thiện)';
    const newPackage: SavedExamPackage = {
      id: 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: (meta.title || 'Đề kiểm tra định kì') + titleSuffix,
      subject: currentSession.subject || meta.subject || 'Chung',
      grade: currentSession.grade || meta.grade || '',
      semester: meta.semester || 'Định kì',
      schoolYear: meta.schoolYear || '2024 - 2025',
      durationMinutes: Number(currentSession.durationMinutes) || examDuration || meta.durationMinutes || 45,
      lesson: currentSession.lesson,
      regulationSource: currentSession.regulationSource,
      sampleExam: currentSession.sampleExam,
      matrix: currentSession.matrix,
      resultStep1: currentSession.resultStep1,
      resultStep2: currentSession.resultStep2,
      resultStep3: currentSession.resultStep3,
      resultStep5: currentSession.resultStep5,
      notes: `Đồng bộ trực tiếp từ Bước 4 & Bước 5 lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveExamToVault(newPackage);
    await loadExams();
    triggerToast(`Đã đồng bộ thành công Bước 4 và Bước 5 vào Kho đề: "${newPackage.title}"!`);
  };

  // Delete an exam (triggers clean in-app confirmation modal)
  const handleDeleteExam = (id: string, title: string) => {
    setDeleteConfirmTarget({ id, title });
  };

  const confirmDeleteExam = async () => {
    if (!deleteConfirmTarget) return;
    const { id, title } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);
    try {
      await deleteExamFromVault(id);
      await loadExams();
      if (previewExam?.id === id) setPreviewExam(null);
      triggerToast(`Đã xóa vĩnh viễn bộ đề "${title}" khỏi kho đề thi.`);
    } catch (err: any) {
      console.error('Lỗi khi xóa bộ đề:', err);
      triggerToast('Không thể xóa bộ đề, vui lòng thử lại.');
    }
  };

  // Load into current workflow (triggers clean in-app confirmation modal)
  const handleLoadToWorkflow = (pkg: SavedExamPackage) => {
    setLoadConfirmTarget(pkg);
  };

  const confirmLoadToWorkflow = () => {
    if (!loadConfirmTarget) return;
    const pkg = loadConfirmTarget;
    setLoadConfirmTarget(null);
    onLoadExamIntoWorkflow(pkg);
    triggerToast(`Đã nạp bộ đề "${pkg.title}" vào các bước biên soạn!`);
    onNavigateToStep('M4'); // Navigate to step 4 or step 3
  };

  // Seed sample exam if vault is empty
  const handleSeedSampleExam = async () => {
    const samplePackage: SavedExamPackage = {
      id: 'exam_sample_bio8_' + Date.now(),
      title: 'Đề kiểm tra Giữa Học kì I - Môn Sinh học Lớp 8 (THCS Gio Linh)',
      subject: 'Sinh học',
      grade: '8',
      semester: 'Giữa Học kì I',
      schoolYear: '2024 - 2025',
      durationMinutes: 45,
      lesson: currentSession.lesson || 'Chủ đề: Cơ thể người, Hệ vận động, Hệ tuần hoàn, Dinh dưỡng và tiêu hóa.',
      regulationSource: currentSession.regulationSource || '',
      sampleExam: currentSession.sampleExam || '',
      matrix: currentSession.matrix || '',
      resultStep1: currentSession.resultStep1 || 'Phân tích chuẩn kiến thức kỹ năng môn Sinh học 8.',
      resultStep2: currentSession.resultStep2 || 'Bản đặc tả và Ma trận chuẩn GDPT 2018.',
      resultStep3: currentSession.resultStep3 || `# TRƯỜNG THCS GIO LINH\n## ĐỀ KIỂM TRA ĐỊNH KÌ GIỮA HỌC KÌ I\nMôn: Sinh học - Lớp 8\nThời gian làm bài: 45 phút\n\n### PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN\n**Câu 1:** Đơn vị cấu tạo và chức năng của cơ thể sống là gì?\nA. Mô\nB. Cơ quan\nC. Tế bào\nD. Hệ cơ quan\n\n**Câu 2:** Chức năng chính của hồng cầu trong máu là gì?\nA. Vận chuyển khí ôxi và khí cacbônic\nB. Tham gia vào quá trình đông máu\nC. Bảo vệ cơ thể chống lại vi khuẩn\nD. Vận chuyển các chất dinh dưỡng\n\n**Câu 3:** Khớp nào sau đây là khớp động?\nA. Khớp ngón tay\nB. Khớp hộp sọ\nC. Khớp cột sống\nD. Khớp xương chậu\n\n**Câu 4:** Chất dinh dưỡng nào bắt đầu được tiêu hóa hóa học tại khoang miệng?\nA. Protein\nB. Tinh bột chín\nC. Lipit\nD. Axit nucleic\n\n### PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG - SAI\n**Câu 1:** Khi nói về hệ tuần hoàn ở người:\na) Tim có 4 ngăn gồm 2 tâm thất ở trên và 2 tâm nhĩ ở dưới.\nb) Máu đỏ tươi ở tâm thất trái giàu khí O2 được bơm đi nuôi toàn cơ thể qua cung động mạch chủ.\nc) Vận tốc máu chảy trong mao mạch là chậm nhất giúp quá trình trao đổi chất diễn ra hiệu quả.\nd) Người có nhóm máu O có thể truyền cho tất cả các nhóm máu khác mà không sợ ngưng kết hồng cầu người cho.\n\n**Câu 2:** Khi nói về hệ hô hấp ở người:\na) Đường dẫn khí có chức năng dẫn khí, làm ấm, làm ẩm không khí và bảo vệ phổi.\nb) Quá trình trao đổi khí ở phổi diễn ra theo cơ chế khuếch tán từ nơi có nồng độ cao đến nơi có nồng độ thấp.\nc) Cử động hít vào bình thường có sự tham gia của cơ hoành co và cơ liên sườn ngoài co.\nd) Phổi trái gồm 3 thùy, phổi phải gồm 2 thùy do tim nằm lệch sang bên phải.\n\n### PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN\n**Câu 1:** Một chu kì co dãn của tim người bình thường ở trạng thái nghỉ ngơi kéo dài khoảng bao nhiêu giây? [giây]\n\n**Câu 2:** Trong một phân tử ADN gồm 3000 nucleotide có tỉ lệ A = 20%. Hãy tính số liên kết hiđrô của phân tử ADN này. [liên kết]\n\n**Câu 3:** Một người trưởng thành bình thường có thể tích khí lưu thông mỗi lần hít vào là 500 ml. Nếu nhịp thở là 16 lần/phút thì thể tích khí lưu thông qua phổi trong 1 phút là bao nhiêu lít? [lít]\n\n**Câu 4:** Khi đo huyết áp một người khỏe mạnh, chỉ số huyết áp tối đa trung bình là bao nhiêu mmHg? [mmHg]\n\n**Câu 5:** Một giọt máu của người có khoảng 5 lít máu. Với số lượng hồng cầu trung bình là 4.5 triệu tế bào/mm³ máu. Hãy tính số lượng hồng cầu có trong 1 mm³ máu người đó.\n\n**Câu 6:** Tỉ lệ % số nucleotide loại Guanine (G) của một gen có A = 35% là bao nhiêu %? [%]\n\n### ĐÁP ÁN VÀ THANG ĐIỂM\nPHẦN I:\nCâu 1: C\nCâu 2: A\nCâu 3: A\nCâu 4: B\n\nPHẦN II:\nCâu 1: a - S, b - Đ, c - Đ, d - Đ\nCâu 2: a - Đ, b - Đ, c - Đ, d - S\n\nPHẦN III:\nCâu 1: 0.8\nCâu 2: 3900\nCâu 3: 8\nCâu 4: 120\nCâu 5: 4500000\nCâu 6: 15`,
      resultStep5: currentSession.resultStep5 || `# BỘ MÃ ĐỀ TƯƠNG ĐƯƠNG 101 - 104\n\n## MÃ ĐỀ 101\n**Câu 1:** Tế bào là đơn vị cơ bản cấu tạo nên cơ thể vì:\nA. Mọi cơ quan đều được cấu tạo từ tế bào\nB. Tế bào thực hiện mọi hoạt động sống cơ bản\nC. Cả A và B đều đúng\nD. Tế bào có kích thước hiển vi`,
      notes: 'Đề mẫu chuẩn định dạng GDPT 2018 tích hợp sẵn công thức và đáp án.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveExamToVault(samplePackage);
    await loadExams();
    triggerToast('Đã nạp đề kiểm tra mẫu vào Kho đề thi thành công!');
  };

  // Export JSON backup of single exam
  const handleExportJson = (pkg: SavedExamPackage) => {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(pkg.title || 'De_Thi').replace(/[/\\?%*:|"<>]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Đã xuất tệp dữ liệu đề thi (.json) thành công.');
  };

  // Import JSON backup
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.title && !parsed.resultStep3) {
          alert('Tệp JSON không đúng định dạng của gói đề thi hệ thống.');
          return;
        }
        const importedPkg: SavedExamPackage = {
          ...parsed,
          id: 'exam_import_' + Date.now(),
          title: parsed.title || file.name.replace('.json', ''),
          createdAt: parsed.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await saveExamToVault(importedPkg);
        await loadExams();
        triggerToast(`Đã nhập thành công bộ đề "${importedPkg.title}" vào kho!`);
      } catch (err) {
        alert('Lỗi đọc tệp JSON: Vui lòng kiểm tra lại cấu trúc tệp.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered list
  const filteredExams = exams.filter(item => {
    const matchSearch = (item.title + ' ' + (item.subject || '') + ' ' + (item.notes || '')).toLowerCase().includes(searchTerm.toLowerCase());
    const matchSubject = selectedSubject === 'ALL' || item.subject?.toLowerCase() === selectedSubject.toLowerCase();
    const matchGrade = selectedGrade === 'ALL' || item.grade === selectedGrade;
    return matchSearch && matchSubject && matchGrade;
  });

  // Unique subjects and grades for filters
  const subjects = Array.from(new Set(exams.map(e => e.subject).filter(Boolean))) as string[];
  const grades = Array.from(new Set(exams.map(e => e.grade).filter(Boolean))) as string[];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 animate-fade-in">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-cyan-500/50 flex items-center gap-3 animate-bounce">
          <CheckCircle2 size={20} className="text-cyan-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
              <Archive size={14} /> Phân hệ 6. Kho lưu trữ & Tải về đề thi
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              KHO ĐỀ THI ĐÃ BIÊN SOẠN
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Nơi lưu trữ tập trung các bộ đề thi đã hoàn thiện từ Bước 0 đến Bước 5. Thầy cô có thể tra cứu, xem trước, tải về tệp Word (.docx) chuẩn Bộ GD&ĐT, in ấn đề thi hoặc nạp lại để tiếp tục chỉnh sửa bất cứ khi nào cần.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {hasActiveSessionData && (
              <button
                onClick={handleOpenSaveModal}
                className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02]"
              >
                <Plus size={18} /> Lưu đề hiện tại vào kho
              </button>
            )}

            <label className="px-4 py-3 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl font-semibold text-sm flex items-center gap-2 cursor-pointer transition-all">
              <Upload size={16} className="text-cyan-400" />
              <span>Nhập tệp .JSON</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
          </div>
        </div>

        {/* Current Working Session Banner */}
        {hasActiveSessionData && (
          <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-800/50 p-5 rounded-2xl border border-slate-700/60">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping shrink-0 mt-1 sm:mt-0"></div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                    Quy trình biên soạn hiện hành (Bước 0 - 5)
                  </p>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Clock size={11} className="text-amber-400" />
                    {examDuration || currentSession.durationMinutes || 45} phút
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className={`inline-flex items-center gap-1.5 ${currentSession.resultStep3 ? 'text-emerald-300 font-semibold' : 'text-slate-400'}`}>
                    <CheckCircle2 size={13} className={currentSession.resultStep3 ? 'text-emerald-400' : 'text-slate-500'} />
                    {currentSession.resultStep3 ? 'Bước 4: Đã có Đề thi hoàn thiện' : 'Bước 4: Chưa xuất bản đề'}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 ${currentSession.resultStep5 ? 'text-emerald-300 font-semibold' : 'text-slate-400'}`}>
                    <CheckCircle2 size={13} className={currentSession.resultStep5 ? 'text-emerald-400' : 'text-slate-500'} />
                    {currentSession.resultStep5 ? 'Bước 5: Đã có 4 Mã đề hoán đổi (101 - 104)' : 'Bước 5: Chưa sinh 4 mã đề'}
                  </span>
                  {currentSession.resultStep2 && (
                    <span className="text-blue-300/90 inline-flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-blue-400" />
                      Bước 2: Ma trận & Bản đặc tả
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-end">
              {(currentSession.resultStep3 || currentSession.resultStep5) && (
                <button
                  onClick={() => {
                    const meta = inferExamMetadata(currentSession);
                    const activePkg: SavedExamPackage = {
                      id: 'exam_' + Date.now(),
                      title: meta.title || 'Đề kiểm tra định kì',
                      subject: currentSession.subject || meta.subject || 'Chung',
                      grade: currentSession.grade || meta.grade || '',
                      semester: meta.semester || 'Định kì',
                      schoolYear: meta.schoolYear || '2024 - 2025',
                      durationMinutes: examDuration || meta.durationMinutes || 45,
                      lesson: currentSession.lesson,
                      regulationSource: currentSession.regulationSource,
                      sampleExam: currentSession.sampleExam,
                      matrix: currentSession.matrix,
                      resultStep1: currentSession.resultStep1,
                      resultStep2: currentSession.resultStep2,
                      resultStep3: currentSession.resultStep3,
                      resultStep5: currentSession.resultStep5,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setAssignModalExam(activePkg);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-950/40"
                >
                  <QrCode size={14} /> Giao bài tập này (Email / QR)
                </button>
              )}
              <button
                onClick={handleQuickSyncStepsToVault}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
              >
                <FolderArchive size={14} /> Đồng bộ nhanh Bước 4 & 5 vào Kho
              </button>
              <button
                onClick={handleOpenSaveModal}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 font-bold text-xs transition-all flex items-center gap-1.5"
              >
                Tùy chỉnh & Lưu...
              </button>
              <button
                onClick={() => onNavigateToStep('M7')}
                className="px-3.5 py-2 rounded-xl bg-indigo-950/80 text-indigo-300 hover:text-white hover:bg-indigo-900 border border-indigo-700/70 font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <GraduationCap size={14} className="text-indigo-400" /> Xem bài nộp HS (Mục 7)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên đề thi, từ khóa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Filter by Subject */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Môn:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả môn học</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Filter by Grade */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Lớp:</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả khối</option>
              {grades.map(g => (
                <option key={g} value={g}>Lớp {g}</option>
              ))}
            </select>
          </div>

          {/* Total count badge */}
          <div className="ml-auto text-xs font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">
            Tổng cộng: <span className="text-blue-600 font-extrabold">{filteredExams.length}</span> bộ đề
          </div>
        </div>
      </div>

      {/* Main Content: Exam List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 space-y-3">
          <RefreshCw size={28} className="animate-spin text-blue-500 mx-auto" />
          <p className="text-sm font-semibold">Đang truy xuất kho dữ liệu đề thi...</p>
        </div>
      ) : filteredExams.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto">
            <Archive size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-800">Kho đề thi chưa có bài lưu nào</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thầy cô có thể thực hiện quy trình từ Bước 0 đến Bước 5 rồi bấm <strong className="text-slate-700">"Lưu vào kho"</strong>, hoặc nạp ngay bộ đề mẫu chuẩn môn Sinh học để trải nghiệm.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleSeedSampleExam}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              <Sparkles size={16} /> Nạp đề mẫu vào kho
            </button>
            {hasActiveSessionData && (
              <button
                onClick={handleOpenSaveModal}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <FolderArchive size={16} /> Lưu đề đang soạn vào kho
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Grid of Exam Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const hasStep3 = !!exam.resultStep3?.trim();
            const hasStep5 = !!exam.resultStep5?.trim();
            const hasStep2 = !!exam.resultStep2?.trim();

            return (
              <div
                key={exam.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden group hover:border-blue-300"
              >
                {/* Card Top */}
                <div className="p-5 space-y-3">
                  {/* Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {exam.subject && (
                        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {exam.subject}
                        </span>
                      )}
                      {exam.grade && (
                        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                          Lớp {exam.grade}
                        </span>
                      )}
                      {exam.semester && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {exam.semester}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteExam(exam.id, exam.title)}
                      title="Xóa đề khỏi kho"
                      className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Title */}
                  <h3 
                    onClick={() => { setPreviewExam(exam); setPreviewTab('step3'); }}
                    className="font-bold text-slate-800 text-base leading-snug group-hover:text-blue-600 transition-colors cursor-pointer line-clamp-2"
                  >
                    {exam.title}
                  </h3>

                  {/* Content Indicators */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-2 h-2 rounded-full ${hasStep3 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                      <span className={hasStep3 ? 'font-medium text-slate-700' : 'text-slate-400'}>
                        {hasStep3 ? 'Đề kiểm tra gốc & Hướng dẫn chấm' : 'Chưa có đề gốc'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-2 h-2 rounded-full ${hasStep5 ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                      <span className={hasStep5 ? 'font-medium text-slate-700' : 'text-slate-400'}>
                        {hasStep5 ? '4 Mã đề hoán đổi (101 - 104)' : 'Chưa tạo mã đề gộp'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-2 h-2 rounded-full ${hasStep2 ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                      <span className={hasStep2 ? 'font-medium text-slate-700' : 'text-slate-400'}>
                        {hasStep2 ? 'Ma trận & Đặc tả chuẩn văn bản quy định' : 'Chưa có ma trận đặc tả'}
                      </span>
                    </div>
                  </div>

                  {/* Date and duration */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} /> {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {exam.durationMinutes || 45} phút
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="bg-slate-50/80 p-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* View Details & Assign Button Group */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setPreviewExam(exam); setPreviewTab('step3'); }}
                      className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Eye size={14} className="text-slate-500" /> Xem đề
                    </button>

                    <button
                      onClick={() => setAssignModalExam(exam)}
                      title="Giao bài tập cho học sinh qua Email hoặc quét mã QR"
                      className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs hover:scale-[1.02]"
                    >
                      <QrCode size={14} /> Giao bài
                    </button>

                    <button
                      onClick={() => onNavigateToStep('M7', exam.id)}
                      title="Xem kết quả, phổ điểm & bài nộp của học sinh (Mục 7)"
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <GraduationCap size={14} className="text-indigo-600" /> Bài làm (Mục 7)
                    </button>
                  </div>

                  {/* Fast Download Dropdown / Group */}
                  <div className="flex items-center gap-1.5">
                    {/* Word Download */}
                    <button
                      onClick={() => {
                        if (hasStep5 && hasStep3) {
                          downloadPackageAsDocx(exam);
                          triggerToast(`Đang tải trọn gói Word (.docx) cho: ${exam.title}`);
                        } else if (hasStep3) {
                          downloadTextAsDocx(exam.resultStep3 || '', `${exam.title}.docx`);
                          triggerToast(`Đang tải Đề gốc Word (.docx) cho: ${exam.title}`);
                        } else {
                          triggerToast('Bộ đề này chưa có nội dung đề thi để xuất Word.');
                        }
                      }}
                      title="Tải tệp Word (.docx) chuẩn Bộ GD&ĐT"
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Download size={14} /> Tải Word
                    </button>

                    {/* Print Button */}
                    <button
                      onClick={() => printExamText(exam.title, exam.resultStep3 || exam.resultStep5 || '')}
                      title="In đề thi / Xuất PDF A4"
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      <Printer size={15} className="text-slate-600" />
                    </button>

                    {/* Load into Workflow Button */}
                    <button
                      onClick={() => handleLoadToWorkflow(exam)}
                      title="Nạp lại bộ đề này vào quy trình Bước 0 - 5 để chỉnh sửa"
                      className="p-2 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
                    >
                      <ExternalLink size={15} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: PREVIEW & DOWNLOAD EXAM */}
      {previewExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Kho lưu trữ đề thi
                  </span>
                  <span className="text-xs text-slate-400">
                    Tạo ngày: {new Date(previewExam.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white leading-tight">
                  {previewExam.title}
                </h2>
              </div>
              
              <button
                onClick={() => setPreviewExam(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap gap-2">
              <button
                onClick={() => setPreviewTab('step3')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  previewTab === 'step3'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText size={15} /> 1. Đề thi gốc & Đáp án
              </button>
              <button
                onClick={() => setPreviewTab('step5')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  previewTab === 'step5'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={15} /> 2. 4 Mã đề hoán đổi (101 - 104)
              </button>
              <button
                onClick={() => setPreviewTab('step2')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  previewTab === 'step2'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={15} /> 3. Ma trận & Đặc tả (văn bản quy định)
              </button>
              <button
                onClick={() => setPreviewTab('step0')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  previewTab === 'step0'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen size={15} /> 4. Tài liệu nguồn / YC cần đạt
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto bg-slate-50">
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs prose max-w-none text-sm text-slate-800 leading-relaxed">
                {previewTab === 'step3' && (
                  previewExam.resultStep3 ? (
                    <ContentRenderer content={previewExam.resultStep3} />
                  ) : (
                    <div className="text-center py-12 text-slate-400 font-medium">
                      Bộ đề này chưa có nội dung Đề thi gốc (Mục 3).
                    </div>
                  )
                )}

                {previewTab === 'step5' && (
                  previewExam.resultStep5 ? (
                    <ContentRenderer content={previewExam.resultStep5} />
                  ) : (
                    <div className="text-center py-12 text-slate-400 font-medium">
                      Bộ đề này chưa có 4 mã đề hoán đổi (Mục 5).
                    </div>
                  )
                )}

                {previewTab === 'step2' && (
                  previewExam.resultStep2 ? (
                    <ContentRenderer content={previewExam.resultStep2} />
                  ) : (
                    <div className="text-center py-12 text-slate-400 font-medium">
                      Bộ đề này chưa có Ma trận & Bản đặc tả (Mục 2).
                    </div>
                  )
                )}

                {previewTab === 'step0' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Tài liệu học tập / Nội dung bài học:</h4>
                      <div className="bg-slate-50 p-3 rounded-xl text-xs font-mono whitespace-pre-wrap">
                        {previewExam.lesson || 'Không có ghi chú nguồn.'}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1">Yêu cầu cần đạt / văn bản quy định:</h4>
                      <div className="bg-slate-50 p-3 rounded-xl text-xs font-mono whitespace-pre-wrap">
                        {previewExam.regulationSource || 'Không có văn bản quy chuẩn.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleLoadToWorkflow(previewExam)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <ExternalLink size={15} /> Mở vào quy trình soạn thảo (Bước 0 - 5)
                </button>

                <button
                  onClick={() => handleExportJson(previewExam)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download size={14} /> Xuất gói JSON
                </button>
              </div>

              {/* Download & Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Assign to Students */}
                <button
                  onClick={() => {
                    const target = previewExam;
                    setPreviewExam(null);
                    setAssignModalExam(target);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:scale-[1.02]"
                >
                  <QrCode size={15} /> Giao bài tập (Email / QR)
                </button>

                {/* Print */}
                <button
                  onClick={() => {
                    const textToPrint = previewTab === 'step5' 
                      ? previewExam.resultStep5 
                      : previewTab === 'step2'
                      ? previewExam.resultStep2
                      : previewExam.resultStep3;
                    printExamText(previewExam.title, textToPrint || '');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Printer size={15} /> In trang này
                </button>

                {/* Download Word for active tab */}
                <button
                  onClick={() => {
                    const activeContent = previewTab === 'step5'
                      ? previewExam.resultStep5
                      : previewTab === 'step2'
                      ? previewExam.resultStep2
                      : previewExam.resultStep3;
                    const suffix = previewTab === 'step5' ? '_4_Ma_De' : previewTab === 'step2' ? '_Ma_Tran' : '_De_Goc';
                    downloadTextAsDocx(activeContent || '', `${previewExam.title}${suffix}.docx`);
                    triggerToast('Đang tải tệp Word (.docx)...');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={15} /> Tải Word mục đang xem
                </button>

                {/* Download Full Package */}
                <button
                  onClick={() => {
                    downloadPackageAsDocx(previewExam);
                    triggerToast(`Đang tải trọn gói Word cho: ${previewExam.title}`);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={15} /> Tải Trọn gói đề thi (.docx)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: SAVE ACTIVE SESSION INTO VAULT */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Archive size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Lưu bộ đề vào Kho đề thi</h3>
                  <p className="text-xs text-slate-400">Đóng gói toàn bộ các bước 0 - 5 để tải về sau</p>
                </div>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCurrentExam} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Tên bộ đề thi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Đề kiểm tra Giữa Học kì I - Môn Sinh học Lớp 8"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Môn học</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="Ví dụ: Sinh học, Toán..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Khối lớp</label>
                  <input
                    type="text"
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                    placeholder="Ví dụ: 8, 9, 10..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Học kì</label>
                  <input
                    type="text"
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value)}
                    placeholder="Giữa kì I, Cuối kì I..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">Thời gian làm bài (phút)</label>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {formDuration} phút
                    </span>
                  </div>
                  <input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {[15, 45, 60, 90, 120, 180].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setFormDuration(mins)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                          formDuration === mins
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {mins}p
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Ghi chú của giáo viên (tùy chọn)</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ghi chú về mức độ khó, lớp áp dụng..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Data package summary */}
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 text-[11px] text-blue-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5 text-blue-900">
                  <CheckCircle2 size={14} className="text-blue-600" />
                  Dữ liệu được đóng gói đồng bộ từ Bước 0 - 5:
                </p>
                <div className="text-blue-800 space-y-0.5 pl-4 text-[11px]">
                  <p>• <strong>Bước 4 & 3:</strong> Đề kiểm tra hoàn thiện ({currentSession.resultStep3 ? 'Đã sẵn sàng' : 'Chưa có'})</p>
                  <p>• <strong>Bước 5:</strong> 4 Mã đề hoán đổi 101 - 104 ({currentSession.resultStep5 ? 'Đã sẵn sàng' : 'Chưa tạo'})</p>
                  <p>• <strong>Bước 2:</strong> Ma trận và Bản đặc tả theo văn bản đã nạp ({currentSession.resultStep2 ? 'Đã sẵn sàng' : 'Chưa tạo'})</p>
                  <p>• <strong>Bước 0 & 1:</strong> Tài liệu nguồn & Hướng dẫn chuẩn hóa</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
                >
                  <Archive size={15} /> Lưu ngay vào kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Exam */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Xác nhận xóa bộ đề thi</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn bộ đề <strong className="text-slate-900">"{deleteConfirmTarget.title}"</strong> khỏi Kho đề thi? Thao tác này sẽ xóa hoàn toàn đề thi khỏi bộ nhớ lưu trữ và không thể hoàn tác.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteExam}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all text-xs shadow-md shadow-rose-200 flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Load Exam to Workflow */}
      {loadConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <FolderArchive size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Nạp đề vào quy trình biên soạn</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Bạn có muốn nạp bộ đề <strong className="text-slate-900">"{loadConfirmTarget.title}"</strong> vào quy trình biên soạn (các Bước 0 đến 5) để tiếp tục chỉnh sửa, cập nhật hoặc xuất bản?
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setLoadConfirmTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-xs"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmLoadToWorkflow}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all text-xs shadow-md shadow-indigo-200 flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Nạp vào quy trình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN EXAM (QR & EMAIL) */}
      {assignModalExam && (
        <AssignExamModal
          isOpen={!!assignModalExam}
          onClose={() => setAssignModalExam(null)}
          exam={assignModalExam}
          examDuration={assignModalExam.durationMinutes || examDuration || 45}
          onPreviewStudentMode={(variant) => {
            const target = assignModalExam;
            setStudentPreviewVariant(variant);
            setStudentPreviewExam(target);
          }}
        />
      )}

      {/* FULLSCREEN PREVIEW: STUDENT EXAM PORTAL */}
      {studentPreviewExam && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <StudentExamPortal
            exam={studentPreviewExam}
            variant={studentPreviewVariant}
            durationMinutes={studentPreviewExam.durationMinutes || examDuration || 45}
            allowSolutionView={false}
            isPreviewMode={true}
            onExit={() => setStudentPreviewExam(null)}
          />
        </div>
      )}

    </div>
  );
};

export default ExamVault;
