'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingState({ message, fullScreen = false }: LoadingStateProps) {
  const { t } = useTranslations();

  const content = (
    <div className="loading-state">
      <Loader2 className="loading-spinner-icon" size={32} />
      <p className="loading-state-message">{message || t('common.loading')}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-state-fullscreen">
        {content}
      </div>
    );
  }

  return content;
}
