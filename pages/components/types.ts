
export type CapHoc = "TieuHoc" | "THCS" | "THPT" | "DungChung";
export type MucDo = "NB" | "TH" | "VD" | "VDC";
export type DangCau = "TracNghiem" | "TuLuan" | "DungSai" | "DienKhuyet";

export interface Question {
  id: string;
  capHoc: CapHoc;
  monHoc: string;
  lop: string;
  chuDe: string;
  chuanKTKN: string;
  mucDo: MucDo;
  dangCau: DangCau;
  noiDung: string;
  luaChon?: { A?: string; B?: string; C?: string; D?: string };
  dapAn: string;
  giaiThichCham: string;
  diem: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  timesUsed: number;
}

export interface BlueprintMatrixCell {
  soCau: number;
  diem: number;
}

export interface ExamBlueprint {
  id: string;
  monHoc: string;
  capHoc: CapHoc;
  lop: string;
  phamViChuDe: string[];
  tongDiem: number;
  tongSoCau: number;
  thoiGian: number;
  tiLeMucDo: { NB: number; TH: number; VD: number; VDC: number };
  tiLeDangCau: { tracNghiem: number; tuLuan: number };
  rangBuoc: {
    khongLapCau: boolean;
    uuTienChuaDungGanDay: boolean;
    xaoCau: boolean;
    xaoDapAn: boolean;
  };
  maTran: {
    [chuDe: string]: {
      [key in MucDo]: BlueprintMatrixCell;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedExam {
  id: string;
  blueprintId: string;
  maDe: string;
  danhSachCauHoi: Array<{ questionId: string; order: number; diem: number }>;
  createdAt: string;
}

export interface SavedExamPackage {
  id: string;
  title: string;              // Tên bộ đề thi
  subject?: string;           // Môn học (Sinh học, Toán, KHTN...)
  grade?: string;             // Khối lớp (6, 7, 8, 9, 10, 11, 12...)
  semester?: string;          // Học kì (Giữa kì I, Cuối kì I, Giữa kì II...)
  schoolYear?: string;        // Năm học (ví dụ: 2024 - 2025)
  durationMinutes?: number;   // Thời gian làm bài (phút)
  
  // Dữ liệu các mục từ 0 đến 5
  lesson?: string;            // Mục 0: Tài liệu bài học / SGK
  regulationSource?: string;            // Mục 0: Yêu cầu cần đạt / văn bản quy định
  sampleExam?: string;        // Mục 0: Đề mẫu tham khảo
  matrix?: string;            // Mục 0/2: Ma trận dạng text
  
  resultStep1?: string;       // Mục 1: Kết quả phân tích nguồn
  resultStep2?: string;       // Mục 2: Ma trận & Bản đặc tả
  resultStep3?: string;       // Mục 3: Đề kiểm tra định kì gốc & Hướng dẫn chấm
  resultStep5?: string;       // Mục 5: 4 mã đề hoán đổi (101, 102, 103, 104)

  questionsOnlyContent?: string; // Đề chỉ gồm câu hỏi cho học sinh
  serverAnswerKey?: Record<string, string>; // Đáp án chính thức được đồng bộ chuẩn xác

  notes?: string;             // Ghi chú thêm
  tags?: string[];            // Thẻ phân loại
  createdAt: string;          // Thời gian tạo
  updatedAt: string;          // Thời gian cập nhật
}

export interface ExamVariantDetail {
  questionMapping: Record<string, string>;
  answerKey: Record<string, string>;
  scoringRules?: Record<string, any>;
}

export interface StructuredExamPackageSchema {
  examId: string;
  subject: string;
  grade: string;
  schoolYear: string;
  matrix: string;
  specification: string;
  originalExam: string;
  markingScheme: string;
  variants: {
    '101': ExamVariantDetail;
    '102': ExamVariantDetail;
    '103': ExamVariantDetail;
    '104': ExamVariantDetail;
  };
}

export type ViewState = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';

export interface ExamAssignment {
  id: string;
  examId: string;
  examTitle: string;
  variant: 'step3' | '101' | '102' | '103' | '104' | 'all';
  className: string;
  deadline?: string;
  durationMinutes: number;
  allowSolutionView: boolean;
  teacherNote?: string;
  recipientEmails?: string[];
  assignedMethod: 'email' | 'qr' | 'both';
  createdAt: string;
}

export interface QuestionResultItem {
  question: string;
  maxScore: number;
  score: number;
  verdict: 'ĐÚNG' | 'SAI' | 'ĐÚNG MỘT PHẦN' | 'KHÔNG TRẢ LỜI' | 'KHÔNG ĐỌC RÕ' | 'KHÔNG ĐỌC ĐƯỢC' | 'CẦN GIÁO VIÊN DUYỆT' | 'CẦN GIÁO VIÊN KIỂM TRA' | string;
  studentAnswer?: string;
  expectedAnswer?: string;
  analysis?: string;
  basisForScore?: string; // Ghi lại căn cứ chấm theo Hướng dẫn chấm chính thức
}

export interface MatrixSpecMappingItem {
  questionNumber: string;                  // Số câu (ví dụ: Câu 1, Câu 2, Câu 1.a)
  topic: string;                           // Chủ đề/nội dung kiến thức
  learningObjective: string;               // Yêu cầu cần đạt
  cognitiveLevel: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao' | string; // Mức độ nhận thức
  questionType: string;                    // Dạng câu hỏi (TN nhiều lựa chọn, Đúng-Sai, Trả lời ngắn, Tự luận)
  points: number;                          // Số điểm
  subItemsCount?: number;                  // Số ý thành phần nếu có (ví dụ 4 ý a,b,c,d)
  status: 'KHỚP' | 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA';
  syncDetails?: {
    matrix: string;
    spec: string;
    exam: string;
    rubric: string;
    submission: string;
  };
  warning?: string;
}

export interface PreGradingSyncRow {
  question: string;
  exam: string;
  rubric: string;
  points: number;
  matrix: string;
  status: 'KHỚP' | 'CẢNH BÁO KHÔNG ĐỒNG BỘ MA TRẬN' | 'MÂU THUẪN' | 'THIẾU DỮ LIỆU' | 'CẦN KIỂM TRA';
  topic?: string;
  learningObjective?: string;
  cognitiveLevel?: string;
  questionType?: string;
  subItemsCount?: number;
  note?: string;
}

export interface PreGradingSyncReport {
  isAllowedToGrade: boolean;
  totalQuestions: number;
  matchCount: number;
  conflictCount: number;
  missingCount: number;
  needsCheckCount: number;
  matrixWarningCount?: number;
  rows: PreGradingSyncRow[];
  matrixSpecMappings?: MatrixSpecMappingItem[];
  blockReason?: string;
}

export interface SynchronizationCheckDetails {
  matrixVsExam: string;
  examVsAnswers: string;
  answersVsRubric: string;
  rubricVsSubmission: string;
  matrixVsResults: string;
  isSynchronized: boolean;
  warningDetails?: string;
}

export interface PedagogicalEvaluation {
  score: number;
  maxScore: number;
  correctCount?: number;
  totalQuestions?: number;
  warning?: string;
  submissionStatus?: 'ĐÃ CHẤM – ĐỦ CĂN CỨ' | 'ĐÃ CHẤM' | 'CẦN GIÁO VIÊN KIỂM TRA' | 'CẦN GIÁO VIÊN DUYỆT';
  isAllowedToGrade?: boolean;
  preGradingSyncTable?: PreGradingSyncRow[];
  matrixSpecMappings?: MatrixSpecMappingItem[];
  preFinalCrossCheck?: PreFinalCrossCheckReport;
  finalTenStepCheck?: FinalTenStepCheckReport;
  antiMistakeChecks?: {
    check01_code?: boolean;
    check02_exam?: boolean;
    check03_rubric?: boolean;
    check04_answer?: boolean;
    check05_question?: boolean;
    check06_submission?: boolean;
    check07_itemScores?: boolean;
    check08_totalScore?: boolean;
    check09_uncertainty?: boolean;
    check10_dataConflict?: boolean;
    [key: string]: boolean | string | undefined;
  };
  synchronizationChecks?: SynchronizationCheckDetails;
  questionResultsTable?: QuestionResultItem[];
  learningFeedback?: {
    achievedKnowledge: string;
    unachievedKnowledge: string;
    errorsToFix: string;
    recommendedReview: string;
  };
  formattedFeedback: string;
  strengths: string;
  weaknesses: string;
  improvements: string;
  teacherComment: string;
  gradedBy?: 'ai' | 'teacher' | 'instant';
  gradedAt?: string;
  auditReport?: ScoreAuditReport;
}

export interface ScoreAuditReport {
  status: 'TRẠNG THÁI: ĐÃ KIỂM TOÁN' | 'TRẠNG THÁI: LỖI — CẦN KIỂM TRA';
  auditedAt: string;
  auditorRole: string; // 'KIỂM TOÁN VIÊN ĐIỂM (Độc lập)'
  // 10 Tiêu chí kiểm toán
  criteria: {
    totalExamQuestions: number;        // 1. Tổng số câu trong đề
    gradedQuestionsCount: number;      // 2. Số câu đã chấm
    omittedQuestionsCount: number;     // 3. Số câu bỏ sót
    itemMaxScores: Array<{ question: string; maxScore: number }>; // 4. Điểm tối đa từng câu
    itemAwardedScores: Array<{ question: string; score: number }>; // 5. Điểm đạt từng câu
    sumItemScores: number;             // Tổng điểm các câu cộng lại
    reportedTotalScore: number;        // 6. Tổng điểm ghi nhận
    maxAllowedTotalScore: number;      // Thang điểm tối đa của bài (10.0)
    variantCode: string;               // 7. Mã đề
    answersUsedSummary: string;        // 8. Đáp án sử dụng
    rubricUsedSummary: string;         // 9. Hướng dẫn chấm sử dụng
    manualReviewQuestions: string[];   // 10. Các câu cần kiểm tra thủ công
  };
  // Các câu hỏi kiểm tra nghiêm ngặt
  checks: {
    isTotalScoreWithinMax: boolean;    // Tổng điểm có vượt điểm tối đa không?
    isAnyItemExceedingMax: boolean;    // Có câu nào vượt điểm tối đa không? (false = tốt)
    isAnyItemDuplicated: boolean;      // Có câu nào bị tính hai lần không? (false = tốt)
    isAnyItemOmitted: boolean;         // Có câu nào chưa tính không? (false = tốt)
    isWrongVariantUsed: boolean;       // Có sử dụng sai mã đề không? (false = tốt)
    isFormulaExact: boolean;           // TỔNG ĐIỂM = TỔNG ĐIỂM CÁC CÂU
  };
  discrepancies: string[];             // Danh sách các sai lệch phát hiện
  summaryText: string;                 // Văn bản báo cáo kiểm toán đầy đủ
}

export interface PreFinalCrossCheckReport {
  status: 'CHO PHÉP CHỐT ĐIỂM' | 'DỪNG CHẤM — MÃ ĐỀ KHÔNG KHỚP' | 'DỪNG CHẤM — VƯỢT ĐIỂM TỐI ĐA' | 'DỪNG CHẤM — MÂU THUẪN DỮ LIỆU' | 'CẢNH BÁO';
  isPassed: boolean;
  checkedAt: string;
  check1_variant: {
    passed: boolean;
    studentVariant: string;
    answerKeyVariant: string;
    note: string;
  };
  check2_answerKey: {
    passed: boolean;
    answerKeyCount: number;
    note: string;
  };
  check3_questionSequence: {
    passed: boolean;
    sequenceSummary: string;
    note: string;
  };
  check4_itemAnswers: {
    passed: boolean;
    matchedCount: number;
    extraInSubmissionCount: number;
    missingInSubmissionCount: number;
    note: string;
  };
  check5_scoringScale: {
    passed: boolean;
    isAnyItemExceeding: boolean;
    note: string;
  };
  check6_totalMaxScore: {
    passed: boolean;
    reportedTotal: number;
    maxAllowed: number;
    sumItems: number;
    note: string;
  };
  warnings: string[];
  stopReasons: string[];
}

export interface FinalTenStepCheckReport {
  status: 'ĐÃ CHẤM – ĐỦ CĂN CỨ' | 'CẦN GIÁO VIÊN DUYỆT' | 'CẦN GIÁO VIÊN KIỂM TRA' | 'KHÔNG ĐỦ ĐIỀU KIỆN CÔNG BỐ';
  isPassedAll10Steps: boolean;
  checkedAt: string;
  steps: {
    step1_student: { passed: boolean; label: string; detail: string };          // [1] Đúng học sinh?
    step2_variant: { passed: boolean; label: string; detail: string };          // [2] Đúng mã đề?
    step3_exam: { passed: boolean; label: string; detail: string };             // [3] Đúng đề?
    step4_matrix: { passed: boolean; label: string; detail: string };           // [4] Đúng ma trận?
    step5_spec: { passed: boolean; label: string; detail: string };             // [5] Đúng bản đặc tả?
    step6_rubric: { passed: boolean; label: string; detail: string };           // [6] Đúng hướng dẫn chấm?
    step7_answers: { passed: boolean; label: string; detail: string };          // [7] Đúng đáp án?
    step8_itemScores: { passed: boolean; label: string; detail: string };       // [8] Đúng điểm từng câu?
    step9_totalScore: { passed: boolean; label: string; detail: string };       // [9] Đúng tổng điểm?
    step10_teacherReview: { passed: boolean; label: string; detail: string; pendingReviewCount: number }; // [10] Có câu nào cần giáo viên duyệt?
  };
  passedCount: number;
  totalStepsCount: number; // 10
  unresolvedIssues: string[];
}

export interface SectionScoreItem {
  sectionName: string;
  score: number;
  maxScore: number;
}

export interface GradingResultSchema {
  studentId: string;
  examId: string;
  examCode: string;
  questionResults: QuestionResultItem[];
  sectionScores: SectionScoreItem[];
  totalScore: number;
  validationStatus: string;
  warningFlags: string[];
  teacherReviewRequired: boolean;
}

export interface ScoreAuditHistoryItem {
  previousScore: number;
  newScore: number;
  editedBy: string;
  editedAt: string;
  reason?: string;
}

export interface StudentSubmission {
  id: string;
  studentId?: string;           // student_id
  examId: string;
  examTitle: string;
  subject?: string;
  grade?: string;
  variant: 'step3' | '101' | '102' | '103' | '104' | string;
  studentName: string;          // student_name
  studentClass: string;         // class
  assignedExamId?: string;      // assigned_exam_id
  assignedCode?: string;        // assigned_code
  submittedFile?: string;       // submitted_file
  studentCode?: string;
  submittedAt: string;          // submission_time
  durationMinutes?: number;
  timeSpentSeconds: number;
  answers: Record<string, string>; // e.g. { "q_1": "A", "q_2": "B" }
  essayAnswer?: string;
  score?: number; // Thang điểm 10 (ví dụ 8.5)
  totalQuestions?: number;
  correctCount?: number;
  feedback?: string;
  evaluationDetails?: PedagogicalEvaluation;
  auditReport?: ScoreAuditReport;
  preFinalCrossCheck?: PreFinalCrossCheckReport;
  finalTenStepCheck?: FinalTenStepCheckReport;
  scoreAuditHistory?: ScoreAuditHistoryItem[];
  isTeacherApproved?: boolean;
  teacherApprovedAt?: string;
  status: 'submitted' | 'graded';
}

/**
 * Cấu trúc chuẩn hóa BÀI LÀM theo sơ đồ cây phân cấp
 */
export interface BaiLamQuestionItem {
  Question_ID: string;
  Source_Knowledge_ID?: string;
  Specification_ID?: string;
  Cognitive_Level: 'NB' | 'TH' | 'VD' | 'VDC' | string;
  Student_Answer: string;
  Correct_Answer: string;
  Max_Score: number;
  Earned_Score: number;
  Grading_Status: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'BLANK' | 'NEEDS_REVIEW' | string;
}

export interface BaiLamRecord {
  Submission_ID: string;
  Student_ID: string;
  Student_Name: string;
  Class_ID: string;
  
  Exam_ID: string;
  Exam_Version: string;
  Test_Code: string; // e.g. 101, 102, 103, 104, step3
  
  Questions: BaiLamQuestionItem[];
  
  Total_Score: number;
  Classification: 'Giỏi' | 'Khá' | 'Trung bình' | 'Dưới trung bình' | string;
  Submitted_At: string;
  Graded_At: string;
  Audit_Log: ScoreAuditHistoryItem[] | string;
}

