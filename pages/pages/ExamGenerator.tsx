
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { ExamBlueprint, GeneratedExam, Question, MucDo } from '../types';
import { Play, Copy, ArrowRight, CheckCircle, FileDown, Eye } from 'lucide-react';

const ExamGenerator: React.FC<{ onExamGenerated: () => void }> = ({ onExamGenerated }) => {
  const [blueprints, setBlueprints] = useState<ExamBlueprint[]>([]);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
  const [numCodes, setNumCodes] = useState(1);
  const [generatedExams, setGeneratedExams] = useState<GeneratedExam[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadBlueprints();
  }, []);

  const loadBlueprints = async () => {
    const all = await db.blueprints.toArray();
    setBlueprints(all);
  };

  const generate = async () => {
    if (!selectedBlueprintId) return;
    setIsGenerating(true);
    
    const bp = blueprints.find(b => b.id === selectedBlueprintId);
    if (!bp) return;

    const allQuestions = await db.questions.toArray();
    const newExams: GeneratedExam[] = [];

    for (let i = 0; i < numCodes; i++) {
      const examQuestions: { questionId: string; order: number; diem: number }[] = [];
      let currentOrder = 1;
      let usedIds = new Set<string>();

      // Select questions based on matrix
      for (const topic of bp.phamViChuDe) {
        for (const level of ['NB', 'TH', 'VD', 'VDC'] as MucDo[]) {
          const cell = bp.maTran[topic][level];
          if (cell.soCau > 0) {
            const available = allQuestions.filter(q => 
              q.chuDe === topic && 
              q.mucDo === level && 
              !usedIds.has(q.id)
            );

            // Shuffling and selection logic
            const shuffled = available.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, cell.soCau);
            
            selected.forEach(q => {
              examQuestions.push({
                questionId: q.id,
                order: currentOrder++,
                diem: cell.diem / cell.soCau // Distributed point per question in cell
              });
              usedIds.add(q.id);
            });
          }
        }
      }

      // Final shuffle if enabled
      if (bp.rangBuoc.xaoCau) {
        examQuestions.sort(() => 0.5 - Math.random()).forEach((q, idx) => q.order = idx + 1);
      }

      const exam: GeneratedExam = {
        id: crypto.randomUUID(),
        blueprintId: bp.id,
        maDe: (100 + i + 1).toString().slice(1),
        danhSachCauHoi: examQuestions,
        createdAt: new Date().toISOString()
      };
      
      await db.exams.add(exam);
      newExams.push(exam);

      // Update times used for selected questions
      for (const eq of examQuestions) {
        await db.questions.where('id').equals(eq.questionId).modify(q => { q.timesUsed++; });
      }
    }

    setGeneratedExams(newExams);
    setIsGenerating(false);
    onExamGenerated();
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Sinh đề & Quản lý mã đề</h1>
      <p className="text-slate-500 mb-8">Dựa trên ma trận đã thiết lập để tạo ra các bộ đề thi khác nhau</p>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm mb-10">
        <div className="grid md:grid-cols-2 gap-8 items-end">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Chọn ma trận đề mẫu</label>
            <select 
              className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-medium"
              value={selectedBlueprintId}
              onChange={(e) => setSelectedBlueprintId(e.target.value)}
            >
              <option value="">-- Danh sách ma trận đã lưu --</option>
              {blueprints.map(bp => (
                <option key={bp.id} value={bp.id}>
                  {bp.monHoc} Lớp {bp.lop} ({new Date(bp.createdAt).toLocaleDateString('vi-VN')})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="w-32">
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Số mã đề</label>
              <input 
                type="number" 
                min="1" max="10"
                className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={numCodes}
                onChange={(e) => setNumCodes(parseInt(e.target.value))}
              />
            </div>
            <button 
              onClick={generate}
              disabled={isGenerating || !selectedBlueprintId}
              className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-lg shadow-blue-200 transition-all"
            >
              {isGenerating ? <><RefreshCw className="animate-spin" /> Đang tạo...</> : <><Play /> Bắt đầu tạo đề</>}
            </button>
          </div>
        </div>
      </div>

      {generatedExams.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="text-emerald-500" /> Các mã đề vừa tạo:
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {generatedExams.map(exam => (
              <div key={exam.id} className="bg-white border-2 border-slate-100 rounded-xl p-5 hover:border-blue-200 transition-colors shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mã đề</div>
                  <div className="px-3 py-1 bg-blue-600 text-white text-xl font-bold rounded-lg">{exam.maDe}</div>
                </div>
                <div className="text-sm text-slate-600 mb-4">
                  Tổng số: <span className="font-bold">{exam.danhSachCauHoi.length} câu hỏi</span>
                </div>
                <button 
                  onClick={() => alert('Đã lưu đề. Chuyển sang module Xuất file để xem chi tiết.')}
                  className="w-full py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"
                >
                  <Eye size={16} /> Xem trước
                </button>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-blue-50 p-6 rounded-2xl flex items-center justify-between border border-blue-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                <FileDown size={24} />
              </div>
              <div>
                <h4 className="font-bold text-blue-900">Sẵn sàng xuất bản</h4>
                <p className="text-sm text-blue-700">Tất cả mã đề đã được lưu vào hệ thống. Bạn có thể xuất Đề thi & Đáp án ngay bây giờ.</p>
              </div>
            </div>
            <button className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all">
              Chuyển đến Export Center
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
);

export default ExamGenerator;
