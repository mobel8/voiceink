import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useStore } from '../stores/useStore';

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

const CONFIG = {
  success: { Icon: CheckCircle2, color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.2)'  },
  error:   { Icon: XCircle,      color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.2)' },
  info:    { Icon: Info,         color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.2)'  },
};

function ToastItem({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, toast.duration ?? 3200);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  const { Icon, color, bg, border } = CONFIG[toast.type];

  return (
    <div
      className="animate-slide-up"
      role="alert"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px 8px 10px',
        borderRadius: 10,
        background: 'var(--bg-elevated)',
        border: `1px solid ${border}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${border}`,
        backdropFilter: 'blur(20px)',
        minWidth: 200, maxWidth: 300,
        pointerEvents: 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: color, borderRadius: '10px 0 0 10px',
      }} />

      <div style={{ marginLeft: 4, flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>

      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>
        {toast.message}
      </span>

      <button
        onClick={onClose}
        className="icon-btn"
        style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0 }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useStore();
  return (
    <div
      style={{
        position: 'fixed', bottom: 34, right: 12,
        display: 'flex', flexDirection: 'column', gap: 6,
        pointerEvents: 'none', zIndex: 9999,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
