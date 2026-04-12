import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Settings, Mic, Square, X, Loader2, ChevronRight, ArrowUpRight, GripHorizontal } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { useRecordingSession } from '../hooks/useRecordingSession';
import { useTranslation } from '../i18n/useTranslation';
import { SUPPORTED_LANGUAGES } from '../lib/constants';
import type { ProcessingMode } from '@shared/types';
import type { TranslationKey } from '../i18n/translations';

const ORB = { d: 48, box: 90 };
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function CompactOverlay() {
  const {
    setPanelExpanded,
    setSelectedMode, selectedMode, selectedLanguage, setSelectedLanguage,
    targetLanguage, setTargetLanguage,
    resultBubble, setResultBubble,
  } = useStore();
  const { t } = useTranslation();

  const { toggleRecording, isRecording, audioLevel, recordingState: recState } = useRecordingSession();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuSection, setMenuSection] = useState<'main' | 'mode' | 'lang' | 'translate'>('main');
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);

  const MODE_PILLS: { mode: ProcessingMode; key: TranslationKey }[] = [
    { mode: 'raw',           key: 'mode.raw' },
    { mode: 'email',         key: 'mode.email' },
    { mode: 'short_message', key: 'mode.short_message' },
    { mode: 'meeting_notes', key: 'mode.meeting_notes' },
    { mode: 'summary',       key: 'mode.summary' },
    { mode: 'formal',        key: 'mode.formal' },
    { mode: 'simplified',    key: 'mode.simplified' },
    { mode: 'custom',        key: 'mode.custom' },
  ];

  const isRec  = recState === 'recording';
  const isProc = recState === 'processing';

  // Auto-fade result bubble
  useEffect(() => {
    if (!resultBubble) return;
    const tm = setTimeout(() => setResultBubble(null), 3000);
    return () => clearTimeout(tm);
  }, [resultBubble, setResultBubble]);

  // Close menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleExpand = useCallback(() => {
    setPanelExpanded(true);
    window.voiceink?.setCompactMode(false, 320, 420);
  }, [setPanelExpanded]);

  // Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (showMenu) setShowMenu(false); }
    };
    document.addEventListener('keydown', h, true);
    return () => document.removeEventListener('keydown', h, true);
  }, [showMenu]);

  const lvl = Math.max(0, Math.min(1, audioLevel));
  const tone = isRec
    ? { r: 244, g: 63,  b: 94  }
    : isProc
    ? { r: 251, g: 191, b: 36  }
    : { r: 139, g: 120, b: 255 };
  const rgb  = `${tone.r},${tone.g},${tone.b}`;
  const rgbL = `${Math.min(255, tone.r + 30)},${Math.min(255, tone.g + 40)},${Math.min(255, tone.b + 30)}`;

  const scale = isRec ? 1 + lvl * 0.18 : 1;
  const glowA = isRec ? 0.55 + lvl * 0.35 : isProc ? 0.45 : 0.38;
  const glowR = isRec ? 32  + lvl * 28   : isProc ? 26   : 22;

  const coreBg = `
    radial-gradient(circle at 38% 32%,
      rgba(255,255,255,0.92) 0%,
      rgba(${rgbL},0.85) 14%,
      rgba(${rgb},0.78) 38%,
      rgba(${rgb},0.42) 62%,
      rgba(${rgb},0.12) 82%,
      transparent 100%)
  `;

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
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(!showMenu); setMenuSection('main'); }}
      onMouseDown={(e) => {
        mouseDownPos.current = { x: e.screenX, y: e.screenY };
        isDragging.current = false;
      }}
      onMouseMove={(e) => {
        if (mouseDownPos.current) {
          const dx = e.screenX - mouseDownPos.current.x;
          const dy = e.screenY - mouseDownPos.current.y;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            isDragging.current = true;
          }
        }
      }}
      onMouseUp={(e) => {
        if (mouseDownPos.current && !isDragging.current) {
          toggleRecording();
        }
        mouseDownPos.current = null;
        isDragging.current = false;
      }}
      style={{ background: 'transparent', cursor: 'grab' }}
    >
      {/* Entire window is a drag region */}
      <div className="titlebar-drag absolute inset-0" />

      {/* Result bubble */}
      {resultBubble && (
        <div
          className="result-bubble glass-card"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: 180,
            maxWidth: 260,
            padding: '8px 12px',
            borderRadius: 10,
            zIndex: 200,
          }}
        >
          <div style={{
            fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--accent)', opacity: 0.7,
            marginBottom: 4,
          }}>
            {resultBubble.mode}
          </div>
          <div style={{
            fontSize: 11.5, lineHeight: 1.5, color: 'var(--text-primary)',
            maxHeight: 80, overflow: 'hidden', wordBreak: 'break-word',
          }}>
            {resultBubble.text.length > 140 ? resultBubble.text.substring(0, 140) + '…' : resultBubble.text}
          </div>
        </div>
      )}

      {/* Ambient halo */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: ORB.box * 0.92, height: ORB.box * 0.92,
          borderRadius: '50%', background: haloBg,
          filter: 'blur(18px)', willChange: 'transform, opacity',
          animation: isRec ? 'compact-halo 1.3s ease-in-out infinite' : 'compact-halo 4.2s ease-in-out infinite',
          transition: `background 0.8s ${EASE}`,
        }}
      />

      {/* Ripple rings */}
      <div
        className="pointer-events-none absolute"
        style={{
          width: ORB.d, height: ORB.d, borderRadius: '50%',
          border: `1px solid rgba(${rgb},${isRec ? 0.55 : 0.2})`,
          animation: isRec
            ? 'compact-ripple-rec 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite'
            : 'compact-ripple-idle 4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        }}
      />

      {/* Expand button */}
      <button
        className="titlebar-no-drag"
        onMouseDown={(e) => { e.stopPropagation(); mouseDownPos.current = null; }}
        onClick={(e) => { e.stopPropagation(); handleExpand(); }}
        title={t('orb.openPanelTitle')}
        style={{
          position: 'absolute',
          bottom: 4,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(12,12,28,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0,
          zIndex: 30,
          transition: `all 0.2s ${EASE}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(139,120,255,0.35)';
          e.currentTarget.style.borderColor = 'rgba(139,120,255,0.5)';
          e.currentTarget.style.transform = 'scale(1.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(12,12,28,0.75)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <ArrowUpRight size={8} color="rgba(230,220,255,0.85)" strokeWidth={2.5} />
      </button>

      {/* The Orb */}
      <div
        className="relative pointer-events-none"
        style={{
          width: ORB.d, height: ORB.d,
          borderRadius: '50%', background: coreBg,
          filter: `
            drop-shadow(0 0 ${glowR}px rgba(${rgb},${glowA}))
            drop-shadow(0 0 ${glowR * 2}px rgba(${rgb},${glowA * 0.35}))
            drop-shadow(0 3px 10px rgba(0,0,0,0.35))
          `,
          transform: `scale(${scale})`,
          willChange: 'transform, background, filter',
          transition: isRec
            ? `transform 0.08s linear, background 0.45s ${EASE}, filter 0.2s ${EASE}`
            : `transform 0.65s ${EASE}, background 0.8s ${EASE}, filter 0.6s ${EASE}`,
          animation: !isRec && !isProc ? 'compact-breathe 4.5s ease-in-out infinite' : undefined,
          flexShrink: 0,
        }}
      >
        {/* Processing spinner */}
        {isProc && (
          <div style={{
            position: 'absolute', inset: '18%', borderRadius: '50%',
            border: '1.5px solid transparent',
            borderTopColor: `rgba(${rgb},0.95)`, borderRightColor: `rgba(${rgb},0.25)`,
            animation: 'compact-orbit 0.85s linear infinite',
          }} />
        )}
      </div>

      {/* Context menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="titlebar-no-drag absolute animate-scale-in"
          style={{
            top: '100%', marginTop: 4,
            background: 'rgba(8,8,22,0.96)',
            backdropFilter: 'blur(48px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04) inset',
            minWidth: 170, zIndex: 100, overflow: 'hidden', padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => { e.stopPropagation(); mouseDownPos.current = null; }}
        >
          {menuSection === 'main' && (
            <>
              <MenuItem
                icon={isRec ? <Square size={10} /> : <Mic size={10} />}
                label={isRec ? t('orb.stop') : t('orb.record')}
                shortcut="Ctrl+⇧ Space"
                onClick={() => { toggleRecording(); setShowMenu(false); }}
              />
              <MenuSeparator />
              <MenuItem icon={<></>} label={`${t('orb.mode')}: ${t(MODE_PILLS.find(m => m.mode === selectedMode)?.key || 'mode.raw')}`} chevron onClick={() => setMenuSection('mode')} />
              <MenuItem icon={<></>} label={`${t('orb.lang')}: ${selectedLanguage.toUpperCase()}`} chevron onClick={() => setMenuSection('lang')} />
              <MenuItem icon={<></>} label={`${t('orb.translate')}: ${targetLanguage ? targetLanguage.toUpperCase() : '—'}`} chevron onClick={() => setMenuSection('translate')} />
              <MenuSeparator />
              <MenuItem icon={<ArrowUpRight size={10} />} label={t('orb.openPanel')} onClick={() => { setShowMenu(false); handleExpand(); }} />
              <MenuItem icon={<Settings size={10} />} label={t('nav.settings')} onClick={() => { setShowMenu(false); useStore.getState().setView('settings'); handleExpand(); }} />
              <MenuSeparator />
              <MenuItem icon={<X size={10} />} label={t('common.quit')} danger onClick={() => { window.voiceink?.quit(); }} />
            </>
          )}

          {menuSection === 'mode' && (
            <>
              <MenuItem icon={<></>} label={`← ${t('orb.mode')}`} onClick={() => setMenuSection('main')} />
              <MenuSeparator />
              {MODE_PILLS.map(({ mode, key }) => (
                <MenuItem key={mode} icon={<></>} label={t(key)} checked={selectedMode === mode} onClick={() => { setSelectedMode(mode); setShowMenu(false); }} />
              ))}
            </>
          )}

          {menuSection === 'lang' && (
            <>
              <MenuItem icon={<></>} label={`← ${t('orb.lang')}`} onClick={() => setMenuSection('main')} />
              <MenuSeparator />
              {SUPPORTED_LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} icon={<></>} label={lang.name} checked={selectedLanguage === lang.code} onClick={() => { setSelectedLanguage(lang.code); setShowMenu(false); }} />
              ))}
            </>
          )}

          {menuSection === 'translate' && (
            <>
              <MenuItem icon={<></>} label={`← ${t('orb.translate')}`} onClick={() => setMenuSection('main')} />
              <MenuSeparator />
              <MenuItem icon={<></>} label={t('orb.translateNone')} checked={!targetLanguage} onClick={() => { setTargetLanguage(''); setShowMenu(false); }} />
              <MenuSeparator />
              {SUPPORTED_LANGUAGES.filter((l) => l.code !== selectedLanguage).map((lang) => (
                <MenuItem key={lang.code} icon={<></>} label={lang.name} checked={targetLanguage === lang.code} onClick={() => { setTargetLanguage(lang.code); setShowMenu(false); }} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Menu primitives ── */
function MenuItem({ icon, label, shortcut, chevron, checked, danger, onClick }: {
  icon: React.ReactNode; label: string; shortcut?: string; chevron?: boolean;
  checked?: boolean; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '8px 14px',
        fontSize: 11.5, fontWeight: 500,
        border: 'none', background: 'transparent',
        color: danger ? 'var(--danger)' : checked ? 'var(--accent)' : 'rgba(255,255,255,0.78)',
        cursor: 'pointer', transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {icon}
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {checked && <span style={{ color: 'var(--accent)', fontSize: 10 }}>✓</span>}
      {chevron && <ChevronRight size={10} style={{ opacity: 0.4 }} />}
      {shortcut && (
        <span style={{
          fontSize: 8.5, fontFamily: 'ui-monospace, monospace',
          padding: '1px 5px', borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.35)',
        }}>{shortcut}</span>
      )}
    </button>
  );
}

function MenuSeparator() {
  return <div style={{ height: 1, margin: '3px 10px', background: 'rgba(255,255,255,0.06)' }} />;
}
