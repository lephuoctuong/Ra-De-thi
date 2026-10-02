import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  Mail,
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  GraduationCap,
  Sparkles,
  Eye,
  FileText,
  Send,
  HelpCircle,
  Info,
  ShieldCheck
} from 'lucide-react';
import { SavedExamPackage, ExamAssignment } from '../types';
import { saveAssignment, getAssignments } from '../utils/examStorage';
import { getStudentExamQuestionsOnly } from '../utils/examSanitizer';
import { extractAnswerKey } from '../utils/submissionStorage';

interface AssignExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: SavedExamPackage;
  examDuration?: number;
  onPreviewStudentMode: (variant: 'step3' | '101' | '102' | '103' | '104' | 'all') => void;
}

const AssignExamModal: React.FC<AssignExamModalProps> = ({
  isOpen,
  onClose,
  exam,
  examDuration = 45,
  onPreviewStudentMode
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'email' | 'history'>('qr');
  
  // Assignment Configuration
  const [selectedVariant, setSelectedVariant] = useState<'step3' | '101' | '102' | '103' | '104' | 'all'>('step3');
  const [className, setClassName] = useState('Lớp 10A1');
  const [duration, setDuration] = useState<number>(exam.durationMinutes || examDuration || 45);
  const [hasDeadline, setHasDeadline] = useState(true);
  
  // Default deadline: tomorrow at 22:00
  const [deadline, setDeadline] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(22, 0, 0, 0);
    return tomorrow.toISOString().slice(0, 16);
  });
  
  // Assignment security: strictly assign questions only, never answers
  const allowSolutionView = false;
  const [teacherNote, setTeacherNote] = useState(
    'Các em đọc kĩ đề bài, làm bài nghiêm túc và nộp đúng hạn. Không sử dụng tài liệu. Chúc các em đạt kết quả cao!'
  );

  // Email state
  const [emailsInput, setEmailsInput] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmailBody, setCopiedEmailBody] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [assignmentHistory, setAssignmentHistory] = useState<ExamAssignment[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedOnServer, setPublishedOnServer] = useState(false);

  // Auto publish sanitized questions only to server API so any student scanning QR receives questions
  useEffect(() => {
    if (!isOpen || !exam) return;
    let isCancelled = false;

    const publishToServer = async () => {
      setIsPublishing(true);
      try {
        const sanitizedQuestions = getStudentExamQuestionsOnly(exam, selectedVariant);
        // Pre-compute answer key for server-side instant grading security (prioritize stored serverAnswerKey)
        const answerKey = (exam.serverAnswerKey && Object.keys(exam.serverAnswerKey).length > 0)
          ? exam.serverAnswerKey
          : extractAnswerKey(exam.resultStep3 || exam.resultStep5 || '', selectedVariant);
        const res = await fetch('/api/student/publish-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: exam.id,
            examId: exam.id,
            title: exam.title,
            subject: exam.subject,
            grade: exam.grade,
            durationMinutes: duration,
            className: className.trim() || 'Lớp học',
            deadline: hasDeadline && deadline ? deadline : undefined,
            teacherNote,
            variant: selectedVariant,
            questionsOnlyContent: sanitizedQuestions,
            serverAnswerKey: answerKey
          })
        });
        if (res.ok && !isCancelled) {
          setPublishedOnServer(true);
        }
      } catch (err) {
        console.warn('Could not auto-publish exam to server API:', err);
      } finally {
        if (!isCancelled) setIsPublishing(false);
      }
    };

    publishToServer();
    return () => { isCancelled = true; };
  }, [isOpen, exam.id, selectedVariant, className, duration, hasDeadline, deadline, teacherNote]);

  // Calculate shareable student URL
  const studentShareUrl = useMemo(() => {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('view', 'student');
    params.set('examId', exam.id);
    if (selectedVariant !== 'step3') {
      params.set('variant', selectedVariant);
    }
    params.set('class', className.trim() || 'Học sinh');
    params.set('duration', String(duration));
    if (hasDeadline && deadline) {
      params.set('deadline', deadline);
    }
    // Strict pedagogical security: NEVER append sol param so students only receive questions
    return `${baseUrl}?${params.toString()}`;
  }, [exam.id, selectedVariant, className, duration, hasDeadline, deadline]);

  // Generate QR Code
  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(studentShareUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Error generating QR code:', err));
  }, [isOpen, studentShareUrl]);

  // Load assignment history
  const loadHistory = async () => {
    const all = await getAssignments();
    const forThisExam = all.filter((a: ExamAssignment) => a.examId === exam.id);
    setAssignmentHistory(forThisExam);
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, exam.id]);

  // Update email template when settings change
  useEffect(() => {
    const subj = `[BÀI TẬP] Môn ${exam.subject || 'Chung'} - ${exam.title} - ${className}`;
    setEmailSubject(subj);

    const deadlineFormatted = hasDeadline && deadline 
      ? new Date(deadline).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Không giới hạn thời gian nộp';

    const variantLabel = selectedVariant === 'step3' 
      ? 'Đề thi chuẩn (Đề gốc)' 
      : selectedVariant === 'all' 
      ? 'Bộ 4 mã đề hoán đổi' 
      : `Mã đề ${selectedVariant}`;

    const body = `Kính gửi Quý Phụ huynh và các em Học sinh ${className},

Thầy/Cô gửi bài tập ôn luyện / đề kiểm tra định kì của môn ${exam.subject || 'Chung'}.

📌 THÔNG TIN BÀI TẬP:
- Tên bài kiểm tra: ${exam.title}
- Lớp: ${className}
- Hình thức/Mã đề: ${variantLabel}
- Thời gian làm bài: ${duration} phút
- Hạn nộp bài: ${deadlineFormatted}
- Chế độ bảo mật: CHỈ GIAO ĐỀ BÀI (Tuyệt đối không gửi kèm đáp án hay thang điểm)
- Lời dặn của Giáo viên: ${teacherNote}

👉 HƯỚNG DẪN LÀM BÀI:
1. Cách 1: Bấm vào đường liên kết dưới đây để mở đề và làm bài trực tuyến:
${studentShareUrl}

2. Cách 2: Quét mã QR đính kèm bằng Zalo hoặc Camera điện thoại/máy tính bảng.

Sau khi hoàn thành, học sinh bấm "Nộp bài thi" trên hệ thống để hoàn tất ghi nhận điểm và nhận xét.

Chúc các em ôn tập và làm bài đạt kết quả thật tốt!
Thầy/Cô bộ môn ${exam.subject || 'Chung'}.`;

    setEmailBody(body);
  }, [exam, className, duration, hasDeadline, deadline, teacherNote, studentShareUrl, selectedVariant]);

  if (!isOpen) return null;

  // Parsed valid emails
  const validEmails = emailsInput
    .split(/[\n,;]+/)
    .map(e => e.trim())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Copy share link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(studentShareUrl);
    setCopiedLink(true);
    showToast('Đã sao chép liên kết làm bài cho học sinh!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Copy email body
  const handleCopyEmailBody = () => {
    navigator.clipboard.writeText(emailBody);
    setCopiedEmailBody(true);
    showToast('Đã sao chép nội dung email mẫu vào bộ nhớ tạm!');
    setTimeout(() => setCopiedEmailBody(false), 2500);
  };

  // Download QR Code image
  const handleDownloadQrImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    const safeTitle = (exam.title || 'De_Thi').replace(/\s+/g, '_').slice(0, 30);
    a.download = `Ma_QR_GiaoBai_${safeTitle}_${className.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Đã tải xuống hình ảnh Mã QR (PNG)!');
  };

  // Save assignment record
  const handleSaveAssignmentRecord = async (method: 'email' | 'qr' | 'both') => {
    const record: ExamAssignment = {
      id: 'assign_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      examId: exam.id,
      examTitle: exam.title,
      variant: selectedVariant,
      className: className.trim() || 'Lớp học',
      deadline: hasDeadline ? deadline : undefined,
      durationMinutes: duration,
      allowSolutionView,
      teacherNote,
      recipientEmails: validEmails,
      assignedMethod: method,
      createdAt: new Date().toISOString()
    };

    await saveAssignment(record);
    await loadHistory();
    showToast(`Đã lưu đợt giao bài cho "${className}" vào hệ thống!`);
  };

  // Launch native mail client via mailto
  const handleSendViaMailto = async () => {
    if (validEmails.length === 0) {
      alert('Vui lòng nhập ít nhất một địa chỉ email học sinh hợp lệ.');
      return;
    }

    await handleSaveAssignmentRecord('email');

    // Use BCC for student privacy
    const bccList = encodeURIComponent(validEmails.join(','));
    const subjectEncoded = encodeURIComponent(emailSubject);
    const bodyEncoded = encodeURIComponent(emailBody);
    const mailtoUrl = `mailto:?bcc=${bccList}&subject=${subjectEncoded}&body=${bodyEncoded}`;

    window.location.href = mailtoUrl;
    showToast(`Đã chuẩn bị mở email gửi tới ${validEmails.length} học sinh!`);
  };

  // Print A4 assignment sheet with QR Code
  const handlePrintAssignmentSheet = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Trình duyệt đang chặn cửa sổ in. Vui lòng cho phép popup.');
      return;
    }

    const deadlineStr = hasDeadline && deadline
      ? new Date(deadline).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Không giới hạn';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Phiếu Giao Bài Tập - ${exam.title}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Times New Roman', serif;
            color: #111827;
            margin: 0;
            padding: 20px;
            font-size: 14pt;
            line-height: 1.5;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .header-table td {
            vertical-align: top;
          }
          .school-info {
            text-align: center;
            font-size: 12pt;
          }
          .exam-title-box {
            text-align: center;
            margin: 15px 0 20px 0;
          }
          .exam-title {
            font-size: 18pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 0 0 5px 0;
          }
          .meta-line {
            font-size: 12pt;
            font-style: italic;
          }
          .student-info-box {
            border: 1px dashed #333;
            padding: 12px 18px;
            margin-bottom: 20px;
            font-size: 13pt;
            background: #fafafa;
          }
          .qr-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 2px solid #0f172a;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 25px;
            background: #f8fafc;
          }
          .qr-img {
            width: 160px;
            height: 160px;
            border: 1px solid #cbd5e1;
            background: #fff;
            padding: 4px;
          }
          .qr-instruction {
            padding-left: 20px;
            flex: 1;
          }
          .qr-title {
            font-size: 15pt;
            font-weight: bold;
            color: #0f172a;
            margin-bottom: 6px;
          }
          .qr-text {
            font-size: 12pt;
            color: #334155;
            line-height: 1.4;
          }
          .link-box {
            background: #e2e8f0;
            padding: 6px 10px;
            font-family: monospace;
            font-size: 10pt;
            word-break: break-all;
            margin-top: 8px;
          }
          .notes-box {
            margin-top: 15px;
            font-size: 12pt;
            border-left: 3px solid #2563eb;
            padding-left: 12px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="width: 50%;" class="school-info">
              <div>SỞ GIÁO DỤC VÀ ĐÀO TẠO</div>
              <div style="font-weight: bold;">TRƯỜNG THPT / THCS</div>
              <div style="margin-top: 4px; border-bottom: 1px solid #000; width: 120px; margin: 4px auto 0;"></div>
            </td>
            <td style="width: 50%;" class="school-info">
              <div style="font-weight: bold;">PHIẾU GIAO BÀI TẬP VỀ NHÀ</div>
              <div>Năm học: ${exam.schoolYear || '2024 - 2025'}</div>
              <div style="font-style: italic;">Hạn nộp: ${deadlineStr}</div>
            </td>
          </tr>
        </table>

        <div class="exam-title-box">
          <div class="exam-title">${exam.title}</div>
          <div class="meta-line">
            Môn học: <strong>${exam.subject || 'Chung'}</strong> | Khối: <strong>${exam.grade || '...'}</strong> | Thời gian làm bài: <strong>${duration} phút</strong>
          </div>
          <div style="margin-top: 5px; font-size: 10pt; color: #15803d; font-weight: bold;">
            🔒 Chế độ giao bài: Chỉ phát đề bài làm (Không kèm đáp án hay thang điểm)
          </div>
        </div>

        <div class="student-info-box">
          <table style="width: 100%;">
            <tr>
              <td style="width: 60%;">Họ và tên học sinh: ..............................................................</td>
              <td style="width: 40%;">Lớp: <strong>${className}</strong></td>
            </tr>
            <tr>
              <td style="padding-top: 8px;">Mã số học sinh (SBD): ....................................................</td>
              <td style="padding-top: 8px;">Ngày nộp bài: ....../....../202...</td>
            </tr>
          </table>
        </div>

        <div class="qr-section">
          <img src="${qrDataUrl}" class="qr-img" alt="QR Code" />
          <div class="qr-instruction">
            <div class="qr-title">📱 QUÉT MÃ QR ĐỂ MỞ ĐỀ & LÀM BÀI TRỰC TUYẾN</div>
            <div class="qr-text">
              1. Mở ứng dụng <strong>Zalo</strong> hoặc <strong>Camera</strong> trên điện thoại/máy tính bảng.<br/>
              2. Hướng máy ảnh vào mã QR bên cạnh để nhận đề bài.<br/>
              3. Hoàn thành các câu hỏi và bấm <strong>"Nộp bài thi"</strong> để hoàn tất.
            </div>
            <div class="link-box">Liên kết trực tiếp: ${studentShareUrl}</div>
          </div>
        </div>

        <div class="notes-box">
          <strong>Lời dặn của Giáo viên:</strong> ${teacherNote}
        </div>

        <div style="margin-top: 40px; text-align: right; padding-right: 30px; font-size: 13pt;">
          <div style="font-style: italic;">Ngày ..... tháng ..... năm 202...</div>
          <div style="font-weight: bold; margin-top: 5px;">GIÁO VIÊN BỘ MÔN</div>
          <div style="height: 60px;"></div>
          <div style="font-weight: bold;">(Ký và ghi rõ họ tên)</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    showToast('Đã mở bản in Phiếu bài tập kèm mã QR A4!');
  };

  const hasStep5Variants = !!exam.resultStep5?.trim();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
              <GraduationCap size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Giao bài tập cho học sinh
                </span>
                <span className="text-xs text-slate-400">
                  Môn: <strong className="text-white">{exam.subject || 'Chung'}</strong>
                </span>
                {exam.grade && (
                  <span className="text-xs text-slate-400">
                    Khối: <strong className="text-white">Lớp {exam.grade}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight mt-0.5">
                {exam.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 pt-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'qr'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <QrCode size={15} />
            <span>Phương thức 1: Quét mã QR</span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'email'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Mail size={15} />
            <span>Phương thức 2: Gửi qua Email</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 rounded-t-xl transition-all flex items-center gap-2 border-b-2 ml-auto ${
              activeTab === 'history'
                ? 'bg-white text-indigo-700 border-indigo-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 border-transparent'
            }`}
          >
            <Users size={15} />
            <span>Nhật ký giao bài ({assignmentHistory.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Universal Assignment Settings (Collapsible or Compact Card) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileText size={15} className="text-indigo-600" />
                Cấu hình thông số bài tập
              </h3>
              <span className="text-[11px] text-slate-500">
                Áp dụng chung cho cả liên kết QR và Email
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Variant Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Đề thi / Mã đề giao:
                </label>
                <select
                  value={selectedVariant}
                  onChange={(e) => setSelectedVariant(e.target.value as any)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="step3">Đề gốc hoàn thiện (Bước 4)</option>
                  {hasStep5Variants && (
                    <>
                      <option value="101">Mã đề 101</option>
                      <option value="102">Mã đề 102</option>
                      <option value="103">Mã đề 103</option>
                      <option value="104">Mã đề 104</option>
                      <option value="all">Cả 4 mã đề hoán đổi</option>
                    </>
                  )}
                </select>
              </div>

              {/* Class Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Lớp / Nhóm học sinh:
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ví dụ: Lớp 10A1"
                  className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Thời gian làm bài:
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value) || 45)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="text-xs text-slate-500 font-bold shrink-0">phút</span>
                </div>
              </div>

              {/* Deadline */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">
                    Hạn chót nộp bài:
                  </label>
                  <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDeadline}
                      onChange={(e) => setHasDeadline(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Bật hạn
                  </label>
                </div>
                <input
                  type="datetime-local"
                  disabled={!hasDeadline}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            {/* Note & Settings Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Lời dặn của Giáo viên:
                </label>
                <input
                  type="text"
                  value={teacherNote}
                  onChange={(e) => setTeacherNote(e.target.value)}
                  placeholder="Ghi chú hướng dẫn các em học sinh..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex flex-col justify-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-start gap-2 text-emerald-900 shadow-xs">
                  <ShieldCheck size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                      <span>Chỉ giao đề bài (Không kèm đáp án)</span>
                    </div>
                    <p className="text-[10px] text-emerald-700 leading-tight mt-0.5">
                      Đảm bảo tính nghiêm túc: Tự động khóa & loại bỏ toàn bộ đáp án, thang điểm.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: QR CODE */}
          {activeTab === 'qr' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* QR Image Box */}
              <div className="md:col-span-5 bg-gradient-to-b from-slate-900 to-slate-800 p-6 rounded-3xl text-white flex flex-col items-center text-center shadow-xl border border-slate-700">
                <div className="bg-white p-3.5 rounded-2xl shadow-md mb-4 border-2 border-cyan-400/40">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Mã QR làm bài"
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                      Đang tạo mã QR...
                    </div>
                  )}
                </div>

                <div className="text-xs font-bold text-cyan-300 flex items-center gap-1 mb-1">
                  <QrCode size={14} /> Quét mã để làm bài trên Điện thoại/Tablet
                </div>
                <p className="text-[11px] text-slate-300 max-w-xs leading-relaxed">
                  Học sinh chỉ cần dùng <strong>Zalo</strong> hoặc <strong>Camera</strong> để quét mã, đề thi sẽ mở trực tiếp mà không cần cài đặt ứng dụng.
                </p>

                <div className="grid grid-cols-2 gap-2 w-full mt-4">
                  <button
                    onClick={handleDownloadQrImage}
                    className="w-full py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-900/30"
                  >
                    <Download size={13} /> Tải ảnh QR
                  </button>

                  <button
                    onClick={handlePrintAssignmentSheet}
                    className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-600"
                  >
                    <Printer size={13} /> In Phiếu A4
                  </button>
                </div>
              </div>

              {/* QR Actions & Direct Link */}
              <div className="md:col-span-7 space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <ExternalLink size={16} className="text-indigo-600" />
                    Đường liên kết làm bài trực tiếp (Direct Link)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Thầy cô có thể sao chép liên kết này để gửi vào nhóm <strong>Zalo lớp</strong>, <strong>Google Classroom</strong>, <strong>Facebook</strong> hoặc tin nhắn cho phụ huynh.
                  </p>

                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={studentShareUrl}
                      className="w-full text-xs font-mono bg-transparent text-slate-700 outline-none select-all"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedLink ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      {isPublishing ? (
                        <span className="text-amber-600 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                          Đang đồng bộ đề bài lên máy chủ...
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <ShieldCheck size={14} className="text-emerald-600" />
                          Đã sẵn sàng cho học sinh quét mã (Chỉ đề, 0% đáp án)
                        </span>
                      )}
                    </div>
                    <a
                      href={studentShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 underline"
                    >
                      Mở thử trong tab mới <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                {/* Pedagogical Print Sheet Features */}
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-2 text-xs text-amber-900">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Sparkles size={15} className="text-amber-600" />
                    Tính năng In Phiếu giao bài tập chuẩn sư phạm (A4):
                  </div>
                  <p className="text-slate-700 text-[11px] leading-relaxed">
                    Hệ thống sẽ tạo trang in định dạng chuẩn A4 có tiêu đề Sở/Trường, khung thông tin học sinh, mã QR to rõ ràng và hướng dẫn chi tiết. Giáo viên có thể in phát trực tiếp trên lớp để học sinh mang về nhà làm bài.
                  </p>
                </div>

                {/* Preview student interface button */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={() => onPreviewStudentMode(selectedVariant)}
                    className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-100 transition-all hover:scale-[1.01]"
                  >
                    <Eye size={15} />
                    <span>Xem thử giao diện làm bài của Học sinh</span>
                  </button>

                  <button
                    onClick={() => handleSaveAssignmentRecord('qr')}
                    className="w-full sm:w-auto px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>Lưu vào lịch sử giao bài</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMAIL */}
          {activeTab === 'email' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* Email Inputs */}
                <div className="md:col-span-6 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Mail size={14} className="text-indigo-600" />
                        Danh sách Email học sinh / Phụ huynh:
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Đã nhận diện: <strong className="text-indigo-600 font-bold">{validEmails.length}</strong> email
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={emailsInput}
                      onChange={(e) => setEmailsInput(e.target.value)}
                      placeholder="Nhập hoặc dán danh sách email, cách nhau bằng dấu phẩy, chấm phẩy hoặc xuống dòng:&#10;nguyenan@gmail.com, lebinh@gmail.com&#10;trancuong@gmail.com"
                      className="w-full text-xs p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed font-mono"
                    />
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                      <span>Có thể dán cột email từ tệp Excel</span>
                      <button
                        type="button"
                        onClick={() => setEmailsInput('hocsinh1@gmail.com, hocsinh2@gmail.com, hocsinh3@gmail.com')}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        + Dán mẫu thử
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tiêu đề thư (Subject):
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Email Preview */}
                <div className="md:col-span-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Eye size={14} className="text-slate-500" />
                      Nội dung thư mẫu (Email Body Preview):
                    </label>
                    <button
                      onClick={handleCopyEmailBody}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      {copiedEmailBody ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedEmailBody ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={9}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed font-sans text-slate-700"
                  />
                </div>
              </div>

              {/* Email Actions Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Info size={16} className="text-indigo-600 shrink-0" />
                  <span>
                    Bấm <strong>"Mở ứng dụng Email"</strong> để mở trực tiếp Gmail / Outlook với danh sách người nhận vào trường <strong>BCC</strong> bảo mật.
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  <button
                    onClick={handleCopyEmailBody}
                    className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <Copy size={14} /> Sao chép thư
                  </button>

                  <button
                    onClick={handleSendViaMailto}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-100"
                  >
                    <Send size={14} />
                    <span>Mở ứng dụng Email ({validEmails.length} học sinh)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ASSIGNMENT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Users size={16} className="text-indigo-600" />
                  Nhật ký các đợt giao bài của đề này
                </h4>
                <span className="text-xs text-slate-500">
                  Tổng cộng: {assignmentHistory.length} đợt giao
                </span>
              </div>

              {assignmentHistory.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 space-y-2">
                  <Users size={32} className="mx-auto text-slate-400 opacity-60" />
                  <p className="text-sm font-semibold">Chưa có lịch sử giao bài nào cho bộ đề này.</p>
                  <p className="text-xs text-slate-400">
                    Khi thầy cô gửi email hoặc sao chép mã QR giao cho học sinh, thông tin sẽ được lưu lại tại đây.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {assignmentHistory.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-200 transition-all shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {item.className}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {item.variant === 'step3' ? 'Đề gốc' : item.variant === 'all' ? '4 Mã đề' : `Mã đề ${item.variant}`}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock size={11} /> {item.durationMinutes} phút
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                          <span>Ngày giao: {new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                          {item.deadline && (
                            <span className="text-amber-700 font-medium">
                              Hạn: {new Date(item.deadline).toLocaleString('vi-VN')}
                            </span>
                          )}
                          {item.recipientEmails && item.recipientEmails.length > 0 && (
                            <span className="text-blue-600 font-medium">
                              {item.recipientEmails.length} email
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(studentShareUrl);
                            showToast('Đã sao chép link làm bài của đợt này!');
                          }}
                          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all text-xs font-bold flex items-center gap-1"
                          title="Sao chép link làm bài"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => onPreviewStudentMode(item.variant)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Eye size={13} /> Xem bài
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 size={15} className="text-emerald-500" />
            <span>Đề thi được mã hóa đồng bộ chuẩn quy định</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Floating Toast */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-60 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-cyan-500/50 flex items-center gap-2 text-xs font-bold animate-bounce">
            <CheckCircle2 size={16} className="text-cyan-400" />
            <span>{toastMsg}</span>
          </div>
        )}

      </div>
    </div>
  );
};

export default AssignExamModal;
