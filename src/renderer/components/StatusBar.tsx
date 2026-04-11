import React, { useState, useEffect } from 'react';
import { useStore } from '../stores/useStore';

function Timer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      200,
    );
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: 10, fontWeight: 600,
        color: 'var(--recording)',
        letterSpacing: '0.04em',
      }}
    >
      {m}:{s.toString().padStart(2, '0')}
    </span>
  );
}

const Pill = ({ children, color, glow }: { children: React.ReactNode; color?: string; glow?: boolean }) => (
  <span
    style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 5,
      fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
      textTransform: 'uppercase',
      background: color ? `${color}12` : 'rgba(255,255,255,0.04)',
      color: color || 'var(--text-muted)',
      border: `1px solid ${color ? `${color}28` : 'var(--border)'}`,
      boxShadow: glow && color ? `0 0 8px ${color}22` : undefined,
    }}
  >
    {children}
  </span>
);

export function StatusBar() {
  const {
    pipelineStatus, recordingState, settings,
    modelReady, recordingStartTime, lastTranscriptionMs,
  } = useStore();

  const provider =
    settings?.stt?.provider === 'groq'   ? 'Groq'
    : settings?.stt?.provider === 'openai' ? 'OpenAI'
    : settings?.stt?.provider === 'glm'    ? 'GLM'
    : modelReady ? 'Whisper' : 'Local';

  const privacy =
    settings?.privacy === 'local'   ? 'LOCAL'
    : settings?.privacy === 'hybrid' ? 'HYBRID'
    : 'CLOUD';

  const privacyColor =
    settings?.privacy === 'local'   ? '#34d399'
    : settings?.privacy === 'hybrid' ? '#fbbf24'
    : '#f87171';

  return (
    <div
      style={{
        height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      {/* Left: status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div
          className={recordingState === 'recording' ? 'status-dot-recording' : ''}
          style={{
            width: 5, height: 5, borderRadius: '50%',
            background:
              recordingState === 'recording'  ? 'var(--recording)'
              : recordingState === 'processing' ? 'var(--processing)'
              : 'var(--text-muted)',
            boxShadow:
              recordingState === 'recording'
                ? '0 0 8px var(--recording)'
              : recordingState === 'processing'
                ? '0 0 6px var(--processing)'
                : 'none',
            flexShrink: 0,
            transition: 'background 0.3s, box-shadow 0.3s',
          }}
        />
        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          {recordingState === 'recording' && recordingStartTime ? (
            <Timer startTime={recordingStartTime} />
          ) : lastTranscriptionMs && recordingState === 'idle' ? (
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>
              ✓ {(lastTranscriptionMs / 1000).toFixed(2)}s
            </span>
          ) : (
            pipelineStatus.message || 'Prêt'
          )}
        </span>
      </div>

      {/* Right: provider + privacy */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Pill glow>{provider}</Pill>
        <Pill color={privacyColor} glow>{privacy}</Pill>
      </div>
    </div>
  );
}
