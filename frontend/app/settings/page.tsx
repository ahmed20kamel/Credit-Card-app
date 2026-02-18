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
import {
  User,
  Lock,
  Palette,
  Globe,
  Sun,
  Moon,
  Monitor,
  Mail,
  Eye,
  EyeOff,
  Shield,
  Check,
  Save,
} from 'lucide-react';
import PasswordStrength from '@/components/ui/PasswordStrength';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadUser } = useAuthStore();
  const { t, locale, setLocale } = useTranslations();

  const [fullName, setFullName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [currentTheme, setCurrentTheme] = useState<Theme>('system');

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => {
        toast.error(t('errors.unauthorized'));
        router.push('/login');
      });
    }
  }, [isAuthenticated, loadUser, router, t]);

  useEffect(() => {
    if (user) setFullName(user.full_name || '');
  }, [user]);

  useEffect(() => {
    setCurrentTheme(getTheme());
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await authAPI.updateProfile({ full_name: fullName });
      await loadUser();
      toast.success(t('settings.profileUpdated') || 'Profile updated successfully');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('settings.profileUpdateFailed') || 'Failed to update profile'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      await authAPI.changePassword({ current_password: currentPassword, new_password: newPassword });
      toast.success(t('settings.passwordChanged') || 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('settings.passwordChangeFailed') || 'Failed to change password'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    setTheme(theme);
  };

  const handleLanguageChange = (newLocale: 'en' | 'ar') => {
    if (newLocale !== locale) {
      setLocale(newLocale);
      authAPI.updateProfile({ preferred_language: newLocale }).catch(() => {});
      setTimeout(() => router.refresh(), 100);
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
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <User size={32} />
            </div>
            <div className="page-header-text">
              <h1>{t('settings.title') || 'Settings'}</h1>
              <p className="page-subtitle">{t('settings.subtitle') || 'Manage your account preferences'}</p>
            </div>
          </div>
        </div>

        <div className="settings-layout">
          {/* Left Column */}
          <div className="settings-column">
            {/* Profile */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon profile">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.profileInfo') || 'Profile Information'}</h2>
                  <p className="settings-card-desc">{t('settings.profileDesc') || 'Update your personal details'}</p>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="settings-form">
                <div className="form-group">
                  <label htmlFor="email" className="settings-label">
                    <Mail size={14} />
                    {t('settings.email') || 'Email'}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    disabled
                    className="form-input settings-input-disabled"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fullName" className="settings-label">
                    <User size={14} />
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

                <button type="submit" disabled={profileLoading} className="btn btn-primary settings-save-btn">
                  <Save size={16} />
                  {profileLoading ? (t('common.saving') || 'Saving...') : (t('settings.saveProfile') || 'Save')}
                </button>
              </form>
            </div>

            {/* Password */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon security">
                  <Shield size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.passwordSection') || 'Change Password'}</h2>
                  <p className="settings-card-desc">{t('settings.passwordDesc') || 'Keep your account secure'}</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="settings-form">
                <div className="form-group">
                  <label htmlFor="currentPassword" className="settings-label">
                    <Lock size={14} />
                    {t('settings.currentPassword') || 'Current Password'}
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('settings.currentPasswordPlaceholder') || 'Enter current password'}
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      tabIndex={-1}
                    >
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="settings-label">
                    <Lock size={14} />
                    {t('settings.newPassword') || 'New Password'}
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('settings.newPasswordPlaceholder') || 'Min 8 characters'}
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>

                <button type="submit" disabled={passwordLoading} className="btn btn-primary settings-save-btn">
                  <Lock size={16} />
                  {passwordLoading ? (t('common.saving') || 'Changing...') : (t('settings.changePassword') || 'Change Password')}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column */}
          <div className="settings-column">
            {/* Appearance */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon appearance">
                  <Palette size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.themeSection') || 'Appearance'}</h2>
                  <p className="settings-card-desc">{t('settings.themeDesc') || 'Choose your preferred theme'}</p>
                </div>
              </div>

              <div className="settings-theme-grid">
                {([
                  { key: 'light' as Theme, icon: Sun, label: t('settings.themeLight') || 'Light' },
                  { key: 'dark' as Theme, icon: Moon, label: t('settings.themeDark') || 'Dark' },
                  { key: 'system' as Theme, icon: Monitor, label: t('settings.themeSystem') || 'System' },
                ]).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`settings-theme-card ${currentTheme === key ? 'active' : ''}`}
                    onClick={() => handleThemeChange(key)}
                  >
                    <div className="settings-theme-icon">
                      <Icon size={28} />
                    </div>
                    <div className="settings-theme-label">{label}</div>
                    {currentTheme === key && (
                      <div className="settings-theme-check">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="card settings-card">
              <div className="settings-card-header">
                <div className="settings-card-icon language">
                  <Globe size={20} />
                </div>
                <div>
                  <h2 className="settings-card-title">{t('settings.languageSection') || 'Language'}</h2>
                  <p className="settings-card-desc">{t('settings.languageDesc') || 'Select your preferred language'}</p>
                </div>
              </div>

              <div className="settings-lang-grid">
                <button
                  type="button"
                  className={`settings-lang-card ${locale === 'en' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('en')}
                >
                  <div className="settings-lang-info">
                    <div className="settings-lang-name">{t('settings.english') || 'English'}</div>
                    <div className="settings-lang-native">English</div>
                  </div>
                  {locale === 'en' && (
                    <div className="settings-lang-check">
                      <Check size={14} />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  className={`settings-lang-card ${locale === 'ar' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('ar')}
                >
                  <div className="settings-lang-info">
                    <div className="settings-lang-name">{t('settings.arabic') || 'Arabic'}</div>
                    <div className="settings-lang-native">العربية</div>
                  </div>
                  {locale === 'ar' && (
                    <div className="settings-lang-check">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
