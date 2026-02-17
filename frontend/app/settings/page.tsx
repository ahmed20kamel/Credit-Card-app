'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { authAPI } from '@/app/api/auth';
import { getErrorMessage } from '@/lib/errors';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import toast from 'react-hot-toast';
import { User, Lock, Palette, Globe, Sun, Moon, Monitor } from 'lucide-react';
import PasswordStrength from '@/components/ui/PasswordStrength';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadUser } = useAuthStore();
  const { t, locale, setLocale } = useTranslations();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<Theme>('system');

  // Auth check - redirect to /login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => {
        toast.error(t('errors.unauthorized'));
        router.push('/login');
      });
    }
  }, [isAuthenticated, loadUser, router, t]);

  // Initialize form values from user data
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
    }
  }, [user]);

  // Initialize theme from storage
  useEffect(() => {
    setCurrentTheme(getTheme());
  }, []);

  // Handle profile update
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);
    try {
      await authAPI.updateProfile({ full_name: fullName });
      await loadUser();
      setProfileSuccess(t('settings.profileUpdated') || 'Profile updated successfully');
      toast.success(t('settings.profileUpdated') || 'Profile updated successfully');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, t('settings.profileUpdateFailed') || 'Failed to update profile');
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);
    try {
      await authAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(t('settings.passwordChanged') || 'Password changed successfully');
      toast.success(t('settings.passwordChanged') || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      const msg = getErrorMessage(err, t('settings.passwordChangeFailed') || 'Failed to change password');
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle theme change
  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    setTheme(theme);
  };

  // Handle language change
  const handleLanguageChange = (newLocale: 'en' | 'ar') => {
    if (newLocale !== locale) {
      setLocale(newLocale);
      authAPI.updateProfile({ preferred_language: newLocale }).catch(() => {});
      setTimeout(() => {
        router.refresh();
      }, 100);
    }
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="text-secondary">{t('common.loading')}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>{t('settings.title') || 'Settings'}</h1>
            <p className="text-secondary">{t('settings.subtitle') || 'Manage your account preferences'}</p>
          </div>
        </div>

        {/* Profile Information */}
        <div className="card settings-section">
          <h2 className="settings-section-title">
            <User size={20} />
            {t('settings.profileInfo') || 'Profile Information'}
          </h2>
          <form onSubmit={handleProfileSave}>
            {profileError && <div className="alert alert-error">{profileError}</div>}
            {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {t('settings.email') || 'Email'}
              </label>
              <input
                id="email"
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="fullName" className="form-label">
                {t('settings.fullName') || 'Full Name'}
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('settings.fullNamePlaceholder') || 'Enter your full name'}
                className="form-input"
              />
            </div>

            <button type="submit" disabled={profileLoading} className="btn btn-primary">
              {profileLoading
                ? (t('common.saving') || 'Saving...')
                : (t('settings.saveProfile') || 'Save')}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="card settings-section">
          <h2 className="settings-section-title">
            <Lock size={20} />
            {t('settings.changePassword') || 'Change Password'}
          </h2>
          <form onSubmit={handlePasswordChange}>
            {passwordError && <div className="alert alert-error">{passwordError}</div>}
            {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}

            <div className="form-group">
              <label htmlFor="currentPassword" className="form-label">
                {t('settings.currentPassword') || 'Current Password'}
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('settings.currentPasswordPlaceholder') || 'Enter current password'}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                {t('settings.newPassword') || 'New Password'}
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings.newPasswordPlaceholder') || 'Min 8 characters'}
                className="form-input"
              />
              <PasswordStrength password={newPassword} />
            </div>

            <button type="submit" disabled={passwordLoading} className="btn btn-primary">
              {passwordLoading
                ? (t('common.saving') || 'Changing...')
                : (t('settings.changePassword') || 'Change Password')}
            </button>
          </form>
        </div>

        {/* Appearance */}
        <div className="card settings-section">
          <h2 className="settings-section-title">
            <Palette size={20} />
            {t('settings.appearance') || 'Appearance'}
          </h2>
          <div className="theme-options">
            <button
              type="button"
              className={`theme-option ${currentTheme === 'light' ? 'active' : ''}`}
              onClick={() => handleThemeChange('light')}
            >
              <Sun size={24} />
              <span>{t('settings.themeLight') || 'Light'}</span>
            </button>
            <button
              type="button"
              className={`theme-option ${currentTheme === 'dark' ? 'active' : ''}`}
              onClick={() => handleThemeChange('dark')}
            >
              <Moon size={24} />
              <span>{t('settings.themeDark') || 'Dark'}</span>
            </button>
            <button
              type="button"
              className={`theme-option ${currentTheme === 'system' ? 'active' : ''}`}
              onClick={() => handleThemeChange('system')}
            >
              <Monitor size={24} />
              <span>{t('settings.themeSystem') || 'System'}</span>
            </button>
          </div>
        </div>

        {/* Language */}
        <div className="card settings-section">
          <h2 className="settings-section-title">
            <Globe size={20} />
            {t('settings.language') || 'Language'}
          </h2>
          <div className="theme-options">
            <button
              type="button"
              className={`theme-option ${locale === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              <span style={{ fontSize: '1.5rem' }}>EN</span>
              <span>{t('settings.english') || 'English'}</span>
            </button>
            <button
              type="button"
              className={`theme-option ${locale === 'ar' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('ar')}
            >
              <span style={{ fontSize: '1.5rem' }}>AR</span>
              <span>{t('settings.arabic') || 'Arabic'}</span>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
