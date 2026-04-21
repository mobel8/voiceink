import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, Copy, Check, ClipboardPaste, AlertCircle, Zap, Key, ArrowRight, Languages, Globe } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { MODE_LABELS, SUPPORTED_LANGUAGES, TRANSLATE_TARGETS } from '../lib/constants';
import { Mode } from '../../shared/types';

export function MainView() {
  const {
    settings,
    setView,
    recState, setRecState,
    lastTranscript, setLastTranscript,
    lastLatencyMs, setLastLatencyMs,
    lastError, setLastError,
    audioLevel, setAudioLevel,
    loadHistory,
  } = useStore();
  const hasKey = !!settings.groqApiKey;

  const [copied, setCopied] = useState(false);

  const recorder = useAudioRecorder({
    onLevel: (rms) => setAudioLevel(rms),
    onStop: async (blob, mimeType) => {
      setRecState('processing');
      setAudioLevel(0);
      const t0 = Date.now();
      try {
        const audioBase64 = await blobToBase64(blob);
        const res = await window.voiceink.transcribe({
          audioBase64,
          mimeType,
          language: settings.language === 'auto' ? undefined : settings.language,
          translateTo: settings.translateTo || undefined,
          mode: settings.mode,
        });
        setLastLatencyMs(Date.now() - t0);
        if (!res.ok) {
          setLastError(res.error || 'Erreur inconnue');
          setRecState('error');
          return;
        }
        setLastTranscript(res.finalText);
        setRecState('idle');
        setLastError('');
        loadHistory();
        if (settings.autoInject && res.finalText) {
          await window.voiceink.injectText(res.finalText);
        }
      } catch (err: any) {
        setLastError(err?.message || String(err));
        setRecState('error');
      }
    },
    onError: (err) => {
      setLastError(err.message);
      setRecState('error');
    },
  });

  // Hold the latest recState in a ref so the IPC handler never reads a
  // stale value. Same fix as CompactView — without it, a shortcut press
  // arriving during the ~1-frame window between setRecState('recording')
  // and the effect's re-run would see the old 'idle' value and try to
  // start a second recorder on top of the first.
  const recStateRef = useRef(recState);
  recStateRef.current = recState;

  const toggle = async () => {
    const current = recStateRef.current;
    if (current === 'recording') {
      recorder.stop();
    } else if (current === 'idle' || current === 'error') {
      setLastError('');
      setLastTranscript('');
      setRecState('recording');
      await recorder.start();
    }
  };

  // Global toggle shortcut from main. Registered ONCE so there is never
  // a gap between unsubscribe-old and subscribe-new during rapid state
  // transitions; the toggle() above reads the ref, not the closure.
  useEffect(() => {
    const unsub = window.voiceink.onToggleRecording(() => toggle());
    return () => unsub?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: Space to toggle (when focused on main view, not in input).
  // Registered ONCE; recState reads go through recStateRef so there's
  // never a stale-closure window between React state commits and the
  // effect re-running (same contract as CompactView).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); toggle(); }
      if (e.code === 'Escape' && recStateRef.current === 'recording') { recorder.stop(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!lastTranscript) return;
    await window.voiceink.copyText(lastTranscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const inject = async () => {
    if (!lastTranscript) return;
    await window.voiceink.injectText(lastTranscript);
  };

  const bars = useWaveform(audioLevel, recState === 'recording');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            <span className="gradient-text">Dictée intelligente</span>
          </h1>
          <p className="text-white/50 text-xs mt-1">
            Parlez. On transcrit en un éclair.{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[10px] border border-white/10">Espace</kbd> pour démarrer / arrêter.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ModePicker />
          <LanguagePicker />
          <TranslatePicker />
        </div>
      </div>

      {/* Setup banner: no API key yet */}
      {!hasKey && (
        <div className="mx-6 mb-3 glass rounded-xl px-4 py-3 flex items-center gap-3 slide-up" style={{ borderColor: 'rgba(251,191,36,0.35)' }}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center shadow-lg shadow-amber-500/30 shrink-0">
            <Key size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Configurez votre clé Groq pour commencer</div>
            <div className="text-white/60 text-xs mt-0.5 truncate">
              Gratuite sur <a className="text-amber-300 hover:underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a>. Stockée localement.
            </div>
          </div>
          <button className="btn btn-primary !text-xs !py-1.5" onClick={() => setView('settings')}>
            Paramètres <ArrowRight size={12} />
          </button>
        </div>
      )}

      {/* Record area */}
      <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto] px-6 pb-5 gap-4">
        <div className="glass-strong rounded-2xl flex flex-col items-center justify-center p-6 relative overflow-hidden">
          {/* Ambient dots */}
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }} />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="relative">
              <div className={`record-halo ${recState === 'recording' ? 'recording' : ''}`} />
              <button
                className={`record-btn ${recState === 'recording' ? 'recording' : ''} ${recState === 'processing' ? 'processing' : ''}`}
                onClick={toggle}
                disabled={recState === 'processing'}
                title={recState === 'recording' ? 'Arrêter' : 'Démarrer'}
              >
                {recState === 'processing' && <Loader2 size={38} className="animate-spin" />}
                {recState === 'recording' && <Square size={34} fill="white" />}
                {(recState === 'idle' || recState === 'error') && <Mic size={40} />}
              </button>
            </div>

            <div className="text-center min-h-[44px]">
              {recState === 'idle' && (
                <>
                  <div className="text-base font-medium">Prêt à vous écouter</div>
                  <div className="text-white/40 text-xs mt-0.5">
                    Cliquez ou appuyez sur <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/70 text-[10px] border border-white/10 mx-1">Espace</kbd>
                    {settings.translateTo && (
                      <> · <Languages size={10} className="inline" /> Traduction: <span className="text-fuchsia-300">{TRANSLATE_TARGETS.find((t) => t.code === settings.translateTo)?.native}</span></>
                    )}
                  </div>
                </>
              )}
              {recState === 'recording' && (
                <>
                  <div className="text-base font-medium text-rose-300">Enregistrement…</div>
                  <div className="text-white/40 text-xs mt-0.5">Appuyez à nouveau pour arrêter</div>
                </>
              )}
              {recState === 'processing' && (
                <>
                  <div className="text-base font-medium text-cyan-300">Transcription en cours…</div>
                  <div className="text-white/40 text-xs mt-0.5">
                    Whisper Turbo sur Groq{settings.translateTo && <> + traduction</>}
                  </div>
                </>
              )}
              {recState === 'error' && (
                <>
                  <div className="text-base font-medium text-rose-300 flex items-center justify-center gap-1.5">
                    <AlertCircle size={14} /> Oups, une erreur
                  </div>
                  <div className="text-white/50 text-xs mt-0.5 max-w-md">{lastError}</div>
                </>
              )}
            </div>

            {/* Waveform — fluid width with a sensible max */}
            <div className="wave w-full max-w-[min(60vw,360px)]">
              {bars.map((h, i) => (
                <div key={i} className="bar" style={{ height: `${h}px`, opacity: recState === 'recording' ? 1 : 0.25 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Transcript panel */}
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="label">Dernière transcription</span>
              {lastLatencyMs > 0 && (
                <span className="badge badge-green">
                  <Zap size={9} /> {lastLatencyMs}ms
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button className="btn btn-ghost !text-xs !py-1" onClick={copy} disabled={!lastTranscript}>
                {copied ? <><Check size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
              </button>
              <button className="btn btn-ghost !text-xs !py-1" onClick={inject} disabled={!lastTranscript}>
                <ClipboardPaste size={12} /> Coller
              </button>
            </div>
          </div>
          <div
            className="min-h-[68px] max-h-40 overflow-auto text-white/90 text-sm leading-relaxed select-text whitespace-pre-wrap"
            style={{ userSelect: 'text' }}
          >
            {lastTranscript || <span className="text-white/30">Votre transcription apparaîtra ici…</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModePicker() {
  const { settings, updateSettings } = useStore();
  const active = settings.mode !== 'raw';
  const ModeIcon = MODE_LABELS[settings.mode].Icon;
  return (
    <label className={`picker-chip ${active ? 'is-active' : ''}`} title={MODE_LABELS[settings.mode].desc}>
      <ModeIcon size={12} className="picker-chip-icon" />
      <select
        value={settings.mode}
        onChange={(e) => updateSettings({ mode: e.target.value as Mode })}
      >
        {Object.entries(MODE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v.icon} {v.label}</option>
        ))}
      </select>
    </label>
  );
}

function LanguagePicker() {
  const { settings, updateSettings } = useStore();
  const active = settings.language !== 'auto';
  return (
    <label className={`picker-chip ${active ? 'is-active' : ''}`} title="Langue de dictée">
      <Globe size={12} className="picker-chip-icon" />
      <select
        value={settings.language}
        onChange={(e) => updateSettings({ language: e.target.value })}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
    </label>
  );
}

function TranslatePicker() {
  const { settings, updateSettings } = useStore();
  const active = !!settings.translateTo;
  return (
    <label className={`picker-chip ${active ? 'is-active' : ''}`} title="Traduire automatiquement la dictée">
      <Languages size={12} className="picker-chip-icon" />
      <select
        value={settings.translateTo}
        onChange={(e) => updateSettings({ translateTo: e.target.value })}
      >
        {TRANSLATE_TARGETS.map((t) => (
          <option key={t.code || 'none'} value={t.code}>
            {t.code ? `→ ${t.native}` : 'Pas de traduction'}
          </option>
        ))}
      </select>
    </label>
  );
}

function useWaveform(level: number, active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(() => new Array(48).fill(4));
  const levelRef = useRef(level);
  const activeRef = useRef(active);
  levelRef.current = level;
  activeRef.current = active;

  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) => {
        const next = prev.slice(1);
        const target = activeRef.current
          ? 6 + levelRef.current * 54 + Math.random() * 6
          : 4 + Math.random() * 2;
        next.push(target);
        return next;
      });
    }, 60);
    return () => clearInterval(id);
  }, []);
  return bars;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
