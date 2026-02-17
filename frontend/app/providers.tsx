'use client';

import { useEffect, useState } from 'react';
import ToastProvider from '@/components/ToastProvider';
import { getLocale, setLocale } from '@/lib/i18n';
import { applyTheme, getTheme } from '@/lib/theme';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize locale
    const locale = getLocale();
    setLocale(locale); // This will set dir on html element
    
    // Initialize theme
    applyTheme(getTheme());

    // Listen for locale changes
    const handleLocaleChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.locale) {
        setLocale(customEvent.detail.locale);
      }
    };
    window.addEventListener('localechange', handleLocaleChange);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (getTheme() === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      window.removeEventListener('localechange', handleLocaleChange);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  if (!mounted) {
    return (
      <>
        {children}
        <ToastProvider />
      </>
    );
  }

  return (
    <>
      {children}
      <ToastProvider />
    </>
  );
}
