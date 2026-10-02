
import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64: string) => void;
  title: string;
}

const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture, title }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        onCapture(base64);
        onClose();
      }
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col relative">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center">
              <Camera size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{title}</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Căn chỉnh tài liệu vào khung hình</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          {error ? (
            <div className="text-center p-8 text-white">
              <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
              <p className="font-bold mb-4">{error}</p>
              <button onClick={startCamera} className="px-6 py-2 bg-white text-slate-900 rounded-xl font-bold flex items-center gap-2 mx-auto">
                <RefreshCw size={18} /> Thử lại
              </button>
            </div>
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              {/* Overlay khung quét */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[80%] h-[70%] border-2 border-white/50 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
              </div>
            </>
          )}
        </div>

        <div className="p-8 flex justify-center bg-slate-50">
          <button 
            onClick={handleCapture}
            disabled={!stream || isCapturing}
            className="w-20 h-20 bg-white border-8 border-indigo-600 rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white">
              <Check size={28} strokeWidth={3} />
            </div>
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CameraModal;
