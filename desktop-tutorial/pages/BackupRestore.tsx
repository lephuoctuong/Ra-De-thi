import React from 'react';
import { DownloadCloud, Trash2, ArrowRight } from 'lucide-react';

interface BackupRestoreProps {
  onExportAll: () => Promise<void>;
  onClearAllData: () => Promise<void>;
}

const BackupRestore: React.FC<BackupRestoreProps> = ({ onExportAll, onClearAllData }) => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
          <DownloadCloud size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sao lưu & Phục hồi ứng dụng</h1>
          <p className="text-sm text-slate-500 font-medium">Đảm bảo dữ liệu các bước của bạn luôn được phân vùng an toàn.</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* Backup Card */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-all">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
            <DownloadCloud size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Xuất bản sao dữ liệu</h3>
          <p className="text-slate-500 mb-8 flex-1 text-sm leading-relaxed">
            Nén và tải xuống toàn bộ tài liệu nguồn (Sách giáo khoa, Đề thi mẫu, Ma trận đề và kết quả biên soạn đề gốc, 4 mã đề tương đương) về máy tính cá nhân dưới dạng tệp tin dự phòng định dạng .json.
          </p>
          <button 
            onClick={onExportAll}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 group"
          >
            Tải bản lưu trữ ngay <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Restore / Delete Card */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-all">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
            <Trash2 size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Xóa sạch toàn bộ dữ liệu</h3>
          <p className="text-slate-500 mb-8 flex-1 text-sm leading-relaxed">
            Xóa vĩnh viễn mọi bản thảo các tài liệu nguồn và các Đề thi đang biên soạn dở dang trên bộ nhớ cục bộ để dọn dẹp hệ thống ra một đề tài liệu mới từ đầu.
          </p>
          <button 
            onClick={onClearAllData}
            className="w-full py-4 border-2 border-red-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all"
          >
            Xóa sạch dữ liệu cục bộ
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;
