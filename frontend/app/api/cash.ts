import api from './client';
import type { CashEntry, CashEntryCreateRequest, ApiResponse } from '@/types';

export type { CashEntry };

export const cashAPI = {
  list: async (params?: { page?: number; per_page?: number }): Promise<ApiResponse<CashEntry>> => {
    const response = await api.get('/cash/', { params });
    return response.data;
  },

  get: async (id: string): Promise<CashEntry> => {
    const response = await api.get(`/cash/${id}/`);
    return response.data;
  },

  create: async (data: CashEntryCreateRequest): Promise<CashEntry> => {
    const response = await api.post('/cash/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CashEntryCreateRequest>): Promise<CashEntry> => {
    const response = await api.put(`/cash/${id}/`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/cash/${id}/`);
  },

  getBalance: async (): Promise<{ balance: number; currency: string }> => {
    const response = await api.get('/cash/balance/');
    return response.data;
  },
};
