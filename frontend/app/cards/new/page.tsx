'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { ArrowLeft, CreditCard as CreditCardIcon, Building2, Wallet, FileText, Camera, Upload, Loader2, Shield, X, CheckCircle, Smartphone, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { CreditCard, type CreditCardValue } from '@/components/ui/CreditCard';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { UAE_BANKS } from '@/lib/uae-banks';
import { getErrorMessage } from '@/lib/errors';
import FormattedNumberInput from '@/components/ui/FormattedNumberInput';
import { scanCardImage } from '@/lib/cardOcr';

function NewCardContent() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardValid, setCardValid] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cardNumberInputRef = useRef<HTMLInputElement>(null);

  const [creditCard, setCreditCard] = useState<CreditCardValue>({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cvvLabel: 'CVV',
  });
  const [formData, setFormData] = useState({
    card_name: '',
    bank_name: '',
    card_type: 'credit',
    card_network: '',
    iban: '',
    notes: '',
    color_hex: '#3B82F6',
    available_balance: '',
    balance_currency: 'AED',
    statement_date: '',
    payment_due_date: '',
    minimum_payment: '',
    minimum_payment_percentage: '',
    credit_limit: '',
    current_balance: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('cards.scanInvalidFile') || 'Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('cards.scanFileTooLarge') || 'Image must be under 10MB');
      return;
    }

    setScanning(true);
    setScanProgress(0);
    setError('');
    setScanPreview(null);

    try {
      // Client-side OCR: image NEVER leaves the browser
      const result = await scanCardImage(file, (progress) => {
        setScanProgress(progress);
      });

      setScanPreview('done');

      // Auto-fill extracted data
      const updates: Partial<CreditCardValue> = {};
      if (result.card_number) {
        const formatted = result.card_number.replace(/(\d{4})/g, '$1 ').trim();
        updates.cardNumber = formatted;
      }
      if (result.cardholder_name) {
        updates.cardholderName = result.cardholder_name;
      }
      if (result.expiry_month) {
        updates.expiryMonth = result.expiry_month.padStart(2, '0');
      }
      if (result.expiry_year) {
        let year = result.expiry_year;
        if (year.length === 4) year = year.slice(2);
        updates.expiryYear = year;
      }
      if (result.cvv) {
        updates.cvv = result.cvv;
      }

      // Update credit card state
      if (Object.keys(updates).length > 0) {
        setCreditCard(prev => ({ ...prev, ...updates }));
      }

      // Update form data
      const formUpdates: Record<string, string> = {};
      if (result.card_network) {
        formUpdates.card_network = result.card_network.toLowerCase();
      }
      if (result.bank_name) {
        const matchedBank = UAE_BANKS.find(bank =>
          bank.toLowerCase().includes(result.bank_name!.toLowerCase()) ||
          result.bank_name!.toLowerCase().includes(bank.toLowerCase())
        );
        formUpdates.bank_name = matchedBank || result.bank_name;
      }

      if (Object.keys(formUpdates).length > 0) {
        setFormData(prev => ({ ...prev, ...formUpdates }));
      }

      const fieldsFound = Object.keys(result).filter(k => result[k as keyof typeof result]);
      if (fieldsFound.length > 0) {
        toast.success(
          (t('cards.scanSuccess') || 'Card scanned!') + ` ${fieldsFound.length} ` + (t('cards.fieldsExtracted') || 'fields extracted')
        );
      } else {
        toast.error(t('cards.scanNoData') || 'Could not read card details. Please try a clearer photo or enter details manually.');
      }

    } catch (err: unknown) {
      console.error('OCR error:', err);
      toast.error(t('cards.scanFailed') || 'Failed to scan card. Please try a clearer photo.');
    } finally {
      setScanning(false);
      setScanProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }, [t]);

  if (!isAuthenticated) {
    return null;
  }

  const handleCreditCardChange = (value: CreditCardValue) => {
    setCreditCard(value);
    // Auto-detect card network
    const cardNumber = value.cardNumber.replace(/\s/g, '');
    let network = '';
    if (/^4/.test(cardNumber)) network = 'visa';
    else if (/^(5[1-5]|2[2-7])/.test(cardNumber)) network = 'mastercard';
    else if (/^3[47]/.test(cardNumber)) network = 'amex';
    else if (/^6/.test(cardNumber)) network = 'discover';

    if (network) {
      setFormData({ ...formData, card_network: network });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const num = (v: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
      const data = {
        card_name: formData.card_name || '',
        bank_name: formData.bank_name || '',
        card_type: (formData.card_type || 'credit') as 'credit' | 'debit' | 'prepaid',
        card_network: formData.card_network || undefined,
        card_number: creditCard.cardNumber.replace(/\s/g, ''),
        cardholder_name: creditCard.cardholderName || undefined,
        expiry_month: num(creditCard.expiryMonth) ?? undefined,
        expiry_year: num(creditCard.expiryYear) ?? undefined,
        cvv: creditCard.cvv || undefined,
        notes: formData.notes || undefined,
        color_hex: formData.color_hex || undefined,
        balance_currency: formData.balance_currency || undefined,
        available_balance: num(formData.available_balance) ?? undefined,
        statement_date: num(formData.statement_date) ?? undefined,
        payment_due_date: num(formData.payment_due_date) ?? undefined,
        minimum_payment: num(formData.minimum_payment) ?? undefined,
        minimum_payment_percentage: num(formData.minimum_payment_percentage) ?? undefined,
        credit_limit: num(formData.credit_limit) ?? undefined,
        current_balance: num(formData.current_balance) ?? undefined,
      };
      await cardsAPI.create(data);
      toast.success(t('success.cardCreated') || 'Card created successfully');
      router.push('/cards');
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err, 'Failed to create card');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="add-card-page">
        <div className="page-header-section">
          <button
            onClick={() => router.back()}
            className="btn btn-secondary btn-back"
          >
            <ArrowLeft size={16} />
            <span>{t('common.back')}</span>
          </button>
          <div className="page-header-content">
            <div className="page-header-icon">
              <CreditCardIcon size={32} />
            </div>
            <div>
              <h1>{t('cards.addCard') || 'Add New Card'}</h1>
              <p className="page-subtitle">{t('cards.addCardDescription') || 'Fill in the card details below to add a new card'}</p>
            </div>
          </div>
        </div>

        {/* Card Scan Section */}
        <div className="card scan-card-section">
          <div className="scan-card-header">
            <div className="scan-card-title-row">
              <ScanLine size={22} />
              <div>
                <h3>{t('cards.scanCard') || 'Scan Card'}</h3>
                <p className="scan-card-subtitle">{t('cards.scanCardDesc') || 'Use your browser\'s built-in scanner or upload an image'}</p>
              </div>
            </div>
            <div className="scan-security-badge">
              <Shield size={14} />
              <span>{t('cards.scanSecure') || 'Secure'}</span>
            </div>
          </div>

          {/* Method 1: Browser Native Scanner (Primary) */}
          <div className="scan-method scan-method-primary">
            <button
              type="button"
              className="scan-btn scan-btn-native"
              onClick={() => {
                // Focus the card number input to trigger browser's autofill / card scan
                const ccInput = document.querySelector<HTMLInputElement>('input[name="cc-number"]');
                if (ccInput) {
                  ccInput.focus();
                  ccInput.click();
                }
              }}
            >
              <div className="scan-btn-icon-wrap">
                <Smartphone size={28} />
                <ScanLine size={16} className="scan-btn-overlay-icon" />
              </div>
              <div className="scan-btn-text">
                <span className="scan-btn-label">{t('cards.scanWithBrowser') || 'Scan with Camera'}</span>
                <span className="scan-btn-hint">{t('cards.scanWithBrowserHint') || 'Tap the card number field below to use your browser\'s card scanner'}</span>
              </div>
            </button>
          </div>

          {/* Method 2: Image Upload OCR (Secondary) */}
          {scanning ? (
            <div className="scan-loading">
              <Loader2 size={32} className="scan-spinner" />
              <p>{t('cards.scanning') || 'Scanning card...'}</p>
              {scanProgress > 0 && (
                <div className="scan-progress-bar">
                  <div className="scan-progress-fill" style={{ width: `${scanProgress}%` }} />
                </div>
              )}
              <p className="scan-loading-hint">{t('cards.scanningHint') || 'Extracting card details from image'}</p>
            </div>
          ) : (
            <div className="scan-method scan-method-secondary">
              <div className="scan-method-divider">
                <span>{t('cards.scanOrUpload') || 'or upload an image'}</span>
              </div>
              <div className="scan-actions">
                <button
                  type="button"
                  className="scan-btn scan-btn-camera"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera size={20} />
                  <span>{t('cards.takePhoto') || 'Take Photo'}</span>
                </button>
                <button
                  type="button"
                  className="scan-btn scan-btn-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={20} />
                  <span>{t('cards.uploadImage') || 'Upload Image'}</span>
                </button>
              </div>
            </div>
          )}

          {scanPreview && !scanning && (
            <div className="scan-preview">
              <button
                className="scan-preview-close"
                onClick={() => setScanPreview(null)}
                title={t('common.close') || 'Close'}
              >
                <X size={16} />
              </button>
              <div className="scan-preview-badge">
                <CheckCircle size={14} />
                <span>{t('cards.scanComplete') || 'Scan complete'}</span>
              </div>
            </div>
          )}

          <div className="scan-security-note">
            <Shield size={14} />
            <span>{t('cards.scanSecurityNote') || 'Your card image is processed locally on your device and never uploaded to any server.'}</span>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>

        {/* Card Preview in Header */}
        <div className="card-preview-section">
          <CreditCard
            value={creditCard}
            onChange={handleCreditCardChange}
            onValidationChange={(isValid) => setCardValid(isValid)}
            cardStyle="shiny-silver"
            showVendor={true}
            cvvLabel="CVV"
          />
        </div>

        {/* Form Fields */}
        <div className="form-column form-column-fields">
          <form onSubmit={handleSubmit} className="card form-card">
              {error && (
                <div className="form-error">
                  {error}
                </div>
              )}

              {/* Basic Information */}
              <div className="form-section">
                <div className="section-header">
                  <Building2 size={20} />
                  <h3 className="form-section-title">{t('cards.basicInformation') || 'Basic Information'}</h3>
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>{t('cards.cardName') || 'Card Name'} *</label>
                    <input
                      type="text"
                      required
                      value={formData.card_name}
                      onChange={(e) => setFormData({ ...formData, card_name: e.target.value })}
                      placeholder="e.g., Personal Credit Card"
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('cards.bankName') || 'Bank Name'} *</label>
                    <SearchableSelect
                      required
                      value={formData.bank_name}
                      onChange={(bank) => setFormData({ ...formData, bank_name: bank })}
                      options={UAE_BANKS}
                      placeholder={t('common.selectBank') || 'Search or select bank...'}
                      noMatchesText={t('common.noMatches') || 'No matches'}
                      aria-label={t('cards.bankName') || 'Bank Name'}
                    />
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>{t('cards.cardType') || 'Card Type'} *</label>
                    <SearchableSelect
                      required
                      value={formData.card_type}
                      onChange={(v) => setFormData({ ...formData, card_type: v })}
                      options={[t('cards.credit'), t('cards.debit'), t('cards.prepaid')]}
                      optionValues={['credit', 'debit', 'prepaid']}
                      placeholder={t('common.search')}
                      noMatchesText={t('common.noMatches')}
                      aria-label={t('cards.cardType')}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('cards.cardNetwork') || 'Card Network'}</label>
                    <SearchableSelect
                      value={formData.card_network}
                      onChange={(v) => setFormData({ ...formData, card_network: v })}
                      options={[t('common.autoDetected'), t('cards.network_visa'), t('cards.network_mastercard'), t('cards.network_amex'), t('cards.network_discover')]}
                      optionValues={['', 'visa', 'mastercard', 'amex', 'discover']}
                      placeholder={t('common.search')}
                      noMatchesText={t('common.noMatches')}
                      aria-label={t('cards.cardNetwork')}
                    />
                  </div>
                </div>
              </div>

              {/* Balance Information */}
              {formData.card_type !== 'credit' && (
                <div className="form-section">
                  <div className="section-header">
                    <Wallet size={20} />
                    <h3 className="form-section-title">{t('cards.balanceInformation') || 'Balance Information'}</h3>
                  </div>

                  <div className="form-group">
                    <label>{t('cards.availableBalance') || 'Available Balance'}</label>
                    <FormattedNumberInput
                      value={formData.available_balance}
                      onChange={(v) => setFormData({ ...formData, available_balance: v })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              {/* Credit Card Management */}
              {formData.card_type === 'credit' && (
                <div className="form-section">
                  <div className="section-header">
                    <Wallet size={20} />
                    <h3 className="form-section-title">{t('cards.creditCardManagement') || 'Credit Card Management'}</h3>
                  </div>

                  <div className="grid grid-2">
                    <div className="form-group">
                      <label>{t('cards.creditLimit') || 'Credit Limit'}</label>
                      <FormattedNumberInput
                        value={formData.credit_limit}
                        onChange={(v) => setFormData({ ...formData, credit_limit: v })}
                        placeholder="e.g., 50,000"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('cards.currentBalance') || 'Current Balance'}</label>
                      <FormattedNumberInput
                        value={formData.current_balance}
                        onChange={(v) => setFormData({ ...formData, current_balance: v })}
                        placeholder="e.g., 15,000"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('cards.statementDate') || 'Statement Date (Day)'}</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.statement_date}
                        onChange={(e) => setFormData({ ...formData, statement_date: e.target.value })}
                        placeholder="e.g., 15"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('cards.paymentDueDate') || 'Payment Due Date (Day)'}</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={formData.payment_due_date}
                        onChange={(e) => setFormData({ ...formData, payment_due_date: e.target.value })}
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('cards.minimumPayment') || 'Minimum Payment'}</label>
                      <FormattedNumberInput
                        value={formData.minimum_payment}
                        onChange={(v) => setFormData({ ...formData, minimum_payment: v })}
                        placeholder="e.g., 500"
                      />
                      <p className="form-hint">{t('cards.minimumPaymentHint') || 'Fixed amount, or use % below'}</p>
                    </div>
                    <div className="form-group">
                      <label>{t('cards.minimumPaymentPercent') || 'Minimum Payment %'}</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.minimum_payment_percentage}
                        onChange={(e) => setFormData({ ...formData, minimum_payment_percentage: e.target.value })}
                        placeholder="e.g., 5"
                      />
                      <p className="form-hint">{t('cards.minimumPaymentPercentHint') || 'e.g. 5 = 5% of amount due (varies by bank)'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="form-section">
                <div className="section-header">
                  <FileText size={20} />
                  <h3 className="form-section-title">{t('cards.notes') || 'Notes'}</h3>
                </div>

                <div className="form-group">
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder={t('cards.notesPlaceholder') || 'Add any additional notes about this card...'}
                  />
                </div>
              </div>

            {/* Action Buttons */}
            <div className="form-actions">
              <button
                type="submit"
                disabled={loading || !cardValid}
                className="btn btn-primary btn-submit"
              >
                {loading ? (t('common.creating') || 'Creating...') : (t('cards.addCard') || 'Add Card')}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-secondary"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}

export default function NewCardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="loading-page">
        <div className="loading-page-content">
          <div className="loading-spinner loading-center"></div>
        </div>
      </div>
    );
  }

  return <NewCardContent />;
}
