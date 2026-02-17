'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({ 
  title, 
  message, 
  onRetry,
  className = '' 
}: ErrorStateProps) {
  const { t } = useTranslations();

  return (
    <div className={`error-state ${className}`}>
      <div className="error-state-icon-wrapper">
        <AlertCircle size={48} className="error-state-icon" />
      </div>
      <h3 className="error-state-title">
        {title || t('errors.somethingWentWrong') || 'Something went wrong'}
      </h3>
      {message && (
        <p className="error-state-message">{message}</p>
      )}
      {onRetry && (
        <button onClick={onRetry} className="btn btn-primary">
          <RefreshCw size={16} />
          <span>{t('common.retry') || 'Try Again'}</span>
        </button>
      )}
    </div>
  );
}
