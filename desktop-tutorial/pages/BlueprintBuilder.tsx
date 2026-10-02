
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Save, Sparkles, Loader2, Zap, Image as ImageIcon, Check, Info, FileType, Printer, AlertTriangle, Key, ExternalLink
} from 'lucide-react';
import { db } from '../db';
import { ExamBlueprint, Question, MucDo } from '../types';
import { MUC_DO_OPTIONS } from '../constants';
import { aiService } from '../services/ai';
import { exportToWord } from '../exportUtils';

const BlueprintBuilder: React.FC<{ onBlueprintSaved: () => void }> = ({ onBlueprintSaved }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const matrixVisionInputRef = useRef<HTMLInputElement>(null);
  const matrixDocInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<ExamBlueprint>>({
    monHoc: '', 
    lop: '', 
    phamViChuDe: [], 
    tongDiem: 10, 
    tongSoCau: 40, 
    thoiGian: 90,
    maTran: {}, 
    capHoc: 'THPT',
    tiLeMucDo: { NB: 40, TH: 30, VD: 20, VDC: 10 },
    tiLeDangCau: { tracNghiem: 100, tuLuan: 0 },
    rangBuoc: { khongLapCau: true, uuTienChuaDungGanDay: true, xaoCau: true, xaoDapAn: true }
  });

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    const allQ = await db.questions.toArray();
    setQuestions(allQ);
    const uniqueTopics = Array.from(new Set(allQ.map(q => q.chuDe))).filter(Boolean);
    setTopics(uniqueTopics);
  };

  const currentTotalQuestions = useMemo(() => {
    let total = 0; 
    if (!formData.maTran) return 0;
    Object.values(formData.maTran).forEach(topicCells => {
      Object.values(topicCells).forEach(cell => { 
        total += (Number(cell.soCau) || 0); 
      });
    });
    return total;
  }, [formData.maTran]);

  const handleOpenKeyDialog = async () => {
    try {
      if ((window as any).aistudio?.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
      }
      setApiError(null);
    } catch (err) {
      console.error("Failed to open key dialog", err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; 
    if (!file) return;
    
    setIsAISuggesting(true);
    setApiError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const results = await aiService.extractMatrixFromImage(base64, file.type);
        const newMaTran: any = { ...formData.maTran };
        const extractedTopics: string[] = [];
        
        results.forEach((item: any) => {
          if (item.topic) {
            extractedTopics.push(item.topic);
            newMaTran[item.topic] = { 
              NB: { soCau: item.NB || 0, diem: 0 }, 
              TH: { soCau: item.TH || 0, diem: 0 }, 
              VD: { soCau: item.VD || 0, diem: 0 }, 
              VDC: { soCau: item.VDC || 0, diem: 0 } 
            };
            updateCellPoints(newMaTran, item.topic);
          }
        });
        
        setFormData(prev => ({ 
          ...prev, 
          phamViChuDe: Array.from(new Set([...(prev.phamViChuDe || []), ...extractedTopics])), 
          maTran: newMaTran 
        }));
      } catch (err: any) { 
        if (err.message === 'API_KEY_NOT_FOUND') {
          setApiError("Không tìm thấy API Key hợp lệ. Vui lòng chọn Project đã bật Billing.");
        } else {
          setApiError("Lỗi Gemini API khi phân tích ma trận.");
        }
      } finally { 
        setIsAISuggesting(false); 
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAISuggest = async () => {
    if (!formData.monHoc || formData.phamViChuDe?.length === 0) {
      return alert("Vui lòng nhập môn học và chọn ít nhất 1 chủ đề kiến thức!");
    }
    setIsAISuggesting(true);
    setApiError(null);
    try {
      const inventory: any = {};
      questions.forEach(q => {
        if (!inventory[q.chuDe]) inventory[q.chuDe] = { NB: 0, TH: 0, VD: 0, VDC: 0 };
        inventory[q.chuDe][q.mucDo]++;
      });
      
      const suggest = await aiService.suggestSmartMatrix(
        formData.phamViChuDe!, 
        formData.tongSoCau!, 
        formData.monHoc!, 
        JSON.stringify(inventory)
      );
      
      const newMaTran: any = {};
      suggest.forEach((item: any) => {
        newMaTran[item.topic] = { 
          NB: { soCau: item.NB || 0, diem: 0 }, 
          TH: { soCau: item.TH || 0, diem: 0 }, 
          VD: { soCau: item.VD || 0, diem: 0 }, 
          VDC: { soCau: item.VDC || 0, diem: 0 } 
        };
        updateCellPoints(newMaTran, item.topic);
      });
      setFormData(prev => ({ ...prev, maTran: newMaTran }));
    } catch (err: any) { 
      if (err.message === 'API_KEY_NOT_FOUND') {
        setApiError("Không tìm thấy API Key hợp lệ. Vui lòng chọn Project đã bật Billing.");
      } else {
        setApiError("Lỗi Gemini API gợi ý ma trận.");
      }
    } finally { 
      setIsAISuggesting(false); 
    }
  };

  const updateCellPoints = (matrix: any, topic: string) => {
    const pointPerQ = (formData.tongDiem || 10) / (formData.tongSoCau || 40);
    (['NB', 'TH', 'VD', 'VDC'] as MucDo[]).forEach(level => {
      if (matrix[topic]?.[level]) {
        const count = Number(matrix[topic][level].soCau) || 0;
        matrix[topic][level].diem = Number((count * pointPerQ).toFixed(2));
      }
    });
  };

  const handleSave = async () => {
    if (!formData.monHoc) return alert("Cảnh báo: Thầy/Cô vui lòng nhập tên Môn học!");
    if (!formData.phamViChuDe?.length) return alert("Cảnh báo: Thầy/Cô vui lòng chọn các chủ đề kiến thức cho đề thi!");
    if (currentTotalQuestions === 0) return alert("Cảnh báo: Ma trận hiện chưa có câu hỏi nào. Hãy nhập số câu cho các ô!");
    
    if (currentTotalQuestions !== formData.tongSoCau) {
      const confirmed = confirm(`Tổng số câu trong ma trận (${currentTotalQuestions}) đang khác với tổng số câu cấu hình (${formData.tongSoCau}). Thầy/Cô có muốn tiếp tục lưu không?`);
      if (!confirmed) return;
    }

    setIsSaving(true);
    try {
      const finalMaTran = { ...formData.maTran };
      formData.phamViChuDe.forEach(topic => {
        if (!finalMaTran[topic]) {
          finalMaTran[topic] = { 
            NB: { soCau: 0, diem: 0 }, 
            TH: { soCau: 0, diem: 0 }, 
            VD: { soCau: 0, diem: 0 }, 
            VDC: { soCau: 0, diem: 0 } 
          };
        }
      });

      const blueprint: ExamBlueprint = { 
        ...formData, 
        maTran: finalMaTran,
        id: crypto.randomUUID(), 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString() 
      } as ExamBlueprint;
      
      await db.blueprints.add(blueprint);
      
      setSaveMessage("Đã lưu ma trận thành công!");
      setTimeout(() => { 
        setSaveMessage(null); 
        onBlueprintSaved(); 
      }, 1000);
    } catch (err) { 
      console.error(err);
      alert("Lỗi hệ thống: Không thể lưu ma trận."); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const handleExportMatrix = () => {
    exportToWord('matrix-print-area', `Ma_tran_de_thi_${formData.monHoc}_lop_${formData.lop}`);
  };

  return (
    <div className="p-8">
      <input type="file" ref={matrixVisionInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
      <input type="file" ref={matrixDocInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.doc,.docx" />

      <div className="flex justify-between items-center mb-10 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Thiết lập Ma trận đề</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Cấu trúc đề thi chuẩn Bộ GD&ĐT 2018</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportMatrix}
            disabled={currentTotalQuestions === 0}
            className="bg-white text-slate-700 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all font-bold border border-slate-200"
          >
            <Printer size={18} /> Tải ma trận (Word/PDF)
          </button>
          <button 
            onClick={handleAISuggest}
            disabled={isAISuggesting}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 border border-indigo-500/20"
          >
            {isAISuggesting ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            Gợi ý ma trận AI
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100 border border-blue-500/20"
          >
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saveMessage || 'Lưu ma trận'}
          </button>
        </div>
      </div>

      {apiError && (
        <div className="mb-10 p-6 bg-rose-50 border-2 border-rose-200 rounded-[2.5rem] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
              <Key size={24} />
            </div>
            <div>
              <h3 className="font-black text-rose-900 uppercase text-xs">Lỗi xác thực Gemini API</h3>
              <p className="text-rose-700 text-sm">{apiError}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-5 py-2.5 text-slate-500 font-bold text-xs flex items-center gap-2 hover:text-slate-700"
            >
              <ExternalLink size={14} /> Tài liệu Billing
            </a>
            <button 
              onClick={handleOpenKeyDialog}
              className="bg-rose-600 text-white px-6 py-2.5 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
            >
              Chọn lại API Key (Paid)
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Môn học</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-xl font-bold bg-slate-50" 
              value={formData.monHoc} 
              onChange={e => setFormData({...formData, monHoc: e.target.value})} 
              placeholder="VD: Toán" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Lớp</label>
            <input 
              type="text" 
              className="w-full p-3 border rounded-xl font-bold bg-slate-50" 
              value={formData.lop} 
              onChange={e => setFormData({...formData, lop: e.target.value})} 
              placeholder="VD: 10" 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Tổng số câu</label>
            <input 
              type="number" 
              className="w-full p-3 border rounded-xl font-bold bg-slate-50" 
              value={formData.tongSoCau} 
              onChange={e => setFormData({...formData, tongSoCau: parseInt(e.target.value) || 0})} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Thời gian (phút)</label>
            <input 
              type="number" 
              className="w-full p-3 border rounded-xl font-bold bg-slate-50" 
              value={formData.thoiGian} 
              onChange={e => setFormData({...formData, thoiGian: parseInt(e.target.value) || 0})} 
            />
          </div>
        </div>

        <div className="mb-8">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Phạm vi chủ đề</label>
          <div className="flex flex-wrap gap-2">
            {topics.map(topic => (
              <button
                key={topic}
                onClick={() => {
                  const current = formData.phamViChuDe || [];
                  if (current.includes(topic)) {
                    setFormData({...formData, phamViChuDe: current.filter(t => t !== topic)});
                  } else {
                    setFormData({...formData, phamViChuDe: [...current, topic]});
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                  formData.phamViChuDe?.includes(topic)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        <div id="matrix-print-area" className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                <th className="border border-slate-200 p-4 text-left">Chủ đề</th>
                {MUC_DO_OPTIONS.map(opt => (
                  <th key={opt.value} className="border border-slate-200 p-4 text-center">{opt.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {formData.phamViChuDe?.map(topic => (
                <tr key={topic} className="hover:bg-slate-50 transition-colors">
                  <td className="border border-slate-200 p-4 font-bold text-slate-700">{topic}</td>
                  {(['NB', 'TH', 'VD', 'VDC'] as MucDo[]).map(level => (
                    <td key={level} className="border border-slate-200 p-4">
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="number"
                          className="w-16 p-1 text-center border rounded font-bold"
                          value={formData.maTran?.[topic]?.[level]?.soCau || 0}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            const newMatrix = { ...formData.maTran };
                            if (!newMatrix[topic]) newMatrix[topic] = { NB: {soCau:0, diem:0}, TH: {soCau:0, diem:0}, VD: {soCau:0, diem:0}, VDC: {soCau:0, diem:0} };
                            newMatrix[topic][level].soCau = val;
                            updateCellPoints(newMatrix, topic);
                            setFormData({ ...formData, maTran: newMatrix });
                          }}
                        />
                        <span className="text-[9px] text-slate-400 font-bold">{formData.maTran?.[topic]?.[level]?.diem || 0}đ</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td className="border border-slate-200 p-4">Tổng cộng</td>
                <td colSpan={4} className="border border-slate-200 p-4 text-right">
                  {currentTotalQuestions} / {formData.tongSoCau} câu
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BlueprintBuilder;
