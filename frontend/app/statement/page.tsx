'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { cardsAPI } from '@/app/api/cards';
import { useTranslations } from '@/lib/i18n';
import { formatAmount } from '@/lib/formatNumber';
import CurrencySymbol from '@/components/ui/CurrencySymbol';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle, Loader2, CreditCard, Receipt,
  X, ChevronDown, ChevronUp, Building2, Calendar, Banknote,
  TrendingDown, TrendingUp, RefreshCw, ArrowLeft, Lock, Eye,
  EyeOff, Trash2, KeyRound,
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

type ParsedTxn = { date: string; merchant: string; amount: number; type: string; currency: string; category?: string; selected?: boolean };
type ParseResult = { card_info: CardInfo; transactions: ParsedTxn[]; transaction_count: number; matched_card_id?: string; matched_card_name?: string; password_saved?: boolean };
type ImportResult = { card_created: boolean; transactions_created: number; transactions_skipped: number; total_transactions: number };
type SavedPassword = { id: string; bank_name: string; updated_at: string };

const TXN_AR: Record<string, string> = { purchase: 'شراء', payment: 'دفعة', refund: 'استرداد', withdrawal: 'سحب', transfer: 'تحويل', deposit: 'إيداع' };
const TXN_EN: Record<string, string> = { purchase: 'Purchase', payment: 'Payment', refund: 'Refund', withdrawal: 'Withdrawal', transfer: 'Transfer', deposit: 'Deposit' };

export default function StatementPage() {
  const router = useRouter();
  const { isRTL } = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [fileType, setFileType] = useState('');
  const [isPdf, setIsPdf] = useState(false);

  // Password state
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(true);
  const [savedPasswords, setSavedPasswords] = useState<SavedPassword[]>([]);
  const [showPasswordManager, setShowPasswordManager] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankPassword, setNewBankPassword] = useState('');

  // Results
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTxn[]>([]);

  useEffect(() => {
    cardsAPI.getBankPasswords().then(setSavedPasswords).catch(() => {});
  }, []);

  const callParse = useCallback(async (base64: string, type: string, password?: string, savePw?: boolean) => {
    setParsing(true);
    try {
      const result = await cardsAPI.parseStatement(base64, type, {
        pdf_password: password,
        save_password: savePw,
        bank_name_hint: '',
      });

      if (result.error === 'pdf_password_required') {
        setNeedsPassword(true);
        toast('هذا الملف محمي. أدخل كلمة السر.', { icon: '🔒' });
        return;
      }
      if (result.error === 'pdf_password_wrong') {
        setNeedsPassword(true);
        toast.error('كلمة السر غير صحيحة');
        return;
      }
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.password_saved) {
        cardsAPI.getBankPasswords().then(setSavedPasswords).catch(() => {});
      }

      const txns = (result.transactions || []).map(t => ({ ...t, selected: true }));
      setTransactions(txns);
      setParseResult(result);
      setSelectedCardId(result.matched_card_id || '');
      setNeedsPassword(false);
      toast.success(`تم استخراج ${txns.length} معاملة`);
    } catch {
      toast.error('فشل تحليل الملف');
    } finally {
      setParsing(false);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (file.size > 25 * 1024 * 1024) { toast.error('الملف كبير جداً — الحد 25MB'); return; }
    const valid = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!valid.includes(file.type)) { toast.error('استخدم PDF أو صورة'); return; }

    setFileName(file.name);
    setIsPdf(file.type === 'application/pdf');
    setParseResult(null);
    setImportResult(null);
    setNeedsPassword(false);
    setPdfPassword('');

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    setFileBase64(base64);
    setFileType(file.type);
    await callParse(base64, file.type);
  }, [callParse]);

  const handlePasswordSubmit = () => {
    if (!pdfPassword.trim()) { toast.error('أدخل كلمة السر'); return; }
    callParse(fileBase64, fileType, pdfPassword, savePassword);
  };

  const toggleTxn = (idx: number) => setTransactions(p => p.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  const toggleAll = () => { const all = transactions.every(t => t.selected); setTransactions(p => p.map(t => ({ ...t, selected: !all }))); };

  const handleImport = async () => {
    if (!parseResult) return;
    const selected = transactions.filter(t => t.selected);
    if (!selected.length) { toast.error('اختر معاملة واحدة على الأقل'); return; }
    setImporting(true);
    try {
      const result = await cardsAPI.importStatement({
        card_info: parseResult.card_info as Record<string, unknown>,
        transactions: selected as unknown as Array<Record<string, unknown>>,
        card_id: selectedCardId || undefined,
      });
      setImportResult(result);
      toast.success(`تم الحفظ! ${result.transactions_created} معاملة جديدة`);
    } catch { toast.error('فشل الاستيراد'); } finally { setImporting(false); }
  };

  const reset = () => { setParseResult(null); setImportResult(null); setTransactions([]); setFileName(''); setSelectedCardId(''); setNeedsPassword(false); setPdfPassword(''); setFileBase64(''); };

  const deletePassword = async (bankName: string) => {
    try {
      await cardsAPI.deleteBankPassword(bankName);
      setSavedPasswords(p => p.filter(x => x.bank_name !== bankName));
      toast.success('تم الحذف');
    } catch { toast.error('فشل الحذف'); }
  };

  const addPassword = async () => {
    if (!newBankName.trim() || !newBankPassword.trim()) { toast.error('أدخل اسم البنك وكلمة السر'); return; }
    try {
      await cardsAPI.saveBankPassword(newBankName.trim(), newBankPassword.trim());
      const updated = await cardsAPI.getBankPasswords();
      setSavedPasswords(updated);
      setNewBankName(''); setNewBankPassword('');
      toast.success('تم الحفظ');
    } catch { toast.error('فشل الحفظ'); }
  };

  const selectedCount = transactions.filter(t => t.selected).length;
  const visibleTxns = showAllTxns ? transactions : transactions.slice(0, 10);
  const currency = parseResult?.card_info?.currency || 'AED';
  const totalPurchases = transactions.filter(t => t.selected && ['purchase', 'withdrawal'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalPayments = transactions.filter(t => t.selected && ['payment', 'refund'].includes(t.type)).reduce((s, t) => s + t.amount, 0);

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: 920 }}>
        {/* Header */}
        <div className="page-header-section" style={{ marginBottom: 'var(--space-6)' }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-back"><ArrowLeft size={16} /><span>رجوع</span></button>
          <div className="page-header-content">
            <div className="page-header-icon"><FileText size={28} /></div>
            <div className="page-header-text">
              <h1>استيراد كشف الحساب</h1>
              <p className="page-subtitle">ارفع كشف الحساب البنكي — PDF أو صورة</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setShowPasswordManager(!showPasswordManager)} className="btn btn-secondary" title="كلمات سر البنوك">
                <KeyRound size={16} />
                {savedPasswords.length > 0 && <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>{savedPasswords.length}</span>}
              </button>
              {parseResult && <button onClick={reset} className="btn btn-secondary"><RefreshCw size={16} /><span>ملف جديد</span></button>}
            </div>
          </div>
        </div>

        {/* Password Manager Panel */}
        {showPasswordManager && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              <KeyRound size={18} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>كلمات سر البنوك المحفوظة</h3>
              <button onClick={() => setShowPasswordManager(false)} className="btn btn-secondary btn-icon-only" style={{ marginRight: 'auto', marginLeft: isRTL ? undefined : 'auto' }}><X size={14} /></button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              محفوظة بشكل مشفر — تُستخدم تلقائياً عند رفع كشف من نفس البنك
            </p>

            {savedPasswords.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>لا توجد كلمات سر محفوظة بعد</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {savedPasswords.map(bp => (
                  <div key={bp.bank_name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                    <Lock size={16} color="var(--primary)" />
                    <span style={{ fontWeight: 600, flex: 1 }}>{bp.bank_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>••••••</span>
                    <button onClick={() => deletePassword(bp.bank_name)} className="btn btn-secondary btn-icon-only" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <input placeholder="اسم البنك" value={newBankName} onChange={e => setNewBankName(e.target.value)} style={{ flex: '1 1 150px' }} />
              <input type="password" placeholder="كلمة السر" value={newBankPassword} onChange={e => setNewBankPassword(e.target.value)} style={{ flex: '1 1 150px' }} />
              <button onClick={addPassword} className="btn btn-primary"><CheckCircle size={15} /> حفظ</button>
            </div>
          </div>
        )}

        {/* Import Success */}
        {importResult && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <CheckCircle size={28} color="var(--success)" />
              <h2 style={{ margin: 0, color: 'var(--success)' }}>تم الاستيراد بنجاح</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-4)' }}>
              {[
                { label: 'معاملات جديدة', value: importResult.transactions_created, color: 'var(--success)' },
                { label: 'مكررة (تخطت)', value: importResult.transactions_skipped, color: 'var(--warning)' },
                { label: 'بطاقة جديدة', value: importResult.card_created ? 'نعم' : 'لا', color: importResult.card_created ? 'var(--primary)' : 'var(--text-secondary)' },
              ].map(item => (
                <div key={item.label} className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/transactions')} className="btn btn-primary"><Receipt size={16} /> عرض المعاملات</button>
              <button onClick={() => router.push('/cards')} className="btn btn-secondary"><CreditCard size={16} /> البطاقات</button>
              <button onClick={reset} className="btn btn-secondary"><Upload size={16} /> استيراد آخر</button>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        {!parseResult && !importResult && (
          <>
            <div
              className="card"
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !parsing && !needsPassword && fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, background: dragOver ? 'var(--primary-bg)' : undefined, cursor: parsing || needsPassword ? 'default' : 'pointer', textAlign: 'center', padding: 'var(--space-12)', transition: 'all 0.2s' }}
            >
              {parsing ? (
                <div>
                  <Loader2 size={48} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite', margin: '0 auto var(--space-4)' }} />
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>جاري تحليل الكشف...</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>10–30 ثانية حسب حجم الملف</p>
                </div>
              ) : needsPassword ? (
                <div onClick={e => e.stopPropagation()}>
                  <Lock size={40} style={{ color: 'var(--warning)', margin: '0 auto var(--space-3)' }} />
                  <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 'var(--space-1)' }}>الملف محمي بكلمة سر</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 'var(--space-4)' }}>{fileName}</p>
                  <div style={{ maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="أدخل كلمة سر الـ PDF"
                        value={pdfPassword}
                        onChange={e => setPdfPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                        style={{ width: '100%', paddingLeft: 40, paddingRight: 40 }}
                        autoFocus
                      />
                      <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', cursor: 'pointer', justifyContent: 'center' }}>
                      <input type="checkbox" checked={savePassword} onChange={e => setSavePassword(e.target.checked)} />
                      حفظ كلمة السر لهذا البنك (مشفرة)
                    </label>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                      <button onClick={handlePasswordSubmit} className="btn btn-primary" disabled={parsing}>
                        {parsing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={15} />}
                        فتح وتحليل
                      </button>
                      <button onClick={reset} className="btn btn-secondary"><X size={15} /> إلغاء</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <Upload size={48} style={{ color: 'var(--primary)', margin: '0 auto var(--space-4)' }} />
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-2)' }}>اسحب الملف هنا أو اضغط للاختيار</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>PDF أو صورة (JPG, PNG) — حتى 25MB</p>
                  {savedPasswords.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                      <Lock size={12} style={{ display: 'inline', marginLeft: 4 }} />
                      {savedPasswords.length} كلمة سر محفوظة — ستُفتح الملفات المحمية تلقائياً
                    </p>
                  )}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,image/*" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }} style={{ display: 'none' }} />
            </div>

            {/* How it works */}
            {!needsPassword && (
              <div className="card" style={{ marginTop: 'var(--space-6)' }}>
                <h3 style={{ marginBottom: 'var(--space-4)' }}>كيف يعمل؟</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--space-4)' }}>
                  {[
                    { step: '1', title: 'ارفع الكشف', desc: 'PDF أو صورة لكشف حساب البنك' },
                    { step: '2', title: 'استخراج تلقائي', desc: 'الذكاء الاصطناعي يقرأ كل المعاملات والبيانات' },
                    { step: '3', title: 'راجع وتحقق', desc: 'حدد أو ألغِ أي معاملات قبل الحفظ' },
                    { step: '4', title: 'حفظ دفعة واحدة', desc: 'تُسجَّل كل المعاملات وتُحدَّث بيانات البطاقة' },
                  ].map(item => (
                    <div key={item.step} style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: '0.8rem' }}>{item.step}</div>
                      <div><p style={{ fontWeight: 600, margin: 0 }}>{item.title}</p><p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>{item.desc}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Parse Results */}
        {parseResult && !importResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* Card Info */}
            <div className="card">
              <div className="section-header" style={{ marginBottom: 'var(--space-4)' }}>
                <CreditCard size={20} />
                <h2 className="section-title">معلومات البطاقة</h2>
                {parseResult.matched_card_name && (
                  <span style={{ padding: '3px 10px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 600 }}>
                    ✓ {parseResult.matched_card_name}
                  </span>
                )}
                {parseResult.password_saved && (
                  <span style={{ padding: '3px 10px', background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 'var(--radius-full)', fontSize: '0.8rem' }}>
                    <Lock size={11} style={{ display: 'inline', marginLeft: 3 }} /> كلمة السر محفوظة
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                {[
                  { icon: <Building2 size={15} />, label: 'البنك', value: parseResult.card_info.bank_name },
                  { icon: <CreditCard size={15} />, label: 'اسم البطاقة', value: parseResult.card_info.card_name },
                  { icon: <CreditCard size={15} />, label: 'آخر 4 أرقام', value: parseResult.card_info.card_last_four ? `**** ${parseResult.card_info.card_last_four}` : undefined },
                  { icon: <Banknote size={15} />, label: 'الليميت', value: parseResult.card_info.credit_limit != null ? `${formatAmount(parseResult.card_info.credit_limit)} ${currency}` : undefined },
                  { icon: <Banknote size={15} />, label: 'المتاح', value: parseResult.card_info.available_balance != null ? `${formatAmount(parseResult.card_info.available_balance)} ${currency}` : undefined },
                  { icon: <Banknote size={15} />, label: 'رصيد الكشف', value: parseResult.card_info.statement_balance != null ? `${formatAmount(parseResult.card_info.statement_balance)} ${currency}` : undefined },
                  { icon: <Calendar size={15} />, label: 'تاريخ الكشف', value: parseResult.card_info.statement_date ? `يوم ${parseResult.card_info.statement_date}` : undefined },
                  { icon: <Calendar size={15} />, label: 'استحقاق الدفع', value: parseResult.card_info.payment_due_full_date || (parseResult.card_info.payment_due_date ? `يوم ${parseResult.card_info.payment_due_date}` : undefined) },
                  { icon: <Banknote size={15} />, label: 'الحد الأدنى', value: parseResult.card_info.minimum_payment != null ? `${formatAmount(parseResult.card_info.minimum_payment)} ${currency}` : undefined },
                  { icon: <Calendar size={15} />, label: 'فترة الكشف', value: parseResult.card_info.statement_period_from ? `${parseResult.card_info.statement_period_from} ← ${parseResult.card_info.statement_period_to}` : undefined },
                ].filter(x => x.value).map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: '0.88rem' }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>ربط بالبطاقة (اتركه فارغاً لإنشاء بطاقة جديدة)</label>
                <input type="text" placeholder="معرّف البطاقة أو اتركه فارغاً" value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={{ maxWidth: 360 }} />
                {parseResult.matched_card_id && !selectedCardId && (
                  <button className="btn btn-secondary" style={{ marginTop: 6, fontSize: '0.8rem' }} onClick={() => setSelectedCardId(parseResult.matched_card_id!)}>
                    استخدام البطاقة المطابقة: {parseResult.matched_card_name}
                  </button>
                )}
              </div>
            </div>

            {/* Transactions */}
            <div className="card">
              <div className="section-header" style={{ marginBottom: 'var(--space-4)' }}>
                <Receipt size={20} />
                <h2 className="section-title">المعاملات ({transactions.length})</h2>
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginRight: 'auto', marginLeft: isRTL ? 'auto' : undefined, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>محدد: <strong>{selectedCount}</strong></span>
                  <button onClick={toggleAll} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '3px 9px' }}>
                    {transactions.every(t => t.selected) ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                {[
                  { label: 'إجمالي المشتريات', value: totalPurchases, color: 'var(--danger)', icon: <TrendingDown size={15} /> },
                  { label: 'إجمالي الدفعات', value: totalPayments, color: 'var(--success)', icon: <TrendingUp size={15} /> },
                  { label: 'الصافي', value: totalPurchases - totalPayments, color: totalPurchases - totalPayments > 0 ? 'var(--danger)' : 'var(--success)', icon: <Banknote size={15} /> },
                ].map(item => (
                  <div key={item.label} className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: item.color, marginBottom: 3 }}>{item.icon}</div>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: item.color, margin: 0 }}>{formatAmount(Math.abs(item.value))} <CurrencySymbol code={currency} size={12} /></p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                  </div>
                ))}
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: 'var(--space-2)', width: 36, textAlign: 'center' }}>
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
                      const isExp = ['purchase', 'withdrawal'].includes(txn.type);
                      return (
                        <tr key={idx} onClick={() => toggleTxn(idx)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: txn.selected ? 1 : 0.38, background: txn.selected ? undefined : 'var(--bg-secondary)', transition: 'opacity 0.15s' }}>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!txn.selected} onChange={() => toggleTxn(idx)} onClick={e => e.stopPropagation()} />
                          </td>
                          <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{txn.date}</td>
                          <td style={{ padding: 'var(--space-2)' }}>
                            <p style={{ margin: 0, fontWeight: 500 }}>{txn.merchant}</p>
                            {txn.category && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{txn.category}</p>}
                          </td>
                          <td style={{ padding: 'var(--space-2)' }}>
                            <span className="transaction-badge" data-type={txn.type} style={{ fontSize: '0.73rem' }}>
                              {isRTL ? TXN_AR[txn.type] || txn.type : TXN_EN[txn.type] || txn.type}
                            </span>
                          </td>
                          <td style={{ padding: 'var(--space-2)', textAlign: 'end', fontWeight: 700, color: isExp ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap' }}>
                            {isExp ? '-' : '+'}{formatAmount(txn.amount)} <CurrencySymbol code={txn.currency || currency} size={12} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {transactions.length > 10 && (
                <button onClick={() => setShowAllTxns(!showAllTxns)} className="btn btn-secondary" style={{ width: '100%', marginTop: 'var(--space-3)', fontSize: '0.85rem' }}>
                  {showAllTxns ? <><ChevronUp size={15} /> عرض أقل</> : <><ChevronDown size={15} /> عرض كل {transactions.length} معاملة</>}
                </button>
              )}

              {/* Import */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleImport} disabled={importing || selectedCount === 0} className="btn btn-primary" style={{ minWidth: 170 }}>
                  {importing ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> جاري الحفظ...</> : <><CheckCircle size={15} /> حفظ {selectedCount} معاملة</>}
                </button>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedCardId ? '← ربط بالبطاقة المحددة' : parseResult.matched_card_id ? `← ${parseResult.matched_card_name}` : '← إنشاء بطاقة جديدة'}
                </p>
                <button onClick={reset} className="btn btn-secondary" style={{ marginRight: 'auto', marginLeft: isRTL ? undefined : 'auto' }}><X size={15} /> إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
