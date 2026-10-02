
import { Dexie, type Table } from 'dexie';
import { Question, ExamBlueprint, GeneratedExam, SavedExamPackage } from './types';

// QBankDB handles the IndexedDB storage for questions, blueprints, generated exams, and archived exam packages.
export class QBankDB extends Dexie {
  questions!: Table<Question>;
  blueprints!: Table<ExamBlueprint>;
  exams!: Table<GeneratedExam>;
  savedExams!: Table<SavedExamPackage>;

  constructor() {
    super('QBankVNDatabase');
    // Version 2 schema
    (this as any).version(2).stores({
      questions: 'id, capHoc, monHoc, lop, chuDe, mucDo, dangCau, timesUsed',
      blueprints: 'id, monHoc, lop, createdAt',
      exams: 'id, blueprintId, maDe, createdAt'
    });
    // Version 3: Bổ sung Kho lưu trữ đề thi (SavedExamPackage)
    (this as any).version(3).stores({
      questions: 'id, capHoc, monHoc, lop, chuDe, mucDo, dangCau, timesUsed',
      blueprints: 'id, monHoc, lop, createdAt',
      exams: 'id, blueprintId, maDe, createdAt',
      savedExams: 'id, title, subject, grade, createdAt, updatedAt'
    });
  }
}

export const db = new QBankDB();
