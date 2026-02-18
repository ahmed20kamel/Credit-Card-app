'use client';

import { useEffect, useState } from 'react';
import ToastProvider from '@/components/ToastProvider';
import { getLocale, setLocale } from '@/lib/i18n';
import { applyTheme, getTheme } from '@/lib/theme';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize locale (setLocale updates document and dispatches 'localechange' for other components)
    const locale = getLocale();
    setLocale(locale);

    // Initialize theme
    applyTheme(getTheme());

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (getTheme() === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <ToastProvider />
    </>
  );
}
