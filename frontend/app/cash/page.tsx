'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { formatAmount } from '@/lib/formatNumber';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useAuthStore } from '@/app/store/authStore';
import { cashAPI } from '@/app/api/cash';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/errors';
import type { CashEntry, CashEntryCreateRequest } from '@/types';
import { Banknote, Plus, TrendingUp, TrendingDown, Trash2, X } from 'lucide-react';

export default function CashPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t, isRTL } = useTranslations();

  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const [balanceCurrency, setBalanceCurrency] = useState<string>('AED');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  // Form state
  const [entryType, setEntryType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const [entriesRes, balanceRes] = await Promise.all([
        cashAPI.list().then((res) => res.items || []),
        cashAPI.getBalance(),
      ]);
      setEntries(entriesRes);
      setBalance(balanceRes.balance);
      setBalanceCurrency(balanceRes.currency || 'AED');
    } catch (err: any) {
      console.error('Error loading cash data:', err);
      toast.error(getErrorMessage(err, t('errors.generic') || 'An error occurred'));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  const resetForm = () => {
    setEntryType('income');
    setAmount('');
    setCurrency('AED');
    setDescription('');
    setCategory('');
    setEntryDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      toast.error(t('cash.invalidAmount') || 'Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      const data: CashEntryCreateRequest = {
        entry_type: entryType,
        amount: Number(amount),
        currency,
        description: description || undefined,
        category: category || undefined,
        entry_date: entryDate,
      };

      await cashAPI.create(data);
      toast.success(t('cash.entryAdded') || 'Cash entry added successfully');
      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating cash entry:', err);
      toast.error(getErrorMessage(err, t('errors.generic') || 'An error occurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('cash.deleteConfirm') || 'Are you sure you want to delete this entry?')) {
      try {
        await cashAPI.delete(id);
        toast.success(t('cash.entryDeleted') || 'Cash entry deleted');
        await loadData();
      } catch (err: any) {
        console.error('Error deleting cash entry:', err);
        toast.error(getErrorMessage(err, t('errors.generic') || 'An error occurred'));
      }
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (filter === 'all') return true;
    return entry.entry_type === filter;
  });

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Banknote size={28} />
            <h1>{t('cash.title') || 'Cash Management'}</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {t('cash.subtitle') || 'Track your cash income and expenses'}
          </p>
        </div>

        {/* Cash Balance Card */}
        <div className="cash-balance-card">
          <div className="cash-balance-label">
            {t('cash.totalBalance') || 'Total Cash Balance'}
          </div>
          <div className="cash-balance-amount">
            {loading ? '...' : `${formatAmount(balance)} ${balanceCurrency}`}
          </div>
        </div>

        {/* Add Entry Button */}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="btn btn-primary"
          >
            {showForm ? (
              <>
                <X size={18} />
                <span>{t('common.cancel') || 'Cancel'}</span>
              </>
            ) : (
              <>
                <Plus size={18} />
                <span>{t('cash.addEntry') || 'Add Entry'}</span>
              </>
            )}
          </button>
        </div>

        {/* Add Entry Form */}
        {showForm && (
          <div className="card mb-6">
            <h3 style={{ marginBottom: '1rem' }}>
              {t('cash.newEntry') || 'New Cash Entry'}
            </h3>
            <form onSubmit={handleSubmit}>
              {/* Entry Type Toggle */}
              <div className="form-group">
                <label>{t('cash.entryType') || 'Entry Type'}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType('income')}
                    className={`btn ${entryType === 'income' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    <TrendingUp size={16} />
                    <span>{t('cash.income') || 'Income'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType('expense')}
                    className={`btn ${entryType === 'expense' ? 'btn-danger' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    <TrendingDown size={16} />
                    <span>{t('cash.expense') || 'Expense'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-2">
                {/* Amount */}
                <div className="form-group">
                  <label>{t('cash.amount') || 'Amount'} *</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={t('cash.amountPlaceholder') || 'Enter amount'}
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>

                {/* Currency */}
                <div className="form-group">
                  <label>{t('cash.currency') || 'Currency'}</label>
                  <SearchableSelect
                    value={currency}
                    onChange={setCurrency}
                    options={['AED', 'USD', 'EUR', 'GBP', 'SAR']}
                    placeholder={t('common.search')}
                    noMatchesText={t('common.noMatches')}
                  />
                </div>
              </div>

              <div className="grid grid-2">
                {/* Description */}
                <div className="form-group">
                  <label>{t('cash.description') || 'Description'}</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('cash.descriptionPlaceholder') || 'Enter description'}
                  />
                </div>

                {/* Category */}
                <div className="form-group">
                  <label>{t('cash.category') || 'Category'}</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={t('cash.categoryPlaceholder') || 'Enter category'}
                  />
                </div>
              </div>

              {/* Date */}
              <div className="form-group">
                <label>{t('cash.date') || 'Date'}</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-2" style={{ marginTop: '1rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? (t('common.saving') || 'Saving...')
                    : (t('cash.addEntry') || 'Add Entry')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="btn btn-secondary"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="card mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              {t('cash.all') || 'All'}
            </button>
            <button
              onClick={() => setFilter('income')}
              className={`btn ${filter === 'income' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <TrendingUp size={16} />
              <span>{t('cash.income') || 'Income'}</span>
            </button>
            <button
              onClick={() => setFilter('expense')}
              className={`btn ${filter === 'expense' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <TrendingDown size={16} />
              <span>{t('cash.expense') || 'Expense'}</span>
            </button>
          </div>
        </div>

        {/* Entries List */}
        {loading ? (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              {t('common.loading') || 'Loading...'}
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <Banknote size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>{t('cash.noEntries') || 'No cash entries found'}</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {t('cash.noEntriesDescription') || 'Start by adding your first cash entry'}
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            {filteredEntries.map((entry) => {
              const isIncome = entry.entry_type === 'income';
              return (
                <div key={entry.id} className="cash-entry-item">
                  <div className="flex items-center gap-3" style={{ flex: 1 }}>
                    {isIncome ? (
                      <TrendingUp size={20} style={{ color: 'var(--success)' }} />
                    ) : (
                      <TrendingDown size={20} style={{ color: 'var(--danger)' }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {entry.description || (isIncome ? (t('cash.income') || 'Income') : (t('cash.expense') || 'Expense'))}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {entry.category && (
                          <span style={{ marginRight: '0.5rem' }}>{entry.category}</span>
                        )}
                        <span>{entry.entry_date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontWeight: 600,
                        color: isIncome ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {isIncome ? '+' : '-'}{formatAmount(entry.amount)} {entry.currency}
                    </span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="btn-icon btn-icon-danger"
                      title={t('common.delete') || 'Delete'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
