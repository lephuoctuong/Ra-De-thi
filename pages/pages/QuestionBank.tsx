
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Search, Trash2, Edit3, Sparkles, Loader2, X, Zap, 
  ImageIcon, PlusCircle, Database, FileType, FileUp, Camera, Key, AlertTriangle, ExternalLink, Filter, Save, Check
} from 'lucide-react';
import { db } from '../db';
import { Question, MucDo, DangCau } from '../types';
import { aiService } from '../services/ai';
import ContentRenderer from '../components/ContentRenderer';

// Comment: The global declaration of aistudio was removed because it is already 
// defined by the environment with the correct AIStudio type.

const QuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAIOperating, setIsAIOperating] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false); // Modal soạn thảo thủ công
  const [uploadMode, setUploadMode] = useState<'generate' | 'extract'>('generate');
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterLevel, setFilterLevel] = useState('');

  // Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorForm, setEditorForm] = useState<Partial<Question>>({
    capHoc: 'THPT', monHoc: 'Toán', lop: '10', chuDe: '', mucDo: 'NB', dangCau: 'TracNghiem', 
    noiDung: '', luaChon: { A:'', B:'', C:'', D:'' }, dapAn: 'A', giaiThichCham: '', diem: 0.25
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  const [bulkConfig, setBulkConfig] = useState({ 
    topic: '', subject: '', grade: '10', count: 5, level: 'NB' as MucDo, type: 'TracNghiem' as string
  });
  
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);

  useEffect(() => { loadQuestions(); }, []);
  
  useEffect(() => {
    if (previewQuestions.length > 0 && window.renderMathInElement && previewContainerRef.current) {
      setTimeout(() => {
        window.renderMathInElement(previewContainerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false,
          trust: true
        });
      }, 100);
    }
  }, [previewQuestions]);

  const loadQuestions = async () => { 
    const all = await db.questions.toArray(); 
    setQuestions(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())); 
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchSearch = (q.noiDung || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (q.chuDe || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchSubject = !filterSubject || q.monHoc === filterSubject;
      const matchLevel = !filterLevel || q.mucDo === filterLevel;
      return matchSearch && matchSubject && matchLevel;
    });
  }, [questions, searchTerm, filterSubject, filterLevel]);

  const uniqueSubjects = useMemo(() => Array.from(new Set(questions.map(q => q.monHoc).filter(Boolean))), [questions]);

  const handleOpenKeyDialog = async () => {
    try {
      // @ts-ignore - aistudio is globally available via environment types
      await (window as any).aistudio.openSelectKey();
      setApiError(null);
    } catch (err) {
      console.error("Failed to open key dialog", err);
    }
  };

  const handleBulkAIInvoke = async () => {
    if (!bulkConfig.subject || !bulkConfig.topic) return alert("Vui lòng nhập Môn học và Chủ đề!");
    setIsAIOperating(true);
    setApiError(null);
    try {
      const results = await aiService.generateQuestions(
        bulkConfig.topic, 
        bulkConfig.subject, 
        bulkConfig.grade, 
        bulkConfig.count, 
        bulkConfig.level,
        bulkConfig.type
      );
      setPreviewQuestions(results.map((r: any) => ({ 
        ...r, 
        monHoc: bulkConfig.subject, 
        lop: bulkConfig.grade, 
        chuDe: bulkConfig.topic 
      })));
    } catch (err: any) { 
      if (err.message === 'API_KEY_NOT_FOUND') {
        setApiError("Không tìm thấy API Key hợp lệ hoặc Project chưa được bật Billing.");
      } else {
        setApiError("Lỗi gọi Gemini API. Có thể do giới hạn tài khoản hoặc API Key chưa đúng.");
      }
    } finally { setIsAIOperating(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsAIOperating(true);
    setApiError(null);
    setUploadMode('extract');
    setIsBulkModalOpen(true);
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      try {
        const results = await aiService.extractQuestionsFromDoc(base64, file.type);
        setPreviewQuestions(results);
      } catch (err: any) {
        if (err.message === 'API_KEY_NOT_FOUND') {
          setApiError("Không tìm thấy API Key hợp lệ hoặc Project chưa được bật Billing.");
        } else {
          setApiError("Lỗi khi trích xuất tài liệu từ Gemini API.");
        }
      } finally {
        setIsAIOperating(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const savePreviewToBank = async () => {
    if (previewQuestions.length === 0) return;
    try {
      const toSave = previewQuestions.map(q => ({
        ...q,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timesUsed: 0,
        tags: [],
        diem: q.diem || (q.dangCau === 'TuLuan' ? 2.0 : 0.25),
        capHoc: q.capHoc || 'THPT'
      }));
      await db.questions.bulkAdd(toSave);
      setIsBulkModalOpen(false); setPreviewQuestions([]); loadQuestions();
      alert(`Đã lưu ${toSave.length} câu hỏi vào ngân hàng!`);
    } catch (err) { alert("Lỗi khi lưu!"); }
  };

  const handleAddNew = () => {
    setEditorForm({
      capHoc: 'THPT', monHoc: 'Toán', lop: '10', chuDe: '', mucDo: 'NB', dangCau: 'TracNghiem', 
      noiDung: '', luaChon: { A:'', B:'', C:'', D:'' }, dapAn: 'A', giaiThichCham: '', diem: 0.25
    });
    setEditingId(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (q: Question) => {
    setEditorForm({ ...q });
    setEditingId(q.id);
    setIsEditorOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!editorForm.noiDung || !editorForm.monHoc) return alert("Vui lòng nhập Nội dung và Môn học");
    
    try {
      const questionData = {
        ...editorForm,
        id: editingId || crypto.randomUUID(),
        createdAt: editingId ? editorForm.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timesUsed: editorForm.timesUsed || 0,
        tags: editorForm.tags || []
      } as Question;

      if (editingId) {
        await db.questions.put(questionData);
      } else {
        await db.questions.add(questionData);
      }
      setIsEditorOpen(false);
      loadQuestions();
    } catch (err) {
      alert("Lỗi khi lưu câu hỏi.");
    }
  };

  return (
    <div className="p-8">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.doc,.docx,image/*" />
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Ngân hàng câu hỏi</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1 flex items-center gap-2">
            <Database size={12} className="text-indigo-500" /> Quản lý kho lưu trữ chuyên nghiệp
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="bg-white text-slate-700 px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all font-bold border border-slate-200"
          >
            <FileUp size={18} className="text-emerald-500" /> Quét tài liệu (PDF/Ảnh)
          </button>
          <button 
            onClick={() => { setUploadMode('generate'); setIsBulkModalOpen(true); setPreviewQuestions([]); setApiError(null); }} 
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-100 border border-indigo-500/20"
          >
            <Zap size={18} /> Sinh câu hỏi STEM AI
          </button>
          <button 
            onClick={handleAddNew} 
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100 border border-blue-500/20"
          >
            <Plus size={18} /> Thêm mới
          </button>
        </div>
      </div>

      {/* Toolbar: Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm câu hỏi theo nội dung, chủ đề..." 
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
           <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
             <select 
               className="pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
               value={filterSubject}
               onChange={(e) => setFilterSubject(e.target.value)}
             >
               <option value="">Tất cả môn</option>
               {uniqueSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
             </select>
           </div>
           <div className="relative">
             <select 
               className="pl-4 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
               value={filterLevel}
               onChange={(e) => setFilterLevel(e.target.value)}
             >
               <option value="">Tất cả mức độ</option>
               <option value="NB">Nhận biết</option>
               <option value="TH">Thông hiểu</option>
               <option value="VD">Vận dụng</option>
               <option value="VDC">Vận dụng cao</option>
             </select>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-black tracking-widest">
            <tr><th className="px-8 py-5">Nội dung câu hỏi (STEM Ready)</th><th className="px-8 py-5">Mức độ</th><th className="px-8 py-5 text-right">Thao tác</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredQuestions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-8 py-20 text-center text-slate-400 font-medium">
                   {questions.length === 0 ? "Ngân hàng đang trống." : "Không tìm thấy kết quả phù hợp."}
                </td>
              </tr>
            ) : filteredQuestions.map(q => (
              <tr key={q.id} className="hover:bg-slate-50/50 group transition-colors">
                <td className="px-8 py-6">
                  <ContentRenderer content={q.noiDung} className="text-slate-900 font-medium mb-3" />
                  {q.dangCau === 'TracNghiem' && q.luaChon && Object.keys(q.luaChon).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-4 ml-4">
                      {Object.entries(q.luaChon).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <b className="text-blue-600">{k}.</b> <ContentRenderer content={v as string} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-4 flex gap-3">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">{q.monHoc}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">{q.chuDe}</span>
                    {q.dangCau === 'TuLuan' && <span className="bg-purple-100 px-2 py-0.5 rounded text-purple-600">Tự luận</span>}
                  </div>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                    q.mucDo === 'NB' ? 'bg-blue-100 text-blue-700' : 
                    q.mucDo === 'TH' ? 'bg-emerald-100 text-emerald-700' : 
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {q.mucDo}
                  </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(q)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit3 size={16} /></button>
                    <button onClick={async () => { if(confirm('Xóa câu hỏi này khỏi ngân hàng?')) { await db.questions.delete(q.id); loadQuestions(); } }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                 {editingId ? <><Edit3 className="text-blue-500" /> Chỉnh sửa câu hỏi</> : <><PlusCircle className="text-emerald-500" /> Thêm câu hỏi mới</>}
               </h2>
               <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Môn học</label>
                    <input className="w-full p-3 border rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editorForm.monHoc} onChange={e => setEditorForm({...editorForm, monHoc: e.target.value})} placeholder="Toán, Lý..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Lớp</label>
                    <input className="w-full p-3 border rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editorForm.lop} onChange={e => setEditorForm({...editorForm, lop: e.target.value})} placeholder="10, 11..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Chủ đề</label>
                    <input className="w-full p-3 border rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" 
                      value={editorForm.chuDe} onChange={e => setEditorForm({...editorForm, chuDe: e.target.value})} placeholder="Đại số, Hình học..." />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Mức độ</label>
                    <select className="w-full p-3 border rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editorForm.mucDo} onChange={e => setEditorForm({...editorForm, mucDo: e.target.value as MucDo})}>
                      <option value="NB">Nhận biết</option><option value="TH">Thông hiểu</option><option value="VD">Vận dụng</option><option value="VDC">Vận dụng cao</option>
                    </select>
                  </div>
               </div>

               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Nội dung câu hỏi (Hỗ trợ LaTeX, SVG)</label>
                 <textarea className="w-full p-4 border rounded-xl font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px]"
                   value={editorForm.noiDung} onChange={e => setEditorForm({...editorForm, noiDung: e.target.value})} placeholder="Nhập nội dung câu hỏi..." />
               </div>

               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Loại câu</label>
                 <select className="w-full p-3 border rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editorForm.dangCau} onChange={e => setEditorForm({...editorForm, dangCau: e.target.value as DangCau})}>
                    <option value="TracNghiem">Trắc nghiệm</option><option value="TuLuan">Tự luận</option>
                 </select>
               </div>

               {editorForm.dangCau === 'TracNghiem' && (
                 <div className="grid grid-cols-2 gap-4">
                    {['A', 'B', 'C', 'D'].map(opt => (
                      <div key={opt}>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Đáp án {opt}</label>
                        <input className="w-full p-3 border rounded-xl font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                          value={editorForm.luaChon?.[opt as keyof typeof editorForm.luaChon] || ''} 
                          onChange={e => setEditorForm({
                            ...editorForm, 
                            luaChon: { ...editorForm.luaChon, [opt]: e.target.value }
                          })} 
                        />
                      </div>
                    ))}
                 </div>
               )}

               <div className="grid grid-cols-2 gap-6">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Đáp án đúng</label>
                   {editorForm.dangCau === 'TracNghiem' ? (
                     <select className="w-full p-3 border rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                       value={editorForm.dapAn} onChange={e => setEditorForm({...editorForm, dapAn: e.target.value})}>
                       <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                     </select>
                   ) : (
                     <textarea className="w-full p-3 border rounded-xl font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                       value={editorForm.dapAn} onChange={e => setEditorForm({...editorForm, dapAn: e.target.value})} />
                   )}
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Điểm số</label>
                    <input type="number" step="0.05" className="w-full p-3 border rounded-xl font-bold bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editorForm.diem} onChange={e => setEditorForm({...editorForm, diem: parseFloat(e.target.value)})} />
                 </div>
               </div>
               
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Lời giải chi tiết</label>
                 <textarea className="w-full p-4 border rounded-xl font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                   value={editorForm.giaiThichCham} onChange={e => setEditorForm({...editorForm, giaiThichCham: e.target.value})} placeholder="Hướng dẫn chấm..." />
               </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsEditorOpen(false)} className="px-6 py-3 text-slate-500 font-bold uppercase text-xs hover:bg-slate-200 rounded-xl transition-colors">Hủy bỏ</button>
              <button onClick={handleSaveQuestion} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2">
                <Save size={18} /> Lưu câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                 {uploadMode === 'generate' ? <><Sparkles className="text-indigo-500" /> Sinh câu hỏi STEM AI</> : <><FileUp className="text-emerald-500" /> Trích xuất tài liệu AI</>}
               </h2>
               <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div ref={previewContainerRef} className="flex-1 overflow-y-auto p-10 custom-scrollbar">
               {apiError && (
                 <div className="mb-8 p-6 bg-rose-50 border-2 border-rose-200 rounded-3xl flex flex-col items-center text-center">
                    <AlertTriangle className="text-rose-600 mb-3" size={40} />
                    <h3 className="font-black text-rose-900 uppercase text-sm mb-2">Lỗi kết nối Gemini API</h3>
                    <p className="text-rose-700 text-sm mb-6 max-w-md">{apiError}</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      <button 
                        onClick={handleOpenKeyDialog}
                        className="px-6 py-3 bg-rose-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-200 flex items-center gap-2 hover:bg-rose-700 transition-all"
                      >
                        <Key size={16} /> Cấu hình API Key (Paid)
                      </button>
                      <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all"
                      >
                        <ExternalLink size={16} /> Tài liệu Billing
                      </a>
                    </div>
                 </div>
               )}

               {isAIOperating ? (
                 <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <Loader2 className="animate-spin text-indigo-600" size={56} />
                    <p className="font-black text-slate-900 uppercase tracking-widest">AI đang xử lý dữ liệu...</p>
                    <p className="text-xs text-slate-500">Đang chuẩn hóa LaTeX & nhúng Figure STEM</p>
                 </div>
               ) : previewQuestions.length > 0 ? (
                 <div className="space-y-6">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl mb-6 text-xs text-blue-700 font-medium">
                      Kiểm tra lại nội dung và công thức trước khi lưu vào ngân hàng chính thức.
                    </div>
                    {previewQuestions.map((q, i) => (
                      <div key={i} className="p-8 bg-slate-50 border border-slate-200 rounded-[2rem] relative group hover:border-blue-300 transition-all">
                        <span className="absolute top-6 right-6 text-[10px] font-black uppercase bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">{q.mucDo || '??'}</span>
                        <div className="mb-6">
                           <div className="text-[10px] text-indigo-500 font-black uppercase mb-1">Nội dung câu hỏi:</div>
                           <ContentRenderer content={q.noiDung} className="font-bold text-slate-900 text-lg" />
                        </div>
                        {q.dangCau === 'TracNghiem' && q.luaChon && (
                          <div className="grid grid-cols-2 gap-4 mt-6">
                             {Object.entries(q.luaChon).map(([k, v]) => (
                               <div key={k} className="p-4 bg-white rounded-2xl border border-slate-200 flex gap-3 text-sm shadow-sm">
                                 <b className="text-indigo-600 text-md">{k}.</b> 
                                 <ContentRenderer content={v as string} />
                               </div>
                             ))}
                          </div>
                        )}
                        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between items-center">
                           <div className="text-[10px] font-bold text-slate-400">ĐÁP ÁN: <span className="text-emerald-600 ml-1">{q.dapAn}</span></div>
                           <button onClick={() => setPreviewQuestions(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 text-xs font-bold hover:underline">Loại bỏ câu này</button>
                        </div>
                      </div>
                    ))}
                 </div>
               ) : uploadMode === 'generate' ? (
                 <div className="max-w-xl mx-auto space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Môn học</label><input className="w-full p-4 border rounded-2xl font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" value={bulkConfig.subject} onChange={e => setBulkConfig({...bulkConfig, subject: e.target.value})} placeholder="Toán, Lý, Hóa..." /></div>
                       <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Lớp</label><select className="w-full p-4 border rounded-2xl font-bold bg-slate-50" value={bulkConfig.grade} onChange={e => setBulkConfig({...bulkConfig, grade: e.target.value})}>{[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>Lớp {i+1}</option>)}</select></div>
                    </div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Chủ đề chi tiết</label><input className="w-full p-4 border rounded-2xl font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none" value={bulkConfig.topic} onChange={e => setBulkConfig({...bulkConfig, topic: e.target.value})} placeholder="VD: Khảo sát hàm số, Phản ứng thế..." /></div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Mức độ</label><select className="w-full p-4 border rounded-2xl font-bold bg-slate-50" value={bulkConfig.level} onChange={e => setBulkConfig({...bulkConfig, level: e.target.value as MucDo})}><option value="NB">Nhận biết</option><option value="TH">Thông hiểu</option><option value="VD">Vận dụng</option><option value="VDC">Vận dụng cao</option></select></div>
                       <div><label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Số lượng</label><input type="number" className="w-full p-4 border rounded-2xl font-bold bg-slate-50" value={bulkConfig.count} onChange={e => setBulkConfig({...bulkConfig, count: parseInt(e.target.value)})} /></div>
                    </div>
                    <button onClick={handleBulkAIInvoke} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-sm tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all transform hover:-translate-y-1"><Zap size={20} /> Bắt đầu sinh câu hỏi</button>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <FileUp size={64} className="mb-4 opacity-20" />
                    <p className="font-bold">Hãy chọn tài liệu để AI bắt đầu trích xuất</p>
                 </div>
               )}
            </div>
            {previewQuestions.length > 0 && !isAIOperating && (
              <div className="p-8 border-t bg-slate-50 flex justify-between items-center">
                <div className="text-sm font-bold text-slate-500">Tìm thấy <span className="text-indigo-600">{previewQuestions.length}</span> câu hỏi sẵn sàng</div>
                <div className="flex gap-4">
                  <button onClick={() => setPreviewQuestions([])} className="px-8 py-3 text-slate-500 font-bold uppercase text-xs">Hủy bỏ</button>
                  <button onClick={savePreviewToBank} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Lưu vào ngân hàng</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
