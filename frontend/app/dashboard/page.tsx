'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/app/store/authStore';
import { transactionsAPI } from '@/app/api/transactions';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { getErrorMessage } from '@/lib/errors';
import toast from 'react-hot-toast';
import type { Transaction, MonthlySummary, MonthlyChartData, CategoryChartData } from '@/types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRight,
  Receipt,
  CreditCard,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#6B2C91', '#8B4FA8', '#0D9488', '#C2410C', '#D97706', '#A855C7', '#9333EA', '#7C3AED'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => {
        toast.error(t('errors.unauthorized'));
        router.push('/login');
      });
    }
  }, [isAuthenticated, loadUser, router, t]);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([
        transactionsAPI.list({ per_page: 100 }).then((res) => {
          setTransactions(res.items || []);
        }).catch(() => {
          setTransactions([]);
        }),
        transactionsAPI.monthlySummary(
          new Date().getFullYear(),
          new Date().getMonth() + 1
        ).then((data) => setSummary(data)).catch(() => {}),
      ]).finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  const monthlyData = useMemo(() => {
    return transactions.reduce((acc: MonthlyChartData[], txn) => {
      const month = new Date(txn.transaction_date).toLocaleDateString('en-US', { month: 'short' });
      const existing = acc.find(item => item.month === month);
      const isExpense = ['purchase', 'withdrawal'].includes(txn.transaction_type);
      const amount = Number(txn.amount);

      if (existing) {
        if (isExpense) {
          existing.spent += amount;
        } else {
          existing.income += amount;
        }
      } else {
        acc.push({
          month,
          spent: isExpense ? amount : 0,
          income: isExpense ? 0 : amount,
        });
      }
      return acc;
    }, []).sort((a, b) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.indexOf(a.month) - months.indexOf(b.month);
    });
  }, [transactions]);

  const pieData = useMemo(() => {
    const categoryMap = transactions.reduce((acc: Record<string, number>, txn) => {
      if (['purchase', 'withdrawal'].includes(txn.transaction_type)) {
        const category = txn.category || t('transactions.purchase');
        acc[category] = (acc[category] || 0) + Number(txn.amount);
      }
      return acc;
    }, {});

    return Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [transactions, t]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .slice(0, 5);
  }, [transactions]);

  if (!isAuthenticated && loading) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="text-secondary">{t('common.loading')}</p>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="page-header">
          <div>
            <h1>{t('dashboard.title')}</h1>
            <p className="text-secondary">{t('dashboard.subtitle')}</p>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-3 mb-8">
            <div className="summary-card danger">
              <div className="summary-content">
                <div className="summary-label">{t('dashboard.totalSpent')}</div>
                <div className="summary-value">
                  {summary.total_spent?.toFixed(2) || '0.00'} <span className="summary-currency">{summary.currency || 'AED'}</span>
                </div>
              </div>
              <div className="summary-icon">
                <TrendingDown size={24} />
              </div>
            </div>

            <div className="summary-card success">
              <div className="summary-content">
                <div className="summary-label">{t('dashboard.totalIncome')}</div>
                <div className="summary-value">
                  {summary.total_income?.toFixed(2) || '0.00'} <span className="summary-currency">{summary.currency || 'AED'}</span>
                </div>
              </div>
              <div className="summary-icon">
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="summary-card info">
              <div className="summary-content">
                <div className="summary-label">{t('dashboard.net')}</div>
                <div className="summary-value">
                  {summary.net?.toFixed(2) || '0.00'} <span className="summary-currency">{summary.currency || 'AED'}</span>
                </div>
              </div>
              <div className="summary-icon">
                <DollarSign size={24} />
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {transactions.length > 0 && (
          <div className="grid grid-2 mb-8">
            {monthlyData.length > 0 && (
              <div className="card">
                <h3 className="card-section-title-small">{t('dashboard.monthlySpending')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--text-secondary)" fontSize={12} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text)',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="spent" stroke="#DC2626" strokeWidth={2} name={t('dashboard.totalSpent')} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="income" stroke="#059669" strokeWidth={2} name={t('dashboard.totalIncome')} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {pieData.length > 0 && (
              <div className="card">
                <h3 className="card-section-title-small">{t('dashboard.byCategory')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props) => `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#888"
                      dataKey="value"
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        color: 'var(--text)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Recent Transactions */}
        {recentTransactions.length > 0 && (
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-section-title-small" style={{ marginBottom: 0 }}>
                <Receipt size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                {t('dashboard.recentTransactions') || 'Recent Transactions'}
              </h3>
              <Link href="/transactions" className="btn btn-secondary btn-sm">
                {t('common.viewAll') || 'View All'}
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="recent-transactions-list">
              {recentTransactions.map((txn) => {
                const isExpense = ['purchase', 'withdrawal'].includes(txn.transaction_type);
                return (
                  <div key={txn.id} className="recent-transaction-item">
                    <div className="recent-transaction-left">
                      <div className={`recent-transaction-icon ${isExpense ? 'expense' : 'income'}`}>
                        {isExpense ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
                      </div>
                      <div>
                        <div className="recent-transaction-merchant">
                          {txn.merchant_name || t(`transactions.${txn.transaction_type}`) || txn.transaction_type}
                        </div>
                        <div className="recent-transaction-date">
                          {new Date(txn.transaction_date).toLocaleDateString()}
                          {txn.card_last_four && (
                            <span className="recent-transaction-card">
                              <CreditCard size={12} /> ****{txn.card_last_four}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`recent-transaction-amount ${isExpense ? 'expense' : 'income'}`}>
                      {isExpense ? '-' : '+'}{Number(txn.amount).toFixed(2)} {txn.currency}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && transactions.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <Receipt size={48} style={{ color: 'var(--text-light)', margin: '0 auto 1rem' }} />
            <h3>{t('transactions.noTransactions') || 'No transactions yet'}</h3>
            <p className="text-secondary" style={{ marginBottom: '1rem' }}>
              {t('transactions.noTransactionsDesc') || 'Start by adding your first transaction'}
            </p>
            <Link href="/sms-parser" className="btn btn-primary">
              {t('navigation.addTransaction') || 'Add Transaction'}
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
