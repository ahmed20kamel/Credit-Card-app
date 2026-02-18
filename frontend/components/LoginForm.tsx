'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/app/store/authStore';
import { useTranslations } from '@/lib/i18n';
import { getErrorMessage } from '@/lib/errors';
import { CreditCard, Eye, EyeOff } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { t } = useTranslations();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const loginFailedMsg = t('errors.loginFailed');
      const fallback = 'Login failed. Please check your credentials.';
      const errorMessage = getErrorMessage(err, (loginFailedMsg && loginFailedMsg !== 'errors.loginFailed' ? loginFailedMsg : fallback));
      setError(errorMessage);
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
          <p className="auth-subtitle">{t('auth.signInSubtitle') || 'Sign in to your account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}

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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder') || 'Enter your password'}
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
          </div>

          <button type="submit" disabled={isLoading} className="btn btn-primary btn-full">
            {isLoading ? (t('auth.signingIn') || 'Signing in...') : (t('auth.signIn') || 'Sign in')}
          </button>

          <p className="auth-footer-text">
            {t('auth.noAccount') || "Don't have an account?"}{' '}
            <Link href="/register" className="auth-link">
              {t('auth.signUp') || 'Sign up'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
