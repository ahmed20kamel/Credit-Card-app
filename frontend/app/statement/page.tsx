'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { cardsAPI } from '@/app/api/cards';
import { useTranslations } from '@/lib/i18n';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle, AlertCircle, Loader2,
  CreditCard, Receipt, X, ChevronDown, ChevronUp,
  Building2, Calendar, Banknote, TrendingDown, TrendingUp,
  RefreshCw, ArrowLeft,
} from 'lucide-react';

type CardInfo = {
  bank_name?: string; card_name?: string; card_last_four?: string;
  cardholder_name?: string; credit_limit?: number; available_balance?: number;
  statement_balance?: number; statement_date?: number; payment_due_date?: number;
  payment_due_full_date?: string; minimum_payment?: number;
  minimum_payment_percentage?: number; annual_fee?: number;
  late_payment_fee?: number; over_limit_fee?: number;
  account_manager_name?: string; account_manager_phone?: string;
  bank_emails?: string[]; currency?: string;
  statement_period_from?: string; statement_period_to?: string;
};

type ParsedTxn = {
  date: string; merchant: string; amount: number;
  type: string; currency: string; category?: string;
  selected?: boolean;
};

type ParseResult = {
  card_info: CardInfo;
  transactions: ParsedTxn[];
  transaction_count: number;
  matched_card_id?: string;
  matched_card_name?: string;
};

type ImportResult = {
  card_created: boolean;
  transactions_created: number;
  transactions_skipped: number;
  total_transactions: number;
};

const TXN_TYPE_LABELS: Record<string, string> = {
  purchase: 'شراء', payment: 'دفعة', refund: 'استرداد',
  withdrawal: 'سحب', transfer: 'تحويل', deposit: 'إيداع',
};

const TXN_TYPE_EN: Record<string, string> = {
  purchase: 'Purchase', payment: 'Payment', refund: 'Refund',
  withdrawal: 'Withdrawal', transfer: 'Transfer', deposit: 'Deposit',
};

export default function StatementPage() {
  const router = useRouter();
  const { isRTL } = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTxn[]>([]);

  const processFile = useCallback(async (file: File) => {
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('الملف كبير جداً. الحد الأقصى 25MB');
      return;
    }

    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('نوع الملف غير مدعوم. استخدم PDF أو صورة');
      return;
    }

    setFileName(file.name);
    setParsing(true);
    setParseResult(null);
    setImportResult(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await cardsAPI.parseStatement(base64, file.type);

      if ('error' in result && result.error) {
        toast.error(result.error);
        return;
      }

      const txns = (result.transactions || []).map(t => ({ ...t, selected: true }));
      setTransactions(txns);
      setParseResult(result);
      setSelectedCardId(result.matched_card_id || '');
      toast.success(`تم استخراج ${txns.length} معاملة بنجاح`);
    } catch {
      toast.error('فشل تحليل الملف. تأكد من أن الملف واضح وصالح');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const toggleTxn = (idx: number) => {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  };

  const toggleAll = () => {
    const allSelected = transactions.every(t => t.selected);
    setTransactions(prev => prev.map(t => ({ ...t, selected: !allSelected })));
  };

  const handleImport = async () => {
    if (!parseResult) return;
    const selected = transactions.filter(t => t.selected);
    if (selected.length === 0) {
      toast.error('اختر معاملة واحدة على الأقل');
      return;
    }

    setImporting(true);
    try {
      const result = await cardsAPI.importStatement({
        card_info: parseResult.card_info as Record<string, unknown>,
        transactions: selected as unknown as Array<Record<string, unknown>>,
        card_id: selectedCardId || undefined,
      });
      setImportResult(result);
      toast.success(`تم الحفظ! ${result.transactions_created} معاملة جديدة`);
    } catch {
      toast.error('فشل الاستيراد. حاول مرة أخرى');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setParseResult(null);
    setImportResult(null);
    setTransactions([]);
    setFileName('');
    setSelectedCardId('');
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const visibleTxns = showAllTxns ? transactions : transactions.slice(0, 10);
  const currency = parseResult?.card_info?.currency || 'AED';
  const totalPurchases = transactions.filter(t => t.selected && t.type === 'purchase').reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.selected && t.type === 'payment').reduce((s, t) => s + t.amount, 0);

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: 900 }}>
        {/* Header */}
        <div className="page-header-section" style={{ marginBottom: 'var(--space-6)' }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-back">
            <ArrowLeft size={16} />
            <span>رجوع</span>
          </button>
          <div className="page-header-content">
            <div className="page-header-icon"><FileText size={28} /></div>
            <div className="page-header-text">
              <h1>استيراد كشف الحساب</h1>
              <p className="page-subtitle">ارفع كشف الحساب البنكي لاستخراج المعاملات تلقائياً</p>
            </div>
            {parseResult && (
              <button onClick={reset} className="btn btn-secondary">
                <RefreshCw size={16} />
                <span>ملف جديد</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Summary */}
        {importResult && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <CheckCircle size={28} color="var(--success)" />
              <div>
                <h2 style={{ margin: 0, color: 'var(--success)' }}>تم الاستيراد بنجاح</h2>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)' }}>
              {[
                { label: 'معاملات جديدة', value: importResult.transactions_created, color: 'var(--success)' },
                { label: 'معاملات مكررة', value: importResult.transactions_skipped, color: 'var(--warning)' },
                { label: 'بطاقة جديدة', value: importResult.card_created ? 'نعم' : 'لا', color: importResult.card_created ? 'var(--primary)' : 'var(--text-secondary)' },
              ].map(item => (
                <div key={item.label} className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <button onClick={() => router.push('/transactions')} className="btn btn-primary">
                <Receipt size={16} /> عرض المعاملات
              </button>
              <button onClick={() => router.push('/cards')} className="btn btn-secondary">
                <CreditCard size={16} /> البطاقات
              </button>
              <button onClick={reset} className="btn btn-secondary">
                <Upload size={16} /> استيراد آخر
              </button>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        {!parseResult && !importResult && (
          <div
            className="card"
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !parsing && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              background: dragOver ? 'var(--primary-bg)' : undefined,
              cursor: parsing ? 'default' : 'pointer',
              textAlign: 'center',
              padding: 'var(--space-12)',
              transition: 'all 0.2s',
            }}
          >
            {parsing ? (
              <div>
                <Loader2 size={48} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite', margin: '0 auto var(--space-4)' }} />
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>جاري تحليل الكشف...</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>يستغرق ذلك 10-30 ثانية حسب حجم الملف</p>
              </div>
            ) : (
              <div>
                <Upload size={48} style={{ color: 'var(--primary)', margin: '0 auto var(--space-4)' }} />
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  اسحب الملف هنا أو اضغط للاختيار
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
                  PDF أو صورة (JPG, PNG) — الحد الأقصى 25MB
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  {['PDF كشف حساب', 'صورة فاتورة', 'ملف Excel محول'].map(t => (
                    <span key={t} style={{ padding: '4px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
        )}

        {/* Parse Results */}
        {parseResult && !importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Card Info */}
            <div className="card">
              <div className="section-header" style={{ marginBottom: 'var(--space-4)' }}>
                <CreditCard size={20} />
                <h2 className="section-title">معلومات البطاقة المستخرجة</h2>
                {parseResult.matched_card_name && (
                  <span style={{ padding: '4px 10px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✓ موجودة: {parseResult.matched_card_name}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
                {[
                  { icon: <Building2 size={16} />, label: 'البنك', value: parseResult.card_info.bank_name },
                  { icon: <CreditCard size={16} />, label: 'اسم البطاقة', value: parseResult.card_info.card_name },
                  { icon: <CreditCard size={16} />, label: 'آخر 4 أرقام', value: parseResult.card_info.card_last_four ? `**** ${parseResult.card_info.card_last_four}` : undefined },
                  { icon: <Banknote size={16} />, label: 'الليميت', value: parseResult.card_info.credit_limit != null ? `${formatAmount(parseResult.card_info.credit_limit)} ${currency}` : undefined },
                  { icon: <Banknote size={16} />, label: 'المتاح', value: parseResult.card_info.available_balance != null ? `${formatAmount(parseResult.card_info.available_balance)} ${currency}` : undefined },
                  { icon: <Banknote size={16} />, label: 'رصيد الكشف', value: parseResult.card_info.statement_balance != null ? `${formatAmount(parseResult.card_info.statement_balance)} ${currency}` : undefined },
                  { icon: <Calendar size={16} />, label: 'تاريخ الكشف', value: parseResult.card_info.statement_date ? `يوم ${parseResult.card_info.statement_date}` : undefined },
                  { icon: <Calendar size={16} />, label: 'استحقاق الدفع', value: parseResult.card_info.payment_due_full_date || (parseResult.card_info.payment_due_date ? `يوم ${parseResult.card_info.payment_due_date}` : undefined) },
                  { icon: <Banknote size={16} />, label: 'الحد الأدنى', value: parseResult.card_info.minimum_payment != null ? `${formatAmount(parseResult.card_info.minimum_payment)} ${currency}` : undefined },
                  { icon: <Calendar size={16} />, label: 'فترة الكشف', value: parseResult.card_info.statement_period_from ? `${parseResult.card_info.statement_period_from} → ${parseResult.card_info.statement_period_to}` : undefined },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card selector */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>
                  ربط بالبطاقة (اختياري — إذا تركته فارغاً سيُنشئ بطاقة جديدة)
                </label>
                <input
                  type="text"
                  placeholder="أدخل معرّف البطاقة أو اتركه فارغاً"
                  value={selectedCardId}
                  onChange={e => setSelectedCardId(e.target.value)}
                  style={{ maxWidth: 400 }}
                />
                {parseResult.matched_card_id && (
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: 'var(--space-2)', fontSize: '0.8rem' }}
                    onClick={() => setSelectedCardId(parseResult.matched_card_id!)}
                  >
                    استخدم البطاقة المطابقة: {parseResult.matched_card_name}
                  </button>
                )}
              </div>
            </div>

            {/* Transactions */}
            <div className="card">
              <div className="section-header" style={{ marginBottom: 'var(--space-4)' }}>
                <Receipt size={20} />
                <h2 className="section-title">المعاملات ({transactions.length})</h2>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginRight: 'auto', marginLeft: isRTL ? 'auto' : undefined }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    محدد: <strong>{selectedCount}</strong>
                  </span>
                  <button onClick={toggleAll} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                    {transactions.every(t => t.selected) ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>
              </div>

              {/* Summary row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                {[
                  { label: 'إجمالي المشتريات', value: totalPurchases, color: 'var(--danger)', icon: <TrendingDown size={16} /> },
                  { label: 'إجمالي الدفعات', value: totalPayments, color: 'var(--success)', icon: <TrendingUp size={16} /> },
                  { label: 'الصافي', value: totalPurchases - totalPayments, color: totalPurchases - totalPayments > 0 ? 'var(--danger)' : 'var(--success)', icon: <Banknote size={16} /> },
                ].map(item => (
                  <div key={item.label} className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: item.color, marginBottom: 4 }}>{item.icon}</div>
                    <p style={{ fontWeight: 700, fontSize: '1rem', color: item.color, margin: 0 }}>
                      {formatAmount(Math.abs(item.value))} <CurrencySymbol code={currency} size={13} />
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Transactions table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'center', width: 36 }}>
                        <input type="checkbox" checked={transactions.every(t => t.selected)} onChange={toggleAll} />
                      </th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>التاريخ</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>الوصف</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>النوع</th>
                      <th style={{ padding: 'var(--space-2)', textAlign: 'end', color: 'var(--text-secondary)' }}>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTxns.map((txn, idx) => {
                      const isExpense = ['purchase', 'withdrawal'].includes(txn.type);
                      return (
                        <tr
                          key={idx}
                          onClick={() => toggleTxn(idx)}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                            opacity: txn.selected ? 1 : 0.4,
                            background: txn.selected ? undefined : 'var(--bg-secondary)',
                            transition: 'opacity 0.15s',
                          }}
                        >
                          <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!txn.selected} onChange={() => toggleTxn(idx)} onClick={e => e.stopPropagation()} />
                          </td>
                          <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{txn.date}</td>
                          <td style={{ padding: 'var(--space-2)' }}>
                            <p style={{ margin: 0, fontWeight: 500 }}>{txn.merchant}</p>
                            {txn.category && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{txn.category}</p>}
                          </td>
                          <td style={{ padding: 'var(--space-2)' }}>
                            <span className="transaction-badge" data-type={txn.type} style={{ fontSize: '0.75rem' }}>
                              {isRTL ? TXN_TYPE_LABELS[txn.type] || txn.type : TXN_TYPE_EN[txn.type] || txn.type}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'end', fontWeight: 700, color: isExpense ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap' }}>
                            {isExpense ? '-' : '+'}{formatAmount(txn.amount)} <CurrencySymbol code={txn.currency || currency} size={12} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {transactions.length > 10 && (
                <button
                  onClick={() => setShowAllTxns(!showAllTxns)}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: 'var(--space-3)', fontSize: '0.875rem' }}
                >
                  {showAllTxns ? <><ChevronUp size={16} /> عرض أقل</> : <><ChevronDown size={16} /> عرض كل {transactions.length} معاملة</>}
                </button>
              )}

              {/* Import button */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedCount === 0}
                  className="btn btn-primary"
                  style={{ minWidth: 180 }}
                >
                  {importing ? (
                    <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> جاري الحفظ...</>
                  ) : (
                    <><CheckCircle size={16} /> حفظ {selectedCount} معاملة</>
                  )}
                </button>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedCardId ? '→ ربط بالبطاقة المحددة' : parseResult.matched_card_id ? `→ ربط بـ ${parseResult.matched_card_name}` : '→ إنشاء بطاقة جديدة تلقائياً'}
                </p>
                <button onClick={reset} className="btn btn-secondary" style={{ marginRight: 'auto', marginLeft: isRTL ? undefined : 'auto' }}>
                  <X size={16} /> إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        {!parseResult && !importResult && !parsing && (
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>كيف يعمل؟</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              {[
                { step: '1', title: 'ارفع الكشف', desc: 'PDF أو صورة لكشف حساب البنك' },
                { step: '2', title: 'استخراج تلقائي', desc: 'الذكاء الاصطناعي يقرأ كل المعاملات والبيانات' },
                { step: '3', title: 'راجع وتحقق', desc: 'حدد أو ألغِ أي معاملات قبل الحفظ' },
                { step: '4', title: 'حفظ دفعة واحدة', desc: 'تُسجَّل كل المعاملات وتُحدَّث بيانات البطاقة' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: '0.875rem' }}>{item.step}</div>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>{item.title}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
