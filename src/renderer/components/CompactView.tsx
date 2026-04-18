import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2, AlertCircle, Check, Maximize2 } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

/**
 * Compact pill widget — Superwhisper-style floating badge.
 *
 * The window is 176x52, transparent, frameless, always-on-top, skipTaskbar.
 * The whole pill body is a drag handle (`-webkit-app-region: drag`); only
 * the mic button and expand icon are `no-drag` so they can receive clicks.
 *
 * Right-click anywhere on the pill opens a native context menu (agrandir,
 * paramètres, masquer, quitter) via IPC.
 *
 * Visual states:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ idle + not hovered  → very small black oval (Superwhisper-style)│
 *   │ idle + hovered      → full pill, violet accent, "Parler"        │
 *   │ recording           → full pill, red glow, live mini waveform   │
 *   │ processing          → full pill, cyan glow, "Transcription…"    │
 *   │ done (brief flash)  → full pill, green "Injecté"                │
 *   │ error               → full pill, amber warning + message        │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * The pill expands/collapses smoothly via CSS transitions on its width,
 * height, padding, background and shadow (see `.pill` / `.pill-root.is-*`
 * in `index.css`). React just toggles the two top-level classes and swaps
 * the inner face via opacity.
 */
export function CompactView() {
  const {
    settings,
    recState, setRecState,
    lastTranscript, setLastTranscript,
    lastLatencyMs, setLastLatencyMs,
    lastError, setLastError,
    audioLevel, setAudioLevel,
    loadHistory,
  } = useStore();

  const [justDone, setJustDone] = useState(false);
  const [hovered, setHovered] = useState(false);

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
        // Flash "done" state briefly before returning to idle label.
        setJustDone(true);
        setTimeout(() => setJustDone(false), 1500);
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

  const toggle = async () => {
    if (recState === 'recording') { recorder.stop(); return; }
    if (recState === 'processing') return;
    setLastError('');
    setRecState('recording');
    await recorder.start();
  };

  // Global shortcut forwarded from main.
  useEffect(() => {
    const unsub = window.voiceink.onToggleRecording(() => toggle());
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState, settings]);

  // Keyboard shortcuts when the pill is focused:
  //   Space  → toggle
  //   Esc    → stop if recording
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); toggle(); }
      if (e.code === 'Escape' && recState === 'recording') recorder.stop();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState]);

  const expand = async () => {
    await window.voiceink.windowResizeForDensity?.('comfortable');
  };

  const openContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.voiceink.showWidgetContextMenu?.();
  };

  const bars = useMiniWaveform(audioLevel, recState === 'recording');

  // Superwhisper-style collapse: tiny dark pill when truly idle and not
  // being hovered. Any activity (recording / processing / error / done
  // flash) OR a hover forces the full UI so the user always sees context.
  const isIdle = recState === 'idle' && !justDone;
  const isExpanded = !isIdle || hovered;

  return (
    <div
      className={`pill-root state-${recState} ${justDone ? 'done-flash' : ''} ${isExpanded ? 'is-expanded' : 'is-idle'}`}
      onContextMenu={openContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="pill">
        {/*
          Idle (collapsed) face — a small black dot-pill. Clicking it starts
          recording. The whole area is `no-drag` so the click reaches us.
        */}
        <button
          type="button"
          className="pill-idle-face no-drag"
          onClick={toggle}
          onDoubleClick={expand}
          aria-hidden={isExpanded}
          tabIndex={isExpanded ? -1 : 0}
          title="Démarrer (Espace) · Double-clic = agrandir"
        >
          <span className="pill-idle-dot" />
        </button>

        {/* Full face — expanded UI with mic button + body + expand. */}
        <div className="pill-full" aria-hidden={!isExpanded}>
          <button
            className="pill-mic no-drag"
            onClick={toggle}
            onDoubleClick={expand}
            disabled={recState === 'processing'}
            tabIndex={isExpanded ? 0 : -1}
            title={
              recState === 'recording' ? 'Arrêter (Espace)' :
              recState === 'processing' ? 'Transcription en cours…' :
              'Démarrer (Espace) · Double-clic = agrandir'
            }
          >
            {recState === 'processing' ? <Loader2 size={15} className="animate-spin" /> :
             recState === 'recording'  ? <Square size={11} fill="currentColor" /> :
             recState === 'error'      ? <AlertCircle size={14} /> :
             justDone                  ? <Check size={14} /> :
                                         <Mic size={14} />}
          </button>

          <div className="pill-body">
            {recState === 'recording' ? (
              <div className="pill-wave">
                {bars.map((h, i) => (
                  <span key={i} className="pill-wave-bar" style={{ height: `${h}px` }} />
                ))}
              </div>
            ) : recState === 'processing' ? (
              <span className="pill-label pill-label-cyan">Transcription…</span>
            ) : recState === 'error' ? (
              <span className="pill-label pill-label-amber" title={lastError}>
                {lastError?.slice(0, 28) || 'Erreur'}
              </span>
            ) : justDone ? (
              <span className="pill-label pill-label-green">
                Injecté{lastLatencyMs > 0 ? ` · ${Math.round(lastLatencyMs)}ms` : ''}
              </span>
            ) : lastTranscript ? (
              <span className="pill-label pill-label-faded" title={lastTranscript}>
                {lastTranscript.slice(0, 24)}{lastTranscript.length > 24 ? '…' : ''}
              </span>
            ) : (
              <span className="pill-label">Parler</span>
            )}
          </div>

          <button
            className="pill-expand no-drag"
            onClick={expand}
            tabIndex={isExpanded ? 0 : -1}
            title="Mode confortable"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Short waveform for the pill (12 bars, tiny amplitude).
function useMiniWaveform(level: number, active: boolean): number[] {
  const [bars, setBars] = useState<number[]>(() => new Array(12).fill(3));
  const levelRef = useRef(level);
  const activeRef = useRef(active);
  levelRef.current = level;
  activeRef.current = active;
  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) => {
        const next = prev.slice(1);
        const v = activeRef.current ? 3 + levelRef.current * 14 + Math.random() * 2 : 3;
        next.push(v);
        return next;
      });
    }, 70);
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
