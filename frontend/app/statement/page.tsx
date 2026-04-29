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
  EyeOff, Trash2, KeyRound, AlertCircle, Clock, PlayCircle,
  Files,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
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
  date: string; merchant: string; amount: number; type: string;
  currency: string; category?: string; selected?: boolean;
  _fileIndex?: number; _fileName?: string; _bankName?: string;
};

type FileStatus = 'waiting' | 'processing' | 'done' | 'error' | 'password_required';

type FileEntry = {
  id: string;
  file: File;
  base64: string;
  status: FileStatus;
  error?: string;
  cardInfo?: CardInfo;
  transactions?: ParsedTxn[];
  matchedCardId?: string;
  matchedCardName?: string;
  passwordRequired?: boolean;
  password?: string;
  savePassword?: boolean;
};

type SavedPassword = { id: string; bank_name: string; updated_at: string };

const TXN_AR: Record<string, string> = { purchase: 'شراء', payment: 'دفعة', refund: 'استرداد', withdrawal: 'سحب', transfer: 'تحويل', deposit: 'إيداع' };
const TXN_EN: Record<string, string> = { purchase: 'Purchase', payment: 'Payment', refund: 'Refund', withdrawal: 'Withdrawal', transfer: 'Transfer', deposit: 'Deposit' };

const uid = () => Math.random().toString(36).slice(2);

// ── Component ──────────────────────────────────────────────────────────────
export default function StatementPage() {
  const router = useRouter();
  const { isRTL } = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Files
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);

  // Combined results
  const [allTransactions, setAllTransactions] = useState<ParsedTxn[]>([]);
  const [showAllTxns, setShowAllTxns] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importSummary, setImportSummary] = useState({ created: 0, skipped: 0, cards: 0 });

  // Password manager
  const [savedPasswords, setSavedPasswords] = useState<SavedPassword[]>([]);
  const [showPwManager, setShowPwManager] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newBankPassword, setNewBankPassword] = useState('');
  const [showPwInput, setShowPwInput] = useState<Record<string, boolean>>({});

  useEffect(() => {
    cardsAPI.getBankPasswords().then(setSavedPasswords).catch(() => {});
  }, []);

  // ── File selection ─────────────────────────────────────────────────────
  const readBase64 = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const addFiles = useCallback(async (newFiles: File[]) => {
    const valid = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    const filtered = newFiles
      .filter(f => valid.includes(f.type) && f.size <= 25 * 1024 * 1024)
      .slice(0, 15);

    if (filtered.length < newFiles.length)
      toast('بعض الملفات تجاوزت الحد أو نوعها غير مدعوم', { icon: '⚠️' });

    const entries: FileEntry[] = await Promise.all(
      filtered.map(async (file) => ({
        id: uid(), file,
        base64: await readBase64(file),
        status: 'waiting' as FileStatus,
        password: '',
        savePassword: true,
      }))
    );

    setFiles(prev => {
      const combined = [...prev, ...entries].slice(0, 15);
      return combined;
    });
  }, []);

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));
  const reset = () => { setFiles([]); setAllTransactions([]); setImportDone(false); setCurrentIdx(-1); };

  // ── Process files sequentially ─────────────────────────────────────────
  const processAll = async () => {
    const waiting = files.filter(f => f.status === 'waiting' || f.status === 'error');
    if (!waiting.length) { toast.error('لا توجد ملفات للمعالجة'); return; }

    setProcessing(true);
    const collected: ParsedTxn[] = [...allTransactions];

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status === 'done') continue;
      if (entry.passwordRequired && !entry.password) continue;

      setCurrentIdx(i);
      setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

      try {
        const result = await cardsAPI.parseStatement(entry.base64, entry.file.type, {
          pdf_password: entry.password || undefined,
          save_password: entry.savePassword,
        });

        if (result.error === 'pdf_password_required') {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: 'محمي بكلمة سر' } : f));
          continue;
        }
        if (result.error === 'pdf_password_wrong') {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'password_required', passwordRequired: true, error: 'كلمة السر غير صحيحة' } : f));
          continue;
        }
        if (result.error) {
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: result.error } : f));
          continue;
        }

        const bankName = result.card_info?.bank_name || entry.file.name;
        const txns = (result.transactions || []).map(t => ({
          ...t, selected: true,
          _fileIndex: i,
          _fileName: entry.file.name,
          _bankName: bankName,
        }));

        collected.push(...txns);

        if (result.password_saved)
          cardsAPI.getBankPasswords().then(setSavedPasswords).catch(() => {});

        setFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f, status: 'done',
          cardInfo: result.card_info,
          transactions: txns,
          matchedCardId: result.matched_card_id,
          matchedCardName: result.matched_card_name,
        } : f));

      } catch {
        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: 'فشل الاتصال' } : f));
      }
    }

    setAllTransactions(collected);
    setCurrentIdx(-1);
    setProcessing(false);

    const doneCount = files.filter((_, i) => files[i].status === 'done').length + collected.filter((t, i, a) => a.findIndex(x => x._fileIndex === t._fileIndex) === i).length;
    toast.success(`تم تحليل ${collected.length} معاملة`);
  };

  // ── Toggle transactions ────────────────────────────────────────────────
  const toggleTxn = (idx: number) =>
    setAllTransactions(prev => prev.map((t, i) => i === idx ? { ...t, selected: !t.selected } : t));
  const toggleAll = () => {
    const all = allTransactions.every(t => t.selected);
    setAllTransactions(prev => prev.map(t => ({ ...t, selected: !all })));
  };
  const toggleBank = (bankName: string) => {
    const bankTxns = allTransactions.filter(t => t._bankName === bankName);
    const allSelected = bankTxns.every(t => t.selected);
    setAllTransactions(prev => prev.map(t => t._bankName === bankName ? { ...t, selected: !allSelected } : t));
  };

  // ── Import ─────────────────────────────────────────────────────────────
  const handleImport = async () => {
    const selected = allTransactions.filter(t => t.selected);
    if (!selected.length) { toast.error('اختر معاملة واحدة على الأقل'); return; }

    setImporting(true);
    let totalCreated = 0, totalSkipped = 0, newCards = 0;

    // Group by file (card)
    const byFile = new Map<number, { cardInfo: CardInfo; txns: ParsedTxn[]; cardId?: string }>();
    for (const txn of selected) {
      const fi = txn._fileIndex ?? 0;
      if (!byFile.has(fi)) {
        const fileEntry = files[fi];
        byFile.set(fi, { cardInfo: fileEntry?.cardInfo || {}, txns: [], cardId: fileEntry?.matchedCardId });
      }
      byFile.get(fi)!.txns.push(txn);
    }

    for (const [, { cardInfo, txns, cardId }] of byFile) {
      try {
        const result = await cardsAPI.importStatement({
          card_info: cardInfo as Record<string, unknown>,
          transactions: txns as unknown as Array<Record<string, unknown>>,
          card_id: cardId,
        });
        totalCreated += result.transactions_created;
        totalSkipped += result.transactions_skipped;
        if (result.card_created) newCards++;
      } catch { /* continue with other cards */ }
    }

    setImportSummary({ created: totalCreated, skipped: totalSkipped, cards: newCards });
    setImportDone(true);
    setImporting(false);
    toast.success(`تم حفظ ${totalCreated} معاملة`);
  };

  // ── Password manager ───────────────────────────────────────────────────
  const addPassword = async () => {
    if (!newBankName.trim() || !newBankPassword.trim()) { toast.error('أدخل اسم البنك وكلمة السر'); return; }
    await cardsAPI.saveBankPassword(newBankName.trim(), newBankPassword.trim());
    const updated = await cardsAPI.getBankPasswords();
    setSavedPasswords(updated);
    setNewBankName(''); setNewBankPassword('');
    toast.success('تم الحفظ');
  };
  const deletePassword = async (bankName: string) => {
    await cardsAPI.deleteBankPassword(bankName);
    setSavedPasswords(p => p.filter(x => x.bank_name !== bankName));
    toast.success('تم الحذف');
  };

  // ── Derived stats ──────────────────────────────────────────────────────
  const selectedCount = allTransactions.filter(t => t.selected).length;
  const doneFiles = files.filter(f => f.status === 'done').length;
  const errorFiles = files.filter(f => f.status === 'error').length;
  const pwFiles = files.filter(f => f.status === 'password_required').length;
  const currency = 'AED';
  const totalPurchases = allTransactions.filter(t => t.selected && ['purchase', 'withdrawal'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const totalPayments = allTransactions.filter(t => t.selected && ['payment', 'refund'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
  const uniqueBanks = [...new Set(allTransactions.map(t => t._bankName).filter(Boolean))] as string[];
  const visibleTxns = showAllTxns ? allTransactions : allTransactions.slice(0, 15);

  const statusIcon = (status: FileStatus) => {
    if (status === 'waiting') return <Clock size={15} color="var(--text-secondary)" />;
    if (status === 'processing') return <Loader2 size={15} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />;
    if (status === 'done') return <CheckCircle size={15} color="var(--success)" />;
    if (status === 'error') return <AlertCircle size={15} color="var(--danger)" />;
    if (status === 'password_required') return <Lock size={15} color="var(--warning)" />;
  };

  const hasResults = allTransactions.length > 0;
  const canProcess = files.some(f => f.status === 'waiting' || f.status === 'error' || (f.status === 'password_required' && f.password));

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: 960 }}>

        {/* ── Header ── */}
        <div className="page-header-section" style={{ marginBottom: 'var(--space-6)' }}>
          <button onClick={() => router.back()} className="btn btn-secondary btn-back"><ArrowLeft size={16} /><span>رجوع</span></button>
          <div className="page-header-content">
            <div className="page-header-icon"><Files size={28} /></div>
            <div className="page-header-text">
              <h1>استيراد كشوفات الحساب</h1>
              <p className="page-subtitle">ارفع حتى 15 كشف مرة واحدة — PDF أو صورة</p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button onClick={() => setShowPwManager(!showPwManager)} className="btn btn-secondary" title="كلمات سر البنوك">
                <KeyRound size={16} />
                {savedPasswords.length > 0 && <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>{savedPasswords.length}</span>}
              </button>
              {(files.length > 0 || hasResults) && (
                <button onClick={reset} className="btn btn-secondary"><RefreshCw size={16} /><span>بداية جديدة</span></button>
              )}
            </div>
          </div>
        </div>

        {/* ── Password Manager ── */}
        {showPwManager && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <KeyRound size={17} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>كلمات سر البنوك</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1 }}>مشفرة — تُستخدم تلقائياً</span>
              <button onClick={() => setShowPwManager(false)} className="btn btn-secondary btn-icon-only"><X size={14} /></button>
            </div>
            {savedPasswords.length === 0
              ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>لا توجد كلمات سر بعد</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  {savedPasswords.map(bp => (
                    <div key={bp.bank_name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      <Lock size={14} color="var(--primary)" />
                      <span style={{ fontWeight: 600, flex: 1 }}>{bp.bank_name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>••••••</span>
                      <button onClick={() => deletePassword(bp.bank_name)} className="btn btn-secondary btn-icon-only" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
            }
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <input placeholder="اسم البنك" value={newBankName} onChange={e => setNewBankName(e.target.value)} style={{ flex: '1 1 140px' }} />
              <input type="password" placeholder="كلمة السر" value={newBankPassword} onChange={e => setNewBankPassword(e.target.value)} style={{ flex: '1 1 140px' }} />
              <button onClick={addPassword} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}><CheckCircle size={14} /> حفظ</button>
            </div>
          </div>
        )}

        {/* ── Import Success ── */}
        {importDone && (
          <div className="card" style={{ marginBottom: 'var(--space-6)', borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <CheckCircle size={28} color="var(--success)" />
              <h2 style={{ margin: 0, color: 'var(--success)' }}>تم الاستيراد بنجاح</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 'var(--space-4)' }}>
              {[
                { label: 'معاملات جديدة', value: importSummary.created, color: 'var(--success)' },
                { label: 'مكررة (تخطت)', value: importSummary.skipped, color: 'var(--warning)' },
                { label: 'بطاقات جديدة', value: importSummary.cards, color: 'var(--primary)' },
              ].map(item => (
                <div key={item.label} className="card" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/transactions')} className="btn btn-primary"><Receipt size={16} /> عرض المعاملات</button>
              <button onClick={() => router.push('/dashboard')} className="btn btn-secondary"><CreditCard size={16} /> الداشبورد</button>
              <button onClick={reset} className="btn btn-secondary"><Upload size={16} /> استيراد جديد</button>
            </div>
          </div>
        )}

        {/* ── Upload Zone ── */}
        {!importDone && (
          <div
            className="card"
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => !processing && fileInputRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, background: dragOver ? 'var(--primary-bg)' : undefined, cursor: processing ? 'default' : 'pointer', textAlign: 'center', padding: files.length ? 'var(--space-6)' : 'var(--space-12)', transition: 'all 0.2s', marginBottom: 'var(--space-4)' }}
          >
            <Upload size={36} style={{ color: 'var(--primary)', margin: '0 auto var(--space-3)' }} />
            <p style={{ fontWeight: 600, marginBottom: 'var(--space-1)' }}>
              {files.length > 0 ? `${files.length} ملف محدد — اسحب المزيد أو اضغط للإضافة` : 'اسحب ملفاتك هنا أو اضغط للاختيار'}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              PDF أو صورة — حتى 15 ملف — 25MB لكل ملف
              {savedPasswords.length > 0 && <span style={{ color: 'var(--success)', marginRight: 8 }}> · {savedPasswords.length} كلمة سر محفوظة</span>}
            </p>
            <input ref={fileInputRef} type="file" accept=".pdf,image/*" multiple onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} style={{ display: 'none' }} />
          </div>
        )}

        {/* ── File List ── */}
        {files.length > 0 && !importDone && (
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <FileText size={18} />
              <h3 style={{ margin: 0 }}>الملفات ({files.length}/15)</h3>
              <div style={{ marginRight: 'auto', marginLeft: isRTL ? 'auto' : undefined, display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                {doneFiles > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> {doneFiles} تم</span>}
                {errorFiles > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={13} /> {errorFiles} خطأ</span>}
                {pwFiles > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={13} /> {pwFiles} تحتاج كلمة سر</span>}
              </div>
              <button
                onClick={processAll}
                disabled={processing || !canProcess}
                className="btn btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                {processing
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> جاري التحليل ({currentIdx + 1}/{files.length})</>
                  : <><PlayCircle size={15} /> تحليل الكل</>}
              </button>
            </div>

            {/* Progress bar */}
            {processing && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 'var(--radius-full)', width: `${((currentIdx + 1) / files.length) * 100}%`, transition: 'width 0.4s ease' }} />
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>
                  جاري تحليل الملف {currentIdx + 1} من {files.length}…
                </p>
              </div>
            )}

            {/* File rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {files.map((entry, i) => (
                <div key={entry.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: entry.status === 'done' ? 'var(--success-bg)' : entry.status === 'error' ? 'var(--danger-bg)' : entry.status === 'processing' ? 'var(--primary-bg)' : undefined }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {statusIcon(entry.status)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.88rem' }}>{entry.file.name}</p>
                      <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                        {(entry.file.size / 1024).toFixed(0)} KB
                        {entry.status === 'done' && entry.transactions && <span style={{ color: 'var(--success)', marginRight: 8 }}> · {entry.transactions.length} معاملة · {entry.cardInfo?.bank_name}</span>}
                        {entry.error && <span style={{ color: entry.status === 'password_required' ? 'var(--warning)' : 'var(--danger)', marginRight: 8 }}> · {entry.error}</span>}
                      </p>
                    </div>
                    {entry.status !== 'processing' && (
                      <button onClick={() => removeFile(entry.id)} className="btn btn-secondary btn-icon-only" style={{ flexShrink: 0 }}><X size={14} /></button>
                    )}
                  </div>

                  {/* Password input for protected files */}
                  {entry.status === 'password_required' && (
                    <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Lock size={14} color="var(--warning)" />
                      <div style={{ position: 'relative', flex: '1 1 180px' }}>
                        <input
                          type={showPwInput[entry.id] ? 'text' : 'password'}
                          placeholder="كلمة سر الـ PDF"
                          value={entry.password || ''}
                          onChange={e => setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, password: e.target.value } : f))}
                          style={{ width: '100%', paddingLeft: 32 }}
                        />
                        <button onClick={() => setShowPwInput(p => ({ ...p, [entry.id]: !p[entry.id] }))} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}>
                          {showPwInput[entry.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input type="checkbox" checked={entry.savePassword !== false} onChange={e => setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, savePassword: e.target.checked } : f))} />
                        حفظ كلمة السر
                      </label>
                      <button
                        onClick={() => {
                          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'waiting' } : f));
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78rem', padding: '4px 10px', whiteSpace: 'nowrap' }}
                      >
                        تجديد
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Combined Results ── */}
        {hasResults && !importDone && (
          <div className="card">
            {/* Header */}
            <div className="section-header" style={{ marginBottom: 'var(--space-4)' }}>
              <Receipt size={20} />
              <h2 className="section-title">كل المعاملات ({allTransactions.length})</h2>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginRight: 'auto', marginLeft: isRTL ? 'auto' : undefined, alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>محدد: <strong>{selectedCount}</strong></span>
                <button onClick={toggleAll} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '3px 9px' }}>
                  {allTransactions.every(t => t.selected) ? 'إلغاء الكل' : 'تحديد الكل'}
                </button>
              </div>
            </div>

            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {[
                { label: 'إجمالي المشتريات', value: totalPurchases, color: 'var(--danger)', icon: <TrendingDown size={15} /> },
                { label: 'إجمالي الدفعات', value: totalPayments, color: 'var(--success)', icon: <TrendingUp size={15} /> },
                { label: 'الصافي', value: totalPurchases - totalPayments, color: totalPurchases > totalPayments ? 'var(--danger)' : 'var(--success)', icon: <Banknote size={15} /> },
                { label: 'عدد البنوك', value: uniqueBanks.length, color: 'var(--primary)', icon: <Building2 size={15} /> },
              ].map(item => (
                <div key={item.label} className="card" style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', color: item.color, marginBottom: 3 }}>{item.icon}</div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: item.color, margin: 0 }}>
                    {typeof item.value === 'number' && item.label !== 'عدد البنوك'
                      ? <>{formatAmount(Math.abs(item.value))} <CurrencySymbol code={currency} size={12} /></>
                      : item.value}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>{item.label}</p>
                </div>
              ))}
            </div>

            {/* Per-bank toggle */}
            {uniqueBanks.length > 1 && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                {uniqueBanks.map(bank => {
                  const count = allTransactions.filter(t => t._bankName === bank && t.selected).length;
                  const total = allTransactions.filter(t => t._bankName === bank).length;
                  return (
                    <button key={bank} onClick={() => toggleBank(bank)} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
                      <Building2 size={12} /> {bank} ({count}/{total})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: 'var(--space-2)', width: 32, textAlign: 'center' }}>
                      <input type="checkbox" checked={allTransactions.every(t => t.selected)} onChange={toggleAll} />
                    </th>
                    <th style={{ padding: 'var(--space-2)', textAlign: 'start', color: 'var(--text-secondary)' }}>البنك</th>
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
                      <tr key={idx} onClick={() => toggleTxn(idx)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: txn.selected ? 1 : 0.35, background: txn.selected ? undefined : 'var(--bg-secondary)', transition: 'opacity 0.15s' }}>
                        <td style={{ padding: 'var(--space-2)', textAlign: 'center' }}>
                          <input type="checkbox" checked={!!txn.selected} onChange={() => toggleTxn(idx)} onClick={e => e.stopPropagation()} />
                        </td>
                        <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>{txn._bankName || '—'}</span>
                        </td>
                        <td style={{ padding: 'var(--space-2)', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{txn.date}</td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <p style={{ margin: 0, fontWeight: 500 }}>{txn.merchant}</p>
                          {txn.category && <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{txn.category}</p>}
                        </td>
                        <td style={{ padding: 'var(--space-2)' }}>
                          <span className="transaction-badge" data-type={txn.type} style={{ fontSize: '0.72rem' }}>
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

            {allTransactions.length > 15 && (
              <button onClick={() => setShowAllTxns(!showAllTxns)} className="btn btn-secondary" style={{ width: '100%', marginTop: 'var(--space-3)', fontSize: '0.85rem' }}>
                {showAllTxns ? <><ChevronUp size={15} /> عرض أقل</> : <><ChevronDown size={15} /> عرض كل {allTransactions.length} معاملة</>}
              </button>
            )}

            {/* Import bar */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleImport} disabled={importing || selectedCount === 0} className="btn btn-primary" style={{ minWidth: 180 }}>
                {importing
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> جاري الحفظ...</>
                  : <><CheckCircle size={15} /> حفظ {selectedCount} معاملة</>}
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                من {doneFiles} كشف · {uniqueBanks.length} بنك
              </span>
              <button onClick={reset} className="btn btn-secondary" style={{ marginRight: 'auto', marginLeft: isRTL ? undefined : 'auto' }}>
                <X size={15} /> مسح الكل
              </button>
            </div>
          </div>
        )}

        {/* ── How it works ── */}
        {files.length === 0 && !importDone && (
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-4)' }}>كيف يعمل؟</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 'var(--space-4)' }}>
              {[
                { step: '1', title: 'ارفع الكشوفات', desc: 'حتى 15 ملف PDF أو صورة دفعة واحدة' },
                { step: '2', title: 'تحليل تلقائي', desc: 'كل ملف يُحلل بالتسلسل مع تتبع التقدم' },
                { step: '3', title: 'راجع الكل', desc: 'جدول موحد لكل المعاملات من كل البنوك' },
                { step: '4', title: 'حفظ دفعة واحدة', desc: 'كل المعاملات تتسجل والكروت تتحدث' },
              ].map(item => (
                <div key={item.step} style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: '0.8rem' }}>{item.step}</div>
                  <div><p style={{ fontWeight: 600, margin: 0 }}>{item.title}</p><p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>{item.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
