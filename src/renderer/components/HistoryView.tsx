import React, { useEffect, useState, useCallback } from 'react';
import { Search, Trash2, Download, Tag, Copy, Clock, FileAudio, Mic } from 'lucide-react';
import { useStore } from '../stores/useStore';
import type { HistoryEntry, ExportFormat } from '@shared/types';
import { MODE_LABELS } from '../lib/constants';

export function HistoryView() {
  const { history, setHistory } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [tagInput, setTagInput] = useState('');

  const loadHistory = useCallback(async () => {
    if (window.voiceink) {
      const entries = await window.voiceink.getHistory(
        searchQuery ? { search: searchQuery } : undefined
      );
      setHistory(entries);
    }
  }, [searchQuery, setHistory]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDelete = async (id: string) => {
    if (window.voiceink) {
      await window.voiceink.deleteHistory(id);
      if (selectedEntry?.id === id) setSelectedEntry(null);
      loadHistory();
    }
  };

  const handleExport = async (id: string, format: ExportFormat) => {
    if (window.voiceink) {
      await window.voiceink.exportHistory(id, format);
    }
  };

  const handleAddTag = async (id: string) => {
    if (window.voiceink && tagInput.trim()) {
      await window.voiceink.addTag(id, tagInput.trim());
      setTagInput('');
      loadHistory();
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}m ${sec}s`;
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--bg-secondary)]">
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Historique</h1>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] outline-none"
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="w-full flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <Clock size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Aucun historique</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--bg-secondary)]">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className={`px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--bg-secondary)]
                    ${selectedEntry?.id === entry.id ? 'bg-[var(--bg-secondary)] border-l-2 border-[var(--accent)]' : ''}`}
                  onClick={() => setSelectedEntry(entry)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {entry.processedText || entry.originalText}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[var(--text-muted)]">{formatDate(entry.timestamp)}</span>
                        <span className="text-xs text-[var(--text-muted)]">-</span>
                        <span className="text-xs text-[var(--accent)]">
                          {MODE_LABELS[entry.mode] || entry.mode}
                        </span>
                        {entry.source === 'file' && (
                          <FileAudio size={10} className="text-[var(--text-muted)]" />
                        )}
                        {entry.source === 'dictation' && (
                          <Mic size={10} className="text-[var(--text-muted)]" />
                        )}
                      </div>
                      {entry.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(entry.processedText || entry.originalText); }}
                        className="p-1 rounded hover:bg-[var(--hover-bg)] transition-colors"
                        title="Copier"
                      >
                        <Copy size={12} className="text-[var(--text-muted)]" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={12} className="text-[var(--text-muted)] hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedEntry && (
          <div className="w-64 border-l border-[var(--bg-secondary)] overflow-y-auto p-4 shrink-0">
            <h3 className="text-xs font-medium text-[var(--accent)] mb-2">Détails</h3>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Date</span>
                <p className="text-xs text-[var(--text-primary)]">{formatDate(selectedEntry.timestamp)}</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Mode</span>
                <p className="text-xs text-[var(--text-primary)]">{MODE_LABELS[selectedEntry.mode]}</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Langue</span>
                <p className="text-xs text-[var(--text-primary)]">{selectedEntry.language}</p>
              </div>
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Durée</span>
                <p className="text-xs text-[var(--text-primary)]">{formatDuration(selectedEntry.duration)}</p>
              </div>

              {/* Tags */}
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Tags</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {selectedEntry.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-1 mt-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag(selectedEntry.id)}
                    placeholder="Ajouter tag..."
                    className="flex-1 px-2 py-1 text-[10px] rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] outline-none"
                  />
                  <button
                    onClick={() => handleAddTag(selectedEntry.id)}
                    className="px-2 py-1 text-[10px] rounded bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30"
                  >
                    <Tag size={10} />
                  </button>
                </div>
              </div>

              {/* Text */}
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Texte traité</span>
                <p className="text-xs text-[var(--text-primary)] mt-1 whitespace-pre-wrap leading-relaxed">
                  {selectedEntry.processedText}
                </p>
              </div>

              {selectedEntry.originalText !== selectedEntry.processedText && (
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase">Texte original</span>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 whitespace-pre-wrap leading-relaxed">
                    {selectedEntry.originalText}
                  </p>
                </div>
              )}

              {/* Export */}
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase">Exporter</span>
                <div className="flex gap-1 mt-1">
                  {(['txt', 'srt', 'json'] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(selectedEntry.id, fmt)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
                    >
                      <Download size={8} />
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
