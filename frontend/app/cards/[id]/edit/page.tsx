'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, CreditCard as CreditCardIcon,
  Building2, Wallet, FileText, Star, X, Lock,
} from 'lucide-react';
import { extractCardId } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { UAE_BANKS } from '@/lib/uae-banks';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import FormattedNumberInput from '@/components/ui/FormattedNumberInput';
import CreditCard, { type CreditCardValue } from '@/components/ui/CreditCard';

const isPlaceholderNumber = (n: string) => {
  const d = n.replace(/\s/g, '');
  return /^0+$/.test(d) || /^0{12}\d{4}$/.test(d);
};

export default function EditCardPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cardId, setCardId] = useState('');
  const [benefitInput, setBenefitInput] = useState('');

  // CreditCard visual component state
  const [creditCard, setCreditCard] = useState<CreditCardValue>({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cvvLabel: 'CVV',
  });

  // Rest of the form fields
  const [formData, setFormData] = useState({
    card_name: '',
    bank_name: '',
    card_type: 'credit' as 'credit' | 'debit' | 'prepaid',
    card_network: '',
    iban: '',
    notes: '',
    available_balance: '',
    balance_currency: 'AED',
    credit_limit: '',
    current_balance: '',
    statement_date: '',
    payment_due_date: '',
    minimum_payment: '',
    minimum_payment_percentage: '',
    card_benefits: [] as string[],
  });

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  const loadCard = useCallback(async (id: string) => {
    try {
      const card = await cardsAPI.get(id, true);

      setCreditCard({
        cardholderName: card.cardholder_name || '',
        cardNumber: card.card_number && !isPlaceholderNumber(card.card_number)
          ? card.card_number.replace(/\s/g, '')
          : '',
        expiryMonth: card.expiry_month != null ? String(card.expiry_month).padStart(2, '0') : '',
        expiryYear: card.expiry_year != null
          ? String(card.expiry_year > 100 ? card.expiry_year % 100 : card.expiry_year).padStart(2, '0')
          : '',
        cvv: card.cvv || '',
        cvvLabel: 'CVV',
      });

      setFormData({
        card_name: card.card_name || '',
        bank_name: card.bank_name || '',
        card_type: card.card_type || 'credit',
        card_network: card.card_network || '',
        iban: card.iban || '',
        notes: card.notes || '',
        available_balance: card.available_balance != null ? String(card.available_balance) : '',
        balance_currency: card.balance_currency || 'AED',
        credit_limit: card.credit_limit != null ? String(card.credit_limit) : '',
        current_balance: card.current_balance != null ? String(card.current_balance) : '',
        statement_date: card.statement_date != null ? String(card.statement_date) : '',
        payment_due_date: card.payment_due_date != null ? String(card.payment_due_date) : '',
        minimum_payment: card.minimum_payment != null ? String(card.minimum_payment) : '',
        minimum_payment_percentage: card.minimum_payment_percentage != null ? String(card.minimum_payment_percentage) : '',
        card_benefits: card.card_benefits
          ? (() => { try { return JSON.parse(card.card_benefits); } catch { return []; } })()
          : [],
      });

      setLoading(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('errors.generic')));
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAuthenticated && params.id) {
      const id = extractCardId(params.id as string);
      setCardId(id);
      loadCard(id);
    }
  }, [isAuthenticated, params.id, loadCard]);

  const addBenefit = () => {
    const val = benefitInput.trim();
    if (val && !formData.card_benefits.includes(val)) {
      setFormData(prev => ({ ...prev, card_benefits: [...prev.card_benefits, val] }));
      setBenefitInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        card_name: formData.card_name,
        bank_name: formData.bank_name,
        card_type: formData.card_type,
        card_network: formData.card_network || undefined,
        cardholder_name: creditCard.cardholderName || undefined,
        card_number: creditCard.cardNumber ? creditCard.cardNumber.replace(/\s/g, '') : undefined,
        expiry_month: creditCard.expiryMonth ? parseInt(creditCard.expiryMonth) : undefined,
        expiry_year: creditCard.expiryYear ? parseInt(creditCard.expiryYear) : undefined,
        cvv: creditCard.cvv || undefined,
        iban: formData.iban || undefined,
        notes: formData.notes || undefined,
        available_balance: formData.available_balance ? parseFloat(formData.available_balance) : undefined,
        balance_currency: formData.balance_currency || undefined,
        card_benefits: formData.card_benefits.length > 0 ? JSON.stringify(formData.card_benefits) : undefined,
      };

      if (formData.card_type === 'credit') {
        data.credit_limit = formData.credit_limit ? parseFloat(formData.credit_limit) : undefined;
        data.current_balance = formData.current_balance ? parseFloat(formData.current_balance) : undefined;
        data.statement_date = formData.statement_date ? parseInt(formData.statement_date) : undefined;
        data.payment_due_date = formData.payment_due_date ? parseInt(formData.payment_due_date) : undefined;
        data.minimum_payment = formData.minimum_payment ? parseFloat(formData.minimum_payment) : undefined;
        data.minimum_payment_percentage = formData.minimum_payment_percentage ? parseFloat(formData.minimum_payment_percentage) : undefined;
      }

      await cardsAPI.update(cardId, data as never);
      toast.success(t('success.cardUpdated') || 'Card updated successfully');
      router.push(`/cards/${cardId}`);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('errors.generic')));
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center loading-container">
          <div className="text-center">
            <div className="loading-spinner loading-center" />
            <p className="text-secondary">{t('common.loading')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="add-card-page">
        {/* Header */}
        <div className="page-header-section">
          <button onClick={() => router.back()} className="btn btn-secondary btn-back">
            <ArrowLeft size={16} />
            <span>{t('common.back')}</span>
          </button>
          <div className="page-header-content">
            <div className="page-header-icon">
              <CreditCardIcon size={32} />
            </div>
            <div>
              <h1>{t('cards.editCard') || 'Edit Card'}</h1>
              <p className="page-subtitle">{t('cards.editCardSubtitle') || 'Update your card details'}</p>
            </div>
          </div>
        </div>

        {/* Card Visual Preview */}
        <div className="card-preview-section">
          <CreditCard
            value={creditCard}
            onChange={setCreditCard}
            onValidationChange={() => {}}
            cardStyle="shiny-silver"
            showVendor={true}
            cvvLabel="CVV"
          />
        </div>

        {/* Form */}
        <div className="form-column form-column-fields">
          <form onSubmit={handleSubmit} className="card form-card">

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
                    onChange={(e) => setFormData(p => ({ ...p, card_name: e.target.value }))}
                    placeholder="e.g., Personal Credit Card"
                  />
                </div>
                <div className="form-group">
                  <label>{t('cards.bankName') || 'Bank Name'} *</label>
                  <SearchableSelect
                    required
                    value={formData.bank_name}
                    onChange={(v) => setFormData(p => ({ ...p, bank_name: v }))}
                    options={UAE_BANKS}
                    placeholder={t('common.selectBank') || 'Search or select bank...'}
                    noMatchesText={t('common.noMatches') || 'No matches'}
                    extraOptions={
                      formData.bank_name && !(UAE_BANKS as readonly string[]).includes(formData.bank_name)
                        ? [formData.bank_name]
                        : []
                    }
                    aria-label={t('cards.bankName') || 'Bank Name'}
                  />
                </div>
              </div>

              <div className="grid grid-2">
                <div className="form-group">
                  <label>{t('cards.cardType') || 'Card Type'} *</label>
                  <SearchableSelect
                    value={formData.card_type}
                    onChange={(v) => setFormData(p => ({ ...p, card_type: v as 'credit' | 'debit' | 'prepaid' }))}
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
                    onChange={(v) => setFormData(p => ({ ...p, card_network: v }))}
                    options={[t('common.autoDetected'), t('cards.network_visa'), t('cards.network_mastercard'), t('cards.network_amex'), t('cards.network_discover')]}
                    optionValues={['', 'visa', 'mastercard', 'amex', 'discover']}
                    placeholder={t('common.search')}
                    noMatchesText={t('common.noMatches')}
                    aria-label={t('cards.cardNetwork')}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('cards.iban') || 'IBAN'}</label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData(p => ({ ...p, iban: e.target.value }))}
                  placeholder="AE123456789012345678901"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Balance — debit / prepaid */}
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
                    onChange={(v) => setFormData(p => ({ ...p, available_balance: v }))}
                    className="form-input"
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
                      onChange={(v) => setFormData(p => ({ ...p, credit_limit: v }))}
                      className="form-input"
                      placeholder="e.g., 50,000"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('cards.currentBalance') || 'Current Balance'}</label>
                    <FormattedNumberInput
                      value={formData.current_balance}
                      onChange={(v) => setFormData(p => ({ ...p, current_balance: v }))}
                      className="form-input"
                      placeholder="e.g., 15,000"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('cards.statementDate') || 'Statement Date (Day)'}</label>
                    <input
                      type="number"
                      min="1" max="31"
                      value={formData.statement_date}
                      onChange={(e) => setFormData(p => ({ ...p, statement_date: e.target.value }))}
                      placeholder="e.g., 15"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('cards.paymentDueDate') || 'Payment Due Date (Day)'}</label>
                    <input
                      type="number"
                      min="1" max="31"
                      value={formData.payment_due_date}
                      onChange={(e) => setFormData(p => ({ ...p, payment_due_date: e.target.value }))}
                      placeholder="e.g., 10"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('cards.minimumPayment') || 'Minimum Payment'}</label>
                    <FormattedNumberInput
                      value={formData.minimum_payment}
                      onChange={(v) => setFormData(p => ({ ...p, minimum_payment: v }))}
                      className="form-input"
                      placeholder="e.g., 500"
                    />
                    <p className="form-hint">{t('cards.minimumPaymentHint') || 'Fixed amount, or use % below'}</p>
                  </div>
                  <div className="form-group">
                    <label>{t('cards.minimumPaymentPercent') || 'Minimum Payment %'}</label>
                    <input
                      type="number"
                      min="0" max="100" step="0.5"
                      value={formData.minimum_payment_percentage}
                      onChange={(e) => setFormData(p => ({ ...p, minimum_payment_percentage: e.target.value }))}
                      placeholder="e.g., 5"
                    />
                    <p className="form-hint">{t('cards.minimumPaymentPercentHint') || 'e.g. 5 = 5% of amount due'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Benefits */}
            <div className="form-section">
              <div className="section-header">
                <Star size={20} />
                <h3 className="form-section-title">{t('cards.benefits') || 'Card Benefits'}</h3>
              </div>
              <p className="form-hint">{t('cards.benefitsHint') || 'Add the perks and features of this card'}</p>
              <div className="benefits-input-row">
                <input
                  type="text"
                  value={benefitInput}
                  onChange={(e) => setBenefitInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBenefit(); } }}
                  placeholder={t('cards.benefitsPlaceholder') || 'e.g., Airport lounge access'}
                />
                <button type="button" className="btn btn-secondary" onClick={addBenefit}>
                  {t('cards.addBenefit') || 'Add'}
                </button>
              </div>
              {formData.card_benefits.length > 0 && (
                <div className="benefits-tags">
                  {formData.card_benefits.map((b, i) => (
                    <span key={i} className="benefit-tag">
                      {b}
                      <button
                        type="button"
                        className="benefit-tag-remove"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          card_benefits: prev.card_benefits.filter((_, idx) => idx !== i),
                        }))}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="form-section">
              <div className="section-header">
                <FileText size={20} />
                <h3 className="form-section-title">{t('cards.notes') || 'Notes'}</h3>
              </div>
              <div className="form-group">
                <textarea
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder={t('cards.notesPlaceholder') || 'Add any additional notes about this card...'}
                />
              </div>
            </div>

            {/* Security notice */}
            <div className="edit-security-notice">
              <Lock size={13} />
              <span>{t('cards.encryptedNotice') || 'All sensitive data is encrypted with AES-256'}</span>
            </div>

            {/* Actions */}
            <div className="form-actions">
              <button type="submit" disabled={saving} className="btn btn-primary btn-submit">
                <Save size={16} />
                <span>{saving ? (t('common.loading') || 'Saving...') : (t('cards.updateCard') || 'Save Changes')}</span>
              </button>
              <button type="button" onClick={() => router.back()} className="btn btn-secondary">
                {t('common.cancel') || 'Cancel'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </Layout>
  );
}
