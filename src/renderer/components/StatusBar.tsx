import React, { useState, useEffect } from 'react';
import { useStore } from '../stores/useStore';

function Timer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 200);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return <span className="font-mono tabular-nums" style={{ color: 'var(--recording)', fontSize: 9 }}>{m}:{s.toString().padStart(2, '0')}</span>;
}

export function StatusBar() {
  const { pipelineStatus, recordingState, settings, modelReady, recordingStartTime, lastTranscriptionMs } = useStore();

  const provider = settings?.stt?.provider === 'groq' ? 'Groq'
    : settings?.stt?.provider === 'openai' ? 'OpenAI'
    : settings?.stt?.provider === 'glm' ? 'GLM'
    : modelReady ? 'Whisper' : 'Local';

  const privacy = settings?.privacy === 'local' ? 'Local' : settings?.privacy === 'hybrid' ? 'Hybride' : 'Cloud';

  return (
    <div className="flex items-center justify-between h-5 px-3 text-[9px] select-none shrink-0"
      style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full" style={{
          background: recordingState === 'recording' ? 'var(--recording)' : recordingState === 'processing' ? 'var(--processing)' : 'var(--text-muted)',
          boxShadow: recordingState === 'recording' ? '0 0 4px var(--recording)' : 'none',
        }} />
        {recordingState === 'recording' && recordingStartTime ? (
          <Timer startTime={recordingStartTime} />
        ) : lastTranscriptionMs && recordingState === 'idle' ? (
          <span style={{ color: 'var(--success)', fontWeight: 500 }}>{(lastTranscriptionMs / 1000).toFixed(1)}s</span>
        ) : (
          <span>{pipelineStatus.message || 'Pret'}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 font-medium" style={{ letterSpacing: '0.04em' }}>
        <span>{provider}</span>
        <span style={{ opacity: 0.2 }}>|</span>
        <span>{privacy}</span>
      </div>
    </div>
  );
}
