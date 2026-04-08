import React from 'react';
import { Minus, X } from 'lucide-react';
import { useStore } from '../stores/useStore';

export function TitleBar() {
  const { recordingState } = useStore();

  return (
    <div className="titlebar-drag flex items-center justify-between h-7 px-3 select-none shrink-0"
      style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-1.5">
        <div className={`w-[5px] h-[5px] rounded-full transition-all duration-300 ${recordingState === 'recording' ? 'animate-pulse' : ''}`}
          style={{
            background: recordingState === 'recording' ? 'var(--recording)' : recordingState === 'processing' ? 'var(--processing)' : 'var(--accent)',
            boxShadow: recordingState === 'recording' ? '0 0 8px var(--recording)' : recordingState === 'processing' ? '0 0 6px var(--processing)' : 'none',
          }}
        />
        <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          VoiceInk
          {recordingState === 'recording' && <span style={{ color: 'var(--recording)', fontWeight: 600 }}> — REC</span>}
          {recordingState === 'processing' && <span style={{ color: 'var(--processing)' }}> — ...</span>}
        </span>
      </div>
      <div className="titlebar-no-drag flex items-center -mr-1">
        <button onClick={() => window.voiceink?.minimize()}
          className="w-7 h-5 flex items-center justify-center rounded transition-fast"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        ><Minus size={10} /></button>
        <button onClick={() => window.voiceink?.quit()}
          className="w-7 h-5 flex items-center justify-center rounded transition-fast"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)'; e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        ><X size={10} /></button>
      </div>
    </div>
  );
}
