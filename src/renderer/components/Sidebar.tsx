import React from 'react';
import { Mic, Settings, Clock, FileAudio, MessageSquare } from 'lucide-react';
import { useStore } from '../stores/useStore';

const NAV = [
  { id: 'main'     as const, Icon: Mic,           label: 'Dictée'      },
  { id: 'chat'     as const, Icon: MessageSquare,  label: 'Chat IA'     },
  { id: 'file'     as const, Icon: FileAudio,      label: 'Fichier'     },
  { id: 'history'  as const, Icon: Clock,          label: 'Historique'  },
];

export function Sidebar() {
  const { currentView, setView, recordingState } = useStore();

  const renderBtn = (
    id: string,
    Icon: React.ElementType,
    label: string,
    isActive: boolean,
  ) => (
    <button
      key={id}
      onClick={() => setView(id as any)}
      title={label}
      className="group relative flex items-center justify-center transition-smooth"
      style={{
        width: 40, height: 40,
        borderRadius: 11,
        background:   isActive ? 'var(--accent-subtle)' : 'transparent',
        color:        isActive ? 'var(--accent)'        : 'var(--text-muted)',
        border:       isActive ? '1px solid var(--pill-active-border)' : '1px solid transparent',
        boxShadow:    isActive ? '0 0 16px rgba(139,120,255,0.12)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--hover-bg)';
          e.currentTarget.style.color      = 'var(--text-secondary)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color      = 'var(--text-muted)';
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
    >
      <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />

      {/* Active accent bar */}
      {isActive && (
        <div
          style={{
            position: 'absolute', left: -1, top: '50%', transform: 'translateY(-50%)',
            width: 2.5, height: 18, borderRadius: '0 3px 3px 0',
            background: 'var(--accent)',
            boxShadow: '0 0 10px var(--accent-glow)',
          }}
        />
      )}

      {/* Recording dot */}
      {id === 'main' && recordingState === 'recording' && (
        <div
          style={{
            position: 'absolute', top: 5, right: 5,
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--recording)',
            boxShadow: '0 0 8px var(--recording)',
            animation: 'mic-recording 1.3s ease-in-out infinite',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="tooltip-animate pointer-events-none absolute left-full z-50 opacity-0 group-hover:opacity-100"
        style={{ marginLeft: 10 }}
      >
        <div
          className="glass-card"
          style={{
            padding: '5px 10px', borderRadius: 8,
            fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
            color: 'var(--text-primary)', letterSpacing: '-0.01em',
          }}
        >
          {label}
        </div>
      </div>
    </button>
  );

  return (
    <nav
      style={{
        width: 56,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0',
        gap: 3,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      {NAV.map(({ id, Icon, label }) =>
        renderBtn(id, Icon, label, currentView === id),
      )}

      {/* Spacer + separator */}
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: 22, height: 1, marginBottom: 4,
          background: 'var(--border)', borderRadius: 1,
        }}
      />
      {renderBtn('settings', Settings, 'Paramètres', currentView === 'settings')}
    </nav>
  );
}
