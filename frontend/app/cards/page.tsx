'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI, Card } from '@/app/api/cards';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount, formatPercent } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import { Plus, CreditCard as CreditCardIcon, CheckSquare, Square, Copy, Check } from 'lucide-react';
import { getCardUrl } from '@/lib/utils';
import BulkActions from '@/components/BulkActions';
import LoadingState from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function CardsPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, isRTL } = useTranslations();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankFilter, setBankFilter] = useState('');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, cardId: string | null}>({isOpen: false, cardId: null});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadCards = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const res = await cardsAPI.list({ bank_name: bankFilter || undefined });
        setCards(res.items || []);
    } catch (err: any) {
        console.error('Cards API Error:', err);
      setError(err?.response?.data?.message || t('errors.generic'));
        setCards([]);
    } finally {
        setLoading(false);
    }
  }, [isAuthenticated, bankFilter, t]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCards();
    }
  }, [isAuthenticated, bankFilter, loadCards]);

  const toggleReveal = async (cardId: string) => {
    if (revealedCards.has(cardId)) {
      setRevealedCards(prev => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
      // Update card in list to remove revealed data
      setCards(prev => prev.map(c => c.id === cardId ? {
        ...c,
        card_number: undefined,
        cardholder_name: undefined,
        expiry_month: undefined,
        expiry_year: undefined,
        cvv: undefined
      } : c));
    } else {
      try {
        const cardData = await cardsAPI.get(cardId, true);
        setCards(prev => prev.map(c => c.id === cardId ? {
          ...c,
          card_number: cardData.card_number,
          cardholder_name: cardData.cardholder_name,
          expiry_month: cardData.expiry_month,
          expiry_year: cardData.expiry_year,
          cvv: cardData.cvv
        } : c));
        setRevealedCards(prev => new Set(prev).add(cardId));
      } catch (err) {
        console.error('Error revealing card:', err);
        toast.error(t('errors.generic'));
      }
    }
  };

  const copyCardNumber = async (card: Card) => {
    let cardNumber = '';
    
    if (revealedCards.has(card.id) && card.card_number) {
      cardNumber = card.card_number.replace(/\s/g, '');
    } else {
      // If not revealed, fetch it
      try {
        const cardData = await cardsAPI.get(card.id, true);
        cardNumber = cardData.card_number?.replace(/\s/g, '') || '';
        setCards(prev => prev.map(c => c.id === card.id ? {
          ...c,
          card_number: cardData.card_number,
          cardholder_name: cardData.cardholder_name,
          expiry_month: cardData.expiry_month,
          expiry_year: cardData.expiry_year,
          cvv: cardData.cvv
        } : c));
        setRevealedCards(prev => new Set(prev).add(card.id));
      } catch (err) {
        console.error('Error fetching card number:', err);
        toast.error(t('errors.generic'));
        return;
      }
    }

    if (cardNumber) {
      await navigator.clipboard.writeText(cardNumber);
      setCopiedCardId(card.id);
      toast.success(t('common.copied') || 'Card number copied!');
      setTimeout(() => setCopiedCardId(null), 2000);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ isOpen: true, cardId: id });
  };

  const confirmDelete = async () => {
    const id = deleteConfirm.cardId;
    if (!id) return;
    setDeleteConfirm({ isOpen: false, cardId: null });
    try {
      await cardsAPI.delete(id);
      setCards(cards.filter((c) => c.id !== id));
      setSelectedCards(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success(t('success.cardDeleted'));
    } catch (err) {
      toast.error(t('errors.generic'));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedCards(new Set(cards.map(c => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedCards(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedCards.size === 0) return;
    setBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirm(false);
    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedCards).map(id => cardsAPI.delete(id));
      await Promise.all(deletePromises);

      setCards(cards.filter(c => !selectedCards.has(c.id)));
      setSelectedCards(new Set());
      toast.success(t('success.cardsDeleted', { count: selectedCards.size }) ||
        `${selectedCards.size} card(s) deleted successfully`);
    } catch (err) {
      toast.error(t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  };

  const formatCardNumber = (cardNumber: string) => {
    // Remove spaces and format as 4-4-4-4
    const digits = cardNumber.replace(/\s/g, '');
    if (digits.length === 16) {
      return `${digits.slice(0, 4)}  ${digits.slice(4, 8)}  ${digits.slice(8, 12)}  ${digits.slice(12, 16)}`;
    }
    return cardNumber;
  };

  const formatCardNumberDisplay = (card: Card) => {
    if (revealedCards.has(card.id) && card.card_number) {
      return formatCardNumber(card.card_number);
    }
    // Show last 4 digits only
    return `****  ****  ****  ${card.card_last_four}`;
  };

  const getCardColor = () => {
    return 'off-white';
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="cards-page">
        {/* Page Header */}
        <div className="page-header-section">
          <div className="page-header-content">
            <div className="page-header-icon">
              <CreditCardIcon size={32} />
            </div>
            <div>
              <h1>{t('cards.title') || 'My Cards'}</h1>
              <p className="page-subtitle">{t('cards.subtitle') || 'Manage all your credit and debit cards'}</p>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="cards-actions-bar">
          <div className="search-container">
            <input
              type="text"
              placeholder={t('cards.filterByBank') || 'Filter by bank name...'}
              value={bankFilter}
              onChange={(e) => setBankFilter(e.target.value)}
              className="search-input-field"
            />
          </div>
          <Link href="/cards/new" className="btn btn-primary btn-add-card">
            <Plus size={18} />
            <span>{t('cards.addCard') || 'Add Card'}</span>
          </Link>
        </div>

        {/* Bulk Actions Bar */}
        {selectedCards.size > 0 && (
          <BulkActions
            selectedItems={selectedCards}
            totalItems={cards.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
            itemName="card"
            isLoading={deleting}
          />
        )}

        {/* Cards Grid */}
        {loading ? (
          <div className="card">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="card">
            <ErrorState 
              message={error}
              onRetry={loadCards}
            />
          </div>
        ) : cards.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={CreditCardIcon}
              title={t('cards.noCards') || 'No Cards Found'}
              description={t('cards.noCardsDescription') || 'Start by adding your first card to manage your finances'}
              action={{
                label: t('cards.addCardLink') || 'Add Your First Card',
                onClick: () => router.push('/cards/new')
              }}
            />
          </div>
        ) : (
          <div className="cards-grid">
            {cards.map((card, index) => {
              const usedPercentage = card.credit_limit && card.current_balance 
                ? (Number(card.current_balance) / Number(card.credit_limit)) * 100 
                : 0;
              const cardColor = getCardColor();
              
              const getCardNetwork = () => {
                if (card.card_network) {
                  const network = card.card_network.toLowerCase();
                  if (network.includes('visa')) return 'visa';
                  if (network.includes('master')) return 'mastercard';
                }
                return null;
              };

              const cardNetwork = getCardNetwork();

              const isSelected = selectedCards.has(card.id);
              
              return (
                <div key={card.id} className={`card-item-wrapper ${isSelected ? 'card-item-selected' : ''}`}>
                  <div className="credit-card-container">
                    <Link
                      href={getCardUrl(card.id, card.card_name)}
                      className={`credit-card ${cardColor}`}
                >
                      <div className="credit-card-header">
                        <div>
                          {card.is_favorite && <span className="card-favorite">★</span>}
                          <p className="credit-card-bank">{card.bank_name}</p>
                          <p className="credit-card-name-text">{card.card_name}</p>
                        </div>
                        {cardNetwork && (
                          <div className="credit-card-vendor-top">
                            {cardNetwork === 'visa' && (
                              <div className="card-network-visa">VISA</div>
                            )}
                            {cardNetwork === 'mastercard' && (
                              <div className="card-network-mastercard"></div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="credit-card-number-wrapper">
                        <div className="credit-card-number">
                          {revealedCards.has(card.id) && card.card_number
                            ? formatCardNumber(card.card_number)
                            : `****  ****  ****  ${card.card_last_four}`}
                        </div>
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await copyCardNumber(card);
                          }}
                          className="credit-card-copy-btn"
                          title={t('common.copy') || 'Copy card number'}
                        >
                          {copiedCardId === card.id ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>

                      <div className="credit-card-info">
                        <div>
                          <p className="credit-card-label">{t('cards.cardholder')}</p>
                          <p className="credit-card-holder">
                            {revealedCards.has(card.id) && card.cardholder_name
                              ? card.cardholder_name
                              : '••••'}
                          </p>
                        </div>
                        <div className="credit-card-expiry">
                          <p className="credit-card-label">{t('cards.expiry')}</p>
                          <p className="credit-card-expiry-value">
                            {revealedCards.has(card.id) && card.expiry_month && card.expiry_year
                              ? `${String(card.expiry_month).padStart(2, '0')}/${String(card.expiry_year).slice(-2)}`
                              : '**/**'}
                          </p>
                    </div>
                  </div>
                      {revealedCards.has(card.id) && card.cvv && (
                        <div className="credit-card-cvv-section">
                          <p className="credit-card-label">CVV</p>
                          <p className="credit-card-cvv-value">{card.cvv}</p>
                        </div>
                      )}
                    </Link>
                  </div>

                  <div className="card card-compact">
                    <div className="card-compact-header">
                      <label className="card-select-label">
                        <input
                          type="checkbox"
                          id={`card-${card.id}`}
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(card.id);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="card-select-checkbox"
                        />
                        <span className="card-select-text">{t('common.select')}</span>
                      </label>
                    </div>
                  {card.card_type === 'credit' && card.credit_limit && (
                    <div className="mb-4">
                        <div className="flex justify-between card-info-row">
                          <span className="text-secondary">{t('cards.creditLimit')}:</span>
                          <span className="card-value">{formatAmount(card.credit_limit)} <CurrencySymbol code={card.balance_currency} size={14} /></span>
                      </div>
                      {card.current_balance !== null && (
                        <>
                            <div className="progress-bar">
                            <div
                                className="progress-fill"
                              style={{ width: `${Math.min(usedPercentage, 100)}%` }}
                            ></div>
                          </div>
                            <div className="flex justify-between card-info-small">
                              <span>{t('cards.used')}: {formatAmount(card.current_balance)}</span>
                              <span>{t('cards.available')}: {formatAmount(Number(card.credit_limit) - Number(card.current_balance))}</span>
                            </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {card.card_type !== 'credit' && card.available_balance !== null && (
                      <p className="card-balance">
                        {t('cards.availableBalance')}: <span className="card-value">{formatAmount(card.available_balance)} <CurrencySymbol code={card.balance_currency} size={14} /></span>
                    </p>
                  )}
                  
                  {card.card_type === 'credit' && card.payment_due_date && (
                      <div className="card-payment-due">
                        <span className="card-payment-label">{t('cards.paymentDue')}:</span> {t('cards.day')} {card.payment_due_date}
                      {card.minimum_payment && (
                          <span className="card-payment-min">{t('cards.minimumPayment')}: {card.minimum_payment_percentage != null ? <>{formatPercent(card.minimum_payment_percentage)} {t('cards.ofAmountDue')}</> : <>{formatAmount(card.minimum_payment)} <CurrencySymbol code={card.balance_currency} size={12} /></>}</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Link
                        href={getCardUrl(card.id, card.card_name)}
                        className="btn btn-primary btn-flex"
                    >
                      {t('cards.viewDetails')}
                    </Link>
                    <button
                      onClick={() => handleDelete(card.id)}
                        className="btn btn-danger"
                    >
                      {t('common.delete')}
                    </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('cards.deleteCard') || 'Delete Card'}
        message={t('cards.deleteConfirm') || 'Are you sure you want to delete this card? This action cannot be undone.'}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, cardId: null })}
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        title={t('cards.deleteCards') || 'Delete Cards'}
        message={t('cards.deleteMultipleConfirm', { count: selectedCards.size }) || `Are you sure you want to delete ${selectedCards.size} card(s)? This action cannot be undone.`}
        confirmLabel={t('common.delete') || 'Delete'}
        cancelLabel={t('common.cancel') || 'Cancel'}
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </Layout>
  );
}
