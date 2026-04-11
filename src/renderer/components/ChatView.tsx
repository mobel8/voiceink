import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Loader2, Bot, User } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@shared/types';

export function ChatView() {
  const {
    chatMessages, addChatMessage, updateLastAssistantMessage,
    clearChat, isChatStreaming, setIsChatStreaming, addToast,
  } = useStore();

  const [input, setInput] = useState('');
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!window.voiceink?.onChatStream) return;
    return window.voiceink.onChatStream((token: string) => {
      updateLastAssistantMessage(token);
    });
  }, [updateLastAssistantMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isChatStreaming) return;

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user',      content: text, timestamp: Date.now() };
    const botMsg:  ChatMessage = { id: uuidv4(), role: 'assistant', content: '',   timestamp: Date.now() };
    addChatMessage(userMsg);
    setInput('');
    addChatMessage(botMsg);
    setIsChatStreaming(true);

    try {
      const messages = [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      if (window.voiceink?.sendChat) await window.voiceink.sendChat(messages);
    } catch (err: any) {
      addToast({ type: 'error', message: err?.message || 'Erreur chat' });
    } finally {
      setIsChatStreaming(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div
      className="flex flex-col h-full animate-fade-in"
      style={{ background: 'var(--gradient-surface)' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 14px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Chat IA</h1>
        <button
          onClick={clearChat}
          className="btn-ghost"
          style={{ padding: '5px 8px', fontSize: 10 }}
          title="Effacer la conversation"
        >
          <Trash2 size={11} /> Effacer
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {chatMessages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            flex: 1, gap: 8, color: 'var(--text-muted)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--accent-subtle)', border: '1px solid var(--pill-active-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <p style={{ fontSize: 12, fontWeight: 500 }}>Commencer une conversation</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Utilise le fournisseur LLM configuré
            </p>
          </div>
        )}

        {chatMessages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: 6,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                background: isUser ? 'var(--gradient-mic)' : 'var(--bg-elevated)',
                border: isUser ? 'none' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isUser
                  ? <User size={11} style={{ color: 'white', opacity: 0.9 }} />
                  : <Bot  size={11} style={{ color: 'var(--accent)' }} />
                }
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: '76%',
                  padding: '9px 12px',
                  borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                  background: isUser ? 'var(--gradient-mic)' : 'var(--bg-elevated)',
                  border: isUser ? 'none' : '1px solid var(--border)',
                  boxShadow: isUser ? '0 4px 16px rgba(124,106,247,0.2)' : 'none',
                }}
              >
                <p style={{
                  fontSize: 12, lineHeight: 1.65,
                  color: isUser ? 'white' : 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  opacity: isUser ? 0.95 : 1,
                }}>
                  {msg.content}
                  {msg.role === 'assistant' && msg.content === '' && isChatStreaming && (
                    <span style={{
                      display: 'inline-block', width: 8, height: 14, marginLeft: 2,
                      background: 'var(--accent)', borderRadius: 2,
                      animation: 'blink-cursor 1s steps(1) infinite',
                    }} />
                  )}
                </p>
                <p style={{
                  fontSize: 9, marginTop: 4,
                  color: isUser ? 'rgba(255,255,255,0.45)' : 'var(--text-muted)',
                  textAlign: isUser ? 'right' : 'left',
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '8px 8px 8px 12px',
          transition: 'border-color 0.15s ease',
        }}
          onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px var(--accent-subtle)'; }}
          onBlurCapture={(e)  => { (e.currentTarget as HTMLElement).style.borderColor = '';              (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Écrire un message… (Entrée pour envoyer)"
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: 'var(--text-primary)', resize: 'none',
              lineHeight: 1.5, maxHeight: 120, minHeight: 20,
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatStreaming}
            style={{
              width: 32, height: 32, borderRadius: 9,
              background: (input.trim() && !isChatStreaming) ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: 'none', cursor: (input.trim() && !isChatStreaming) ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: (input.trim() && !isChatStreaming) ? 'white' : 'var(--text-muted)',
              transition: 'all 0.15s ease', flexShrink: 0,
            }}
          >
            {isChatStreaming
              ? <Loader2 size={14} className="spin-smooth" />
              : <Send size={14} />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
