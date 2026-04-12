import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mic, Square, Loader2, Copy, ClipboardPaste, Minimize2, X,
  Check, Globe, ArrowRight, Sparkles, MessageSquare,
  FileAudio, Clock, Settings, ArrowDownLeft,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useRecordingSession } from '../hooks/useRecordingSession';
import { useTranslation } from '../i18n/useTranslation';
import { SUPPORTED_LANGUAGES } from '../lib/constants';
import type { ProcessingMode } from '@shared/types';
import type { TranslationKey } from '../i18n/translations';
import { ChatView } from './ChatView';
import { FileView } from './FileView';
import { HistoryView } from './HistoryView';
import { SettingsView } from './SettingsView';

/* ─── Language dropdown (shared) ─── */
function LangDropdown({
  languages, selected, onSelect, showDisable, disabledCode, disableLabel,
}: {
  languages: typeof SUPPORTED_LANGUAGES;
  selected: string;
  onSelect: (code: string) => void;
  showDisable?: boolean;
  disabledCode?: string;
  disableLabel?: string;
}) {
  return (
    <div
      className="glass-card animate-scale-in absolute z-50 py-1"
      style={{
        top: 'calc(100% + 4px)', right: 0,
        minWidth: 140, maxHeight: 200,
        overflowY: 'auto', borderRadius: 10,
      }}
    >
      {showDisable && (
        <>
          <button
            onClick={() => onSelect('')}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '5px 10px', fontSize: 10.5,
              color: !selected ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {disableLabel || 'Disable'}
          </button>
          <div style={{ margin: '2px 8px', borderTop: '1px solid var(--border)' }} />
        </>
      )}
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onSelect(lang.code)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            width: '100%', textAlign: 'left',
            padding: '5px 10px', fontSize: 10.5,
            color: selected === lang.code ? 'var(--accent)' : 'var(--text-primary)',
            background: 'transparent',
            opacity: lang.code === disabledCode ? 0.25 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {selected === lang.code && <Check size={9} style={{ flexShrink: 0 }} />}
          <span style={{ marginLeft: selected === lang.code ? 0 : 13 }}>{lang.name}</span>
        </button>
      ))}
    </div>
  );
}

const MODE_KEYS: { mode: ProcessingMode; key: TranslationKey }[] = [
  { mode: 'raw',           key: 'mode.raw' },
  { mode: 'email',         key: 'mode.email' },
  { mode: 'short_message', key: 'mode.short_message' },
  { mode: 'meeting_notes', key: 'mode.meeting_notes' },
  { mode: 'summary',       key: 'mode.summary' },
  { mode: 'formal',        key: 'mode.formal' },
  { mode: 'simplified',    key: 'mode.simplified' },
  { mode: 'custom',        key: 'mode.custom' },
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

  const { t } = useTranslation();
  const { toggleRecording, isRecording, audioLevel, recordingState } = useRecordingSession();
  const [copied, setCopied] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showTargetLangPicker, setShowTargetLangPicker] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const targetLangRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const isRec  = recordingState === 'recording';
  const isProc = recordingState === 'processing';
  const hasResults = !!(currentText || llmStreamText || processedText);

  // Close lang dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangPicker(false);
      if (targetLangRef.current && !targetLangRef.current.contains(e.target as Node)) setShowTargetLangPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const TABS = [
    { id: 'main' as const,    Icon: Mic,           label: t('nav.diction') },
    { id: 'chat' as const,    Icon: MessageSquare,  label: t('nav.chat') },
    { id: 'file' as const,    Icon: FileAudio,      label: t('nav.file') },
    { id: 'history' as const, Icon: Clock,          label: t('nav.history') },
    { id: 'settings' as const, Icon: Settings,      label: t('nav.settings') },
  ];

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
      addToast({ type: 'success', message: t('common.copied') });
    }
  }, [processedText, llmStreamText, currentText, addToast, t]);

  const handleInject = useCallback(() => {
    const text = processedText || llmStreamText || currentText;
    if (text && window.voiceink) {
      window.voiceink.injectText(text);
      addToast({ type: 'success', message: t('common.injected') });
    }
  }, [processedText, llmStreamText, currentText, addToast, t]);

  const activeModeName = MODE_KEYS.find((p) => p.mode === selectedMode)?.key ? t(MODE_KEYS.find((p) => p.mode === selectedMode)!.key) : '';

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
            title={t('panel.backToOrb')}
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
            {t('panel.orb')}
          </button>
          <button
            onClick={() => window.voiceink?.quit()}
            className="icon-btn"
            style={{ width: 24, height: 20, borderRadius: 5 }}
            title={t('common.quit')}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; e.currentTarget.style.color = 'var(--recording)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}
          >
            <X size={10} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {currentView === 'main' ? (
          <>
            {/* Mode pills */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '6px 10px 2px', overflowX: 'auto', flexShrink: 0,
            }}>
              <div className="scrollbar-hide" style={{ display: 'flex', gap: 3 }}>
                {MODE_KEYS.map(({ mode, key }) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`mode-pill ${selectedMode === mode ? 'active' : ''}`}
                    style={{ padding: '4px 9px', borderRadius: 6, fontSize: 10, whiteSpace: 'nowrap', color: selectedMode !== mode ? 'var(--text-muted)' : undefined }}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>

            {/* Language row — compact inline */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '4px 10px 6px', flexShrink: 0,
            }}>
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => { setShowLangPicker(!showLangPicker); setShowTargetLangPicker(false); }}
                  className={`mode-pill ${showLangPicker ? 'active' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    color: 'var(--text-secondary)',
                    background: showLangPicker ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    border: `1px solid ${showLangPicker ? 'var(--pill-active-border)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  <Globe size={10} style={{ opacity: 0.6 }} />
                  {selectedLanguage.toUpperCase()}
                </button>
                {showLangPicker && (
                  <LangDropdown
                    languages={SUPPORTED_LANGUAGES}
                    selected={selectedLanguage}
                    onSelect={(c) => { setSelectedLanguage(c); setShowLangPicker(false); }}
                  />
                )}
              </div>

              <ArrowRight size={10} style={{ color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0 }} />

              <div className="relative" ref={targetLangRef}>
                <button
                  onClick={() => { setShowTargetLangPicker(!showTargetLangPicker); setShowLangPicker(false); }}
                  className={`mode-pill ${targetLanguage ? 'active' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    color: targetLanguage ? 'var(--accent)' : 'var(--text-muted)',
                    background: targetLanguage ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
                    border: `1px solid ${targetLanguage ? 'var(--pill-active-border)' : 'var(--border)'}`,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {targetLanguage ? targetLanguage.toUpperCase() : t('orb.translate')}
                </button>
                {showTargetLangPicker && (
                  <LangDropdown
                    languages={SUPPORTED_LANGUAGES}
                    selected={targetLanguage}
                    onSelect={(c) => { setTargetLanguage(c); setShowTargetLangPicker(false); }}
                    showDisable
                    disabledCode={selectedLanguage}
                    disableLabel={t('orb.translateNone')}
                  />
                )}
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
                  {targetLanguage && (
                    <span style={{ fontSize: 9, color: 'var(--accent)', opacity: 0.65, fontWeight: 500 }}>
                      → {SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.name}
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
                        {isLlmStreaming ? t('common.processing') : currentText && !processedText && !llmStreamText ? t('common.transcription') : t('common.result')}
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
                        {(llmStreamText || processedText) && <p className="label-xs" style={{ marginBottom: 5 }}>{t('common.original')}</p>}
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
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
