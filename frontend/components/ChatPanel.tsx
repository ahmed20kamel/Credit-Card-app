'use client';

import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '@/app/store/chatStore';
import { useTranslations } from '@/lib/i18n';
import { MessageCircle, X, Send, Plus, Bot, User as UserIcon, Clock, Trash2, Loader2 } from 'lucide-react';

export default function ChatPanel() {
  const { t, isRTL } = useTranslations();
  const { isOpen, messages, sessions, isSending, isLoading, currentSessionId,
    toggleChat, closeChat, sendMessage, startNewSession, loadSessions, loadMessages, deleteSession } = useChatStore();
  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) { inputRef.current?.focus(); loadSessions(); }
  }, [isOpen, loadSessions]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <>
      {/* FAB Button */}
      <button className="chat-fab" onClick={toggleChat} type="button" aria-label="Chat">
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="chat-panel">
          {/* Header */}
          <div className="chat-header">
            <div className="chat-header-title">
              <Bot size={20} />
              <span>{t('chat.title') || 'AI Assistant'}</span>
            </div>
            <div className="chat-header-actions">
              <button onClick={() => setShowSessions(!showSessions)} className="chat-header-btn" type="button">
                <Clock size={18} />
              </button>
              <button onClick={() => { startNewSession(); setShowSessions(false); }} className="chat-header-btn" type="button">
                <Plus size={18} />
              </button>
              <button onClick={closeChat} className="chat-header-btn" type="button">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Sessions sidebar */}
          {showSessions && (
            <div className="chat-sessions">
              <div className="chat-sessions-title">{t('chat.sessions') || 'Previous Chats'}</div>
              {sessions.length === 0 && <p className="chat-sessions-empty">No previous chats</p>}
              {sessions.map((s) => (
                <div key={s.id} className={`chat-session-item ${s.id === currentSessionId ? 'active' : ''}`}>
                  <button onClick={() => { loadMessages(s.id); setShowSessions(false); }} className="chat-session-btn" type="button">
                    {s.title || 'Chat'}
                  </button>
                  <button onClick={() => deleteSession(s.id)} className="chat-session-delete" type="button">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="chat-messages">
            {isLoading ? (
              <div className="chat-loading"><Loader2 size={24} className="scan-spinner" /></div>
            ) : messages.length === 0 ? (
              <div className="chat-welcome">
                <Bot size={40} />
                <p>{t('chat.noMessages') || "Hi! I'm your financial assistant. Ask me anything about your cards, balances, or spending."}</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                  <div className="chat-msg-avatar">
                    {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="chat-msg-bubble">{msg.content}</div>
                </div>
              ))
            )}
            {isSending && (
              <div className="chat-msg chat-msg-assistant">
                <div className="chat-msg-avatar"><Bot size={16} /></div>
                <div className="chat-msg-bubble chat-typing">
                  <span className="chat-dot" /><span className="chat-dot" /><span className="chat-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chat-input-area">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t('chat.placeholder') || 'Ask about your finances...'}
              className="chat-input"
              disabled={isSending}
            />
            <button onClick={handleSend} disabled={isSending || !input.trim()} className="chat-send-btn" type="button">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
