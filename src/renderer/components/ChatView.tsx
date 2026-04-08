import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Loader2 } from 'lucide-react';
import { useStore } from '../stores/useStore';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@shared/types';

export function ChatView() {
  const {
    chatMessages,
    addChatMessage,
    updateLastAssistantMessage,
    clearChat,
    isChatStreaming,
    setIsChatStreaming,
    addToast,
  } = useStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!window.voiceink?.onChatStream) return;
    const unsub = window.voiceink.onChatStream((token: string) => {
      updateLastAssistantMessage(token);
    });
    return unsub;
  }, [updateLastAssistantMessage]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isChatStreaming) return;

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setInput('');

    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addChatMessage(assistantMsg);
    setIsChatStreaming(true);

    try {
      const messages = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (window.voiceink?.sendChat) {
        await window.voiceink.sendChat(messages);
      }
    } catch (err: any) {
      addToast({ type: 'error', message: err?.message || 'Erreur chat' });
    } finally {
      setIsChatStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--bg-secondary)]">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Chat IA</h1>
        <button
          onClick={clearChat}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] transition-colors"
          title="Effacer la conversation"
        >
          <Trash2 size={12} />
          Effacer
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
              <Send size={20} className="text-[var(--accent)]" />
            </div>
            <p className="text-sm">Commencez une conversation</p>
            <p className="text-xs text-[var(--text-muted)]">Utilise le fournisseur LLM configuré</p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-br-md'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.content}
                {msg.role === 'assistant' && msg.content === '' && isChatStreaming && (
                  <span className="inline-block w-2 h-4 bg-[var(--accent)] animate-pulse ml-0.5" />
                )}
              </p>
              <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
                {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-3 border-t border-[var(--bg-secondary)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez un message..."
            className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent)]/50 transition-colors max-h-32"
            rows={1}
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatStreaming}
            className="w-10 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--border)] disabled:text-[var(--text-muted)] text-white flex items-center justify-center transition-colors shrink-0"
          >
            {isChatStreaming ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
