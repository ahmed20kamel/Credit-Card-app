'use client';

import { useTranslations } from '@/lib/i18n';
import { Globe, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LanguageSwitcher() {
  const { locale, setLocale, mounted } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // dir is set by setLocale function, no need to set it here

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const changeLanguage = (newLocale: 'en' | 'ar') => {
    if (newLocale !== locale) {
      setLocale(newLocale);
      setIsOpen(false);
      setTimeout(() => {
        router.refresh();
      }, 100);
    }
  };

  if (!mounted) {
    return (
      <button className="language-btn" disabled>
        <Globe size={16} />
        <span>EN</span>
      </button>
    );
  }

  const languages = [
    { code: 'en' as const, name: 'English', flag: '🇬🇧' },
    { code: 'ar' as const, name: 'العربية', flag: '🇸🇦' },
  ];

  return (
    <div className="language-switcher" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="language-btn"
        title="Change Language"
      >
        <Globe size={16} />
        <span>{locale.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div className="language-menu">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`language-option ${locale === lang.code ? 'active' : ''}`}
            >
              <span style={{ fontSize: '1.25rem' }}>{lang.flag}</span>
              <span style={{ flex: 1 }}>{lang.name}</span>
              {locale === lang.code && (
                <Check size={16} style={{ color: 'var(--primary)' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
