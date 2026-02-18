'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { ArrowLeft, CreditCard as CreditCardIcon, Building2, Wallet, FileText, Camera, Upload, Loader2, Shield, X, CheckCircle, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { CreditCard, type CreditCardValue } from '@/components/ui/CreditCard';
import { CameraCardScanner, type ScanResult } from '@/components/ui/CameraCardScanner';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { UAE_BANKS } from '@/lib/uae-banks';
import { getErrorMessage } from '@/lib/errors';
import FormattedNumberInput from '@/components/ui/FormattedNumberInput';

function NewCardContent() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardValid, setCardValid] = useState(false);
  const [scanPreview, setScanPreview] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle scan result from camera scanner
  const handleScanResult = useCallback((result: ScanResult) => {
    const updates: Partial<CreditCardValue> = {};
    if (result.card_number) {
      updates.cardNumber = result.card_number.replace(/(\d{4})/g, '$1 ').trim();
    }
    if (result.cardholder_name) updates.cardholderName = result.cardholder_name;
    if (result.expiry_month) updates.expiryMonth = result.expiry_month.padStart(2, '0');
    if (result.expiry_year) {
      let year = result.expiry_year;
      if (year.length === 4) year = year.slice(2);
      updates.expiryYear = year;
    }
    if (result.cvv) updates.cvv = result.cvv;

    if (Object.keys(updates).length > 0) {
      setCreditCard(prev => ({ ...prev, ...updates }));
    }

    const formUpdates: Record<string, string> = {};
    if (result.card_network) formUpdates.card_network = result.card_network.toLowerCase();
    if (result.bank_name) {
      const matched = UAE_BANKS.find(b =>
        b.toLowerCase().includes(result.bank_name!.toLowerCase()) ||
        result.bank_name!.toLowerCase().includes(b.toLowerCase())
      );
      formUpdates.bank_name = matched || result.bank_name;
    }
    if (Object.keys(formUpdates).length > 0) {
      setFormData(prev => ({ ...prev, ...formUpdates }));
    }

    setScanPreview(true);
    const fieldsFound = Object.keys(result).filter(k => result[k as keyof typeof result]);
    toast.success(
      (t('cards.scanSuccess') || 'Card scanned!') + ` ${fieldsFound.length} ` + (t('cards.fieldsExtracted') || 'fields')
    );
  }, [t]);

  // Handle image file upload
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error(t('cards.scanInvalidFile') || 'Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('cards.scanFileTooLarge') || 'Image must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await cardsAPI.scanCardImage(dataUrl);

      if (result.error) {
        toast.error(result.error);
      } else {
        const fields = Object.keys(result).filter(k => result[k as keyof typeof result]);
        if (fields.length > 0) {
          handleScanResult(result);
        } else {
          toast.error(t('cards.scanNoData') || 'Could not read card details.');
        }
      }
    } catch {
      toast.error(t('cards.scanFailed') || 'Failed to scan card. Please try a clearer photo.');
    } finally {
      setUploading(false);
    }
  }, [t, handleScanResult]);

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

        {/* Camera Scanner Modal */}
        <CameraCardScanner
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onResult={handleScanResult}
        />

        {/* Card Scan Section */}
        <div className="card scan-card-section">
          <div className="scan-card-header">
            <div className="scan-card-title-row">
              <ScanLine size={22} />
              <div>
                <h3>{t('cards.scanCard') || 'Scan Card'}</h3>
                <p className="scan-card-subtitle">{t('cards.scanCardDesc') || 'Scan your card with the camera or upload an image'}</p>
              </div>
            </div>
            <div className="scan-security-badge">
              <Shield size={14} />
              <span>{t('cards.scanSecure') || 'Secure'}</span>
            </div>
          </div>

          {/* Scan Buttons */}
          <div className="scan-buttons-row">
            <button
              type="button"
              className="scan-btn scan-btn-native"
              onClick={() => setCameraOpen(true)}
            >
              <div className="scan-btn-icon-wrap">
                <Camera size={28} />
              </div>
              <div className="scan-btn-text">
                <span className="scan-btn-label">{t('cards.scanWithCamera') || 'Scan with Camera'}</span>
                <span className="scan-btn-hint">{t('cards.scanWithCameraHint') || 'Auto-scan your card details using the camera'}</span>
              </div>
            </button>

            <button
              type="button"
              className="scan-btn scan-btn-native scan-btn-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <div className="scan-btn-icon-wrap">
                {uploading ? <Loader2 size={28} className="scan-spinner" /> : <Upload size={28} />}
              </div>
              <div className="scan-btn-text">
                <span className="scan-btn-label">{t('cards.uploadImage') || 'Upload Image'}</span>
                <span className="scan-btn-hint">{t('cards.uploadImageHint') || 'Select a photo of your card from gallery'}</span>
              </div>
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {scanPreview && (
            <div className="scan-preview">
              <button className="scan-preview-close" onClick={() => setScanPreview(false)} title={t('common.close') || 'Close'}>
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
            <span>{t('cards.scanSecurityNote') || 'Card image is processed securely and never stored.'}</span>
          </div>
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
