import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Square, Loader2, Copy, ClipboardPaste, Minimize2, X,
  Check, Globe, ArrowRight, Sparkles, MessageSquare,
  FileAudio, Clock, Settings, ArrowDownLeft,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useRecordingSession } from '../hooks/useRecordingSession';
import { SUPPORTED_LANGUAGES } from '../lib/constants';
import type { ProcessingMode } from '@shared/types';
import { ChatView } from './ChatView';
import { FileView } from './FileView';
import { HistoryView } from './HistoryView';
import { SettingsView } from './SettingsView';

const MODE_PILLS: { mode: ProcessingMode; label: string }[] = [
  { mode: 'raw',           label: 'Brut'    },
  { mode: 'email',         label: 'Email'   },
  { mode: 'short_message', label: 'Message' },
  { mode: 'meeting_notes', label: 'Notes'   },
  { mode: 'summary',       label: 'Résumé'  },
  { mode: 'formal',        label: 'Formel'  },
  { mode: 'simplified',    label: 'Simple'  },
  { mode: 'custom',        label: 'Custom'  },
];

const TABS = [
  { id: 'main' as const,    Icon: Mic,           label: 'Dictée'    },
  { id: 'chat' as const,    Icon: MessageSquare,  label: 'Chat'      },
  { id: 'file' as const,    Icon: FileAudio,      label: 'Fichier'   },
  { id: 'history' as const, Icon: Clock,          label: 'Historique' },
  { id: 'settings' as const, Icon: Settings,      label: 'Paramètres' },
];

export function PanelView() {
  const {
    currentView, setView, setPanelExpanded,
    selectedMode, setSelectedMode,
    selectedLanguage, setSelectedLanguage,
    targetLanguage, setTargetLanguage,
    currentText, processedText, llmStreamText, isLlmStreaming,
    addToast,
  } = useStore();

  const { toggleRecording, isRecording, audioLevel, recordingState } = useRecordingSession();
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const isRec  = recordingState === 'recording';
  const isProc = recordingState === 'processing';
  const hasResults = !!(currentText || llmStreamText || processedText);

  useEffect(() => {
    if (resultsRef.current) resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
  }, [llmStreamText, currentText]);

  const handleCollapse = useCallback(() => {
    setPanelExpanded(false);
    window.voiceink?.setCompactMode(true, 90, 90);
  }, [setPanelExpanded]);

  const handleCopy = useCallback(() => {
    const text = processedText || llmStreamText || currentText;
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      addToast({ type: 'success', message: 'Copié' });
    }
  }, [processedText, llmStreamText, currentText, addToast]);

  const handleInject = useCallback(() => {
    const text = processedText || llmStreamText || currentText;
    if (text && window.voiceink) {
      window.voiceink.injectText(text);
      addToast({ type: 'success', message: 'Injecté' });
    }
  }, [processedText, llmStreamText, currentText, addToast]);

  const activeModeName = MODE_PILLS.find((p) => p.mode === selectedMode)?.label ?? '';

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="titlebar-drag flex items-center justify-between select-none"
        style={{ height: 28, padding: '0 8px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 14, height: 14, borderRadius: 4,
            background: 'var(--gradient-mic)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>VoiceInk</span>
          {isRec && (
            <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--recording)', animation: 'mic-recording 1.3s ease-in-out infinite' }}>
              ● REC
            </span>
          )}
        </div>
        <div className="titlebar-no-drag flex items-center" style={{ gap: 3 }}>
          <button
            onClick={handleCollapse}
            title="Retour à l'orbe"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6,
              fontSize: 9.5, fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <ArrowDownLeft size={9} strokeWidth={2} />
            Orbe
          </button>
          <button
            onClick={() => window.voiceink?.quit()}
            className="icon-btn"
            style={{ width: 24, height: 20, borderRadius: 5 }}
            title="Quitter"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; e.currentTarget.style.color = 'var(--recording)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}
          >
            <X size={10} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column' }}>
        {currentView === 'main' ? (
          <>
            {/* Mode pills */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '6px 10px 4px', overflowX: 'auto', flexShrink: 0,
            }}>
              <div className="scrollbar-hide" style={{ display: 'flex', gap: 3 }}>
                {MODE_PILLS.map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`mode-pill ${selectedMode === mode ? 'active' : ''}`}
                    style={{ padding: '4px 9px', borderRadius: 6, fontSize: 10, whiteSpace: 'nowrap', color: selectedMode !== mode ? 'var(--text-muted)' : undefined }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mini orb */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: hasResults ? '0 0 auto' : 1,
              minHeight: hasResults ? 120 : undefined,
              paddingTop: hasResults ? 12 : 0, paddingBottom: hasResults ? 6 : 0,
            }}>
              <button
                onClick={toggleRecording}
                disabled={isProc}
                className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${isRec ? 'recording-glow' : isProc ? '' : 'mic-glow'}`}
                style={{
                  width: 56, height: 56,
                  background: isRec ? 'var(--gradient-mic-rec)' : isProc ? 'var(--bg-elevated)' : 'var(--gradient-mic)',
                  transform: isRec ? 'scale(1.08)' : 'scale(1)',
                  cursor: isProc ? 'wait' : 'pointer',
                  border: 'none',
                  boxShadow: isProc ? 'none' : '0 0 0 1px rgba(255,255,255,0.12) inset',
                }}
              >
                {isProc ? (
                  <Loader2 size={18} className="spin-smooth" style={{ color: 'var(--accent-muted)' }} />
                ) : isRec ? (
                  <Square size={14} fill="white" style={{ color: 'white', opacity: 0.95 }} />
                ) : (
                  <Mic size={18} style={{ color: 'white', opacity: 0.95 }} />
                )}
              </button>

              {!isRec && !isProc && !hasResults && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <kbd style={{
                    padding: '3px 8px', borderRadius: 5, fontSize: 9,
                    fontFamily: 'ui-monospace, monospace',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}>
                    Ctrl+Shift+Space
                  </kbd>
                  {selectedMode !== 'raw' && (
                    <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--accent)', opacity: 0.7 }}>
                      <Sparkles size={8} /> {activeModeName}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Results */}
            {hasResults && (
              <div className="animate-slide-up" style={{ flex: 1, minHeight: 0, padding: '0 10px 8px' }}>
                <div className="result-card" style={{ borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
                    background: 'rgba(139,120,255,0.025)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: isLlmStreaming ? 'var(--warning)' : 'var(--accent)',
                        boxShadow: `0 0 5px ${isLlmStreaming ? 'var(--warning)' : 'var(--accent)'}`,
                        animation: isLlmStreaming ? 'mic-recording 1s ease-in-out infinite' : undefined,
                      }} />
                      <span className="label-xs">
                        {isLlmStreaming ? 'Traitement…' : currentText && !processedText && !llmStreamText ? 'Transcription' : 'Résultat'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <button onClick={handleCopy} className="icon-btn" style={{ width: 24, height: 24, borderRadius: 6, color: copied ? 'var(--success)' : undefined }}>
                        {copied ? <Check size={10} /> : <Copy size={10} />}
                      </button>
                      <button onClick={handleInject} className="icon-btn" style={{ width: 24, height: 24, borderRadius: 6 }}>
                        <ClipboardPaste size={10} />
                      </button>
                    </div>
                  </div>
                  <div ref={resultsRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
                    {currentText && (
                      <div style={{ marginBottom: (llmStreamText || processedText) ? 10 : 0 }}>
                        {(llmStreamText || processedText) && <p className="label-xs" style={{ marginBottom: 5 }}>Original</p>}
                        <p style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: (llmStreamText || processedText) ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {currentText}
                        </p>
                      </div>
                    )}
                    {(llmStreamText || processedText) && (
                      <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                        <p className="label-accent" style={{ marginBottom: 5 }}>
                          {targetLanguage ? `→ ${targetLanguage.toUpperCase()}` : activeModeName}
                        </p>
                        <p className={isLlmStreaming ? 'streaming-cursor' : ''} style={{ fontSize: 12.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                          {processedText || llmStreamText}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {currentView === 'chat' && <ChatView />}
            {currentView === 'file' && <FileView />}
            {currentView === 'history' && <HistoryView />}
            {currentView === 'settings' && <SettingsView />}
          </div>
        )}
      </div>

      {/* Bottom tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        height: 38, padding: '0 4px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        {TABS.map(({ id, Icon, label }) => {
          const isActive = currentView === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              title={label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '3px 6px', borderRadius: 6,
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                border: '1px solid', borderColor: isActive ? 'var(--pill-active-border)' : 'transparent',
                cursor: 'pointer', transition: 'all 0.15s ease', minWidth: 40,
              }}
            >
              <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
              <span style={{ fontSize: 8, fontWeight: 500 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
