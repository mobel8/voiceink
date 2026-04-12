import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Loader2, Copy, ClipboardPaste,
  AlertCircle, Minimize2, ArrowRight, Check, Globe, Sparkles,
} from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useTranslation } from '../i18n/useTranslation';
import { SUPPORTED_LANGUAGES } from '../lib/constants';
import type { ProcessingMode } from '@shared/types';
import type { TranslationKey } from '../i18n/translations';

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

/* ─── Organic waveform orb ─── */
function WaveformOrb({
  audioLevel, isRecording, state,
}: { audioLevel: number; isRecording: boolean; state: string }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(new Array(96).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 240;
    const dpr  = window.devicePixelRatio || 2;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    const cx = size / 2, cy = size / 2;
    const baseRadius = 66, pts = 96;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const hist = historyRef.current;
      const t    = Date.now();

      for (let i = 0; i < pts; i++) {
        const target = isRecording
          ? audioLevel
            * (0.28 + 0.72 * Math.sin(t / 180 + i * 0.22))
            * (0.5  + 0.5  * Math.cos(t / 300 + i * 0.14))
          : 0;
        hist[i] += (target - hist[i]) * 0.068;
      }

      const points: [number, number][] = [];
      for (let i = 0; i < pts; i++) {
        const angle = (i / pts) * Math.PI * 2 - Math.PI / 2;
        const amp   = hist[i] * 26;
        const wobble = state === 'idle' ? Math.sin(t / 3200 + i * 0.12) * 0.55 : 0;
        const r = baseRadius + amp + wobble;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }

      ctx.beginPath();
      for (let i = 0; i < pts; i++) {
        const p0 = points[(i - 1 + pts) % pts];
        const p1 = points[i];
        const p2 = points[(i + 1) % pts];
        const p3 = points[(i + 2) % pts];
        if (i === 0) ctx.moveTo(p1[0], p1[1]);
        ctx.bezierCurveTo(
          p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
          p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
          p2[0], p2[1],
        );
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius + 28);
      if (state === 'recording') {
        grad.addColorStop(0, 'rgba(124,106,247,0.01)');
        grad.addColorStop(0.6, 'rgba(124,106,247,0.05)');
        grad.addColorStop(1, 'rgba(124,106,247,0.12)');
        ctx.strokeStyle = `rgba(124,106,247,${0.22 + audioLevel * 0.55})`;
        ctx.lineWidth   = 1.6;
        ctx.shadowColor = 'rgba(124,106,247,0.3)';
        ctx.shadowBlur  = 18;
      } else if (state === 'processing') {
        grad.addColorStop(0, 'rgba(251,191,36,0.01)');
        grad.addColorStop(1, 'rgba(251,191,36,0.06)');
        ctx.strokeStyle = 'rgba(251,191,36,0.28)';
        ctx.lineWidth   = 1.2;
      } else {
        grad.addColorStop(0, 'rgba(124,106,247,0.003)');
        grad.addColorStop(1, 'rgba(124,106,247,0.018)');
        ctx.strokeStyle = `rgba(124,106,247,${0.07 + 0.03 * Math.sin(t / 2200)})`;
        ctx.lineWidth   = 0.7;
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, isRecording, state]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: 240, height: 240 }}
    />
  );
}

/* ─── Language dropdown ─── */
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
        top: 'calc(100% + 6px)', right: 0,
        minWidth: 152, maxHeight: 220,
        overflowY: 'auto', borderRadius: 10,
      }}
    >
      {showDisable && (
        <>
          <button
            onClick={() => onSelect('')}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '6px 12px', fontSize: 11,
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
            display: 'flex', alignItems: 'center', gap: 6,
            width: '100%', textAlign: 'left',
            padding: '6px 12px', fontSize: 11,
            color: selected === lang.code ? 'var(--accent)' : 'var(--text-primary)',
            background: 'transparent',
            opacity: lang.code === disabledCode ? 0.25 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {selected === lang.code && <Check size={10} style={{ flexShrink: 0 }} />}
          <span style={{ marginLeft: selected === lang.code ? 0 : 16 }}>{lang.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Main View ─── */
export function MainView() {
  const {
    recordingState, setRecordingState,
    currentText, setCurrentText,
    processedText, setProcessedText,
    selectedMode, setSelectedMode,
    selectedLanguage, setSelectedLanguage,
    targetLanguage, setTargetLanguage,
    addToast,
    llmStreamText, setLlmStreamText, isLlmStreaming,
    setRecordingStartTime, setLastTranscriptionMs,
    setCompactMode, compactSize,
  } = useStore();
  const { t } = useTranslation();

  const { isRecording, audioLevel, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [showLangPicker,       setShowLangPicker]       = useState(false);
  const [showTargetLangPicker, setShowTargetLangPicker] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const toggleRef      = useRef<(() => void) | null>(null);
  const langRef        = useRef<HTMLDivElement>(null);
  const targetLangRef  = useRef<HTMLDivElement>(null);
  const resultsRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current       && !langRef.current.contains(e.target as Node))       setShowLangPicker(false);
      if (targetLangRef.current && !targetLangRef.current.contains(e.target as Node)) setShowTargetLangPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (resultsRef.current)
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
  }, [llmStreamText, currentText]);

  const handleToggleRecording = useCallback(async () => {
    if (recordingState === 'processing') return;
    try {
      if (isRecording) {
        setRecordingState('processing');
        const t0        = Date.now();
        const audioData = await stopRecording();
        if (audioData && window.voiceink) {
          try {
            const result = await window.voiceink.transcribe(audioData, selectedLanguage);
            setLastTranscriptionMs(Date.now() - t0);
            if (result?.text) {
              setCurrentText(result.text);
              const needsTranslation = targetLanguage && targetLanguage !== '' && targetLanguage !== selectedLanguage;
              const needsLLM         = selectedMode !== 'raw';
              if (!needsTranslation && !needsLLM) {
                window.voiceink.injectText(result.text).catch(() => {});
              } else {
                setLlmStreamText('');
                const tLang = needsTranslation ? targetLanguage : undefined;
                window.voiceink.processText(result.text, selectedMode, tLang).then((p: any) => {
                  if (p?.processed) {
                    setProcessedText(p.processed);
                    window.voiceink.injectText(p.processed).catch(() => {});
                  }
                }).catch(() => { window.voiceink.injectText(result.text).catch(() => {}); });
              }
            } else {
              setTranscriptionError(t('settings.downloadError'));
            }
          } catch (err: any) {
            setTranscriptionError(err?.message || t('file.error'));
          }
        }
        setRecordingState('idle');
        setRecordingStartTime(null);
      } else {
        setCurrentText(''); setProcessedText(''); setLlmStreamText('');
        setTranscriptionError(null);
        setRecordingState('recording');
        setRecordingStartTime(Date.now());
        await startRecording();
      }
    } catch (err: any) {
      setTranscriptionError(err?.message || t('file.error'));
      setRecordingState('idle');
      setRecordingStartTime(null);
    }
  }, [
    isRecording, recordingState, startRecording, stopRecording,
    setRecordingState, setCurrentText, setProcessedText, selectedMode,
    setLlmStreamText, setRecordingStartTime, setLastTranscriptionMs,
    selectedLanguage, targetLanguage, t,
  ]);

  toggleRef.current = handleToggleRecording;

  useEffect(() => {
    if (!window.voiceink?.onToggleRecording) return;
    return window.voiceink.onToggleRecording(() => toggleRef.current?.());
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation();
        toggleRef.current?.();
      }
      if (e.key === 'Escape') { setRecordingState('idle'); setRecordingStartTime(null); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [setRecordingState, setRecordingStartTime]);

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

  const handleCompact = () => {
    const boxMap = { xs: 104, sm: 134, md: 174 } as const;
    const d      = boxMap[compactSize];
    setCompactMode(true);
    window.voiceink?.setCompactMode(true, d, d);
  };

  const activeModeKey = MODE_KEYS.find((p) => p.mode === selectedMode);
  const activeModeName = activeModeKey ? t(activeModeKey.key) : '';
  const hasResults     = !!(currentText || llmStreamText || processedText);

  return (
    <div
      className="flex flex-col h-full animate-fade-in"
      style={{ background: 'var(--gradient-surface)' }}
    >

      {/* ── Top toolbar ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px 6px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        {/* Mode pills */}
        <div
          className="scrollbar-hide"
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            flex: 1, overflowX: 'auto', padding: '1px 0',
          }}
        >
          {MODE_KEYS.map(({ mode, key }) => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={`mode-pill ${selectedMode === mode ? 'active' : ''}`}
              style={{
                padding: '5px 11px', borderRadius: 8, fontSize: 11,
                whiteSpace: 'nowrap',
                color: selectedMode !== mode ? 'var(--text-muted)' : undefined,
              }}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {/* Controls: compact + language + translation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>

          {/* Source language */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => { setShowLangPicker(!showLangPicker); setShowTargetLangPicker(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 8px', borderRadius: 7,
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                background: showLangPicker ? 'var(--hover-bg)' : 'transparent',
                border: '1px solid transparent', cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              onMouseLeave={(e) => { if (!showLangPicker) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
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

          {/* Target translation */}
          <div className="relative" ref={targetLangRef}>
            <button
              onClick={() => { setShowTargetLangPicker(!showTargetLangPicker); setShowLangPicker(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 8px', borderRadius: 7,
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em',
                color:      targetLanguage ? 'var(--accent)'         : 'var(--text-muted)',
                background: targetLanguage ? 'var(--accent-subtle)'  : showTargetLangPicker ? 'var(--hover-bg)' : 'transparent',
                border: targetLanguage ? '1px solid var(--pill-active-border)' : '1px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!targetLanguage) { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
              onMouseLeave={(e) => { if (!targetLanguage && !showTargetLangPicker) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
            >
              <ArrowRight size={9} />
              {targetLanguage ? targetLanguage.toUpperCase() : '—'}
            </button>
            {showTargetLangPicker && (
              <LangDropdown
                languages={SUPPORTED_LANGUAGES}
                selected={targetLanguage}
                onSelect={(c) => { setTargetLanguage(c); setShowTargetLangPicker(false); }}
                showDisable
                disabledCode={selectedLanguage}
                disableLabel={t('common.cancel')}
              />
            )}
          </div>

          <div className="separator" style={{ height: 16 }} />

          <button
            onClick={handleCompact}
            className="icon-btn"
            title={t('panel.orb')}
            style={{ width: 28, height: 28, borderRadius: 7 }}
          >
            <Minimize2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Orb area ── */}
      <div
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', position: 'relative',
          flex: hasResults ? '0 0 auto' : 1,
          minHeight: hasResults ? 200 : undefined,
          paddingTop: hasResults ? 16 : 0,
          paddingBottom: hasResults ? 10 : 0,
        }}
      >
        {/* Background ambient glow */}
        <div className="orb-glow-bg" />

        <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WaveformOrb audioLevel={audioLevel} isRecording={isRecording} state={recordingState} />

          {/* Idle ambient rings */}
          {recordingState === 'idle' && (
            <>
              <div
                className="orb-ring absolute rounded-full"
                style={{ width: 158, height: 158, border: '1px solid rgba(139,120,255,0.08)' }}
              />
              <div
                className="orb-ring absolute rounded-full"
                style={{ width: 118, height: 118, border: '1px solid rgba(139,120,255,0.05)', animationDelay: '2.5s' }}
              />
            </>
          )}

          {/* Recording ripples */}
          {isRecording && (
            <>
              <div className="ripple-ring absolute" style={{ width: 80, height: 80, borderRadius: '50%', border: '1.5px solid rgba(139,120,255,0.3)' }} />
              <div className="ripple-ring absolute" style={{ width: 80, height: 80, borderRadius: '50%', border: '1px solid rgba(139,120,255,0.15)' }} />
              <div className="ripple-ring absolute" style={{ width: 80, height: 80, borderRadius: '50%', border: '1px solid rgba(139,120,255,0.06)' }} />
            </>
          )}

          {/* Mic button */}
          <button
            onClick={handleToggleRecording}
            disabled={recordingState === 'processing'}
            className={`relative z-10 flex items-center justify-center rounded-full transition-all duration-300 ${
              isRecording  ? 'recording-glow'
              : recordingState === 'processing' ? ''
              : 'mic-glow'
            }`}
            style={{
              width: 74, height: 74,
              background:
                isRecording              ? 'var(--gradient-mic-rec)'
                : recordingState === 'processing' ? 'var(--bg-elevated)'
                : 'var(--gradient-mic)',
              transform: isRecording ? 'scale(1.10)' : 'scale(1)',
              cursor: recordingState === 'processing' ? 'wait' : 'pointer',
              border: 'none',
              boxShadow: recordingState === 'processing'
                ? 'none'
                : isRecording
                ? '0 0 0 1px rgba(255,255,255,0.1) inset'
                : '0 0 0 1px rgba(255,255,255,0.15) inset',
            }}
          >
            {recordingState === 'processing' ? (
              <Loader2 size={22} className="spin-smooth" style={{ color: 'var(--accent-muted)' }} />
            ) : isRecording ? (
              <Square size={17} fill="white" style={{ color: 'white', opacity: 0.95 }} />
            ) : (
              <Mic size={22} style={{ color: 'white', opacity: 0.95 }} />
            )}
          </button>
        </div>

        {/* Hint below orb */}
        {recordingState === 'idle' && !hasResults && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <kbd
              style={{
                padding: '4px 10px', borderRadius: 7, fontSize: 10,
                fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontWeight: 500,
              }}
            >
              Ctrl + Shift + Space
            </kbd>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selectedMode !== 'raw' && (
                <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', opacity: 0.7, fontWeight: 500 }}>
                  <Sparkles size={9} /> {activeModeName}
                </span>
              )}
              {targetLanguage && (
                <span style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.65, fontWeight: 500 }}>
                  → {SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage)?.name}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {(recorderError || transcriptionError) && (
          <div
            className="animate-slide-up flex items-center gap-2"
            style={{
              margin: '12px 16px 0',
              padding: '9px 14px', borderRadius: 10,
              background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.14)',
              boxShadow: '0 2px 12px rgba(244,63,94,0.08)',
            }}
          >
            <AlertCircle size={13} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <p style={{ fontSize: 11.5, color: 'var(--danger)', lineHeight: 1.4 }}>
              {recorderError || transcriptionError}
            </p>
          </div>
        )}
      </div>

      {/* ── Results area ── */}
      {hasResults && (
        <div
          className="animate-slide-up"
          style={{ flex: 1, minHeight: 0, padding: '0 12px 12px' }}
        >
          <div
            className="result-card h-full flex flex-col"
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
                background: 'rgba(139,120,255,0.025)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: isLlmStreaming ? 'var(--warning)' : 'var(--accent)',
                  boxShadow: `0 0 6px ${isLlmStreaming ? 'var(--warning)' : 'var(--accent)'}`,
                  flexShrink: 0,
                  animation: isLlmStreaming ? 'mic-recording 1s ease-in-out infinite' : undefined,
                }} />
                <span className="label-xs">
                  {isLlmStreaming ? t('common.processing')
                    : currentText && !processedText && !llmStreamText ? t('common.transcription')
                    : t('common.result')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                <button
                  onClick={handleCopy}
                  className="icon-btn"
                  title={t('common.copy')}
                  style={{
                    width: 28, height: 28, borderRadius: 7,
                    color: copied ? 'var(--success)' : undefined,
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button
                  onClick={handleInject}
                  className="icon-btn"
                  title={t('common.injected')}
                  style={{ width: 28, height: 28, borderRadius: 7 }}
                >
                  <ClipboardPaste size={12} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              ref={resultsRef}
              style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}
            >
              {currentText && (
                <div style={{ marginBottom: (llmStreamText || processedText) ? 14 : 0 }}>
                  {(llmStreamText || processedText) && (
                    <p className="label-xs" style={{ marginBottom: 7 }}>
                      {t('common.original')}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 13, lineHeight: 1.85, whiteSpace: 'pre-wrap',
                      color: (llmStreamText || processedText) ? 'var(--text-muted)' : 'var(--text-primary)',
                      fontWeight: 400,
                    }}
                  >
                    {currentText}
                  </p>
                </div>
              )}
              {(llmStreamText || processedText) && (
                <div style={{
                  paddingTop: 14,
                  borderTop: '1px solid var(--border-subtle)',
                }}>
                  <p className="label-accent" style={{ marginBottom: 7 }}>
                    {targetLanguage ? `→ ${targetLanguage.toUpperCase()}` : activeModeName}
                  </p>
                  <p
                    className={isLlmStreaming ? 'streaming-cursor' : ''}
                    style={{ fontSize: 13.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontWeight: 400 }}
                  >
                    {processedText || llmStreamText}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
