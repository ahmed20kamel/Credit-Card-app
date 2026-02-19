'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '@/app/store/chatStore';
import { useTranslations } from '@/lib/i18n';
import { MessageCircle, X, Send, Plus, Bot, User as UserIcon, Clock, Trash2, Loader2, Mic, MicOff, Paperclip } from 'lucide-react';

export default function ChatPanel() {
  const { t, locale, isRTL } = useTranslations();
  const { isOpen, messages, sessions, isSending, isLoading, currentSessionId,
    toggleChat, closeChat, sendMessage, startNewSession, loadSessions, loadMessages, deleteSession } = useChatStore();
  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Image attachment state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for Speech Recognition support on mount
  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) { inputRef.current?.focus(); loadSessions(); }
  }, [isOpen, loadSessions]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    // Start recording
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = locale === 'ar' ? 'ar-AE' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev ? prev + ' ' + transcript : transcript);
      setIsRecording(false);
      recognitionRef.current = null;
      inputRef.current?.focus();
    };

    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording, locale]);

  const handleImageSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Reset file input so the same file can be selected again
    e.target.value = '';
  }, []);

  const removeImagePreview = useCallback(() => {
    setImagePreview(null);
  }, []);

  const handleSend = () => {
    if ((!input.trim() && !imagePreview) || isSending) return;
    const messageText = input.trim() || (imagePreview ? (t('chat.imageAttached') || 'Image attached') : '');
    sendMessage(messageText, imagePreview || undefined);
    setInput('');
    setImagePreview(null);
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

          {/* Image preview */}
          {imagePreview && (
            <div className="chat-image-preview">
              <img src={imagePreview} alt="Attached" />
              <button
                className="chat-image-preview-remove"
                onClick={removeImagePreview}
                type="button"
                aria-label="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="chat-input-area">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div className="chat-input-extras">
              <button
                onClick={handleImageSelect}
                className="chat-attach-btn"
                type="button"
                title={t('chat.attachImage') || 'Attach image'}
                disabled={isSending}
              >
                <Paperclip size={18} />
              </button>
              {speechSupported && (
                <button
                  onClick={toggleRecording}
                  className={`chat-voice-btn ${isRecording ? 'recording' : ''}`}
                  type="button"
                  title={isRecording ? (t('chat.stopRecording') || 'Stop recording') : (t('chat.voiceInput') || 'Voice input')}
                  disabled={isSending}
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              )}
            </div>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t('chat.placeholder') || 'Ask about your finances...'}
              className="chat-input"
              disabled={isSending}
            />
            <button onClick={handleSend} disabled={isSending || (!input.trim() && !imagePreview)} className="chat-send-btn" type="button">
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
