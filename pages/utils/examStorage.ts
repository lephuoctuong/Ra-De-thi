import { db } from '../db';
import { SavedExamPackage } from '../types';

const FALLBACK_STORAGE_KEY = 'qbank_saved_exams_fallback';

export const getSavedExams = async (): Promise<SavedExamPackage[]> => {
  let list: SavedExamPackage[] | null = null;
  try {
    list = await db.savedExams.toArray();
  } catch (err) {
    console.warn('Could not read from IndexedDB, trying localStorage:', err);
  }

  if (list !== null) {
    if (list.length > 0) {
      // Sort newest first
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    // If IndexedDB is empty, check if we need to migrate from localStorage once
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: SavedExamPackage[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            await db.savedExams.put(item).catch(() => {});
          }
          return parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      } catch (e) {}
    }
    return [];
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) {
      const parsed: SavedExamPackage[] = JSON.parse(raw);
      return parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {
    console.error('Error reading saved exams from localStorage:', err);
  }

  return [];
};

export const saveExamToVault = async (pkg: SavedExamPackage): Promise<void> => {
  // Save to Dexie
  try {
    await db.savedExams.put(pkg);
  } catch (err) {
    console.warn('Could not write to IndexedDB, fallback to localStorage:', err);
  }

  // Also mirror to localStorage
  try {
    const current = await getSavedExams();
    const index = current.findIndex(item => item.id === pkg.id);
    let updated: SavedExamPackage[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = pkg;
    } else {
      updated = [pkg, ...current];
    }
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error writing fallback to localStorage:', err);
  }
};

export const deleteExamFromVault = async (id: string): Promise<void> => {
  try {
    await db.savedExams.delete(id);
  } catch (err) {
    console.warn('Could not delete from IndexedDB:', err);
  }

  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (raw) {
      const parsed: SavedExamPackage[] = JSON.parse(raw);
      const filtered = parsed.filter(item => item.id !== id);
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Error deleting from fallback localStorage:', err);
  }
};

// Helper: Tự động trích xuất thông tin tiêu đề, môn, lớp từ dữ liệu các bước
export const inferExamMetadata = (data: {
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
}) => {
  const combined = [
    data.resultStep3 || '',
    data.resultStep2 || '',
    data.sampleExam || '',
    data.lesson || '',
    data.resultStep1 || ''
  ].join('\n');

  // Detect subject: prioritize explicit subject passed in
  let subject = data.subject && data.subject !== 'Chung' ? data.subject : '';

  if (!subject) {
    // Check explicit "Môn thi:" or "Môn:" lines in sampleExam, resultStep3, or matrix first
    const explicitHeaderMatch = (data.resultStep3 || data.sampleExam || data.matrix || '')
      .match(/Môn(?:\s*thi)?:\s*([^\n\r(]+)/i);
    
    if (explicitHeaderMatch && explicitHeaderMatch[1]) {
      const headerRaw = explicitHeaderMatch[1].trim().replace(/LỚP\s*[0-9]+/i, '').trim();
      if (/sinh\s*học/i.test(headerRaw)) subject = 'Sinh học';
      else if (/khoa\s*học\s*tự\s*nhiên|khtn/i.test(headerRaw)) subject = 'Khoa học tự nhiên';
      else if (/toán/i.test(headerRaw)) subject = 'Toán';
      else if (/vật\s*l[íy]/i.test(headerRaw)) subject = 'Vật lí';
      else if (/hóa\s*học|hoá\s*học/i.test(headerRaw)) subject = 'Hóa học';
      else if (/ngữ\s*văn|văn/i.test(headerRaw)) subject = 'Ngữ văn';
      else if (/tiếng\s*anh/i.test(headerRaw)) subject = 'Tiếng Anh';
      else if (/lịch\s*sử\s*và\s*địa\s*l[íy]|ls&đl/i.test(headerRaw)) subject = 'Lịch sử và Địa lí';
      else if (/lịch\s*sử/i.test(headerRaw)) subject = 'Lịch sử';
      else if (/địa\s*l[íy]/i.test(headerRaw)) subject = 'Địa lí';
      else if (/tin\s*học/i.test(headerRaw)) subject = 'Tin học';
      else if (/công\s*nghệ/i.test(headerRaw)) subject = 'Công nghệ';
      else if (/giáo\s*dục\s*công\s*dân|gdcd/i.test(headerRaw)) subject = 'Giáo dục công dân';
      else if (headerRaw.length > 1 && headerRaw.length < 35) subject = headerRaw;
    }
  }

  if (!subject) {
    if (/khoa\s*học\s*tự\s*nhiên|khtn/i.test(combined)) subject = 'Khoa học tự nhiên';
    else if (/toán/i.test(combined)) subject = 'Toán';
    else if (/vật\s*l[íy]/i.test(combined)) subject = 'Vật lí';
    else if (/hóa\s*học|hoá\s*học/i.test(combined)) subject = 'Hóa học';
    else if (/ngữ\s*văn|văn/i.test(combined)) subject = 'Ngữ văn';
    else if (/tiếng\s*anh/i.test(combined)) subject = 'Tiếng Anh';
    else if (/lịch\s*sử\s*và\s*địa\s*l[íy]/i.test(combined)) subject = 'Lịch sử và Địa lí';
    else if (/lịch\s*sử/i.test(combined)) subject = 'Lịch sử';
    else if (/địa\s*l[íy]/i.test(combined)) subject = 'Địa lí';
    else if (/tin\s*học/i.test(combined)) subject = 'Tin học';
    else if (/công\s*nghệ/i.test(combined)) subject = 'Công nghệ';
    else if (/giáo\s*dục\s*công\s*dân|gdcd/i.test(combined)) subject = 'Giáo dục công dân';
    else if (/sinh\s*học/i.test(combined)) subject = 'Sinh học';
    else subject = 'Chung';
  }

  // Detect grade: prioritize explicit grade passed in
  let grade = data.grade ? String(data.grade).trim() : '';

  if (!grade) {
    // Check header of sampleExam or resultStep3 first
    const explicitGradeMatch = (data.resultStep3 || data.sampleExam || data.matrix || '')
      .match(/LỚP\s*([6-9]|1[0-2])\b/i);
    if (explicitGradeMatch && explicitGradeMatch[1]) {
      grade = explicitGradeMatch[1];
    }
  }

  if (!grade) {
    const gradeMatch = combined.match(/(?:lớp|khối|grade)\s*([6-9]|1[0-2])\b/i) ||
                       combined.match(/\b(sinh|toán|khtn|vật\s*l[íy]|hóa)\s*([6-9]|1[0-2])\b/i);
    if (gradeMatch) {
      grade = gradeMatch[1] || gradeMatch[2] || '';
    }
  }

  // Detect exam type / title
  let semester = 'Định kì';
  if (/giữa\s*k[ìỳ]\s*1|giữa\s*k[ìỳ]\s*i\b/i.test(combined)) semester = 'Giữa Học kì I';
  else if (/cuối\s*k[ìỳ]\s*1|cuối\s*k[ìỳ]\s*i\b|học\s*k[ìỳ]\s*1\b|học\s*k[ìỳ]\s*i\b/i.test(combined)) semester = 'Cuối Học kì I';
  else if (/giữa\s*k[ìỳ]\s*2|giữa\s*k[ìỳ]\s*ii\b/i.test(combined)) semester = 'Giữa Học kì II';
  else if (/cuối\s*k[ìỳ]\s*2|cuối\s*k[ìỳ]\s*ii\b|học\s*k[ìỳ]\s*2\b|học\s*k[ìỳ]\s*ii\b/i.test(combined)) semester = 'Cuối Học kì II';

  // Build title
  const gradeText = grade ? ` Lớp ${grade}` : '';
  const defaultTitle = `Đề kiểm tra ${semester} - Môn ${subject}${gradeText}`;

  // Detect duration: prioritize explicit duration passed in
  let durationMinutes = data.durationMinutes || 45;
  if (!data.durationMinutes) {
    const durationMatch = combined.match(/(?:thời\s*gian\s*(?:làm\s*bài)?|thời\s*lượng)[:\s]*([0-9]{2,3})\s*phút/i) ||
                          combined.match(/\b([0-9]{2,3})\s*phút\b/i);
    if (durationMatch && durationMatch[1]) {
      const d = parseInt(durationMatch[1], 10);
      if ([15, 45, 60, 90, 120, 180].includes(d) || (d >= 10 && d <= 300)) {
        durationMinutes = d;
      }
    }
  }

  return {
    title: defaultTitle,
    subject,
    grade,
    semester,
    schoolYear: '2024 - 2025',
    durationMinutes
  };
};

const ASSIGNMENTS_STORAGE_KEY = 'qbank_assignments_storage';

export const getExamById = async (id: string): Promise<SavedExamPackage | null> => {
  const exams = await getSavedExams();
  return exams.find(e => e.id === id) || null;
};

export const saveAssignment = async (assignment: any): Promise<void> => {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const updated = [assignment, ...list.filter((item: any) => item.id !== assignment.id)];
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving assignment:', err);
  }
};

export const getAssignments = async (): Promise<any[]> => {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading assignments:', err);
    return [];
  }
};

