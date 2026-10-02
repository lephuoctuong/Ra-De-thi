
import React from 'react';
import { PlayCircle, Database, FileSpreadsheet, ArrowRight, CheckCircle } from 'lucide-react';
import { ViewState } from '../types';

interface OnboardingProps {
  onNavigate: (view: ViewState) => void;
  onSeedData: () => Promise<void>;
}

const Onboarding: React.FC<OnboardingProps> = ({ onNavigate, onSeedData }) => {
  return (
    <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 leading-tight">
          Chào Mừng đến với Ngân Hàng Câu Hỏi và Tạo Đề Thi - Nâng Cao (LÊ PHƯỚC TƯỜNG)
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Giải pháp toàn diện giúp giáo viên xây dựng ngân hàng câu hỏi, thiết lập ma trận đề thi và xuất bản đề thi chuẩn hóa chỉ trong chưa đầy 10 phút.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <button 
          onClick={onSeedData}
          className="group p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-blue-500 transition-all text-left"
        >
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <PlayCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Dùng dữ liệu mẫu</h3>
          <p className="text-slate-500 mb-4">Trải nghiệm ngay với hơn 30 câu hỏi mẫu đầy đủ các mức độ và môn học.</p>
          <div className="flex items-center text-blue-600 font-semibold group-hover:gap-2 transition-all">
            Bắt đầu nhanh <ArrowRight size={18} />
          </div>
        </button>

        <button 
          onClick={() => onNavigate('M2')}
          className="group p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-emerald-500 transition-all text-left"
        >
          <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Database size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Tạo ngân hàng mới</h3>
          <p className="text-slate-500 mb-4">Xây dựng kho lưu trữ câu hỏi cá nhân theo chương trình học của riêng bạn.</p>
          <div className="flex items-center text-emerald-600 font-semibold group-hover:gap-2 transition-all">
            Soạn thảo ngay <ArrowRight size={18} />
          </div>
        </button>

        <button 
          onClick={() => onNavigate('M7')}
          className="group p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-amber-500 transition-all text-left"
        >
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <FileSpreadsheet size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Nhập từ Excel/CSV</h3>
          <p className="text-slate-500 mb-4">Đưa dữ liệu sẵn có lên hệ thống một cách nhanh chóng theo template chuẩn.</p>
          <div className="flex items-center text-amber-600 font-semibold group-hover:gap-2 transition-all">
            Import dữ liệu <ArrowRight size={18} />
          </div>
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-blue-900 mb-6 flex items-center gap-2">
          <CheckCircle className="text-blue-600" /> Hướng dẫn nhanh 3 bước
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Nạp câu hỏi</h4>
              <p className="text-sm text-blue-700">Soạn thảo hoặc nhập câu hỏi từ Excel vào "Ngân hàng câu hỏi".</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Dựng ma trận</h4>
              <p className="text-sm text-blue-700">Xác định tỉ lệ % các mức độ Nhận biết - Thông hiểu - Vận dụng.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
            <div>
              <h4 className="font-bold text-blue-900 mb-1">Sinh đề & Xuất file</h4>
              <p className="text-sm text-blue-700">Hệ thống tự chọn câu hỏi và xuất Đề thi, Đáp án sang Word/PDF.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
