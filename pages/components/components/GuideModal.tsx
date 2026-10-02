
import React, { useState } from 'react';
import { 
  X, 
  Database, 
  Layers, 
  PlusCircle, 
  FileText, 
  CheckCircle2,
  ChevronRight,
  Info,
  Code2,
  Sigma,
  Beaker,
  Triangle
} from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'steps' | 'formatting'>('steps');

  if (!isOpen) return null;

  const steps = [
    {
      title: "Bước 1: Nạp ngân hàng câu hỏi",
      desc: "Truy cập menu 'Ngân hàng' để thêm câu hỏi thủ công hoặc dùng AI sinh câu hỏi STEM. Bạn cần ít nhất 30-40 câu để tạo đề thi chất lượng.",
      icon: <Database className="text-blue-600" size={24} />,
      color: "bg-blue-50 border-blue-100"
    },
    {
      title: "Bước 2: Thiết lập Ma trận đề",
      desc: "Vào 'Ma trận đề' để chọn chủ đề, tỉ lệ mức độ (NB-TH-VD-VDC) và số lượng câu hỏi cho từng ô kiến thức theo chương trình 2018.",
      icon: <Layers className="text-emerald-600" size={24} />,
      color: "bg-emerald-50 border-emerald-100"
    },
    {
      title: "Bước 3: Sinh mã đề tự động",
      desc: "Hệ thống tự động chọn ngẫu nhiên câu hỏi từ kho dữ liệu dựa trên ma trận, đảm bảo tính khách quan và không trùng lặp.",
      icon: <PlusCircle className="text-purple-600" size={24} />,
      color: "bg-purple-50 border-purple-100"
    },
    {
      title: "Bước 4: Xuất bản Đề thi & Đáp án",
      desc: "Tại 'Xuất file', bạn có thể xem và tải trọn bộ Đề thi, Đáp án, Ma trận định dạng .doc (Word) chuẩn Pandoc.",
      icon: <FileText className="text-amber-600" size={24} />,
      color: "bg-amber-50 border-amber-100"
    }
  ];

  const formattingRules = [
    { type: "Công thức Toán", syntax: "\\( ax^2 + bx + c = 0 \\)", icon: <Sigma size={16} /> },
    { type: "Toán khối (Block)", syntax: "\\[ \\int_{a}^{b} f(x)dx \\]", icon: <Sigma size={16} /> },
    { type: "Hóa học", syntax: "\\ce{H2SO4}, \\ce{Fe + CuSO4 -> ...}", icon: <Beaker size={16} /> },
    { type: "Hình học/Đồ thị", syntax: "[FIGURE type=\"svg\"] <svg>...</svg> [/FIGURE]", icon: <Triangle size={16} /> },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Hướng dẫn hệ thống LÊ PHƯỚC TƯỜNG</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Quy trình chuyên nghiệp - Tiêu chuẩn STEM</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex bg-slate-100 p-1 mx-8 mt-6 rounded-xl">
          <button 
            onClick={() => setActiveTab('steps')}
            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'steps' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Quy trình tạo đề
          </button>
          <button 
            onClick={() => setActiveTab('formatting')}
            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'formatting' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Chuẩn định dạng STEM
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'steps' ? (
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className={`flex gap-5 p-5 rounded-2xl border ${step.color} transition-all hover:shadow-md`}>
                  <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl shadow-sm border border-inherit flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                       <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">0{idx+1}</span> {step.title}
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex gap-3">
                <Info className="text-indigo-600 shrink-0" size={20} />
                <p className="text-xs text-indigo-900 leading-relaxed">
                  Để đề thi xuất ra Word (.doc) đẹp nhất và hỗ trợ KaTeX, thầy cô vui lòng tuân thủ các cú pháp soạn thảo dưới đây.
                </p>
              </div>
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-widest text-slate-400 border-b">
                    <tr>
                      <th className="p-4">Loại nội dung</th>
                      <th className="p-4">Định dạng chuẩn (LaTeX/SVG)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formattingRules.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-700 flex items-center gap-2">
                          {rule.icon} {rule.type}
                        </td>
                        <td className="p-4 font-mono text-[11px] text-blue-600 bg-slate-50/50">
                          {rule.syntax}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <h5 className="text-[10px] font-black text-amber-700 uppercase mb-2">Lưu ý về Hình học:</h5>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Luôn bao bọc mã SVG bằng thẻ <code>[FIGURE type="svg"]...[/FIGURE]</code>. Hệ thống sẽ tự động chuyển đổi sang hình ảnh khi in hoặc xuất Word.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase">Version 2.5 Advanced</span>
          </div>
          <button 
            onClick={onClose}
            className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
          >
            Bắt đầu soạn thảo <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuideModal;
