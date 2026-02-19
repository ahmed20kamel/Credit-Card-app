'use client';

import { create } from 'zustand';
import { chatAPI, type ChatMessage, type ChatSession } from '../api/chat';

interface ChatState {
  isOpen: boolean;
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  isSending: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (message: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  startNewSession: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  isSending: false,

  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  sendMessage: async (message: string) => {
    const { currentSessionId } = get();
    set((s) => ({ messages: [...s.messages, { role: 'user', content: message }], isSending: true }));
    try {
      const res = await chatAPI.send(message, currentSessionId || undefined);
      set((s) => ({
        messages: [...s.messages, { role: 'assistant', content: res.response }],
        currentSessionId: res.session_id,
        isSending: false,
      }));
      // Reload sessions to get the new title
      get().loadSessions();
    } catch {
      set((s) => ({
        messages: [...s.messages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }],
        isSending: false,
      }));
    }
  },

  loadSessions: async () => {
    try {
      const sessions = await chatAPI.getSessions();
      set({ sessions });
    } catch { /* silent */ }
  },

  loadMessages: async (sessionId: string) => {
    set({ isLoading: true, currentSessionId: sessionId });
    try {
      const messages = await chatAPI.getMessages(sessionId);
      set({ messages, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  startNewSession: () => set({ currentSessionId: null, messages: [] }),

  deleteSession: async (sessionId: string) => {
    try {
      await chatAPI.deleteSession(sessionId);
      const { currentSessionId } = get();
      if (currentSessionId === sessionId) set({ currentSessionId: null, messages: [] });
      get().loadSessions();
    } catch { /* silent */ }
  },
}));
