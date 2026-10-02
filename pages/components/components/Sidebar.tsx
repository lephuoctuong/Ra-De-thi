
import React from 'react';
import { 
  Home, 
  Layers, 
  FileText, 
  DownloadCloud, 
  PlusCircle,
  BookOpen,
  HelpCircle,
  Printer,
  Copy,
  Archive,
  GraduationCap
} from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onOpenGuide: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onOpenGuide }) => {
  const menuItems = [
    { id: 'M0', label: '0. Chuẩn bị nguồn', icon: Home },
    { id: 'M1', label: '1. Phân tích nguồn', icon: BookOpen },
    { id: 'M2', label: '2. Ma trận & Đặc tả', icon: Layers },
    { id: 'M3', label: '3. Đề kiểm tra định kì', icon: PlusCircle },
    { id: 'M4', label: '4. Xuất file đề thi', icon: Printer },
    { id: 'M5', label: '5. Tạo mã đề gộp', icon: Copy },
    { id: 'M6', label: '6. Kho đề thi', icon: Archive },
    { id: 'M7', label: '7. Sản phẩm học sinh', icon: GraduationCap },
    { id: 'M8', label: 'Sao lưu & Khôi phục', icon: DownloadCloud },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col no-print z-40 shadow-xl">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-black flex items-center gap-2.5">
          <FileText size={24} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.85)]" />
          <span className="neon-title uppercase select-none tracking-wide text-lg">LÊ PHƯỚC TƯỜNG</span>
        </h1>
        <div className="mt-2.5 px-2.5 py-1 rounded-xl neon-box-glow inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
          <p className="text-[10px] uppercase font-black tracking-wider neon-text-badge select-none m-0">
            HỆ THỐNG NGÂN HÀNG & ĐỀ THI
          </p>
        </div>
      </div>
      
      <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as ViewState)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-[1.02]' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'text-slate-500'} />
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 space-y-2 border-t border-slate-800">
        <button 
          onClick={onOpenGuide}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
        >
          <HelpCircle size={18} className="text-blue-400" />
          Hướng dẫn
        </button>
        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800">
           <div className="flex items-center gap-2 mb-1">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Hệ thống ngoại tuyến</span>
           </div>
           <p className="text-[9px] text-slate-500">Dữ liệu lưu tại IndexedDB</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
