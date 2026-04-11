import React, { useEffect, useState, useCallback } from 'react';
import { Search, Trash2, Download, Tag, Copy, Clock, FileAudio, Mic, X } from 'lucide-react';
import { useStore } from '../stores/useStore';
import type { HistoryEntry, ExportFormat } from '@shared/types';
import { MODE_LABELS } from '../lib/constants';

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const formatDuration = (s: number) =>
  s < 60 ? `${s.toFixed(0)}s` : `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;

export function HistoryView() {
  const { history, setHistory } = useStore();
  const [query,         setQuery]         = useState('');
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [tagInput,      setTagInput]      = useState('');

  const load = useCallback(async () => {
    if (window.voiceink) {
      const entries = await window.voiceink.getHistory(query ? { search: query } : undefined);
      setHistory(entries);
    }
  }, [query, setHistory]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.voiceink) return;
    await window.voiceink.deleteHistory(id);
    if (selectedEntry?.id === id) setSelectedEntry(null);
    load();
  };

  const handleExport = async (id: string, fmt: ExportFormat) => {
    if (window.voiceink) await window.voiceink.exportHistory(id, fmt);
  };

  const handleAddTag = async (id: string) => {
    if (window.voiceink && tagInput.trim()) {
      await window.voiceink.addTag(id, tagInput.trim());
      setTagInput('');
      load();
    }
  };

  return (
    <div
      className="flex flex-col h-full animate-fade-in"
      style={{ background: 'var(--gradient-surface)' }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
          Historique
        </h1>
        <div style={{ position: 'relative' }}>
          <Search
            size={13}
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="input-base"
            style={{ paddingLeft: 30 }}
          />
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-muted)' }}>
              <Clock size={28} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: 12 }}>Aucun historique</p>
            </div>
          ) : (
            <div>
              {history.map((entry) => {
                const active = selectedEntry?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedEntry(active ? null : entry)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                      background: active ? 'var(--accent-subtle)' : 'transparent',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'; }}
                    onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Main text */}
                        <p style={{
                          fontSize: 12, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          lineHeight: 1.5,
                        }}>
                          {entry.processedText || entry.originalText}
                        </p>

                        {/* Meta */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatDate(entry.timestamp)}</span>
                          <span style={{
                            fontSize: 9.5, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
                            background: 'var(--accent-subtle)', color: 'var(--accent)',
                            border: '1px solid var(--pill-active-border)',
                          }}>
                            {MODE_LABELS[entry.mode] || entry.mode}
                          </span>
                          {entry.source === 'file'      && <FileAudio size={9} style={{ color: 'var(--text-muted)' }} />}
                          {entry.source === 'dictation' && <Mic        size={9} style={{ color: 'var(--text-muted)' }} />}
                        </div>

                        {/* Tags */}
                        {entry.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                            {entry.tags.map((tag) => (
                              <span key={tag} style={{
                                fontSize: 9.5, padding: '1px 6px', borderRadius: 4,
                                background: 'rgba(124,106,247,0.1)',
                                border: '1px solid rgba(124,106,247,0.2)',
                                color: 'var(--accent)',
                              }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entry.processedText || entry.originalText); }}
                          className="icon-btn"
                          style={{ width: 24, height: 24, borderRadius: 5 }}
                          title="Copier"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                          className="icon-btn"
                          style={{ width: 24, height: 24, borderRadius: 5 }}
                          title="Supprimer"
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = ''; e.currentTarget.style.background = ''; }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedEntry && (
          <div
            className="animate-fade-in"
            style={{
              width: 220, overflowY: 'auto', flexShrink: 0,
              borderLeft: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              padding: '12px',
            }}
          >
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Détails</p>
              <button className="icon-btn" style={{ width: 22, height: 22, borderRadius: 5 }} onClick={() => setSelectedEntry(null)}>
                <X size={11} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Meta fields */}
              {[
                { label: 'Date',   value: formatDate(selectedEntry.timestamp) },
                { label: 'Mode',   value: MODE_LABELS[selectedEntry.mode] || selectedEntry.mode },
                { label: 'Langue', value: selectedEntry.language },
                { label: 'Durée',  value: formatDuration(selectedEntry.duration) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-primary)' }}>{value}</p>
                </div>
              ))}

              {/* Tags */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>Tags</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {selectedEntry.tags.map((tag) => (
                    <span key={tag} style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 4,
                      background: 'var(--accent-subtle)', border: '1px solid var(--pill-active-border)',
                      color: 'var(--accent)',
                    }}>{tag}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    type="text" value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag(selectedEntry.id)}
                    placeholder="Ajouter…"
                    className="input-base"
                    style={{ fontSize: 10, padding: '4px 8px', flex: 1 }}
                  />
                  <button onClick={() => handleAddTag(selectedEntry.id)} className="btn-accent" style={{ padding: '4px 8px', fontSize: 10 }}>
                    <Tag size={10} />
                  </button>
                </div>
              </div>

              {/* Processed text */}
              {selectedEntry.processedText && (
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Texte traité</p>
                  <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedEntry.processedText}
                  </p>
                </div>
              )}

              {/* Original if different */}
              {selectedEntry.originalText && selectedEntry.originalText !== selectedEntry.processedText && (
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Original</p>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedEntry.originalText}
                  </p>
                </div>
              )}

              {/* Export */}
              <div>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>Exporter</p>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['txt', 'srt', 'json'] as ExportFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(selectedEntry.id, fmt)}
                      className="btn-ghost"
                      style={{ flex: 1, justifyContent: 'center', padding: '4px 4px', fontSize: 9.5 }}
                    >
                      <Download size={9} />
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
