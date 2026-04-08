import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

const SIZES = {
  xs: { d: 52, canvas: 36, label: 'XS' },
  sm: { d: 68, canvas: 48, label: 'S' },
  md: { d: 88, canvas: 64, label: 'M' },
} as const;

const WAVE_STYLES = {
  purple: {
    rec: (a: number) => `rgba(168,130,255,${0.6 + a * 0.4})`,
    recGlow: 'rgba(168,130,255,0.3)',
    idle: 'rgba(168,130,255,0.25)',
    dot: '#a882ff',
    label: 'Violet',
  },
  cyan: {
    rec: (a: number) => `rgba(34,211,238,${0.6 + a * 0.4})`,
    recGlow: 'rgba(34,211,238,0.3)',
    idle: 'rgba(34,211,238,0.25)',
    dot: '#22d3ee',
    label: 'Cyan',
  },
  green: {
    rec: (a: number) => `rgba(52,211,153,${0.6 + a * 0.4})`,
    recGlow: 'rgba(52,211,153,0.3)',
    idle: 'rgba(52,211,153,0.25)',
    dot: '#34d399',
    label: 'Vert',
  },
  rose: {
    rec: (a: number) => `rgba(251,113,133,${0.6 + a * 0.4})`,
    recGlow: 'rgba(251,113,133,0.3)',
    idle: 'rgba(251,113,133,0.25)',
    dot: '#fb7185',
    label: 'Rose',
  },
  white: {
    rec: (a: number) => `rgba(255,255,255,${0.6 + a * 0.4})`,
    recGlow: 'rgba(255,255,255,0.2)',
    idle: 'rgba(255,255,255,0.3)',
    dot: '#e4e4e7',
    label: 'Blanc',
  },
} as const;

type WaveStyle = keyof typeof WAVE_STYLES;
type Visualization = 'radial' | 'waveform' | 'oscillogram';

/* ===== VISUALIZATION 1: Radial Bars (Audio Visualizer) ===== */
function RadialViz({ audioLevel, isRecording, state, size, style }: {
  audioLevel: number; isRecording: boolean; state: string; size: number; style: WaveStyle;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const histRef = useRef<number[]>(new Array(32).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    const cx = size / 2, cy = size / 2, bars = 32;
    const colors = WAVE_STYLES[style];
    const innerR = size * 0.22, maxBarH = size * 0.24;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const hist = histRef.current;
      const t = Date.now();

      for (let i = 0; i < bars; i++) {
        const target = isRecording ? audioLevel * (0.3 + 0.7 * Math.sin(t / 140 + i * 0.35)) * (0.4 + 0.6 * Math.cos(t / 250 + i * 0.2)) : 0;
        hist[i] += (target - hist[i]) * 0.1;
      }

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const barH = Math.max(2, hist[i] * maxBarH);
        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * (innerR + barH);
        const y2 = cy + Math.sin(angle) * (innerR + barH);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, size * 0.03);

        if (state === 'recording') { ctx.strokeStyle = colors.rec(audioLevel); ctx.shadowColor = colors.recGlow; ctx.shadowBlur = 6; }
        else if (state === 'processing') { ctx.strokeStyle = 'rgba(251,191,36,0.6)'; ctx.shadowBlur = 0; }
        else { const p = 0.12 + 0.08 * Math.sin(t / 1200 + i * 0.15); ctx.strokeStyle = colors.idle.replace(/[\d.]+\)$/, `${p})`); ctx.shadowBlur = 0; }
        ctx.stroke(); ctx.shadowBlur = 0;
      }

      // Center dot
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, size * 0.04), 0, Math.PI * 2);
      ctx.fillStyle = state === 'recording' ? '#f87171' : state === 'processing' ? '#fbbf24' : colors.dot;
      if (state === 'recording') { ctx.shadowColor = 'rgba(248,113,113,0.5)'; ctx.shadowBlur = 8; }
      ctx.fill(); ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, isRecording, state, size, style]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

/* ===== VISUALIZATION 2: Waveform (Oscilloscope Line) ===== */
function WaveformViz({ audioLevel, isRecording, state, size, style }: {
  audioLevel: number; isRecording: boolean; state: string; size: number; style: WaveStyle;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const histRef = useRef<number[]>(new Array(64).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = 2;
    canvas.width = size * dpr; canvas.height = size * dpr; ctx.scale(dpr, dpr);

    let animId: number;
    const cx = size / 2, cy = size / 2;
    const colors = WAVE_STYLES[style];
    const pts = 64;
    const maxAmp = size * 0.35;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const hist = histRef.current;
      const t = Date.now();

      // Rolling waveform
      for (let i = pts - 1; i > 0; i--) hist[i] = hist[i - 1] * 0.92;
      hist[0] = isRecording ? audioLevel * (0.4 + 0.6 * Math.sin(t / 80)) : 0;

      // Draw bezier waveform line
      ctx.beginPath();
      for (let i = 0; i < pts; i++) {
        const x = (i / (pts - 1)) * size;
        const decay = 1 - (i / pts) * 0.6;
        const amp = hist[i] * maxAmp * decay;
        const y = cy + Math.sin(t / 200 + i * 0.25) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = ((i - 1) / (pts - 1)) * size;
          const prevAmp = hist[i - 1] * maxAmp * (1 - ((i - 1) / pts) * 0.6);
          const py = cy + Math.sin(t / 200 + (i - 1) * 0.25) * prevAmp;
          const cpx = (px + x) / 2;
          ctx.quadraticCurveTo(px, py, cpx, (py + y) / 2);
        }
      }

      if (state === 'recording') {
        ctx.strokeStyle = colors.rec(audioLevel); ctx.shadowColor = colors.recGlow; ctx.shadowBlur = 10; ctx.lineWidth = 2;
      } else if (state === 'processing') {
        ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.lineWidth = 1.5; ctx.shadowBlur = 0;
      } else {
        const p = 0.1 + 0.06 * Math.sin(t / 1500);
        ctx.strokeStyle = colors.idle.replace(/[\d.]+\)$/, `${p})`); ctx.lineWidth = 1; ctx.shadowBlur = 0;
      }
      ctx.stroke(); ctx.shadowBlur = 0;

      // Center dot
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, size * 0.04), 0, Math.PI * 2);
      ctx.fillStyle = state === 'recording' ? '#f87171' : state === 'processing' ? '#fbbf24' : colors.dot;
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, isRecording, state, size, style]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

/* ===== VISUALIZATION 3: Oscillogram (Classic Time-Domain) ===== */
function OscillogramViz({ audioLevel, isRecording, state, size, style }: {
  audioLevel: number; isRecording: boolean; state: string; size: number; style: WaveStyle;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<number[]>(new Array(48).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = 2;
    canvas.width = size * dpr; canvas.height = size * dpr; ctx.scale(dpr, dpr);

    let animId: number;
    const cx = size / 2, cy = size / 2;
    const colors = WAVE_STYLES[style];
    const maxAmp = size * 0.38;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const buf = bufferRef.current;
      const t = Date.now();

      // Shift buffer and push new sample
      for (let i = buf.length - 1; i > 0; i--) buf[i] = buf[i - 1];
      buf[0] = isRecording ? audioLevel * (0.5 + 0.5 * Math.sin(t / 100)) : 0;

      const n = buf.length;

      // Draw filled oscillogram (top half)
      ctx.beginPath();
      ctx.moveTo(0, cy);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * size;
        const y = cy - buf[i] * maxAmp;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const px = ((i - 1) / (n - 1)) * size;
          const cpx = (px + x) / 2;
          ctx.quadraticCurveTo(px, cy - buf[i - 1] * maxAmp, cpx, cy - (buf[i - 1] + buf[i]) / 2 * maxAmp);
        }
      }
      ctx.lineTo(size, cy);

      // Fill gradient
      const grad = ctx.createLinearGradient(0, cy - maxAmp, 0, cy);
      if (state === 'recording') {
        grad.addColorStop(0, colors.rec(audioLevel).replace(/[\d.]+\)$/, '0.25)'));
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = colors.rec(audioLevel); ctx.shadowColor = colors.recGlow; ctx.shadowBlur = 8;
      } else if (state === 'processing') {
        grad.addColorStop(0, 'rgba(251,191,36,0.15)'); grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = 'rgba(251,191,36,0.5)'; ctx.shadowBlur = 0;
      } else {
        grad.addColorStop(0, colors.idle.replace(/[\d.]+\)$/, '0.05)')); grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = colors.idle.replace(/[\d.]+\)$/, '0.1)'); ctx.shadowBlur = 0;
      }
      ctx.fillStyle = grad; ctx.fill();
      ctx.lineWidth = 1.5; ctx.stroke(); ctx.shadowBlur = 0;

      // Mirror (bottom half, subtler)
      ctx.beginPath();
      ctx.moveTo(0, cy);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * size;
        const y = cy + buf[i] * maxAmp * 0.5;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const px = ((i - 1) / (n - 1)) * size;
          ctx.quadraticCurveTo(px, cy + buf[i - 1] * maxAmp * 0.5, (px + x) / 2, cy + (buf[i - 1] + buf[i]) / 2 * maxAmp * 0.5);
        }
      }
      ctx.lineTo(size, cy);
      const grad2 = ctx.createLinearGradient(0, cy, 0, cy + maxAmp * 0.5);
      grad2.addColorStop(0, 'transparent');
      grad2.addColorStop(1, colors.idle.replace(/[\d.]+\)$/, '0.08)'));
      ctx.fillStyle = grad2; ctx.fill();
      ctx.strokeStyle = colors.idle.replace(/[\d.]+\)$/, '0.06)'); ctx.lineWidth = 1; ctx.stroke();

      // Center dot
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, size * 0.04), 0, Math.PI * 2);
      ctx.fillStyle = state === 'recording' ? '#f87171' : state === 'processing' ? '#fbbf24' : colors.dot;
      ctx.fill();

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, isRecording, state, size, style]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} />;
}

/* ===== Viz selector ===== */
const VIZ_COMPONENTS: Record<Visualization, typeof RadialViz> = {
  radial: RadialViz,
  waveform: WaveformViz,
  oscillogram: OscillogramViz,
};

const VIZ_LABELS: Record<Visualization, string> = {
  radial: 'Bars',
  waveform: 'Onde',
  oscillogram: 'Classic',
};

/* ===== Context Menu Button Helper ===== */
function MenuButton({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 600,
        border: 'none', cursor: 'pointer',
        background: active ? 'rgba(124,109,247,0.25)' : 'rgba(255,255,255,0.05)',
        color: active ? '#a78bfa' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(124,109,247,0.25)' : 'rgba(255,255,255,0.05)'; }}
    >{children}</button>
  );
}

/* ===== Compact Overlay ===== */
export function CompactOverlay() {
  const {
    recordingState, setRecordingState, setCompactMode,
    compactSize, setCompactSize, compactStyle, setCompactStyle,
    compactVisualization, setCompactVisualization,
    setCurrentText, setProcessedText, setLlmStreamText, selectedMode,
    selectedLanguage, targetLanguage,
    setRecordingStartTime, setLastTranscriptionMs,
  } = useStore();

  const { isRecording, audioLevel, startRecording, stopRecording } = useAudioRecorder();
  const toggleRef = useRef<(() => void) | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const sz = SIZES[compactSize];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleToggle = useCallback(async () => {
    if (recordingState === 'processing') return;
    if (isRecording) {
      setRecordingState('processing');
      const audioData = await stopRecording();
      if (audioData && window.voiceink) {
        try {
          const t0 = Date.now();
          const result = await window.voiceink.transcribe(audioData, selectedLanguage);
          setLastTranscriptionMs(Date.now() - t0);
          if (result?.text) {
            setCurrentText(result.text);
            const needsTranslation = targetLanguage && targetLanguage !== '' && targetLanguage !== selectedLanguage;
            const needsLLM = selectedMode !== 'raw';
            if (!needsTranslation && !needsLLM) {
              await window.voiceink.injectText(result.text);
            } else {
              setLlmStreamText('');
              const tLang = needsTranslation ? targetLanguage : undefined;
              window.voiceink.processText(result.text, selectedMode, tLang).then((p: any) => {
                if (p?.processed) { setProcessedText(p.processed); window.voiceink.injectText(p.processed).catch(() => {}); }
              }).catch(() => { window.voiceink.injectText(result.text).catch(() => {}); });
            }
          }
        } catch (err: any) { console.error('[Compact] Error:', err); }
      }
      setRecordingState('idle'); setRecordingStartTime(null);
    } else {
      setCurrentText(''); setProcessedText(''); setLlmStreamText('');
      setRecordingState('recording'); setRecordingStartTime(Date.now());
      await startRecording();
    }
  }, [isRecording, recordingState, startRecording, stopRecording, setRecordingState, setCurrentText, setProcessedText, selectedMode, setLlmStreamText, setRecordingStartTime, setLastTranscriptionMs, selectedLanguage, targetLanguage]);

  toggleRef.current = handleToggle;

  const handleExpand = useCallback(() => {
    setCompactMode(false);
    window.voiceink?.setCompactMode(false);
  }, [setCompactMode]);

  // Keyboard: Ctrl+Shift+Space = toggle, Escape = expand
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); toggleRef.current?.(); }
      if (e.key === 'Escape') { e.preventDefault(); handleExpand(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [handleExpand]);

  useEffect(() => {
    if (!window.voiceink?.onToggleRecording) return;
    return window.voiceink.onToggleRecording(() => toggleRef.current?.());
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMenu(!showMenu);
  };

  const changeSize = (s: 'xs' | 'sm' | 'md') => {
    setCompactSize(s);
    const d = SIZES[s].d + 16;
    window.voiceink?.setCompactMode(true, d, d);
    setShowMenu(false);
  };

  const borderColor = recordingState === 'recording'
    ? 'rgba(248,113,113,0.4)' : recordingState === 'processing'
    ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)';

  const boxShadow = recordingState === 'recording'
    ? '0 0 24px rgba(248,113,113,0.2), 0 4px 16px rgba(0,0,0,0.5)'
    : recordingState === 'processing'
    ? '0 0 16px rgba(251,191,36,0.12), 0 4px 16px rgba(0,0,0,0.5)'
    : '0 4px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)';

  const VizComponent = VIZ_COMPONENTS[compactVisualization];

  return (
    <div className="h-full w-full flex items-center justify-center relative" onContextMenu={handleContextMenu}>

      {/* DRAG HANDLE: invisible ring BEHIND the circle — this is what gets dragged */}
      <div className="titlebar-drag absolute" style={{
        width: sz.d + 14, height: sz.d + 14, borderRadius: '50%', cursor: 'grab',
      }} />

      {/* CIRCLE WIDGET: NOT draggable — clicks work normally */}
      <div
        className="flex items-center justify-center select-none relative"
        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleExpand(); }}
        style={{
          background: 'rgba(10,10,16,0.92)',
          borderRadius: '50%',
          border: `1px solid ${borderColor}`,
          boxShadow,
          width: sz.d, height: sz.d,
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <VizComponent audioLevel={audioLevel} isRecording={isRecording} state={recordingState} size={sz.canvas} style={compactStyle} />

        {/* EXPAND BUTTON: always visible, top-right corner */}
        <button
          onClick={(e) => { e.stopPropagation(); handleExpand(); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="titlebar-no-drag"
          style={{
            position: 'absolute', top: -4, right: -4,
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(139,92,246,0.35)',
            border: '1px solid rgba(139,92,246,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', opacity: 0.85,
            transition: 'opacity 0.15s, background 0.15s, transform 0.15s',
            zIndex: 10,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(139,92,246,0.6)'; e.currentTarget.style.transform = 'scale(1.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.background = 'rgba(139,92,246,0.35)'; e.currentTarget.style.transform = 'scale(1)'; }}
          title="Mode normal (Echap)"
        >
          <Maximize2 size={9} color="white" />
        </button>
      </div>

      {/* CONTEXT MENU */}
      {showMenu && (
        <div ref={menuRef} className="titlebar-no-drag absolute bottom-full mb-2 rounded-xl overflow-hidden animate-slide-up"
          style={{ background: 'rgba(16,16,24,0.96)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', minWidth: 170, zIndex: 100 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Expand */}
          <button onClick={() => { setShowMenu(false); handleExpand(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          ><Maximize2 size={12} /> Fenetre normale</button>

          {/* Visualization */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Visualisation</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['radial', 'waveform', 'oscillogram'] as const).map((v) => (
                <MenuButton key={v} active={compactVisualization === v} onClick={() => { setCompactVisualization(v); setShowMenu(false); }}>
                  {VIZ_LABELS[v]}
                </MenuButton>
              ))}
            </div>
          </div>

          {/* Size */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Taille</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['xs', 'sm', 'md'] as const).map((s) => (
                <MenuButton key={s} active={compactSize === s} onClick={() => changeSize(s)}>{SIZES[s].label}</MenuButton>
              ))}
            </div>
          </div>

          {/* Style */}
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6, fontWeight: 600 }}>Style</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(Object.entries(WAVE_STYLES) as [WaveStyle, typeof WAVE_STYLES[WaveStyle]][]).map(([key, val]) => (
                <button key={key} onClick={() => { setCompactStyle(key); setShowMenu(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer', background: compactStyle === key ? 'rgba(255,255,255,0.08)' : 'transparent', color: compactStyle === key ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.15s ease' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = compactStyle === key ? 'rgba(255,255,255,0.08)' : 'transparent'}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: val.dot, boxShadow: `0 0 6px ${val.dot}60` }} />
                  {val.label}
                  {compactStyle === key && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>&#10003;</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
