'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { cardsAPI } from '@/app/api/cards';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import {
  FileText, ArrowLeft, Calendar, CreditCard, TrendingDown, TrendingUp,
  ChevronDown, ChevronUp, RefreshCw, Banknote, AlertCircle, CheckCircle,
  Building2, Receipt,
} from 'lucide-react';

type Statement = Awaited<ReturnType<typeof cardsAPI.listStatements>>[number];
type StatementTxn = { id: string; date: string; merchant: string | null; amount: number; type: string; currency: string; category: string | null };

const AR_MONTHS: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};
const EN_MONTHS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

const TXN_COLORS: Record<string, string> = {
  purchase: 'var(--danger)', payment: 'var(--success)',
  refund: 'var(--success)', withdrawal: 'var(--danger)',
  transfer: 'var(--primary)', deposit: 'var(--success)',
};
const TXN_LABELS: Record<string, { ar: string; en: string }> = {
  purchase: { ar: 'شراء', en: 'Purchase' },
  payment: { ar: 'دفعة', en: 'Payment' },
  refund: { ar: 'استرداد', en: 'Refund' },
  withdrawal: { ar: 'سحب', en: 'Withdrawal' },
  transfer: { ar: 'تحويل', en: 'Transfer' },
  deposit: { ar: 'إيداع', en: 'Deposit' },
};

function fmtDate(iso: string | null, locale = 'ar') {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = locale === 'ar' ? AR_MONTHS : EN_MONTHS;
  return `${d} ${months[m] || m} ${y}`;
}

function fmtPeriod(from: string | null, to: string | null, locale = 'ar') {
  const months = locale === 'ar' ? AR_MONTHS : EN_MONTHS;
  if (!from && !to) return locale === 'ar' ? 'فترة غير محددة' : 'Unspecified period';
  if (!to) return `${locale === 'ar' ? 'من' : 'From'} ${fmtDate(from, locale)}`;
  const [, mf] = (from || '').split('-');
  const [yt, mt] = (to || '').split('-');
  return `${months[mf] || mf} — ${months[mt] || mt} ${yt}`;
}

function groupByMonth(stmts: Statement[]) {
  const groups: Record<string, Statement[]> = {};
  for (const s of stmts) {
    const key = s.imported_at.slice(0, 7); // YYYY-MM
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function StatementsHistoryPage() {
  const router = useRouter();
  const { locale } = useTranslations();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [txns, setTxns] = useState<Record<string, StatementTxn[]>>({});
  const [loadingTxns, setLoadingTxns] = useState<string | null>(null);

  useEffect(() => {
    cardsAPI.listStatements()
      .then(setStatements)
      .catch(() => toast.error(locale === 'ar' ? 'فشل تحميل الكشوفات' : 'Failed to load statements'))
      .finally(() => setLoading(false));
  }, []);

  const toggleStatement = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!txns[id]) {
      setLoadingTxns(id);
      try {
        const res = await cardsAPI.getStatementTransactions(id);
        setTxns(prev => ({ ...prev, [id]: res.transactions }));
      } catch {
        toast.error(locale === 'ar' ? 'فشل تحميل المعاملات' : 'Failed to load transactions');
      } finally {
        setLoadingTxns(null);
      }
    }
  };

  if (loading) return (
    <Layout>
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <RefreshCw size={30} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-secondary)', marginTop: 12 }}>{locale === 'ar' ? 'جاري التحميل…' : 'Loading…'}</p>
      </div>
    </Layout>
  );

  const grouped = groupByMonth(statements);
  const totalImported = statements.reduce((s, x) => s + x.transactions_imported, 0);

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: 860 }}>

        {/* ── Header ── */}
        <div className="page-header-section" style={{ marginBottom: 'var(--space-6)' }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-back">
            <ArrowLeft size={16} /><span>{locale === 'ar' ? 'رجوع' : 'Back'}</span>
          </button>
          <div className="page-header-content">
            <div className="page-header-icon"><FileText size={28} /></div>
            <div className="page-header-text">
              <h1>{locale === 'ar' ? 'سجل الكشوفات' : 'Statement History'}</h1>
              <p className="page-subtitle">
                {locale === 'ar'
                  ? `${statements.length} كشف · ${totalImported} معاملة مستوردة`
                  : `${statements.length} statement${statements.length !== 1 ? 's' : ''} · ${totalImported} transactions imported`}
              </p>
            </div>
            <button onClick={() => router.push('/statement')} className="btn btn-primary">
              <FileText size={15} /> {locale === 'ar' ? 'رفع كشف جديد' : 'Upload Statement'}
            </button>
          </div>
        </div>

        {statements.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <FileText size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto var(--space-4)' }} />
            <h3>{locale === 'ar' ? 'لا توجد كشوفات مستوردة بعد' : 'No statements imported yet'}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              {locale === 'ar' ? 'ارفع كشف حساب من صفحة الاستيراد وسيظهر هنا' : 'Upload a statement from the import page and it will appear here'}
            </p>
            <button onClick={() => router.push('/statement')} className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
              {locale === 'ar' ? 'رفع الآن' : 'Upload Now'}
            </button>
          </div>
        ) : (
          grouped.map(([monthKey, monthStmts]) => {
            const [y, m] = monthKey.split('-');
            return (
              <div key={monthKey} style={{ marginBottom: 'var(--space-6)' }}>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <Calendar size={15} color="var(--text-secondary)" />
                  <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {locale === 'ar' ? AR_MONTHS[m] : EN_MONTHS[m]} {y} — {monthStmts.length} {locale === 'ar' ? (monthStmts.length === 1 ? 'كشف' : 'كشوفات') : (monthStmts.length === 1 ? 'statement' : 'statements')}
                  </h3>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {monthStmts.map(stmt => {
                    const isOpen = expandedId === stmt.id;
                    const stmtTxns = txns[stmt.id] || [];
                    const purchases = stmtTxns.filter(t => ['purchase', 'withdrawal'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
                    const payments = stmtTxns.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
                    const refunds = stmtTxns.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0);

                    return (
                      <div key={stmt.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Statement card header */}
                        <button
                          onClick={() => toggleStatement(stmt.id)}
                          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-4)', textAlign: 'start' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            {/* Card chip */}
                            <div style={{
                              width: 44, height: 28, borderRadius: 5, flexShrink: 0,
                              background: stmt.card_color || 'linear-gradient(135deg, var(--primary), #7c3aed)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            }} />

                            {/* Main info */}
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                <p style={{ fontWeight: 700, margin: 0, fontSize: '0.95rem' }}>
                                  {stmt.bank_name}
                                </p>
                                {stmt.card_last_four && (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                    •••• {stmt.card_last_four}
                                  </span>
                                )}
                                {stmt.card_name && (
                                  <span style={{ fontSize: '0.72rem', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 'var(--radius-sm)', padding: '1px 6px' }}>
                                    {stmt.card_name}
                                  </span>
                                )}
                              </div>
                              <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                <Building2 size={11} style={{ display: 'inline', marginLeft: 2 }} />
                                {fmtPeriod(stmt.statement_period_from, stmt.statement_period_to, locale)}
                              </p>
                            </div>

                            {/* Balances */}
                            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                              {stmt.statement_balance != null && (
                                <div style={{ textAlign: 'end' }}>
                                  <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0 }}>{locale === 'ar' ? 'رصيد الكشف' : 'Balance'}</p>
                                  <p style={{ fontWeight: 700, color: 'var(--danger)', margin: 0, fontSize: '0.92rem' }}>
                                    {formatAmount(stmt.statement_balance)} <CurrencySymbol code={stmt.currency} size={10} />
                                  </p>
                                </div>
                              )}
                              {stmt.payment_due_full_date && (
                                <div style={{ textAlign: 'end' }}>
                                  <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0 }}>{locale === 'ar' ? 'الاستحقاق' : 'Due'}</p>
                                  <p style={{ fontWeight: 600, color: '#f59e0b', margin: 0, fontSize: '0.82rem' }}>
                                    {fmtDate(stmt.payment_due_full_date, locale)}
                                  </p>
                                </div>
                              )}
                              <div style={{ textAlign: 'end' }}>
                                <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0 }}>{locale === 'ar' ? 'المعاملات' : 'Transactions'}</p>
                                <p style={{ fontWeight: 600, color: 'var(--primary)', margin: 0, fontSize: '0.88rem' }}>
                                  {stmt.transactions_imported}
                                  {stmt.transactions_skipped > 0 && (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginRight: 3 }}>
                                      (+{stmt.transactions_skipped} {locale === 'ar' ? 'مكررة' : 'dup.'})
                                    </span>
                                  )}
                                </p>
                              </div>
                              {isOpen ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
                            </div>
                          </div>

                          {/* Key metrics bar */}
                          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                            {stmt.credit_limit != null && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                {locale === 'ar' ? 'الحد' : 'Limit'}: <strong>{formatAmount(stmt.credit_limit)}</strong>
                              </span>
                            )}
                            {stmt.available_balance != null && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                {locale === 'ar' ? 'المتاح' : 'Available'}: <strong style={{ color: 'var(--success)' }}>{formatAmount(stmt.available_balance)}</strong>
                              </span>
                            )}
                            {stmt.minimum_payment != null && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                {locale === 'ar' ? 'الحد الأدنى' : 'Min. Payment'}: <strong style={{ color: '#f59e0b' }}>{formatAmount(stmt.minimum_payment)}</strong>
                              </span>
                            )}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>
                              {locale === 'ar' ? 'استُورد' : 'Imported'}: {fmtDate(stmt.imported_at.slice(0, 10), locale)}
                            </span>
                          </div>
                        </button>

                        {/* Expanded transactions */}
                        {isOpen && (
                          <div style={{ borderTop: '1px solid var(--border)' }}>
                            {loadingTxns === stmt.id ? (
                              <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
                              </div>
                            ) : (
                              <>
                                {/* Summary stats */}
                                {stmtTxns.length > 0 && (
                                  <div style={{ display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <TrendingDown size={13} color="var(--danger)" />
                                      {locale === 'ar' ? 'مصروفات' : 'Expenses'}: <strong style={{ color: 'var(--danger)' }}>{formatAmount(purchases)}</strong>
                                    </span>
                                    <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <TrendingUp size={13} color="var(--success)" />
                                      {locale === 'ar' ? 'دفعات' : 'Payments'}: <strong style={{ color: 'var(--success)' }}>{formatAmount(payments)}</strong>
                                    </span>
                                    {refunds > 0 && (
                                      <span style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <CheckCircle size={13} color="var(--success)" />
                                        {locale === 'ar' ? 'مسترد' : 'Refunds'}: <strong style={{ color: 'var(--success)' }}>{formatAmount(refunds)}</strong>
                                      </span>
                                    )}
                                    <span style={{ fontSize: '0.78rem', marginRight: 'auto', color: 'var(--text-secondary)' }}>
                                      {stmtTxns.length} {locale === 'ar' ? 'معاملة' : 'txn'}
                                    </span>
                                  </div>
                                )}

                                {/* Transactions table */}
                                {stmtTxns.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <Receipt size={24} style={{ margin: '0 auto var(--space-2)' }} />
                                    <p>{locale === 'ar' ? 'لا توجد معاملات مرتبطة بهذا الكشف' : 'No transactions linked to this statement'}</p>
                                    <p style={{ fontSize: '0.72rem' }}>{locale === 'ar' ? 'الكشوفات القديمة المرفوعة قبل هذه الميزة لا تملك ربط تلقائي' : 'Statements uploaded before this feature was added have no automatic linking'}</p>
                                  </div>
                                ) : (
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                      <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                          <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'start', color: 'var(--text-secondary)', fontWeight: 500 }}>{locale === 'ar' ? 'التاريخ' : 'Date'}</th>
                                          <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)', fontWeight: 500 }}>{locale === 'ar' ? 'الوصف' : 'Description'}</th>
                                          <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)', fontWeight: 500 }}>{locale === 'ar' ? 'الفئة' : 'Category'}</th>
                                          <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)', fontWeight: 500 }}>{locale === 'ar' ? 'النوع' : 'Type'}</th>
                                          <th style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'end', color: 'var(--text-secondary)', fontWeight: 500 }}>{locale === 'ar' ? 'المبلغ' : 'Amount'}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {stmtTxns.map(txn => {
                                          const isExp = ['purchase', 'withdrawal'].includes(txn.type);
                                          return (
                                            <tr key={txn.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                              <td style={{ padding: 'var(--space-2) var(--space-3)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                {fmtDate(txn.date, locale)}
                                              </td>
                                              <td style={{ padding: 'var(--space-2)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {txn.merchant || '—'}
                                              </td>
                                              <td style={{ padding: 'var(--space-2)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                {txn.category || '—'}
                                              </td>
                                              <td style={{ padding: 'var(--space-2)' }}>
                                                <span className="transaction-badge" data-type={txn.type} style={{ fontSize: '0.68rem' }}>
                                                  {(TXN_LABELS[txn.type] ?? {})[locale === 'ar' ? 'ar' : 'en'] || txn.type}
                                                </span>
                                              </td>
                                              <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'end', fontWeight: 700, whiteSpace: 'nowrap', color: TXN_COLORS[txn.type] || 'var(--text-primary)' }}>
                                                {isExp ? '-' : '+'}{formatAmount(txn.amount)} <CurrencySymbol code={txn.currency} size={10} />
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
