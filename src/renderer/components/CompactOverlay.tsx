import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

/* ─────────────────────────────────────────────────────────────
   Sizes — the "d" is the orb diameter in px.
   The window box is padded extra so the glow can spill out.
   ───────────────────────────────────────────────────────────── */
const SIZES = {
  xs: { d: 48, label: 'XS' },
  sm: { d: 62, label: 'S'  },
  md: { d: 80, label: 'M'  },
} as const;

export function CompactOverlay() {
  const {
    recordingState, setRecordingState, setCompactMode,
    compactSize, setCompactSize,
    setCurrentText, setProcessedText, setLlmStreamText,
    selectedMode, selectedLanguage, targetLanguage,
    setRecordingStartTime, setLastTranscriptionMs,
  } = useStore();

  const { isRecording, audioLevel, startRecording, stopRecording } = useAudioRecorder();
  const toggleRef = useRef<(() => void) | null>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [hovered,  setHovered]  = useState(false);

  const sz     = SIZES[compactSize];
  const isRec  = recordingState === 'recording';
  const isProc = recordingState === 'processing';

  /* ── Close menu on outside click ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── Toggle recording ── */
  const handleToggle = useCallback(async () => {
    if (recordingState === 'processing') return;
    if (isRecording) {
      setRecordingState('processing');
      const audioData = await stopRecording();
      if (audioData && window.voiceink) {
        try {
          const t0     = Date.now();
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
              window.voiceink.processText(result.text, selectedMode, tLang)
                .then((p: any) => {
                  if (p?.processed) { setProcessedText(p.processed); window.voiceink.injectText(p.processed).catch(() => {}); }
                })
                .catch(() => { window.voiceink.injectText(result.text).catch(() => {}); });
            }
          }
        } catch (err) { console.error('[Compact]', err); }
      }
      setRecordingState('idle');
      setRecordingStartTime(null);
    } else {
      setCurrentText(''); setProcessedText(''); setLlmStreamText('');
      setRecordingState('recording');
      setRecordingStartTime(Date.now());
      await startRecording();
    }
  }, [
    isRecording, recordingState, startRecording, stopRecording,
    setRecordingState, setCurrentText, setProcessedText, selectedMode,
    setLlmStreamText, setRecordingStartTime, setLastTranscriptionMs,
    selectedLanguage, targetLanguage,
  ]);

  toggleRef.current = handleToggle;

  const handleExpand = useCallback(() => {
    setCompactMode(false);
    window.voiceink?.setCompactMode(false);
  }, [setCompactMode]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); toggleRef.current?.(); }
      if (e.key === 'Escape') { e.preventDefault(); handleExpand(); }
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [handleExpand]);

  useEffect(() => {
    if (!window.voiceink?.onToggleRecording) return;
    return window.voiceink.onToggleRecording(() => toggleRef.current?.());
  }, []);

  const changeSize = (s: 'xs' | 'sm' | 'md') => {
    setCompactSize(s);
    // Give the window extra headroom for the glow to spill beyond the orb
    const box = SIZES[s].d + 52;
    window.voiceink?.setCompactMode(true, box, box);
    setShowMenu(false);
  };

  /* ──────────────────────────────────────────────────────────
     Dynamic visuals — colors & intensity driven by state
     ────────────────────────────────────────────────────────── */
  // Smoothed audio level (clamped 0..1)
  const lvl = Math.max(0, Math.min(1, audioLevel));

  // Core accent colors per state
  const tone = isRec
    ? { r: 244, g: 63,  b: 94  }   // rose
    : isProc
    ? { r: 251, g: 191, b: 36  }   // amber
    : { r: 139, g: 120, b: 255 };  // violet
  const rgb  = `${tone.r},${tone.g},${tone.b}`;
  const rgbL = `${Math.min(255, tone.r + 30)},${Math.min(255, tone.g + 40)},${Math.min(255, tone.b + 30)}`;

  // Orb scales with mic input while recording
  const scale = isRec ? 1 + lvl * 0.18 : 1;

  // Glow strength
  const glowA = isRec ? 0.55 + lvl * 0.35 : isProc ? 0.45 : 0.38;
  const glowR = isRec ? 32  + lvl * 28   : isProc ? 26   : 22;

  /* ── Pure radial-gradient core (NO container, NO border) ── */
  const coreBg = `
    radial-gradient(circle at 38% 32%,
      rgba(255,255,255,0.92) 0%,
      rgba(${rgbL},0.85) 14%,
      rgba(${rgb},0.78) 38%,
      rgba(${rgb},0.42) 62%,
      rgba(${rgb},0.12) 82%,
      transparent 100%)
  `;

  /* ── Ambient halo — huge soft blur far behind the orb ── */
  const haloBg = `
    radial-gradient(circle at center,
      rgba(${rgb},${0.32 + lvl * 0.18}) 0%,
      rgba(${rgb},${0.14 + lvl * 0.10}) 30%,
      rgba(${rgb},0.04) 55%,
      transparent 75%)
  `;

  return (
    <div
      className="h-full w-full flex items-center justify-center relative"
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
      style={{ background: 'transparent' }}
    >
      {/* ── Invisible drag handle covering the whole window ── */}
      <div
        className="titlebar-drag absolute inset-0"
        style={{ cursor: 'grab' }}
      />

      {/* ── Ambient halo (huge soft glow far behind the orb) ── */}
      <div
        className="pointer-events-none absolute"
        style={{
          width:  sz.d * 3.4,
          height: sz.d * 3.4,
          borderRadius: '50%',
          background: haloBg,
          filter: 'blur(22px)',
          animation: isRec
            ? 'compact-halo 1.2s ease-in-out infinite'
            : 'compact-halo 3.8s ease-in-out infinite',
          transition: 'background 0.6s ease',
        }}
      />

      {/* ── Ripple rings (expand outwards) ── */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: sz.d, height: sz.d, borderRadius: '50%',
          border: `1px solid rgba(${rgb},${isRec ? 0.55 : 0.18})`,
          animation: isRec
            ? 'compact-ripple-rec 1.4s cubic-bezier(0,0.4,0.6,1) infinite'
            : 'compact-ripple-idle 3.6s cubic-bezier(0,0.4,0.6,1) infinite',
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          width: sz.d, height: sz.d, borderRadius: '50%',
          border: `1px solid rgba(${rgb},${isRec ? 0.35 : 0.10})`,
          animation: isRec
            ? 'compact-ripple-rec 1.4s cubic-bezier(0,0.4,0.6,1) infinite 0.6s'
            : 'compact-ripple-idle 3.6s cubic-bezier(0,0.4,0.6,1) infinite 1.6s',
        }}
      />

      {/* ──────────────────────────────────────────────────────
          The Orb itself — a pure radial-gradient sphere,
          NO border, NO solid background, just light.
          ────────────────────────────────────────────────────── */}
      <div
        className="titlebar-no-drag relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); handleExpand(); }}
        style={{
          width:  sz.d,
          height: sz.d,
          borderRadius: '50%',
          background: coreBg,
          filter: `
            drop-shadow(0 0 ${glowR}px rgba(${rgb},${glowA}))
            drop-shadow(0 0 ${glowR * 2}px rgba(${rgb},${glowA * 0.4}))
            drop-shadow(0 3px 8px rgba(0,0,0,0.3))
          `,
          transform: `scale(${scale})`,
          transition: isRec
            ? 'transform 0.05s linear, background 0.25s ease, filter 0.15s ease'
            : 'transform 0.35s cubic-bezier(0.16,1,0.3,1), background 0.5s ease, filter 0.35s ease',
          animation: !isRec && !isProc
            ? 'compact-breathe 4.2s ease-in-out infinite'
            : undefined,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {/* Processing arc — thin spinning C-shape overlay */}
        {isProc && (
          <div
            style={{
              position: 'absolute', inset: '18%',
              borderRadius: '50%',
              border: '1.5px solid transparent',
              borderTopColor:   `rgba(${rgb},0.95)`,
              borderRightColor: `rgba(${rgb},0.25)`,
              animation: 'compact-orbit 0.85s linear infinite',
            }}
          />
        )}

        {/* ── Expand button — surfaces on hover, floats off the orb ── */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handleExpand(); }}
          title="Mode normal (Échap)"
          style={{
            position: 'absolute', top: -2, right: -2,
            width: 17, height: 17, borderRadius: '50%',
            background: 'rgba(12,12,28,0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            opacity:    hovered ? 1 : 0,
            transform:  hovered ? 'scale(1)' : 'scale(0.7)',
            transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.16,1,0.3,1), background 0.15s',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            zIndex: 20,
            padding: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background  = 'rgba(139,120,255,0.28)';
            e.currentTarget.style.borderColor = 'rgba(139,120,255,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background  = 'rgba(12,12,28,0.88)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
          }}
        >
          <Maximize2 size={8} color="rgba(230,220,255,0.95)" strokeWidth={2.4} />
        </button>
      </div>

      {/* ── Context menu (right-click) ── */}
      {showMenu && (
        <div
          ref={menuRef}
          className="titlebar-no-drag absolute animate-scale-in"
          style={{
            top: '100%',
            marginTop: 8,
            background:            'rgba(8,8,22,0.96)',
            backdropFilter:        'blur(48px) saturate(1.6)',
            WebkitBackdropFilter:  'blur(48px) saturate(1.6)',
            border:                '1px solid rgba(255,255,255,0.09)',
            borderRadius: 13,
            boxShadow:   '0 20px 60px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
            minWidth: 158, zIndex: 100, overflow: 'hidden', padding: '5px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Expand */}
          <button
            onClick={() => { setShowMenu(false); handleExpand(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              width: '100%', padding: '9px 14px',
              fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
              border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.82)',
              cursor: 'pointer', transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Maximize2 size={12} />
            Mode normal
            <span style={{
              marginLeft: 'auto', fontSize: 9, fontFamily: 'ui-monospace, monospace',
              padding: '1px 5px', borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
            }}>Échap</span>
          </button>

          {/* Separator */}
          <div style={{ height: 1, margin: '3px 10px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Size selector */}
          <div style={{ padding: '8px 12px 10px' }}>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase', letterSpacing: '0.12em',
              fontWeight: 700, marginBottom: 7,
            }}>
              Taille
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['xs', 'sm', 'md'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => changeSize(s)}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 7,
                    fontSize: 10.5, fontWeight: 700,
                    border: 'none', cursor: 'pointer', letterSpacing: '0.02em',
                    background: compactSize === s ? 'rgba(139,120,255,0.2)' : 'rgba(255,255,255,0.045)',
                    color:      compactSize === s ? '#b8a8ff'                : 'rgba(255,255,255,0.38)',
                    transition: 'all 0.13s ease',
                  }}
                  onMouseEnter={(e) => { if (compactSize !== s) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = compactSize === s ? 'rgba(139,120,255,0.2)' : 'rgba(255,255,255,0.045)'; }}
                >
                  {SIZES[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
