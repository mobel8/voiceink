import React from 'react';
import { Minus, X } from 'lucide-react';
import { useStore } from '../stores/useStore';

export function TitleBar() {
  const { recordingState } = useStore();

  const isRecording  = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';

  return (
    <div
      className="titlebar-drag flex items-center justify-between select-none shrink-0"
      style={{
        height: 40,
        padding: '0 10px 0 14px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        {/* Logo mark */}
        <div
          style={{
            width: 20, height: 20, borderRadius: 6,
            background: isRecording
              ? 'var(--gradient-mic-rec)'
              : 'var(--gradient-mic)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.5s ease',
            flexShrink: 0,
            boxShadow: isRecording
              ? '0 0 12px rgba(244,63,94,0.4)'
              : '0 0 12px rgba(139,120,255,0.3)',
          }}
        >
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)',
            boxShadow: '0 0 5px rgba(255,255,255,0.5)',
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--text-secondary)',
              transition: 'color 0.3s ease',
            }}
          >
            VoiceInk
          </span>
          {isRecording && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--recording)',
              animation: 'mic-recording 1.3s ease-in-out infinite',
            }}>
              ● Rec
            </span>
          )}
          {isProcessing && (
            <span style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em',
              color: 'var(--processing)', opacity: 0.9,
            }}>
              ···
            </span>
          )}
        </div>
      </div>

      {/* Window controls */}
      <div className="titlebar-no-drag flex items-center" style={{ gap: 2 }}>
        <button
          onClick={() => window.voiceink?.minimize()}
          className="icon-btn"
          style={{ width: 28, height: 24, borderRadius: 6 }}
          title="Réduire"
        >
          <Minus size={11} strokeWidth={2} />
        </button>
        <button
          onClick={() => window.voiceink?.quit()}
          className="icon-btn"
          style={{ width: 28, height: 24, borderRadius: 6 }}
          title="Quitter"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(244,63,94,0.1)';
            e.currentTarget.style.color = 'var(--recording)';
            e.currentTarget.style.borderColor = 'rgba(244,63,94,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '';
            e.currentTarget.style.color = '';
            e.currentTarget.style.borderColor = '';
          }}
        >
          <X size={11} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
