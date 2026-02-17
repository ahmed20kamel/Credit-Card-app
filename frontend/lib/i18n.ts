'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

type Locale = 'en' | 'ar';

// Load translations
import enMessages from '../i18n/messages/en.json';
import arMessages from '../i18n/messages/ar.json';

const messages = {
  en: enMessages,
  ar: arMessages,
};

// Professional locale management with smooth transitions
export function setLocale(locale: Locale) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
    
    // Add transition class for smooth direction change
    document.documentElement.classList.add('locale-transitioning');
    
    // Update attributes
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-locale', locale);
    
    // Remove transition class after animation
    setTimeout(() => {
      document.documentElement.classList.remove('locale-transitioning');
    }, 300);
    
    // Dispatch custom event for components to react
    window.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
  }
}

export function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('locale') as Locale;
    if (saved && (saved === 'en' || saved === 'ar')) {
      return saved;
    }
  }
  return 'en';
}

// Professional translation hook with caching
export function useTranslations(namespace?: string) {
  // Always start with 'en' to avoid hydration mismatch
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Only read from localStorage after component mounts (client-side)
    const savedLocale = getLocale();
    setLocaleState(savedLocale);
    setLocale(savedLocale);
    setMounted(true);
    
    // Listen for locale changes from other components
    const handleLocaleChange = (event: CustomEvent) => {
      setLocaleState(event.detail.locale);
    };
    
    window.addEventListener('localechange', handleLocaleChange as EventListener);
    
    return () => {
      window.removeEventListener('localechange', handleLocaleChange as EventListener);
    };
  }, []);
  
  const updateLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setLocale(newLocale);
  }, []);
  
  // Memoize translation function for performance
  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const keys = key.split('.');
    let value: any = namespace 
      ? (messages[locale] as any)[namespace]
      : messages[locale];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    if (typeof value !== 'string') {
      // Fallback to English if translation not found
      let fallbackValue: any = namespace 
        ? (messages['en'] as any)[namespace]
        : messages['en'];
      
      for (const k of keys) {
        fallbackValue = fallbackValue?.[k];
      }
      
      if (typeof fallbackValue === 'string') {
        value = fallbackValue;
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    // Replace params
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match: string, param: string) => {
        return params[param]?.toString() || match;
      });
    }
    
    return value;
  }, [locale, namespace]);
  
  return { t, locale, setLocale: updateLocale, mounted, isRTL: locale === 'ar' };
}

