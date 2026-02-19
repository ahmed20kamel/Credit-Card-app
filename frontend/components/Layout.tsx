'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { useTranslations } from '@/lib/i18n';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Breadcrumbs from './Breadcrumbs';
import ChatPanel from './ChatPanel';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="app-container">
      <Navbar />
      <Sidebar userEmail={user?.email} onLogout={handleLogout} />
      <main className="main-content">
        <div className="content-wrapper">
          <Breadcrumbs />
          {children}
        </div>
      </main>
      <ChatPanel />
    </div>
  );
}
