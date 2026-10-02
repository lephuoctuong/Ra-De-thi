import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  FileText, 
  BookOpen, 
  Layers, 
  HelpCircle, 
  Sparkles, 
  Trash2, 
  CheckCircle,
  PlusCircle,
  Upload,
  Loader2,
  Clock
} from 'lucide-react';
import { 
  DEFAULT_LESSON, 
  DEFAULT_SAMPLE_EXAM, 
  DEFAULT_MATRIX_TEMPLATE 
} from '../constants';
import { getSubjectTemplate } from '../utils/subjectTemplates';
import { EXTRACTION_INVALID_MESSAGE, isValidExtractedText, isValidSourceText } from '../utils/sourceValidation';

export const EXAM_DURATION_OPTIONS = [15, 45, 60, 90, 120, 180];

export const detectGradeFromText = (text: string): string | null => {
  if (!text) return null;
  const regexes = [
    /(?:sinh\s*học|khtn|khoa\s*học\s*tự\s*nhiên|toán|vật\s*lí|vật\s*lý|hóa\s*học|ngữ\s*văn|lịch\s*sử|địa\s*lí|tin\s*học|công\s*nghệ)\s*(?:lớp|khối)?\s*([6-9]|1[0-2])\b/i,
    /(?:lớp|khối|grade)\s*([6-9]|1[0-2])\b/i,
    /\bsinh\s*([6-9]|1[0-2])\b/i,
    /\btoán\s*([6-9]|1[0-2])\b/i,
    /\bkhtn\s*([6-9])\b/i,
    /\bchương\s+trình\s+(?:lớp|khối)?\s*([6-9]|1[0-2])\b/i,
    /\bgdpt\s*2018[^\n]*?(?:lớp|khối)\s*([6-9]|1[0-2])\b/i
  ];
  for (const r of regexes) {
    const m = text.match(r);
    if (m && m[1]) return m[1];
  }
  return null;
};

export interface SubjectGroup {
  group: string;
  subjects: string[];
}

export const GDPT_2018_SUBJECT_GROUPS: SubjectGroup[] = [
  {
    group: "Khoa học tự nhiên & Công nghệ",
    subjects: [
      "Sinh học",
      "Khoa học tự nhiên",
      "Vật lí",
      "Hóa học",
      "Toán",
      "Tin học",
      "Công nghệ"
    ]
  },
  {
    group: "Khoa học xã hội & Ngôn ngữ",
    subjects: [
      "Ngữ văn",
      "Tiếng Anh",
      "Lịch sử và Địa lí",
      "Lịch sử",
      "Địa lí",
      "Giáo dục công dân",
      "Giáo dục kinh tế và pháp luật"
    ]
  },
  {
    group: "Năng khiếu & Giáo dục kỹ năng",
    subjects: [
      "Âm nhạc",
      "Mĩ thuật",
      "Giáo dục thể chất",
      "Hoạt động trải nghiệm, hướng nghiệp",
      "Giáo dục quốc phòng và an ninh"
    ]
  }
];

export const ALL_GDPT_2018_SUBJECTS = GDPT_2018_SUBJECT_GROUPS.flatMap(g => g.subjects);

export const detectSubjectFromText = (text: string): string | null => {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('khoa học tự nhiên') || lower.includes('khtn')) return 'Khoa học tự nhiên';
  if (lower.includes('sinh học') || lower.includes('sinh 8') || lower.includes('sinh 9') || lower.includes('sinh 10') || lower.includes('tế bào') || lower.includes('di truyền') || lower.includes('quang hợp') || lower.includes('nucleotide') || lower.includes('nhiễm sắc thể')) return 'Sinh học';
  if (lower.includes('vật lí') || lower.includes('vật lý') || lower.includes('quang học') || lower.includes('chuyển động') || lower.includes('lực ma sát')) return 'Vật lí';
  if (lower.includes('hóa học') || lower.includes('hoá học') || lower.includes('phản ứng hóa học') || lower.includes('nguyên tố hóa học')) return 'Hóa học';
  if (lower.includes('ngữ văn') || lower.includes('văn học') || lower.includes('thơ lục bát') || lower.includes('nghị luận xã hội')) return 'Ngữ văn';
  if (lower.includes('tiếng anh') || lower.includes('english') || lower.includes('unit ')) return 'Tiếng Anh';
  if (lower.includes('lịch sử và địa lí') || lower.includes('ls&đl') || lower.includes('ls - đl')) return 'Lịch sử và Địa lí';
  if (lower.includes('lịch sử') || lower.includes('triều đại') || lower.includes('kháng chiến')) return 'Lịch sử';
  if (lower.includes('địa lí') || lower.includes('địa lý') || lower.includes('khí hậu') || lower.includes('bản đồ')) return 'Địa lí';
  if (lower.includes('tin học') || lower.includes('python') || lower.includes('thuật toán') || lower.includes('scratch')) return 'Tin học';
  if (lower.includes('công nghệ') || lower.includes('trồng trọt') || lower.includes('chăn nuôi') || lower.includes('mạch điện')) return 'Công nghệ';
  if (lower.includes('kinh tế và pháp luật') || lower.includes('gdkt&pl')) return 'Giáo dục kinh tế và pháp luật';
  if (lower.includes('giáo dục công dân') || lower.includes('gdcd')) return 'Giáo dục công dân';
  if (lower.includes('quốc phòng') || lower.includes('an ninh') || lower.includes('gdqp')) return 'Giáo dục quốc phòng và an ninh';
  if (lower.includes('toán') || lower.includes('đại số') || lower.includes('hình học') || lower.includes('phương trình') || lower.includes('vi-ét')) return 'Toán';
  if (lower.includes('âm nhạc')) return 'Âm nhạc';
  if (lower.includes('mĩ thuật') || lower.includes('mỹ thuật')) return 'Mĩ thuật';
  if (lower.includes('thể chất') || lower.includes('thể dục')) return 'Giáo dục thể chất';
  if (lower.includes('trải nghiệm') || lower.includes('hướng nghiệp')) return 'Hoạt động trải nghiệm, hướng nghiệp';
  return null;
};

interface SourceSetupProps {
  lesson: string;
  setLesson: (v: string) => void;
  regulationSource: string;
  setRegulationSource: (v: string) => void;
  sampleExam: string;
  setSampleExam: (v: string) => void;
  matrix: string;
  setMatrix: (v: string) => void;
  examDuration?: number;
  setExamDuration?: (v: number) => void;
  subject?: string;
  setSubject?: (v: string) => void;
  grade?: string;
  setGrade?: (v: string) => void;
  onClearDependentResults?: () => void;
  onNext: () => void;
}

const SourceSetup: React.FC<SourceSetupProps> = ({
  lesson,
  setLesson,
  regulationSource,
  setRegulationSource,
  sampleExam,
  setSampleExam,
  matrix,
  setMatrix,
  examDuration = 45,
  setExamDuration,
  subject,
  setSubject,
  grade,
  setGrade,
  onClearDependentResults,
  onNext
}) => {
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fileInputRefs = {
    lesson: useRef<HTMLInputElement>(null),
    regulationSource: useRef<HTMLInputElement>(null),
    sampleExam: useRef<HTMLInputElement>(null),
    matrix: useRef<HTMLInputElement>(null),
  };

  const detectedGrade = useMemo(() => detectGradeFromText(lesson), [lesson]);
  const detectedSubject = useMemo(() => detectSubjectFromText(lesson), [lesson]);

  // Priority 1: Prop subject from App.tsx state. Priority 2: Parsed from sampleExam. Priority 3: Detected from lesson.
  const activeSubject = useMemo(() => {
    if (subject && subject !== 'Chung') return subject;
    const match = sampleExam.match(/Môn(?:\s*thi)?:\s*([^\n\r(]+)/i);
    if (match && match[1]) {
      const raw = match[1].trim();
      const clean = raw.replace(/LỚP\s*([0-9]+)/i, '').replace(/\(Tự nhận diện[^\n]*/i, '').trim();
      const matchExact = ALL_GDPT_2018_SUBJECTS.find(s => s.toLowerCase() === clean.toLowerCase());
      if (matchExact) return matchExact;
      const matchPartial = ALL_GDPT_2018_SUBJECTS.find(s => clean.toLowerCase().includes(s.toLowerCase()));
      if (matchPartial) return matchPartial;
      if (clean) return clean;
    }
    return detectedSubject || 'Sinh học';
  }, [subject, sampleExam, detectedSubject]);

  // Priority 1: Prop grade from App.tsx state. Priority 2: Parsed from sampleExam. Priority 3: Detected from lesson.
  const activeGrade = useMemo(() => {
    if (grade) return grade;
    const match = sampleExam.match(/LỚP\s*([6-9]|1[0-2])\b/i);
    if (match && match[1]) return match[1];
    return detectedGrade || '9';
  }, [grade, sampleExam, detectedGrade]);

  // Extract currently active exam duration (minutes) from sampleExam or props
  const activeDuration = useMemo(() => {
    const match = sampleExam.match(/(?:thời\s*gian\s*(?:làm\s*bài)?|thời\s*lượng)[:\s]*([0-9]{2,3})\s*phút/i) ||
                  sampleExam.match(/\b([0-9]{2,3})\s*phút\b/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (EXAM_DURATION_OPTIONS.includes(parsed)) return parsed;
    }
    return examDuration || 45;
  }, [sampleExam, examDuration]);

  // Helper to determine if current lesson is a system template (and safe to auto-swap when changing subjects/grades)
  const isTemplateLesson = (text: string) => {
    if (!text || text.trim().length === 0) return true;
    const lower = text.toLowerCase();
    return (
      lower.includes('tài liệu bài học') ||
      lower.includes('chủ đề: sinh học') ||
      lower.includes('chủ đề: di truyền') ||
      lower.includes('chủ đề: môn toán') ||
      lower.includes('chủ đề: khoa học tự nhiên') ||
      lower.includes('chủ đề: vật lí') ||
      lower.includes('chủ đề: hóa học') ||
      lower.includes('chủ đề: ngữ văn') ||
      lower.includes('chủ đề: tiếng anh') ||
      lower.includes('chủ đề: tin học') ||
      lower.includes('chủ đề: công nghệ') ||
      lower.includes('chủ đề: lịch sử') ||
      lower.includes('chủ đề: địa lí') ||
      lower.includes('chủ đề: giáo dục công dân')
    );
  };

  const handleSubjectChange = (newSubject: string) => {
    if (setSubject) setSubject(newSubject);

    // Fetch rich subject template for the selected subject and current grade
    const tpl = getSubjectTemplate(newSubject, activeGrade, activeDuration);

    if (isTemplateLesson(lesson)) {
      setLesson(tpl.lesson);
      setSampleExam(tpl.sampleExam);
      setMatrix(tpl.matrix);
      triggerNotification(`Đã chuyển môn thi sang: ${newSubject} - Lớp ${activeGrade} (Đã nạp tự động tài liệu bài học, đề mẫu và ma trận chuẩn GDPT 2018)!`);
    } else {
      // If teacher uploaded or typed custom lesson, preserve their text and update headers
      setSampleExam(prev => {
        let updated = prev;
        if (updated.includes("TỈNH QUẢNG TRỊ") && !updated.includes("SỞ GD & ĐT")) {
          updated = updated.replace(/TỈNH QUẢNG TRỊ/g, "SỞ GD & ĐT TỈNH QUẢNG TRỊ");
        }
        const gradePart = activeGrade ? ` LỚP ${activeGrade}` : '';
        const subjectUpper = newSubject.toUpperCase();

        if (/Môn(?:\s*thi)?:[^\n]*/i.test(updated)) {
          return updated.replace(/Môn(?:\s*thi)?:[^\n]*/i, `Môn thi: ${subjectUpper}${gradePart}`);
        } else if (/(ĐỀ THI[^\n]*\n)/i.test(updated)) {
          return updated.replace(/(ĐỀ THI[^\n]*\n)/i, `$1Môn thi: ${subjectUpper}${gradePart}\n`);
        }
        return `Môn thi: ${subjectUpper}${gradePart}\n` + updated;
      });

      setMatrix(prev => {
        let updated = prev;
        const gradePart = activeGrade ? ` - LỚP ${activeGrade}` : '';
        const subjectUpper = newSubject.toUpperCase();
        if (/BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU[^\n]*/i.test(updated)) {
          return updated.replace(/BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU[^\n]*/i, `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN ${subjectUpper}${gradePart}):`);
        }
        return updated;
      });

      triggerNotification(`Đã cập nhật môn thi sang: ${newSubject} - Lớp ${activeGrade} (Đã giữ nguyên tài liệu bài học tự tải lên của Thầy/Cô)`);
    }
  };

  const handleGradeChange = (newGrade: string) => {
    if (setGrade) setGrade(newGrade);

    if (isTemplateLesson(lesson)) {
      const tpl = getSubjectTemplate(activeSubject, newGrade, activeDuration);
      setLesson(tpl.lesson);
      setSampleExam(tpl.sampleExam);
      setMatrix(tpl.matrix);
      triggerNotification(`Đã chuyển sang Khối lớp ${newGrade} - Môn ${activeSubject} (Đã đồng bộ bài học, ma trận và đề mẫu)!`);
    } else {
      setSampleExam(prev => {
        let updated = prev;
        const subjectUpper = (activeSubject || 'Sinh học').toUpperCase();
        if (/Môn(?:\s*thi)?:[^\n]*/i.test(updated)) {
          return updated.replace(/Môn(?:\s*thi)?:[^\n]*/i, `Môn thi: ${subjectUpper} LỚP ${newGrade}`);
        } else if (/(ĐỀ THI[^\n]*\n)/i.test(updated)) {
          return updated.replace(/(ĐỀ THI[^\n]*\n)/i, `$1Môn thi: ${subjectUpper} LỚP ${newGrade}\n`);
        }
        return `Môn thi: ${subjectUpper} LỚP ${newGrade}\n` + updated;
      });

      setMatrix(prev => {
        let updated = prev;
        const subjectUpper = (activeSubject || 'Sinh học').toUpperCase();
        if (/BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU[^\n]*/i.test(updated)) {
          return updated.replace(/BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU[^\n]*/i, `BẢNG MA TRẬN PHÂN PHỐI ĐỀ KIỂM TRA MẪU (MÔN ${subjectUpper} - LỚP ${newGrade}):`);
        }
        return updated;
      });

      triggerNotification(`Đã chọn: Môn ${activeSubject} - Lớp ${newGrade} (Đã đồng bộ sang các bước tiếp theo)`);
    }
  };

  const handleDurationChange = (newDuration: number) => {
    if (setExamDuration) setExamDuration(newDuration);
    setSampleExam(prev => {
      let updated = prev;
      if (/(?:thời\s*gian\s*làm\s*bài|thời\s*lượng)[:\s]*[0-9]{1,3}\s*phút[^\n]*/i.test(updated)) {
        return updated.replace(/(?:thời\s*gian\s*làm\s*bài|thời\s*lượng)[:\s]*[0-9]{1,3}\s*phút[^\n]*/i, `Thời gian làm bài: ${newDuration} phút (Không kể thời gian phát đề)`);
      } else if (/Môn(?:\s*thi)?:[^\n]*/i.test(updated)) {
        return updated.replace(/(Môn(?:\s*thi)?:[^\n]*)/i, `$1\nThời gian làm bài: ${newDuration} phút (Không kể thời gian phát đề)`);
      } else if (/(ĐỀ THI[^\n]*\n)/i.test(updated)) {
        return updated.replace(/(ĐỀ THI[^\n]*\n)/i, `$1Thời gian làm bài: ${newDuration} phút (Không kể thời gian phát đề)\n`);
      } else {
        return `Thời gian làm bài: ${newDuration} phút (Không kể thời gian phát đề)\n` + updated;
      }
    });
    triggerNotification(`Đã chọn thời lượng làm bài: ${newDuration} phút (Đồng bộ sang tất cả các bước tiếp theo)`);
  };

  const handleLoadDefaults = () => {
    const tpl = getSubjectTemplate(activeSubject, activeGrade, activeDuration);
    setLesson(tpl.lesson);
    // Không tự điền văn bản quy định: nguồn này luôn do người dùng cung cấp
    setSampleExam(tpl.sampleExam);
    setMatrix(tpl.matrix);
    if (setExamDuration) setExamDuration(activeDuration);
    if (!isValidSourceText(regulationSource)) {
      triggerNotification(`Đã nạp bài học & đề mẫu môn ${activeSubject} - Lớp ${activeGrade}. Vui lòng nạp Văn bản quy định bắt buộc để tiếp tục!`);
    } else {
      triggerNotification(`Đã nạp bộ dữ liệu mẫu bài học môn ${activeSubject} - Lớp ${activeGrade} (SỞ GD & ĐT TỈNH QUẢNG TRỊ - THCS GIO LINH)!`);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tất cả tài liệu nguồn hiện tại không? Mọi kết quả phân tích và đề thi phụ thuộc cũng sẽ được làm mới.")) {
      setLesson("");
      setRegulationSource("");
      setSampleExam("");
      setMatrix("");
      localStorage.removeItem('qbank_regulation_source');
      localStorage.removeItem('qbank_lesson');
      localStorage.removeItem('qbank_sample_exam');
      localStorage.removeItem('qbank_matrix');
      if (onClearDependentResults) {
        onClearDependentResults();
      }
      triggerNotification("Đã xóa trắng tài liệu nguồn. Thầy/Cô vui lòng cung cấp lại Văn bản quy định trước khi tiếp tục.");
    }
  };

  const triggerNotification = (text: string) => {
    setSaveStatus(text);
    setTimeout(() => setSaveStatus(null), 4000);
  };

  const compressImage = (file: File): Promise<{ base64: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 1600;
          const maxHeight = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Không thể khởi tạo môi ứng vẽ ảnh (canvas context)"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.8 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64 = dataUrl.split(",")[1];
          resolve({ base64, mimeType: 'image/jpeg' });
        };
        img.onerror = () => reject(new Error("Tệp hình ảnh bị hỏng hoặc không thể đọc được."));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Lỗi khi đọc tệp hình ảnh."));
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File, fieldId: 'lesson' | 'regulationSource' | 'sampleExam' | 'matrix') => {
    // Vercel Functions impose a 4.5 MB request-body limit. Because the file is
    // sent as base64 inside JSON, enforce the limit on the actual encoded payload.
    // Images keep the existing client-side compression feature, so a large raw
    // image may still be accepted when its compressed payload fits.
    const MAX_NON_IMAGE_FILE_BYTES = 3 * 1024 * 1024;
    const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024;

    if (file.type.startsWith('image/') && file.size > MAX_RAW_IMAGE_BYTES) {
      const message = `Tệp hình ảnh "${file.name}" vượt quá giới hạn ${MAX_RAW_IMAGE_BYTES / 1024 / 1024} MB. Thầy/Cô vui lòng chọn ảnh nhỏ hơn hoặc giảm độ phân giải trước khi tải lên.`;
      setUploadError(message);
      alert(message);
      return;
    }

    if (!file.type.startsWith('image/') && file.size > MAX_NON_IMAGE_FILE_BYTES) {
      const message = `Tệp "${file.name}" quá lớn (${(file.size / 1024 / 1024).toFixed(2)} MB).\n\nKhi triển khai trên Vercel, hệ thống giới hạn dữ liệu gửi tới API ở mức 4.5 MB. Thầy/Cô vui lòng nén/chia nhỏ tệp xuống dưới 3 MB hoặc dán trực tiếp nội dung văn bản vào ô nhập.`;
      setUploadError(message);
      alert(message);
      return;
    }

    setUploadError(null);
    setUploadingId(fieldId);

    try {
      let base64 = "";
      let mimeType = file.type;
      const fileName = file.name;

      if (file.type.startsWith('image/')) {
        // Optimize and compress images before upload
        const compressed = await compressImage(file);
        base64 = compressed.base64;
        mimeType = compressed.mimeType;
      } else {
        // Read file directly as raw base64
        base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const res = r.result as string;
            resolve(res.split(",")[1]);
          };
          r.onerror = () => reject(new Error("Lỗi khi đọc tệp."));
          r.readAsDataURL(file);
        });
      }

      const requestBody = JSON.stringify({ base64, mimeType, fileName });
      const requestBytes = new TextEncoder().encode(requestBody).byteLength;
      if (requestBytes > 4 * 1024 * 1024) {
        throw new Error("Dữ liệu tệp sau khi mã hóa quá lớn để gửi qua Vercel. Thầy/Cô vui lòng giảm dung lượng/chia nhỏ tệp hoặc dán trực tiếp nội dung văn bản.");
      }

      const response = await fetch("/api/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        if (response.status === 413) {
          throw new Error("Dung lượng tài liệu quá lớn so với giới hạn xử lý. Thầy cô vui lòng chia nhỏ tài liệu hoặc dán trực tiếp nội dung văn bản vào ô nhập!");
        }
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`Máy chủ AI đang bận hoặc quá tải tạm thời (Lỗi ${response.status}). Thầy cô vui lòng đợi khoảng 10 giây rồi thử lại.`);
        }
        throw new Error(`Lỗi phản hồi từ hệ thống (Lỗi ${response.status}). Hãy thử lại.`);
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Gặp lỗi khi số hóa tệp.");
      }

      const extractedText = typeof data.text === 'string' ? data.text.trim() : '';

      // Never persist a Gemini/OCR fallback, empty response, or extraction error
      // as if it were real lesson/regulation content.
      if (!isValidExtractedText(extractedText)) {
        throw new Error(data.error || EXTRACTION_INVALID_MESSAGE);
      }
      
      // Auto-detect subject and grade from digitized document and sync across workflow
      const autoSub = detectSubjectFromText(extractedText);
      const autoGr = detectGradeFromText(extractedText);
      if (autoSub && setSubject) setSubject(autoSub);
      if (autoGr && setGrade) setGrade(autoGr);
      
      // Get correct text state
      let currentVal = "";
      let setter: (v: string) => void;
      if (fieldId === 'lesson') { currentVal = lesson; setter = setLesson; }
      else if (fieldId === 'regulationSource') { currentVal = regulationSource; setter = setRegulationSource; }
      else if (fieldId === 'sampleExam') { currentVal = sampleExam; setter = setSampleExam; }
      else { currentVal = matrix; setter = setMatrix; }

      if (currentVal.trim() && isValidSourceText(currentVal)) {
        if (window.confirm("Bạn muốn GHI ĐÈ nội dung cũ hay CHÈN NỐI TIẾP nội dung mới của tệp này?")) {
          setter(extractedText);
        } else {
          setter((currentVal + "\n\n=== NỘI DUNG TỪ TỆP: " + fileName + " ===\n" + extractedText).trim());
        }
      } else {
        // If the old value was an extraction fallback, replace it rather than
        // appending the real document to an error message.
        setter(extractedText);
      }
      setUploadError(null);
      if (fieldId === 'regulationSource' || isValidSourceText(regulationSource)) {
        triggerNotification(`Đã trích xuất & số hóa thành công tệp: ${fileName}! Dữ liệu văn bản quy định là nguồn chính thức dùng cho Bước 1, 2, 3.`);
      } else {
        triggerNotification(`Đã trích xuất & số hóa thành công tệp: ${fileName}! Thầy/Cô vui lòng cung cấp thêm Văn bản quy định (Mục 2) trước khi chuyển sang Bước 1.`);
      }
    } catch (err: any) {
      console.error(err);
      const message = err?.message || 'Đã xảy ra lỗi khi số hóa tệp.';
      setUploadError(message);
      alert(`Lỗi số hóa tệp: ${message}`);
    } finally {
      setUploadingId(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldId: 'lesson' | 'regulationSource' | 'sampleExam' | 'matrix') => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, fieldId);
    }
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, fieldId: 'lesson' | 'regulationSource' | 'sampleExam' | 'matrix') => {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file, fieldId);
    }
  };

  const renderFileDropZone = (fieldId: 'lesson' | 'regulationSource' | 'sampleExam' | 'matrix') => {
    const isUploading = uploadingId === fieldId;
    const isOver = dragOverId === fieldId;

    return (
      <div 
        onDragOver={(e) => handleDragOver(e, fieldId)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, fieldId)}
        onClick={() => fileInputRefs[fieldId].current?.click()}
        className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 text-center ${
          isOver 
            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 shadow-inner scale-[0.99]' 
            : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50 text-slate-500'
        }`}
      >
        <input 
          type="file" 
          ref={fileInputRefs[fieldId]}
          onChange={(e) => handleFileChange(e, fieldId)}
          accept="image/*,application/pdf,.docx,.txt"
          className="hidden"
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 size={24} className="animate-spin text-indigo-600" />
            <span className="text-xs font-semibold text-indigo-700 animate-pulse">
              Đang số hóa tài liệu này với Gemini...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOver ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
              <Upload size={16} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-700">
                Kéo thả hoặc nhấn để tải tệp lên
              </p>
              <p className="text-[10px] text-slate-400">
                Hỗ trợ tệp Ảnh (JPG/PNG), Word (.docx), PDF hoặc Văn bản (.txt)
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-rose-600 font-bold text-sm uppercase tracking-wide">
            <Sparkles size={16} /> HỆ THỐNG KIỂM TRA ĐẶC TẢ TỰ ĐỘNG
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Bước 0. Nạp thông tin tài liệu nguồn
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Tải lên tài liệu giảng dạy (SGK / Giáo án), văn bản quy định, Đề thi mẫu và Ma trận để Gemini hỗ trợ tự động hóa toàn quy trình.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleLoadDefaults}
            className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-bold transition-all text-sm border border-blue-200 flex items-center gap-2 shadow-sm"
          >
            <Sparkles size={16} /> Nạp dữ liệu mẫu
          </button>
          <button
            onClick={handleClearAll}
            className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-bold transition-all text-sm border border-rose-200 flex items-center gap-2 shadow-sm"
          >
            <Trash2 size={16} /> Xóa trắng
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-2xl flex items-start gap-2 text-sm font-semibold animate-fade-in shadow-sm">
          <span className="text-rose-600 text-base leading-5">⚠️</span>
          <span>{uploadError}</span>
        </div>
      )}

      {saveStatus && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl flex items-center gap-2 text-sm font-semibold animate-fade-in shadow-sm">
          <CheckCircle className="text-emerald-600" size={18} />
          {saveStatus}
        </div>
      )}

      {/* Grid Inputs */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Unit 1: SGK / Lesson */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">1. Tài liệu dạy học / SGK / Giáo án</h3>
                <p className="text-[11px] text-slate-400 font-medium">Chứa kiến thức, định tính, công thức trọng tâm</p>
              </div>
            </div>
          </div>
          
          {renderFileDropZone('lesson')}

          <textarea
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            placeholder="Nội dung sách giáo khoa hoặc giáo án sẽ xuất hiện ở đây sau khi tải tệp lên, hoặc bạn có thể tự dán thủ công..."
            className="w-full h-48 p-4 border border-slate-200 rounded-2xl bg-slate-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none font-sans"
          />
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
            <span>Dùng tệp Ảnh, PDF, Word hoặc gõ trực tiếp</span>
            <span>{lesson.length.toLocaleString()} ký tự</span>
          </div>
        </div>

        {/* Unit 2: văn bản quy định / 7791 */}
        <div className={`bg-white p-6 rounded-3xl border shadow-sm hover:shadow-md transition-all flex flex-col space-y-4 ${
          !isValidSourceText(regulationSource) ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                !isValidSourceText(regulationSource) ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
              }`}>
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  2. Văn bản quy định <span className="text-rose-600 text-sm font-extrabold">* (Bắt buộc)</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Nguồn bắt buộc do người dùng cung cấp - định nghĩa cấu trúc đề, thang điểm, mức độ</p>
              </div>
            </div>

            {/* Status indicator */}
            {!isValidSourceText(regulationSource) ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl animate-pulse">
                Chưa cung cấp văn bản quy định
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl">
                ✓ Đã có văn bản quy định
              </span>
            )}
          </div>

          {!isValidSourceText(regulationSource) && (
            <div className="p-3 bg-rose-50/90 border border-rose-200 rounded-2xl text-xs text-rose-800 leading-relaxed font-medium">
              ⚠️ <strong>Yêu cầu bắt buộc:</strong> Thầy/Cô vui lòng tải lên tệp văn bản quy định (Ảnh, PDF, Word) hoặc dán trực tiếp nội dung văn bản quy định vào ô dưới. Hệ thống không sử dụng văn bản quy định mặc định và bắt buộc phải có văn bản quy định mới được chuyển sang Bước 1.
            </div>
          )}

          {renderFileDropZone('regulationSource')}

          <textarea
            value={regulationSource}
            onChange={(e) => setRegulationSource(e.target.value)}
            placeholder="Nội dung văn bản quy định hoặc quy chuẩn ra đề thi của cơ sở đào tạo do Thầy/Cô cung cấp (Bắt buộc)..."
            className={`w-full h-48 p-4 border rounded-2xl text-sm outline-none transition-all resize-none font-sans ${
              !isValidSourceText(regulationSource)
                ? 'border-rose-200 bg-rose-50/20 focus:bg-white focus:border-rose-500'
                : 'border-slate-200 bg-slate-50/30 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500'
            }`}
          />
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className={!isValidSourceText(regulationSource) ? 'text-rose-600 font-bold' : 'text-slate-400'}>
              {!isValidSourceText(regulationSource) ? 'Chưa có văn bản quy định hợp lệ — bắt buộc phải có' : 'Nguồn chính thức dùng xuyên suốt Bước 1, 2, 3'}
            </span>
            <span className={!isValidSourceText(regulationSource) ? 'text-rose-500' : 'text-slate-400'}>{regulationSource.length.toLocaleString()} ký tự</span>
          </div>
        </div>

        {/* Unit 3: Đề thi mẫu */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                <HelpCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">3. Đề kiểm tra mẫu (Môn {activeSubject} - THCS Gio Linh)</h3>
                <p className="text-[11px] text-slate-400 font-medium">Khuôn mẫu về cách trình bày, tiêu đề, số lượng câu theo CT GDPT 2018</p>
              </div>
            </div>

            {/* Auto-detection & Duration badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs shadow-xs">
                <Clock size={13} className="text-amber-600" />
                Thời lượng: {activeDuration} phút
              </span>
              {detectedGrade || detectedSubject ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs">
                  <CheckCircle size={14} className="text-emerald-600" />
                  {detectedSubject ? `Nhận diện: Môn ${detectedSubject}` : ''}
                  {detectedSubject && detectedGrade ? ' • ' : ''}
                  {detectedGrade ? `Lớp ${detectedGrade}` : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-medium rounded-xl text-xs">
                  <Sparkles size={14} className="text-blue-600" />
                  Chương trình GDPT 2018 (Tự chọn hoặc tự động nhận diện)
                </span>
              )}
            </div>
          </div>

          {/* Quick grade & subject selector according to CT GDPT 2018 */}
          <div className="flex flex-col gap-2.5 p-3.5 bg-slate-50/90 border border-slate-200/90 rounded-2xl text-xs">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-slate-600 font-medium flex-wrap">
                <span>Đơn vị: <strong>SỞ GD & ĐT TỈNH QUẢNG TRỊ - TRƯỜNG THCS GIO LINH</strong></span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <label htmlFor="subject-select" className="text-slate-600 font-bold">Môn học (GDPT 2018):</label>
                  <select
                    id="subject-select"
                    value={activeSubject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="bg-white border border-indigo-300 text-indigo-700 font-bold rounded-xl px-2.5 py-1 text-xs shadow-sm hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-colors"
                  >
                    {GDPT_2018_SUBJECT_GROUPS.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.subjects.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-slate-400 mr-1 text-[11px] font-semibold">Khối lớp:</span>
                {['6', '7', '8', '9', '10', '11', '12'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleGradeChange(g)}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      activeGrade === g
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Lớp {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick-switch chips for popular subjects in GDPT 2018 */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/70">
              <span className="text-slate-400 text-[11px] font-medium mr-0.5">Chọn nhanh:</span>
              {[
                'Sinh học',
                'Khoa học tự nhiên',
                'Toán',
                'Ngữ văn',
                'Tiếng Anh',
                'Vật lí',
                'Hóa học',
                'Lịch sử và Địa lí',
                'Tin học',
                'Công nghệ',
                'Giáo dục công dân'
              ].map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => handleSubjectChange(sub)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                    activeSubject.toLowerCase() === sub.toLowerCase()
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-indigo-600 border border-slate-200'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* Quick exam duration selector: 15, 45, 60, 90, 120, 180 phút */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/70">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 font-bold text-slate-700 text-xs">
                  <Clock size={14} className="text-indigo-600" />
                  Thời lượng bài kiểm tra:
                </span>
                <span className="text-[11px] text-slate-400 font-medium">(Đồng bộ sang các bước tiếp theo)</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {EXAM_DURATION_OPTIONS.map((mins) => {
                  const isSelected = activeDuration === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleDurationChange(mins)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 hover:border-amber-400'
                      }`}
                    >
                      <Clock size={12} className={isSelected ? 'text-white' : 'text-slate-400'} />
                      {mins} phút
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {renderFileDropZone('sampleExam')}

          <textarea
            value={sampleExam}
            onChange={(e) => setSampleExam(e.target.value)}
            placeholder="Đề kiểm tra mẫu hoàn chỉnh..."
            className="w-full h-48 p-4 border border-slate-200 rounded-2xl bg-slate-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none font-sans"
          />
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
            <span>Dùng đề mẫu để AI bắt chước đúng định dạng</span>
            <span>{sampleExam.length.toLocaleString()} ký tự</span>
          </div>
        </div>

        {/* Unit 4: Ma trận đề mẫu */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">4. Ma trận đề thi mẫu (Nếu có)</h3>
                <p className="text-[11px] text-slate-400 font-medium">Bảng sơ đồ tỉ lệ phân phối câu hỏi theo chương, mức độ</p>
              </div>
            </div>
          </div>

          {renderFileDropZone('matrix')}

          <textarea
            value={matrix}
            onChange={(e) => setMatrix(e.target.value)}
            placeholder="Ma trận đề mẫu giúp AI nắm bắt phân phối chương mục..."
            className="w-full h-48 p-4 border border-slate-200 rounded-2xl bg-slate-50/30 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none font-sans"
          />
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
            <span>Tự nạp qua biểu mẫu XLS/PDF/DOCX hoặc dán bảng</span>
            <span>{matrix.length.toLocaleString()} ký tự</span>
          </div>
        </div>
      </div>

      {/* Persistent Note */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 flex gap-4 items-start">
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-850 flex items-center justify-center font-bold flex-shrink-0 text-sm">
          💡
        </div>
        <div>
          <h4 className="font-bold text-indigo-900 text-sm mb-1">Mẹo nạp nhanh siêu hiệu quả</h4>
          <p className="text-indigo-700 text-xs leading-relaxed">
            Bạn có thể click nút <strong className="font-bold text-indigo-800">"Nạp dữ liệu mẫu"</strong> ở góc trên bên phải để nạp sẵn tài liệu, ma trận và đề kiểm tra mẫu chuẩn môn Sinh học (Trường THCS Gio Linh, Tỉnh Quảng Trị), hoặc tải lên tệp bài học/SGK của bạn để hệ thống tự động nhận diện khối lớp!
          </p>
        </div>
      </div>

      {/* Next Step Control */}
      <div className="flex flex-col items-end gap-2 pt-4">
        {!isValidSourceText(regulationSource) && (
          <p className="text-xs text-rose-600 font-bold flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl">
            <span>⚠️</span>
            <span>Mục "2. Văn bản quy định (văn bản quy định)" là nguồn bắt buộc do người dùng cung cấp. Vui lòng cung cấp văn bản quy định trước khi chuyển sang Bước 1!</span>
          </p>
        )}
        <button
          onClick={onNext}
          disabled={!isValidSourceText(regulationSource) || (!isValidSourceText(lesson) && !isValidSourceText(sampleExam))}
          className={`px-8 py-4 rounded-2xl font-extrabold flex items-center gap-2 transition-all text-base shadow-lg ${
            (!isValidSourceText(regulationSource) || (!isValidSourceText(lesson) && !isValidSourceText(sampleExam)))
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-100 hover:translate-y-[-1px]'
          }`}
        >
          Lưu & Tiến hành Phân tích Bước 1
          <PlusCircle size={20} />
        </button>
      </div>
    </div>
  );
};

export default SourceSetup;
