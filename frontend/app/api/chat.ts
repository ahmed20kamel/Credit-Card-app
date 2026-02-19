import api from './client';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
}

export const chatAPI = {
  send: async (message: string, sessionId?: string): Promise<{ response: string; session_id: string }> => {
    const res = await api.post('/chat/send', { message, session_id: sessionId });
    return res.data;
  },
  getSessions: async (): Promise<ChatSession[]> => {
    const res = await api.get('/chat/sessions');
    return Array.isArray(res.data) ? res.data : res.data.items || [];
  },
  getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const res = await api.get('/chat/messages', { params: { session_id: sessionId } });
    return Array.isArray(res.data) ? res.data : res.data.items || [];
  },
  deleteSession: async (sessionId: string): Promise<void> => {
    await api.delete(`/chat/sessions/${sessionId}`);
  },
};
