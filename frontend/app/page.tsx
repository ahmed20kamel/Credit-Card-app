'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from './store/authStore';
import LoginForm from '@/components/LoginForm';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    loadUser().then(() => {
      setChecked(true);
      if (isAuthenticated) {
        router.push('/dashboard');
      }
    });
  }, [isAuthenticated, router, loadUser]);

  // Show login on home to avoid depending on /login route
  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">CardVault</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return null; // سيتم التوجيه لـ /dashboard من الـ useEffect
  }

  return <LoginForm />;
}
