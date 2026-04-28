'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, ChevronRight, ChevronLeft, MoreHorizontal } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { cardsAPI } from '@/app/api/cards';
import { extractCardId } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href: string;
  isActive: boolean;
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslations();
  const [cardName, setCardName] = useState<string | null>(null);
  const [isRtl, setIsRtl] = useState(false);

  useEffect(() => {
    setIsRtl(document.documentElement.getAttribute('dir') === 'rtl');
    const observer = new MutationObserver(() => {
      setIsRtl(document.documentElement.getAttribute('dir') === 'rtl');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pathname?.startsWith('/cards/') && pathname !== '/cards' && pathname !== '/cards/new') {
      const cardId = extractCardId(pathname);
      if (cardId && cardId.length === 36) {
        cardsAPI.get(cardId, false)
          .then((card) => setCardName(card.card_name))
          .catch(() => {});
      }
    } else {
      setCardName(null);
    }
  }, [pathname]);

  if (!pathname || pathname === '/login' || pathname === '/register') return null;

  const pathLabelMap: Record<string, string> = {
    'dashboard': t('navigation.dashboard'),
    'cards': t('navigation.cards'),
    'transactions': t('navigation.transactions'),
    'sms-parser': t('navigation.smsParser'),
    'new': t('common.add'),
    'edit': t('common.edit'),
  };

  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  breadcrumbs.push({ label: t('navigation.dashboard'), href: '/dashboard', isActive: false });

  paths.forEach((path, index) => {
    if (path === 'dashboard' && index === 0) return;
    const isLast = index === paths.length - 1;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const isCardDetail = uuidPattern.test(path);
    if (isCardDetail && isLast && cardName) {
      breadcrumbs.push({ label: cardName, href: '/' + paths.slice(0, index + 1).join('/'), isActive: true });
      return;
    }
    if (isCardDetail) return;
    let label = pathLabelMap[path] || path.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    if (path === 'sms-parser') label = t('navigation.smsParser');
    breadcrumbs.push({ label, href: '/' + paths.slice(0, index + 1).join('/'), isActive: isLast });
  });

  const shouldCollapse = breadcrumbs.length > 4;
  const visibleItems: BreadcrumbItem[] = shouldCollapse
    ? [breadcrumbs[0], { label: '...', href: '', isActive: false }, breadcrumbs[breadcrumbs.length - 2], breadcrumbs[breadcrumbs.length - 1]]
    : [...breadcrumbs];

  const canGoBack = pathname !== '/dashboard';
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;
  const SepIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="page-top-bar">
      <div className="page-top-bar-inner">
        {/* Back Button */}
        {canGoBack && (
          <button className="top-bar-back-btn" onClick={() => router.back()} aria-label={t('common.back') || 'Back'}>
            <BackIcon size={16} />
            <span>{t('common.back') || 'Back'}</span>
          </button>
        )}

        {/* Divider */}
        {canGoBack && <div className="top-bar-divider" />}

        {/* Breadcrumbs */}
        <nav className="top-bar-breadcrumbs" aria-label="Breadcrumb">
          {visibleItems.map((crumb, index) => {
            const isCollapse = crumb.label === '...';
            const isLast = index === visibleItems.length - 1;
            return (
              <div key={`${crumb.href}-${index}`} className="top-bar-crumb-item">
                {index === 0 ? (
                  <Link href={crumb.href} className="top-bar-crumb-link top-bar-crumb-home" title={crumb.label}>
                    <Home size={15} />
                  </Link>
                ) : isCollapse ? (
                  <span className="top-bar-crumb-collapse"><MoreHorizontal size={15} /></span>
                ) : isLast ? (
                  <span className="top-bar-crumb-current">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="top-bar-crumb-link">{crumb.label}</Link>
                )}
                {!isLast && <SepIcon size={14} className="top-bar-crumb-sep" />}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
