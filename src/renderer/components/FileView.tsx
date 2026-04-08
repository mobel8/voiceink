import React, { useState } from 'react';
import { Upload, FileAudio, Loader2, Copy } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { MODE_LABELS } from '../lib/constants';

export function FileView() {
  const { selectedMode, addToast } = useStore();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ original: string; processed: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleOpenFile = async () => {
    if (!window.voiceink) return;
    const path = await window.voiceink.openFile();
    if (path) {
      setFilePath(path);
      setFileName(path.split(/[\\/]/).pop() || path);
      setResult(null);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      const allowed = ['mp3', 'wav', 'm4a', 'mp4', 'ogg', 'webm', 'flac'];
      if (ext && allowed.includes(ext)) {
        const path = (file as any).path;
        if (path) {
          setFilePath(path);
          setFileName(file.name);
          setResult(null);
          setError(null);
        }
      } else {
        addToast({ type: 'error', message: 'Format non supporté. Utilisez MP3, WAV, M4A, OGG, FLAC.' });
      }
    }
  };

  const handleTranscribe = async () => {
    if (!filePath || !window.voiceink) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await window.voiceink.transcribeFile(filePath);
      setResult({
        original: res.transcription.text,
        processed: res.processed.processed,
      });
      addToast({ type: 'success', message: 'Fichier transcrit avec succès' });
    } catch (err: any) {
      setError(err.message || 'Erreur de transcription');
    }
    setIsProcessing(false);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.processed || result.original);
      addToast({ type: 'success', message: 'Copié dans le presse-papier' });
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Transcription de fichier</h1>
        <span className="text-xs text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-1 rounded">
          {MODE_LABELS[selectedMode]}
        </span>
      </div>

      {/* Drop Zone */}
      <div
        onClick={handleOpenFile}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all bg-[var(--bg-secondary)]/50
          ${isDragging
            ? 'border-[var(--accent)] bg-[var(--accent)]/10 scale-[1.02]'
            : filePath
              ? 'border-[var(--accent)]/30 hover:border-[var(--accent)]/50'
              : 'border-[var(--border)] hover:border-[var(--accent)]/50'
          }`}
      >
        {filePath ? (
          <>
            <FileAudio size={32} className="text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-primary)]">{fileName}</p>
            <p className="text-xs text-[var(--text-muted)]">Cliquez ou glissez pour changer de fichier</p>
          </>
        ) : (
          <>
            <Upload size={32} className={isDragging ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
            <p className="text-sm text-[var(--text-secondary)]">
              {isDragging ? 'Déposez le fichier ici' : 'Glissez un fichier ou cliquez pour sélectionner'}
            </p>
            <p className="text-xs text-[var(--text-muted)]">MP3, WAV, M4A, MP4, OGG, FLAC</p>
          </>
        )}
      </div>

      {filePath && (
        <button
          onClick={handleTranscribe}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {isProcessing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Transcription en cours...
            </>
          ) : (
            <>
              <FileAudio size={16} />
              Transcrire
            </>
          )}
        </button>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30" role="alert">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--accent)]">Résultat</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
            >
              <Copy size={10} />
              Copier
            </button>
          </div>
          <div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
              {result.processed || result.original}
            </p>
          </div>

          {result.original && result.processed && result.original !== result.processed && (
            <details className="group">
              <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">
                Texte original
              </summary>
              <div className="mt-2 bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--bg-secondary)]">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
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
