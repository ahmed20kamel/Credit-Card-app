import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'CardVault - Credit Card & Cash Management',
  description: 'Manage your credit cards and cash transactions',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const locale = localStorage.getItem('locale') || 'en';
                  const dir = locale === 'ar' ? 'rtl' : 'ltr';
                  if (document.documentElement) {
                    document.documentElement.setAttribute('dir', dir);
                    document.documentElement.setAttribute('lang', locale);
                    document.documentElement.setAttribute('data-locale', locale);
                  }
                } catch (e) {
                  console.error('Error setting initial locale:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
