import React, { useState } from 'react';
import { Upload, FileAudio, Loader2, Copy, Wand2 } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { MODE_LABELS } from '../lib/constants';

export function FileView() {
  const { selectedMode, addToast } = useStore();
  const [filePath,    setFilePath]    = useState<string | null>(null);
  const [fileName,    setFileName]    = useState('');
  const [processing,  setProcessing]  = useState(false);
  const [result,      setResult]      = useState<{ original: string; processed: string } | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [dragging,    setDragging]    = useState(false);

  const ACCEPTED = ['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'webm', 'flac'];

  const loadFile = (path: string, name: string) => {
    setFilePath(path); setFileName(name);
    setResult(null);   setError(null);
  };

  const handleOpen = async () => {
    if (!window.voiceink) return;
    const path = await window.voiceink.openFile();
    if (path) loadFile(path, path.split(/[\\/]/).pop() || path);
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true);  };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext && ACCEPTED.includes(ext)) {
      const path = (file as any).path;
      if (path) loadFile(path, file.name);
    } else {
      addToast({ type: 'error', message: 'Format non supporté' });
    }
  };

  const handleTranscribe = async () => {
    if (!filePath || !window.voiceink) return;
    setProcessing(true); setError(null);
    try {
      const res = await window.voiceink.transcribeFile(filePath);
      setResult({ original: res.transcription.text, processed: res.processed.processed });
      addToast({ type: 'success', message: 'Fichier transcrit avec succès' });
    } catch (err: any) {
      setError(err.message || 'Erreur de transcription');
    }
    setProcessing(false);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.processed || result.original);
    addToast({ type: 'success', message: 'Copié' });
  };

  return (
    <div
      className="flex flex-col h-full animate-fade-in"
      style={{ padding: '14px', gap: 12, background: 'var(--gradient-surface)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Transcription de fichier
        </h1>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 5,
          background: 'var(--accent-subtle)', border: '1px solid var(--pill-active-border)',
          color: 'var(--accent)',
        }}>
          {MODE_LABELS[selectedMode]}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onClick={handleOpen}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10,
          padding: '28px 20px', borderRadius: 14, cursor: 'pointer',
          border: `1px dashed ${
            dragging   ? 'var(--accent)'
            : filePath ? 'var(--pill-active-border)'
            : 'var(--border-bright)'
          }`,
          background: dragging
            ? 'var(--accent-subtle)'
            : filePath
            ? 'rgba(124,106,247,0.04)'
            : 'var(--bg-input)',
          transition: 'all 0.2s ease',
          transform: dragging ? 'scale(1.01)' : 'scale(1)',
          flexShrink: 0,
        }}
      >
        {filePath ? (
          <>
            <FileAudio size={28} style={{ color: 'var(--accent)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{fileName}</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>Cliquer ou glisser pour changer</p>
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: dragging ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)',
            }}>
              <Upload size={20} style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                {dragging ? 'Déposez le fichier ici' : 'Glissez un fichier ou cliquez'}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                MP3 · WAV · M4A · MP4 · OGG · FLAC
              </p>
            </div>
          </>
        )}
      </div>

      {/* Transcribe button */}
      {filePath && (
        <button
          onClick={handleTranscribe}
          disabled={processing}
          className="btn-accent"
          style={{ padding: '10px', justifyContent: 'center', borderRadius: 10, fontSize: 12, flexShrink: 0 }}
        >
          {processing
            ? <><Loader2 size={14} className="spin-smooth" /> Transcription en cours…</>
            : <><Wand2 size={14} /> Transcrire</>
          }
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 12px', borderRadius: 10, flexShrink: 0,
          background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.18)',
        }}>
          <p style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Résultat
            </p>
            <button onClick={handleCopy} className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}>
              <Copy size={10} /> Copier
            </button>
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px',
            background: 'var(--bg-input)', borderRadius: 10,
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {result.processed || result.original}
            </p>
          </div>

          {result.original && result.processed && result.original !== result.processed && (
            <details>
              <summary style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
                Afficher le texte original
              </summary>
              <div style={{
                marginTop: 6, padding: '10px 12px',
                background: 'var(--bg-input)', borderRadius: 9, border: '1px solid var(--border)',
              }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {result.original}
                </p>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
