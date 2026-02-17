'use client';

import { getLocale } from './i18n';

const localeToBCP = (locale: string): string => (locale === 'ar' ? 'ar-AE' : 'en-US');

/**
 * Format number with correct decimal and thousand separators for current locale.
 * e.g. en: 1,234.56 — ar: ١٬٢٣٤٫٥٦ or 1,234.56 depending on browser.
 */
export function formatNumber(
  value: number | string | null | undefined,
  options?: { minFractionDigits?: number; maxFractionDigits?: number }
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  const num = typeof value === 'string' ? Number(value) : value;
  const locale = typeof window !== 'undefined' ? getLocale() : 'en';
  return new Intl.NumberFormat(localeToBCP(locale), {
    minimumFractionDigits: options?.minFractionDigits ?? 0,
    maximumFractionDigits: options?.maxFractionDigits ?? 2,
  }).format(num);
}

/**
 * Format amount with 2 decimal places (currency-style).
 */
export function formatAmount(
  value: number | string | null | undefined,
  options?: { currency?: string }
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0.00';
  const num = typeof value === 'string' ? Number(value) : value;
  const locale = typeof window !== 'undefined' ? getLocale() : 'en';
  return new Intl.NumberFormat(localeToBCP(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format percentage (e.g. 5.5 -> "5.5%").
 */
export function formatPercent(value: number | string | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0%';
  const num = typeof value === 'string' ? Number(value) : value;
  const locale = typeof window !== 'undefined' ? getLocale() : 'en';
  const formatted = new Intl.NumberFormat(localeToBCP(locale), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
  return `${formatted}%`;
}
