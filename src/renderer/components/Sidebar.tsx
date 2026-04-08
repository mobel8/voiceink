import React from 'react';
import { Mic, Settings, Clock, FileAudio, MessageSquare } from 'lucide-react';
import { useStore } from '../stores/useStore';

const navItems = [
  { id: 'main' as const, icon: Mic, label: 'Dictee' },
  { id: 'chat' as const, icon: MessageSquare, label: 'Chat IA' },
  { id: 'file' as const, icon: FileAudio, label: 'Fichier' },
  { id: 'history' as const, icon: Clock, label: 'Historique' },
];

export function Sidebar() {
  const { currentView, setView, recordingState } = useStore();

  const renderBtn = (id: string, Icon: any, label: string, isActive: boolean) => (
    <button
      key={id}
      onClick={() => setView(id as any)}
      className="group relative w-8 h-8 rounded-xl flex items-center justify-center transition-smooth"
      style={{
        background: isActive ? 'var(--accent-subtle)' : 'transparent',
        color: isActive ? 'var(--accent)' : 'var(--text-muted)',
      }}
      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--hover-bg)'; }}}
      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}}
    >
      <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-r"
          style={{ height: 10, background: 'var(--accent)', boxShadow: '0 0 6px var(--accent-glow)' }}
        />
      )}
      {id === 'main' && recordingState === 'recording' && (
        <div className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] rounded-full animate-pulse"
          style={{ background: 'var(--recording)', boxShadow: '0 0 6px var(--recording)' }}
        />
      )}
      <div className="tooltip-animate absolute left-full ml-2.5 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 glass-card"
        style={{ color: 'var(--text-primary)' }}
      >{label}</div>
    </button>
  );

  return (
    <nav className="w-10 flex flex-col items-center py-2.5 gap-0.5 shrink-0"
      style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }}
    >
      {navItems.map(({ id, icon, label }) => renderBtn(id, icon, label, currentView === id))}
      <div className="mt-auto">
        <div className="mb-1 mx-auto" style={{ width: 10, height: 1, background: 'var(--border)', opacity: 0.6 }} />
        {renderBtn('settings', Settings, 'Parametres', currentView === 'settings')}
      </div>
    </nav>
  );
}
