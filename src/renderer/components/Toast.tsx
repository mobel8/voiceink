import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useStore } from '../stores/useStore';

export function ToastContainer() {
  const { toasts, removeToast } = useStore();

  return (
    <div className="fixed bottom-12 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

function ToastItem({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle size={14} className="text-green-400 shrink-0" />,
    error: <AlertCircle size={14} className="text-red-400 shrink-0" />,
    info: <Info size={14} className="text-blue-400 shrink-0" />,
  };

  const borders = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30',
  };

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg glass-card border ${borders[toast.type]} animate-slide-up min-w-[200px] max-w-[320px]`}
      role="alert"
    >
      {icons[toast.type]}
      <span className="text-xs text-[var(--text-primary)] flex-1">{toast.message}</span>
      <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] shrink-0">
        <X size={12} />
      </button>
    </div>
  );
}
