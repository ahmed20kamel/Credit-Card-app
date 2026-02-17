'use client';

import { useEffect, useState } from 'react';
import { getLocale, setLocale } from '@/lib/i18n';

export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize locale on mount
    const locale = getLocale();
    setLocale(locale);
    
    // Listen for locale changes
    const handleLocaleChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const currentLocale = customEvent.detail.locale || getLocale();
        setLocale(currentLocale);
      }
    };
    
    window.addEventListener('localechange', handleLocaleChange);
    
    return () => {
      window.removeEventListener('localechange', handleLocaleChange);
    };
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
