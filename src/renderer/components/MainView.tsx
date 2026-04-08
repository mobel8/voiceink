import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, Copy, ClipboardPaste, AlertCircle, Minimize2, ArrowRight, Check, Globe, Sparkles } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { SUPPORTED_LANGUAGES } from '../lib/constants';
import type { ProcessingMode } from '@shared/types';

const MODE_PILLS: { mode: ProcessingMode; label: string; icon?: string }[] = [
  { mode: 'raw', label: 'Brut' },
  { mode: 'email', label: 'Email' },
  { mode: 'short_message', label: 'Message' },
  { mode: 'meeting_notes', label: 'Notes' },
  { mode: 'summary', label: 'Resume' },
  { mode: 'formal', label: 'Formel' },
  { mode: 'simplified', label: 'Simple' },
  { mode: 'custom', label: 'Custom' },
];

/* ===== Organic Waveform Orb ===== */
function WaveformOrb({ audioLevel, isRecording, state }: { audioLevel: number; isRecording: boolean; state: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(new Array(96).fill(0));
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 260;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    const cx = size / 2;
    const cy = size / 2;
    const baseRadius = 72;
    const pts = 96;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const hist = historyRef.current;
      const t = Date.now();
      phaseRef.current += 0.008;

      // Update history — smooth interpolation toward target
      for (let i = 0; i < pts; i++) {
        const target = isRecording
          ? audioLevel * (0.3 + 0.7 * Math.sin(t / 180 + i * 0.22)) * (0.5 + 0.5 * Math.cos(t / 300 + i * 0.13))
          : 0;
        hist[i] += (target - hist[i]) * 0.065;
      }

      // Build organic waveform points
      const points: [number, number][] = [];
      for (let i = 0; i < pts; i++) {
        const angle = (i / pts) * Math.PI * 2 - Math.PI / 2;
        const amp = hist[i] * 28;
        // Add subtle organic wobble even when idle
        const idleWobble = state === 'idle' ? Math.sin(t / 3000 + i * 0.12) * 0.6 : 0;
        const r = baseRadius + amp + idleWobble;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }

      // Smooth cardinal spline path
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
          p2[0], p2[1]
        );
      }
      ctx.closePath();

      // Radial gradient fill
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius + 30);
      if (state === 'recording') {
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.01)');
        grad.addColorStop(0.6, 'rgba(139, 92, 246, 0.04)');
        grad.addColorStop(1, 'rgba(139, 92, 246, 0.1)');
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.2 + audioLevel * 0.6})`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(139, 92, 246, 0.25)';
        ctx.shadowBlur = 16;
      } else if (state === 'processing') {
        grad.addColorStop(0, 'rgba(251, 191, 36, 0.01)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0.05)');
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.lineWidth = 1.2;
      } else {
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.003)');
        grad.addColorStop(1, 'rgba(139, 92, 246, 0.015)');
        ctx.strokeStyle = `rgba(139, 92, 246, ${0.06 + 0.03 * Math.sin(t / 2000)})`;
        ctx.lineWidth = 0.6;
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

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: 260, height: 260 }} />;
}

/* ===== Language Dropdown ===== */
function LangDropdown({ languages, selected, onSelect, showDisable, disabledCode }: {
  languages: typeof SUPPORTED_LANGUAGES; selected: string; onSelect: (code: string) => void;
  showDisable?: boolean; disabledCode?: string;
}) {
  return (
    <div className="absolute top-full right-0 mt-1.5 rounded-xl z-50 max-h-56 overflow-y-auto min-w-[150px] py-1 glass-card animate-scale-in">
      {showDisable && (
        <>
          <button onClick={() => onSelect('')}
            className="w-full text-left px-3 py-1.5 text-[11px] transition-fast flex items-center gap-2"
            style={{ color: !selected ? 'var(--accent)' : 'var(--text-secondary)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {!selected && <Check size={10} />}
            <span>Desactiver</span>
          </button>
          <div className="mx-2 my-0.5" style={{ borderTop: '1px solid var(--border)' }} />
        </>
      )}
      {languages.map((lang) => (
        <button key={lang.code} onClick={() => onSelect(lang.code)}
          className="w-full text-left px-3 py-1.5 text-[11px] transition-fast flex items-center gap-2"
          style={{ color: selected === lang.code ? 'var(--accent)' : 'var(--text-primary)', opacity: lang.code === disabledCode ? 0.2 : 1 }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {selected === lang.code && <Check size={10} />}
          <span>{lang.name}</span>
        </button>
      ))}
    </div>
  );
}

/* ===== Main View ===== */
export function MainView() {
  const {
    recordingState, setRecordingState, currentText, setCurrentText,
    processedText, setProcessedText, selectedMode, setSelectedMode,
    selectedLanguage, setSelectedLanguage, targetLanguage, setTargetLanguage,
    addToast, llmStreamText, setLlmStreamText, isLlmStreaming,
    setRecordingStartTime, setLastTranscriptionMs, setCompactMode, compactSize,
  } = useStore();

  const { isRecording, audioLevel, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showTargetLangPicker, setShowTargetLangPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const toggleRef = useRef<(() => void) | null>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const targetLangRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangPicker(false);
      if (targetLangRef.current && !targetLangRef.current.contains(e.target as Node)) setShowTargetLangPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (resultsRef.current) resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
  }, [llmStreamText, currentText]);

  const handleToggleRecording = useCallback(async () => {
    if (recordingState === 'processing') return;
    try {
      if (isRecording) {
        setRecordingState('processing');
        const t0 = Date.now();
        const audioData = await stopRecording();
        if (audioData && window.voiceink) {
          try {
            const result = await window.voiceink.transcribe(audioData, selectedLanguage);
            setLastTranscriptionMs(Date.now() - t0);
            if (result?.text) {
              setCurrentText(result.text);
              const needsTranslation = targetLanguage && targetLanguage !== '' && targetLanguage !== selectedLanguage;
              const needsLLM = selectedMode !== 'raw';
              if (!needsTranslation && !needsLLM) {
                window.voiceink.injectText(result.text).catch(() => {});
              } else {
                setLlmStreamText('');
                const tLang = needsTranslation ? targetLanguage : undefined;
                window.voiceink.processText(result.text, selectedMode, tLang).then((p: any) => {
                  if (p?.processed) { setProcessedText(p.processed); window.voiceink.injectText(p.processed).catch(() => {}); }
                }).catch(() => { window.voiceink.injectText(result.text).catch(() => {}); });
              }
            } else {
              setTranscriptionError('Aucune parole detectee.');
            }
          } catch (err: any) {
            setTranscriptionError(err?.message || 'Erreur de transcription');
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
      setTranscriptionError(err?.message || "Erreur d'enregistrement");
      setRecordingState('idle'); setRecordingStartTime(null);
    }
  }, [isRecording, recordingState, startRecording, stopRecording, setRecordingState, setCurrentText, setProcessedText, selectedMode, setLlmStreamText, setRecordingStartTime, setLastTranscriptionMs, selectedLanguage, targetLanguage]);

  toggleRef.current = handleToggleRecording;

  useEffect(() => {
    if (!window.voiceink?.onToggleRecording) return;
    return window.voiceink.onToggleRecording(() => toggleRef.current?.());
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); toggleRef.current?.(); }
      if (e.key === 'Escape') { setRecordingState('idle'); setRecordingStartTime(null); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [setRecordingState, setRecordingStartTime]);

  const handleCopy = useCallback(() => {
    const text = processedText || llmStreamText || currentText;
    if (text) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); addToast({ type: 'success', message: 'Copie' }); }
  }, [processedText, llmStreamText, currentText, addToast]);

  const handleInject = useCallback(() => {
    const text = processedText || llmStreamText || currentText;
    if (text && window.voiceink) { window.voiceink.injectText(text); addToast({ type: 'success', message: 'Injecte' }); }
  }, [processedText, llmStreamText, currentText, addToast]);

  const langCode = selectedLanguage.toUpperCase();
  const hasResults = !!(currentText || llmStreamText || processedText);

  const handleCompact = () => {
    const szMap = { xs: 52, sm: 68, md: 88 } as const;
    const d = szMap[compactSize] + 16; // circle diameter + padding for shadow
    setCompactMode(true);
    window.voiceink?.setCompactMode(true, d, d);
  };

  const activeModeName = MODE_PILLS.find(p => p.mode === selectedMode)?.label || '';

  return (
    <div className="flex flex-col h-full animate-fade-in" style={{ background: 'var(--gradient-surface)' }}>

      {/* ===== Top Controls: Modes + Language + Compact ===== */}
      <div className="flex items-center gap-1 px-2.5 pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide py-0.5">
          {MODE_PILLS.map(({ mode, label }) => (
            <button key={mode} onClick={() => setSelectedMode(mode)}
              className={`mode-pill px-2 py-[5px] rounded-full text-[10px] whitespace-nowrap ${selectedMode === mode ? 'active' : ''}`}
              style={selectedMode !== mode ? { color: 'var(--text-muted)' } : undefined}
            >{label}</button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={handleCompact} className="p-1.5 rounded-lg transition-fast" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            title="Mode compact"
          ><Minimize2 size={12} /></button>

          <div className="relative" ref={langRef}>
            <button onClick={() => { setShowLangPicker(!showLangPicker); setShowTargetLangPicker(false); }}
              className="flex items-center gap-1 px-1.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-fast"
              style={{ color: 'var(--text-secondary)', background: showLangPicker ? 'var(--hover-bg)' : 'transparent' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
              onMouseLeave={(e) => { if (!showLangPicker) e.currentTarget.style.background = 'transparent'; }}
            ><Globe size={9} style={{ opacity: 0.4 }} />{langCode}</button>
            {showLangPicker && <LangDropdown languages={SUPPORTED_LANGUAGES} selected={selectedLanguage} onSelect={(c) => { setSelectedLanguage(c); setShowLangPicker(false); }} />}
          </div>

          <div className="relative" ref={targetLangRef}>
            <button onClick={() => { setShowTargetLangPicker(!showTargetLangPicker); setShowLangPicker(false); }}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-fast"
              style={{
                color: targetLanguage ? 'var(--accent)' : 'var(--text-muted)',
                background: targetLanguage ? 'var(--pill-active-bg)' : showTargetLangPicker ? 'var(--hover-bg)' : 'transparent',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = targetLanguage ? 'var(--pill-active-bg)' : 'var(--hover-bg)'}
              onMouseLeave={(e) => { if (!showTargetLangPicker) e.currentTarget.style.background = targetLanguage ? 'var(--pill-active-bg)' : 'transparent'; }}
              title="Traduction"
            ><ArrowRight size={8} />{targetLanguage ? targetLanguage.toUpperCase() : '---'}</button>
            {showTargetLangPicker && <LangDropdown languages={SUPPORTED_LANGUAGES} selected={targetLanguage} onSelect={(c) => { setTargetLanguage(c); setShowTargetLangPicker(false); }} showDisable disabledCode={selectedLanguage} />}
          </div>
        </div>
      </div>

      {/* ===== Central Recording Orb ===== */}
      <div className={`flex flex-col items-center justify-center relative ${hasResults ? '' : 'flex-1'}`}
        style={{ minHeight: hasResults ? 160 : undefined, paddingTop: hasResults ? 8 : 0, paddingBottom: hasResults ? 4 : 0 }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
          <WaveformOrb audioLevel={audioLevel} isRecording={isRecording} state={recordingState} />

          {/* Ambient ring */}
          {recordingState === 'idle' && (
            <div className="orb-ring absolute rounded-full" style={{
              width: 160, height: 160,
              border: '1px solid rgba(139, 92, 246, 0.08)',
            }} />
          )}

          {/* Ripple rings during recording */}
          {isRecording && (
            <>
              <div className="ripple-ring absolute w-20 h-20 rounded-full" style={{ border: '1px solid rgba(139, 92, 246, 0.22)' }} />
              <div className="ripple-ring absolute w-20 h-20 rounded-full" style={{ border: '1px solid rgba(139, 92, 246, 0.12)' }} />
              <div className="ripple-ring absolute w-20 h-20 rounded-full" style={{ border: '1px solid rgba(139, 92, 246, 0.06)' }} />
            </>
          )}

          {/* Mic Button */}
          <button onClick={handleToggleRecording} disabled={recordingState === 'processing'}
            className={`relative z-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording ? 'recording-glow' : recordingState === 'processing' ? '' : 'mic-glow'
            }`}
            style={{
              width: 72, height: 72,
              background: isRecording ? 'var(--gradient-mic-rec)' : recordingState === 'processing' ? 'var(--bg-tertiary)' : 'var(--gradient-mic)',
              transform: isRecording ? 'scale(1.06)' : 'scale(1)',
              cursor: recordingState === 'processing' ? 'wait' : 'pointer',
            }}
          >
            {recordingState === 'processing' ? (
              <Loader2 size={20} className="spin-smooth" style={{ color: 'var(--text-muted)' }} />
            ) : isRecording ? (
              <Square size={16} className="text-white" style={{ opacity: 0.95 }} />
            ) : (
              <Mic size={20} className="text-white" style={{ opacity: 0.95 }} />
            )}
          </button>
        </div>

        {/* Status hint below orb */}
        {recordingState === 'idle' && !hasResults && (
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <kbd className="px-2 py-0.5 rounded-md text-[9px] font-mono" style={{
              background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}>Ctrl+Shift+Space</kbd>
            {selectedMode !== 'raw' && (
              <p className="text-[9px] flex items-center gap-1" style={{ color: 'var(--accent)', opacity: 0.5 }}>
                <Sparkles size={8} /> {activeModeName}
              </p>
            )}
            {targetLanguage && (
              <p className="text-[9px]" style={{ color: 'var(--accent)', opacity: 0.5 }}>
                {'\u2192'} {SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name}
              </p>
            )}
          </div>
        )}

        {/* Error display */}
        {(recorderError || transcriptionError) && (
          <div className="flex items-center gap-2 px-3 py-2 mt-2 rounded-xl max-w-[280px] animate-slide-up"
            style={{ background: 'rgba(248, 113, 113, 0.06)', border: '1px solid rgba(248, 113, 113, 0.1)' }}
          >
            <AlertCircle size={12} style={{ color: 'var(--danger)' }} className="shrink-0" />
            <p className="text-[11px] leading-snug" style={{ color: 'var(--danger)' }}>{recorderError || transcriptionError}</p>
          </div>
        )}
      </div>

      {/* ===== Results Area ===== */}
      {hasResults && (
        <div className="flex-1 min-h-0 px-2.5 pb-2 animate-slide-up">
          <div className="result-card h-full flex flex-col rounded-2xl overflow-hidden">
            {/* Result header */}
            <div className="flex items-center justify-between px-3.5 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)' }}>
                {isLlmStreaming ? 'Traitement...' : currentText && !processedText && !llmStreamText ? 'Transcription' : 'Resultat'}
              </span>
              <div className="flex gap-0.5">
                <button onClick={handleCopy} className="p-1.5 rounded-lg transition-fast" title="Copier"
                  style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >{copied ? <Check size={11} /> : <Copy size={11} />}</button>
                <button onClick={handleInject} className="p-1.5 rounded-lg transition-fast" title="Coller"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                ><ClipboardPaste size={11} /></button>
              </div>
            </div>

            {/* Result content */}
            <div ref={resultsRef} className="flex-1 overflow-y-auto px-3.5 py-2.5 space-y-2">
              {currentText && (
                <div>
                  {(llmStreamText || processedText) && (
                    <p className="text-[8px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--text-muted)' }}>Original</p>
                  )}
                  <p className="text-[12.5px] leading-[1.75] whitespace-pre-wrap" style={{
                    color: (llmStreamText || processedText) ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontWeight: (llmStreamText || processedText) ? 400 : 420,
                  }}>{currentText}</p>
                </div>
              )}
              {(llmStreamText || processedText) && (
                <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <p className="text-[8px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--accent)' }}>
                    {targetLanguage ? `Traduction ${targetLanguage.toUpperCase()}` : activeModeName || 'Traite'}
                  </p>
                  <p className={`text-[12.5px] leading-[1.75] whitespace-pre-wrap ${isLlmStreaming ? 'streaming-cursor' : ''}`} style={{ color: 'var(--text-primary)', fontWeight: 420 }}>
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
