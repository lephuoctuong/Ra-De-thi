
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../db';
import { GeneratedExam, ExamBlueprint, Question, MucDo } from '../types';
import { 
  Printer, FileText, CheckSquare, Table as TableIcon, Info, Download, Layout, FileCode
} from 'lucide-react';
import { MUC_DO_OPTIONS } from '../constants';
import ContentRenderer from '../components/ContentRenderer';
import { exportToWord } from '../exportUtils';

type ExportTab = 'EXAM' | 'ANSWER' | 'MATRIX' | 'DESCRIPTION';

const ExportCenter: React.FC = () => {
  const [exams, setExams] = useState<GeneratedExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [currentExam, setCurrentExam] = useState<GeneratedExam | null>(null);
  const [blueprint, setBlueprint] = useState<ExamBlueprint | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState<ExportTab>('EXAM');
  const printRef = useRef<HTMLDivElement>(null);
  
  const [headerInfo, setHeaderInfo] = useState({
    school: 'TỔ KHẢO THÍ CHUYÊN MÔN',
    subject: '', grade: '', time: '',
    date: new Date().toLocaleDateString('vi-VN'),
    title: 'ĐỀ KIỂM TRA ĐỊNH KỲ',
    year: '2024 - 2025'
  });

  useEffect(() => { loadExams(); }, []);
  const loadExams = async () => {
    const all = await db.exams.toArray();
    setExams(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => {
    if (selectedExamId) loadExamDetails(selectedExamId);
  }, [selectedExamId]);

  const loadExamDetails = async (id: string) => {
    const exam = await db.exams.get(id);
    if (!exam) return;
    setCurrentExam(exam);
    const bp = await db.blueprints.get(exam.blueprintId);
    if (bp) {
      setBlueprint(bp);
      setHeaderInfo(prev => ({ ...prev, subject: bp.monHoc, grade: bp.lop, time: bp.thoiGian.toString() }));
    }
    const qIds = exam.danhSachCauHoi.map(dq => dq.questionId);
    const qs = await db.questions.bulkGet(qIds);
    setQuestions(qs.filter(Boolean) as Question[]);
  };

  const getQ = (id: string) => questions.find(q => q.id === id);

  return (
    <div className="p-8 min-h-screen bg-slate-50">
      <div className="flex justify-between items-center mb-8 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Trung tâm xuất bản</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">Hồ sơ STEM chuẩn Pandoc-docx</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => exportToWord('print-area', `De_thi_${currentExam?.maDe}`)}
            className="bg-white text-blue-600 px-6 py-3 rounded-2xl flex items-center gap-3 hover:bg-blue-50 border border-blue-200 shadow-sm transition-all font-black uppercase text-xs tracking-widest"
          >
            <FileCode size={20} /> Tải file Word (.doc)
          </button>
          <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl flex items-center gap-3 hover:bg-black shadow-xl transition-all font-black uppercase text-xs tracking-widest">
            <Printer size={20} /> In / Xuất PDF
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-8 no-print mb-12">
        <div className="lg:col-span-1 space-y-4">
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200">
             <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Chọn mã đề thi</label>
             <select 
                className="w-full p-3.5 border border-slate-200 rounded-xl font-bold bg-slate-50"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                <option value="">-- Danh sách đề --</option>
                {exams.map(e => <option key={e.id} value={e.id}>Mã đề {e.maDe}</option>)}
              </select>
           </div>
           <div className="flex flex-col gap-2">
             {['EXAM', 'ANSWER', 'MATRIX'].map((tab) => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab as ExportTab)}
                 className={`p-4 rounded-2xl text-left font-black text-xs uppercase transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-200'}`}
               >
                 {tab === 'EXAM' ? 'Bộ đề thi học sinh' : tab === 'ANSWER' ? 'Đáp án & Hướng dẫn' : 'Ma trận & Đặc tả'}
               </button>
             ))}
           </div>
        </div>

        <div className="lg:col-span-3">
          <div id="print-area" className="bg-white shadow-2xl mx-auto w-[210mm] min-h-[297mm] p-[15mm] text-black font-serif transition-all exam-page">
            {currentExam && blueprint ? (
              <>
                {activeTab === 'EXAM' && (
                  <div>
                    <div className="flex justify-between items-start mb-10 text-center">
                      <div className="w-[45%] font-bold uppercase text-sm leading-tight">
                        {headerInfo.school} <br/> <span className="border-t border-black mt-2 inline-block pt-1">ĐỀ THI CHÍNH THỨC</span>
                      </div>
                      <div className="w-[50%] font-bold">
                        <div className="uppercase text-md">{headerInfo.title}</div>
                        <div className="text-sm">Môn: {headerInfo.subject.toUpperCase()} - Khối {headerInfo.grade}</div>
                        <div className="text-xs italic font-normal mt-1">Thời gian: {headerInfo.time} phút</div>
                      </div>
                    </div>

                    <div className="student-info-box border border-black p-4 mb-8 flex justify-between items-center font-serif text-sm">
                      <div className="space-y-3">
                        <div>Họ tên học sinh: .....................................................................</div>
                        <div>Số báo danh: ........................................... Lớp: ...................</div>
                      </div>
                      <div className="border-2 border-black p-3 font-bold text-xl rounded">Mã đề: {currentExam.maDe}</div>
                    </div>

                    <div className="space-y-8 text-[11pt] leading-relaxed">
                      {currentExam.danhSachCauHoi.map((dq, idx) => {
                        const q = getQ(dq.questionId);
                        if (!q) return null;
                        return (
                          <div key={q.id} className="question-block">
                            <div className="flex gap-1 mb-3">
                              <span className="font-bold flex-shrink-0">Câu {idx + 1}:</span>
                              <ContentRenderer content={q.noiDung} />
                            </div>
                            {q.dangCau === 'TracNghiem' && q.luaChon && (
                              <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-6">
                                {Object.entries(q.luaChon).map(([k, v]) => (
                                  <div key={k} className="flex gap-2">
                                    <span className="font-bold">{k}.</span>
                                    <ContentRenderer content={v as string} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {activeTab === 'ANSWER' && (
                  <div>
                    <h2 className="text-center font-bold text-xl uppercase mb-10">ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM</h2>
                    <div className="mb-10">
                       <h3 className="font-bold underline mb-4">I. Đáp án trắc nghiệm:</h3>
                       <div className="grid grid-cols-5 gap-2">
                         {currentExam.danhSachCauHoi.map((dq, idx) => {
                           const q = getQ(dq.questionId);
                           return (
                             <div key={idx} className="border border-black p-2 text-center text-sm">
                               <b className="mr-1">{idx+1}:</b> {q?.dapAn}
                             </div>
                           );
                         })}
                       </div>
                    </div>
                    <div>
                       <h3 className="font-bold underline mb-4">II. Hướng dẫn chi tiết:</h3>
                       <table className="w-full border-collapse border border-black text-sm">
                         <thead>
                           <tr className="bg-slate-50"><th className="border border-black p-2 w-16">Câu</th><th className="border border-black p-2">Nội dung hướng dẫn</th><th className="border border-black p-2 w-16">Điểm</th></tr>
                         </thead>
                         <tbody>
                           {currentExam.danhSachCauHoi.map((dq, idx) => (
                             <tr key={idx}>
                               <td className="border border-black p-2 text-center font-bold">{idx+1}</td>
                               <td className="border border-black p-2"><ContentRenderer content={getQ(dq.questionId)?.giaiThichCham || ''} /></td>
                               <td className="border border-black p-2 text-center">{dq.diem}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                    </div>
                  </div>
                )}
                {activeTab === 'MATRIX' && (
                  <div>
                    <h2 className="text-center font-bold text-xl uppercase mb-6 font-serif">MA TRẬN CẤU TRÚC ĐỀ KIỂM TRA</h2>
                    <div className="mb-6 text-center text-sm font-serif italic text-slate-700">
                      Môn học: {headerInfo.subject.toUpperCase()} - Khối lớp {headerInfo.grade} - Thời gian làm bài: {headerInfo.time} phút
                    </div>

                    <table className="w-full border-collapse border border-black text-sm font-serif">
                      <thead>
                        <tr className="bg-slate-50 text-center font-bold">
                          <th className="border border-black p-3 text-left w-[40%]">Chủ đề kiến thức</th>
                          <th className="border border-black p-2 w-[11%]">Nhận biết</th>
                          <th className="border border-black p-2 w-[11%]">Thông hiểu</th>
                           <th className="border border-black p-2 w-[11%]">Vận dụng</th>
                          <th className="border border-black p-2 w-[11%]">Vận dụng cao</th>
                          <th className="border border-black p-2 w-[8%]">Số câu</th>
                          <th className="border border-black p-2 w-[8%] text-center">Điểm số</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blueprint.phamViChuDe?.map(topic => {
                          const nbQ = blueprint.maTran?.[topic]?.NB?.soCau || 0;
                          const nbD = blueprint.maTran?.[topic]?.NB?.diem || 0;
                          const thQ = blueprint.maTran?.[topic]?.TH?.soCau || 0;
                          const thD = blueprint.maTran?.[topic]?.TH?.diem || 0;
                          const vdQ = blueprint.maTran?.[topic]?.VD?.soCau || 0;
                          const vdD = blueprint.maTran?.[topic]?.VD?.diem || 0;
                          const vdcQ = blueprint.maTran?.[topic]?.VDC?.soCau || 0;
                          const vdcD = blueprint.maTran?.[topic]?.VDC?.diem || 0;

                          const rowQ = nbQ + thQ + vdQ + vdcQ;
                          const rowD = nbD + thD + vdD + vdcD;

                          return (
                            <tr key={topic} className="text-sm">
                              <td className="border border-black p-3 font-bold">{topic}</td>
                              <td className="border border-black p-2 text-center">
                                {nbQ > 0 ? `${nbQ} câu (${nbD}đ)` : '-'}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {thQ > 0 ? `${thQ} câu (${thD}đ)` : '-'}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {vdQ > 0 ? `${vdQ} câu (${vdD}đ)` : '-'}
                              </td>
                              <td className="border border-black p-2 text-center">
                                {vdcQ > 0 ? `${vdcQ} câu (${vdcD}đ)` : '-'}
                              </td>
                              <td className="border border-black p-2 text-center font-bold bg-slate-50/20">{rowQ}</td>
                              <td className="border border-black p-2 text-center font-bold bg-slate-50/20">{rowD > 0 ? `${rowD.toFixed(1)}đ` : '0đ'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-center">
                          <td className="border border-black p-3 text-left">Tổng số câu / Điểm số</td>
                          <td className="border border-black p-2">
                            {blueprint.phamViChuDe?.reduce((acc, t) => acc + (blueprint.maTran?.[t]?.NB?.soCau || 0), 0)} câu
                          </td>
                          <td className="border border-black p-2">
                            {blueprint.phamViChuDe?.reduce((acc, t) => acc + (blueprint.maTran?.[t]?.TH?.soCau || 0), 0)} câu
                          </td>
                          <td className="border border-black p-2">
                            {blueprint.phamViChuDe?.reduce((acc, t) => acc + (blueprint.maTran?.[t]?.VD?.soCau || 0), 0)} câu
                          </td>
                          <td className="border border-black p-2">
                            {blueprint.phamViChuDe?.reduce((acc, t) => acc + (blueprint.maTran?.[t]?.VDC?.soCau || 0), 0)} câu
                          </td>
                          <td className="border border-black p-2 bg-slate-100">
                            {blueprint.tongSoCau} câu
                          </td>
                          <td className="border border-black p-2 bg-slate-100 text-indigo-700">
                            {blueprint.tongDiem}đ
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="h-[200mm] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">Vui lòng chọn mã đề thi</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportCenter;
