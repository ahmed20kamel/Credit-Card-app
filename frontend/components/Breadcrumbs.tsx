'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight, MoreHorizontal } from 'lucide-react';
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
  const { t, isRTL } = useTranslations();
  const [cardName, setCardName] = useState<string | null>(null);

  useEffect(() => {
    // If we're on a card detail page, fetch the card name
    if (pathname?.startsWith('/cards/') && pathname !== '/cards' && pathname !== '/cards/new') {
      const cardId = extractCardId(pathname);
      if (cardId && cardId.length === 36) {
        cardsAPI.get(cardId, false)
          .then((card) => {
            setCardName(card.card_name);
          })
          .catch(() => {
            // Ignore errors
          });
      }
    } else {
      setCardName(null);
    }
  }, [pathname]);

  if (!pathname || pathname === '/login' || pathname === '/register') {
    return null;
  }

  // Standard path to label mapping
  const pathLabelMap: Record<string, string> = {
    'dashboard': t('navigation.dashboard'),
    'cards': t('navigation.cards'),
    'transactions': t('navigation.transactions'),
    'sms-parser': 'SMS Parser',
    'new': t('common.add'),
    'edit': t('common.edit'),
  };

  // Build breadcrumbs
  const paths = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Dashboard
  breadcrumbs.push({
    label: t('navigation.dashboard'),
    href: '/dashboard',
    isActive: false,
  });

  // Process paths
  paths.forEach((path, index) => {
    // Skip dashboard if it's the first path
    if (path === 'dashboard' && index === 0) {
      return;
    }

    const isLast = index === paths.length - 1;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const isCardDetail = uuidPattern.test(path);

    // Handle card detail pages
    if (isCardDetail && isLast && cardName) {
      breadcrumbs.push({
        label: cardName,
        href: '/' + paths.slice(0, index + 1).join('/'),
        isActive: true,
      });
      return;
    }

    // Skip UUID paths (handled above)
    if (isCardDetail) {
      return;
    }

    // Get label from map or format path
    let label = pathLabelMap[path] || path
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Special handling for sms-parser
    if (path === 'sms-parser') {
      label = 'SMS Parser';
    }

    breadcrumbs.push({
      label,
      href: '/' + paths.slice(0, index + 1).join('/'),
      isActive: isLast,
    });
  });

  // Collapse if more than 4 items (Dashboard + 3 others)
  const shouldCollapse = breadcrumbs.length > 4;
  const visibleItems: BreadcrumbItem[] = [];

  if (shouldCollapse) {
    // Always show: Dashboard, ... , second-to-last, last
    visibleItems.push(breadcrumbs[0]); // Dashboard
    visibleItems.push({ label: '...', href: '', isActive: false }); // Collapse indicator
    visibleItems.push(breadcrumbs[breadcrumbs.length - 2]); // Second to last
    visibleItems.push(breadcrumbs[breadcrumbs.length - 1]); // Last
  } else {
    visibleItems.push(...breadcrumbs);
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {visibleItems.map((crumb, index) => {
        const isCollapse = crumb.label === '...';
        const isLast = index === visibleItems.length - 1;

        return (
          <div key={`${crumb.href}-${index}`} className="breadcrumb-item">
            {index === 0 ? (
              <Link href={crumb.href} className="breadcrumb-link breadcrumb-home" title={crumb.label}>
                <Home size={16} />
              </Link>
            ) : isCollapse ? (
              <span className="breadcrumb-collapse">
                <MoreHorizontal size={16} />
              </span>
            ) : isLast ? (
              <span className="breadcrumb-current" title={crumb.label}>
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="breadcrumb-link" title={crumb.label}>
                {crumb.label}
              </Link>
            )}
            {!isLast && (
              <ChevronRight 
                size={16} 
                className="breadcrumb-separator"
                style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
