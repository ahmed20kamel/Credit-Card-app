import { AxiosError } from 'axios';
import type { ApiError } from '@/types';

export function getErrorMessage(err: unknown, fallback: string = 'An error occurred'): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiError | undefined;
    return data?.detail || data?.error || data?.message || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
