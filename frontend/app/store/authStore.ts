'use client';

import { create } from 'zustand';
import { authAPI } from '../api/auth';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  preferred_language: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name?: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await authAPI.login({ email, password });
      await useAuthStore.getState().loadUser();
    } finally {
      set({ isLoading: false });
    }
  },
  
  register: async (email: string, password: string, full_name?: string) => {
    set({ isLoading: true });
    try {
      await authAPI.register({ email, password, full_name, preferred_language: 'en' });
      await useAuthStore.getState().loadUser();
    } finally {
      set({ isLoading: false });
    }
  },
  
  logout: () => {
    authAPI.logout();
    set({ user: null, isAuthenticated: false });
  },
  
  loadUser: async () => {
    try {
      const user = await authAPI.getProfile();
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },
}));
