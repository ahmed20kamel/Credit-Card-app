import { AxiosError } from 'axios';
import type { ApiError } from '@/types';

/**
 * Flatten Django REST framework / API validation errors.
 * e.g. { card_number: ["Must be 16 digits"], expiry_month: ["Invalid"] } -> "Card number: Must be 16 digits. Expiry month: Invalid."
 */
function flattenValidationErrors(data: Record<string, unknown>): string | null {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === 'detail' || key === 'error' || key === 'message') continue;
    const msg = Array.isArray(val) ? val[0] : val;
    if (msg != null && String(msg).trim()) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      parts.push(`${label}: ${msg}`);
    }
  }
  return parts.length ? parts.join('. ') : null;
}

export function getErrorMessage(err: unknown, fallback: string = 'An error occurred'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.detail === 'string') return obj.detail;
      if (Array.isArray(obj.detail) && obj.detail.length) return String(obj.detail[0]);
      if (typeof obj.error === 'string') return obj.error;
      if (typeof obj.message === 'string') return obj.message;
      const flat = flattenValidationErrors(obj);
      if (flat) return flat;
    }
    return err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
