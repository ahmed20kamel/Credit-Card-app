'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/app/store/authStore';
import { useTranslations } from '@/lib/i18n';
import { getErrorMessage } from '@/lib/errors';
import { CreditCard, Eye, EyeOff } from 'lucide-react';
import PasswordStrength from '@/components/ui/PasswordStrength';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const { t } = useTranslations();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(email, password, fullName || undefined);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('errors.registrationFailed') || 'Registration failed'));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <CreditCard size={28} />
          </div>
          <h2 className="auth-title">{t('common.appName') || 'CardVault'}</h2>
          <p className="auth-subtitle">{t('auth.createAccount') || 'Create your account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="fullName" className="form-label">
              {t('auth.fullName') || 'Full Name'} <span className="text-secondary">({t('common.optional') || 'Optional'})</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('auth.fullNamePlaceholder') || 'Enter your full name'}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              {t('auth.email') || 'Email address'}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder') || 'Enter your email'}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.password') || 'Password'}
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder') || 'Min 8 characters'}
                className="form-input"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          <button type="submit" disabled={isLoading} className="btn btn-primary btn-full">
            {isLoading ? (t('auth.creatingAccount') || 'Creating account...') : (t('auth.signUp') || 'Sign up')}
          </button>

          <p className="auth-footer-text">
            {t('auth.hasAccount') || 'Already have an account?'}{' '}
            <Link href="/login" className="auth-link">
              {t('auth.signIn') || 'Sign in'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
