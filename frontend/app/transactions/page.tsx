'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/app/store/authStore';
import { transactionsAPI, Transaction } from '@/app/api/transactions';
import { cardsAPI, Card } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount, currencySymbol } from '@/lib/formatNumber';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  CreditCard,
  Wallet,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import BulkActions from '@/components/BulkActions';
import LoadingState from '@/components/ui/LoadingState';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';

export default function TransactionsPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, isRTL } = useTranslations();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string>('all');
  const [transactionType, setTransactionType] = useState<string>('all');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

      try {
        const [cardsRes, transactionsRes] = await Promise.all([
          cardsAPI.list().then((res) => res.items || []),
          transactionsAPI.list({
            card_id: selectedCard !== 'all' ? selectedCard : undefined,
            transaction_type: transactionType !== 'all' ? transactionType : undefined
          }).then((res) => res.items || [])
        ]);
        setCards(cardsRes);
        setTransactions(transactionsRes);
    } catch (err: any) {
        console.error('Error loading data:', err);
      setError(err?.response?.data?.message || t('errors.generic'));
      setTransactions([]);
      setCards([]);
    } finally {
        setLoading(false);
    }
  }, [isAuthenticated, selectedCard, transactionType, t]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, selectedCard, transactionType, loadData]);

  const handleDelete = async (id: string) => {
    if (confirm(t('transactions.deleteConfirm'))) {
      try {
        await transactionsAPI.delete(id);
        setSelectedTransactions(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        await loadData();
        toast.success(t('success.transactionDeleted'));
      } catch (err) {
        console.error('Error deleting transaction:', err);
        toast.error(t('errors.generic'));
      }
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTransactions(prev => {
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
    setSelectedTransactions(new Set(transactions.map(t => t.id)));
  };

  const handleDeselectAll = () => {
    setSelectedTransactions(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedTransactions.size === 0) return;

    const confirmMessage = t('transactions.deleteMultipleConfirm', { count: selectedTransactions.size }) || 
      `Are you sure you want to delete ${selectedTransactions.size} transaction(s)?`;
    
    if (!confirm(confirmMessage)) return;

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedTransactions).map(async (id) => {
        try {
          await transactionsAPI.delete(id);
          return { id, success: true };
        } catch (err: any) {
          // If 404, transaction might already be deleted, treat as success
          if (err?.response?.status === 404) {
            return { id, success: true };
          }
          throw err;
        }
      });

      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      if (failed > 0) {
        toast.error(t('errors.generic') || 'Some transactions could not be deleted');
      } else {
        const deletedCount = selectedTransactions.size;
        setSelectedTransactions(new Set());
        await loadData();
        toast.success(t('success.transactionsDeleted', { count: deletedCount }) || 
          `${deletedCount} transaction(s) deleted successfully`);
      }
    } catch (err) {
      console.error('Error deleting transactions:', err);
      toast.error(t('errors.generic'));
    } finally {
      setDeleting(false);
    }
  };

  if (!isAuthenticated) return null;

  const totalAmount = transactions.reduce((sum, txn) => {
    const isExpense = ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type);
    return sum + (isExpense ? -Number(txn.amount) : Number(txn.amount));
  }, 0);

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1>{t('transactions.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{t('transactions.subtitle')}</p>
        </div>

        {/* Summary Card */}
        {transactions.length > 0 && (
          <div className="summary-card info mb-6">
            <div className="summary-content">
              <div className="summary-label">{t('transactions.totalBalance')}</div>
              <div className="summary-value">
                {totalAmount >= 0 ? '+' : ''}{formatAmount(totalAmount)} <span className="summary-currency">{currencySymbol('AED')}</span>
              </div>
            </div>
            <div className="summary-icon">
              <Wallet size={28} />
            </div>
            <div className="summary-content text-right">
              <div className="summary-label">{t('transactions.totalTransactions')}</div>
              <div className="summary-value summary-value-sm">
                {transactions.length}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid grid-3">
            <div>
              <label className="flex items-center gap-2 mb-2">
                <Filter size={16} />
                {t('transactions.filterByCard')}
              </label>
              <SearchableSelect
                value={selectedCard}
                onChange={setSelectedCard}
                options={[t('transactions.allCards'), ...cards.map((c) => `${c.card_name} - ****${c.card_last_four}`)]}
                optionValues={['all', ...cards.map((c) => c.id)]}
                placeholder={t('common.search')}
                noMatchesText={t('common.noMatches')}
                aria-label={t('transactions.filterByCard')}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mb-2">
                <Filter size={16} />
                {t('transactions.filterByType')}
              </label>
              <SearchableSelect
                value={transactionType}
                onChange={setTransactionType}
                options={[
                  t('transactions.allTypes'),
                  t('transactions.purchase'),
                  t('transactions.withdrawal'),
                  t('transactions.payment'),
                  t('transactions.refund'),
                  t('transactions.transfer'),
                ]}
                optionValues={['all', 'purchase', 'withdrawal', 'payment', 'refund', 'transfer']}
                placeholder={t('common.search')}
                noMatchesText={t('common.noMatches')}
                aria-label={t('transactions.filterByType')}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={loadData}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                <RefreshCw size={18} />
                <span>{t('common.refresh')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Add Transaction Button */}
        <div className="mb-6 flex justify-end">
          <Link href="/sms-parser" className="btn btn-primary">
            <Plus size={18} />
            <span>{t('transactions.addTransaction')}</span>
          </Link>
        </div>

        {/* Bulk Actions Bar */}
        {selectedTransactions.size > 0 && (
          <BulkActions
            selectedItems={selectedTransactions}
            totalItems={transactions.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeleteSelected={handleDeleteSelected}
            itemName="transaction"
            isLoading={deleting}
          />
        )}

        {/* Transactions List */}
        {loading ? (
          <div className="card">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="card">
            <ErrorState 
              message={error}
              onRetry={loadData}
            />
          </div>
        ) : transactions.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Wallet}
              title={t('transactions.noTransactions') || 'No Transactions Found'}
              description={t('transactions.noTransactionsDescription') || 'Start by adding your first transaction'}
              action={{
                label: t('transactions.addFirstTransaction') || 'Add First Transaction',
                onClick: () => router.push('/sms-parser')
              }}
            />
          </div>
        ) : (
          <div className="card card-table">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <button
                        onClick={selectedTransactions.size === transactions.length ? handleDeselectAll : handleSelectAll}
                        className="table-checkbox-btn"
                        title={selectedTransactions.size === transactions.length ? t('common.deselectAll') : t('common.selectAll')}
                      >
                        {selectedTransactions.size === transactions.length ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </th>
                    <th>{t('transactions.date')}</th>
                    <th>{t('transactions.type')}</th>
                    <th>{t('transactions.merchant')}</th>
                    <th>{t('transactions.card')}</th>
                    <th className="text-right">{t('transactions.amount')}</th>
                    <th className="text-center">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const card = cards.find(c => c.id === txn.card_id);
                    const isExpense = ['purchase', 'withdrawal', 'payment'].includes(txn.transaction_type);
                    const isSelected = selectedTransactions.has(txn.id);
                    return (
                      <tr key={txn.id} className={isSelected ? 'table-row-selected' : ''}>
                        <td>
                          <button
                            onClick={() => handleToggleSelect(txn.id)}
                            className="table-checkbox-btn"
                            title={isSelected ? t('common.deselect') : t('common.select')}
                          >
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-light" />
                            <div>
                              <div className="transaction-date">
                              {format(new Date(txn.transaction_date), 'MMM dd, yyyy')}
                          </div>
                              <div className="transaction-time">
                            {format(new Date(txn.transaction_date), 'HH:mm')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {isExpense ? (
                              <TrendingDown size={18} className="transaction-icon-expense" />
                            ) : (
                              <TrendingUp size={18} className="transaction-icon-income" />
                            )}
                            <span className="transaction-badge" data-type={txn.transaction_type}>
                              {t(`transactions.${txn.transaction_type}`)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="transaction-merchant">
                            {txn.merchant_name || txn.description || 'No description'}
                          </div>
                          {txn.description && txn.merchant_name && (
                            <div className="transaction-description">
                              {txn.description}
                            </div>
                          )}
                          {txn.category && (
                            <span className="category-badge">
                              {txn.category}
                            </span>
                          )}
                        </td>
                        <td>
                          {card ? (
                            <div className="flex items-center gap-2">
                              <CreditCard size={16} className="text-light" />
                              <span className="transaction-card-name">
                                {card.card_name}
                              </span>
                              <span className="transaction-card-number">
                                ****{card.card_last_four}
                              </span>
                            </div>
                          ) : (
                            <span className="text-light">
                              {t('transactions.cash')}
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          <span className="transaction-amount" data-type={txn.transaction_type}>
                            {isExpense ? '-' : '+'}
                          {formatAmount(txn.amount)} {currencySymbol(txn.currency)}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handleDelete(txn.id)}
                            className="btn-icon btn-icon-danger"
                            title={t('common.delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
