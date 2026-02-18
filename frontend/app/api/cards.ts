import api from './client';
import type { Card, CardCreateRequest, CardUpdateRequest, ApiResponse } from '@/types';

export type { Card };

export const cardsAPI = {
  list: async (params?: { bank_name?: string; page?: number; per_page?: number }): Promise<ApiResponse<Card>> => {
    const response = await api.get('/cards', { params });
    return response.data;
  },

  get: async (id: string, reveal: boolean = false): Promise<Card> => {
    const response = await api.get(`/cards/${id}`, { params: { reveal: reveal.toString() } });
    return response.data;
  },

  create: async (data: CardCreateRequest): Promise<Card> => {
    const response = await api.post('/cards', data);
    return response.data;
  },

  update: async (id: string, data: CardUpdateRequest): Promise<Card> => {
    const response = await api.put(`/cards/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/cards/${id}`);
  },

  parseText: async (text: string) => {
    const response = await api.post('/cards/parse-text', { text });
    return response.data;
  },

  parseSMS: async (data: {
    sms_body: string;
    sender?: string;
    received_at?: string;
    auto_create?: boolean;
    card_id?: string;
  }) => {
    const response = await api.post('/cards/parse-sms', data);
    return response.data;
  },

  scanCardImage: async (imageBase64: string): Promise<{
    card_number?: string;
    cardholder_name?: string;
    expiry_month?: string;
    expiry_year?: string;
    cvv?: string;
    card_network?: string;
    bank_name?: string;
    error?: string;
  }> => {
    const response = await api.post('/cards/scan-image', { image: imageBase64 });
    return response.data;
  },
};
