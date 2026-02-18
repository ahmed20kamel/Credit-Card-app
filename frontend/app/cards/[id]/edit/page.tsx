'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI, Card } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, CreditCard as CreditCardIcon, Building2, Wallet, FileText } from 'lucide-react';
import { extractCardId } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { UAE_BANKS } from '@/lib/uae-banks';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

export default function EditCardPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cardId, setCardId] = useState('');
  const [formData, setFormData] = useState({
    card_name: '',
    bank_name: '',
    card_type: 'credit' as 'credit' | 'debit' | 'prepaid',
    card_network: '',
    card_number: '',
    cardholder_name: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
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
  });

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

  useEffect(() => {
    if (isAuthenticated && params.id) {
      const id = extractCardId(params.id as string);
      setCardId(id);
      loadCard(id);
    }
  }, [isAuthenticated, params.id]);

  const loadCard = async (id: string) => {
    try {
      const card = await cardsAPI.get(id, true);
      setFormData({
        card_name: card.card_name || '',
        bank_name: card.bank_name || '',
        card_type: card.card_type || 'credit',
        card_network: card.card_network || '',
        card_number: card.card_number ? card.card_number.replace(/\s/g, '') : '',
        cardholder_name: card.cardholder_name || '',
        expiry_month: card.expiry_month != null ? String(card.expiry_month) : '',
        expiry_year: card.expiry_year != null ? String(card.expiry_year) : '',
        cvv: card.cvv || '',
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
      });
      setLoading(false);
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('errors.generic'));
      toast.error(message);
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
        card_number: formData.card_number ? formData.card_number.replace(/\s/g, '') : undefined,
        cardholder_name: formData.cardholder_name || undefined,
        expiry_month: formData.expiry_month ? parseInt(formData.expiry_month) : undefined,
        expiry_year: formData.expiry_year ? parseInt(formData.expiry_year) : undefined,
        cvv: formData.cvv || undefined,
        iban: formData.iban || undefined,
        notes: formData.notes || undefined,
        available_balance: formData.available_balance ? parseFloat(formData.available_balance) : undefined,
        balance_currency: formData.balance_currency || undefined,
      };

      if (formData.card_type === 'credit') {
        data.credit_limit = formData.credit_limit ? parseFloat(formData.credit_limit) : undefined;
        data.current_balance = formData.current_balance ? parseFloat(formData.current_balance) : undefined;
        data.statement_date = formData.statement_date ? parseInt(formData.statement_date) : undefined;
        data.payment_due_date = formData.payment_due_date ? parseInt(formData.payment_due_date) : undefined;
        data.minimum_payment = formData.minimum_payment ? parseFloat(formData.minimum_payment) : undefined;
        data.minimum_payment_percentage = formData.minimum_payment_percentage ? parseFloat(formData.minimum_payment_percentage) : undefined;
      }

      await cardsAPI.update(cardId, data as any);
      toast.success(t('success.cardUpdated') || 'Card updated successfully');
      router.push(`/cards/${cardId}`);
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('errors.generic'));
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center loading-container">
          <div className="text-center">
            <div className="loading-spinner loading-center"></div>
            <p className="text-secondary">{t('common.loading')}</p>
          </div>
        </div>
      </Layout>
    );
  }

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
              <h1>{t('cards.editCard') || 'Edit Card'}</h1>
              <p className="page-subtitle">
                {t('cards.editCardSubtitle') || 'Update your card details'}
              </p>
            </div>
          </div>
        </div>

        <div className="form-layout">
          <div className="form-column form-column-fields">
            <form onSubmit={handleSubmit} className="card form-card">
              {/* Basic Information */}
              <div className="form-section">
                <div className="section-header">
                  <Building2 size={20} />
                  <h3 className="form-section-title">
                    {t('cards.basicInformation') || 'Basic Information'}
                  </h3>
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>
                      {t('cards.cardName') || 'Card Name'} *
                    </label>
                    <input
                      type="text"
                      name="card_name"
                      required
                      value={formData.card_name}
                      onChange={handleChange}
                      placeholder="e.g., Personal Credit Card"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {t('cards.bankName') || 'Bank Name'} *
                    </label>
                    <SearchableSelect
                      required
                      value={formData.bank_name}
                      onChange={(bank) => setFormData((prev) => ({ ...prev, bank_name: bank }))}
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
                    <label>
                      {t('cards.cardType') || 'Card Type'} *
                    </label>
                    <SearchableSelect
                      value={formData.card_type}
                      onChange={(v) => setFormData((prev) => ({ ...prev, card_type: v as 'credit' | 'debit' | 'prepaid' }))}
                      options={[t('cards.credit'), t('cards.debit'), t('cards.prepaid')]}
                      optionValues={['credit', 'debit', 'prepaid']}
                      placeholder={t('common.search')}
                      noMatchesText={t('common.noMatches')}
                      aria-label={t('cards.cardType')}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {t('cards.cardNetwork') || 'Card Network'}
                    </label>
                    <SearchableSelect
                      value={formData.card_network}
                      onChange={(v) => setFormData((prev) => ({ ...prev, card_network: v }))}
                      options={[t('common.autoDetected'), t('cards.network_visa'), t('cards.network_mastercard'), t('cards.network_amex'), t('cards.network_discover')]}
                      optionValues={['', 'visa', 'mastercard', 'amex', 'discover']}
                      placeholder={t('common.search')}
                      noMatchesText={t('common.noMatches')}
                      aria-label={t('cards.cardNetwork')}
                    />
                  </div>
                </div>

                <div className="form-group credit-card-form-ltr" dir="ltr">
                  <label>
                    {t('cards.cardNumber') || 'Card Number'}
                  </label>
                  <input
                    type="tel"
                    name="card_number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={formData.card_number.replace(/(.{4})/g, '$1 ').trim()}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                      if (value.length <= 19) {
                        setFormData({ ...formData, card_number: value });
                      }
                    }}
                    placeholder="1234 5678 9012 3456"
                    maxLength={23}
                    aria-label="Card number"
                  />
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>
                      {t('cards.cardholder') || 'Cardholder Name'}
                    </label>
                    <input
                      type="text"
                      name="cardholder_name"
                      value={formData.cardholder_name}
                      onChange={handleChange}
                      placeholder="e.g., John Doe"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {t('cards.expiry') || 'Expiry'}
                    </label>
                    <div className="form-row">
                      <input
                        type="number"
                        name="expiry_month"
                        min="1"
                        max="12"
                        value={formData.expiry_month}
                        onChange={handleChange}
                        placeholder="MM"
                      />
                      <input
                        type="number"
                        name="expiry_year"
                        min="2024"
                        max="2099"
                        value={formData.expiry_year}
                        onChange={handleChange}
                        placeholder="YYYY"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>
                      {t('cards.cvv') || 'CVV'}
                    </label>
                    <input
                      type="text"
                      name="cvv"
                      value={formData.cvv}
                      onChange={handleChange}
                      placeholder="123"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      {t('cards.iban') || 'IBAN'}
                    </label>
                    <input
                      type="text"
                      name="iban"
                      value={formData.iban}
                      onChange={handleChange}
                      placeholder="AE123456789012345678901"
                    />
                  </div>
                </div>
              </div>

              {/* Balance Information */}
              {formData.card_type !== 'credit' && (
                <div className="form-section">
                  <div className="section-header">
                    <Wallet size={20} />
                    <h3 className="form-section-title">
                      {t('cards.balanceInformation') || 'Balance Information'}
                    </h3>
                  </div>

                  <div className="form-group">
                    <label>
                      {t('cards.availableBalance') || 'Available Balance'}
                    </label>
                    <input
                      type="number"
                      name="available_balance"
                      step="0.01"
                      value={formData.available_balance}
                      onChange={handleChange}
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
                    <h3 className="form-section-title">
                      {t('cards.creditCardManagement') || 'Credit Card Management'}
                    </h3>
                  </div>
                  
                  <div className="grid grid-2">
                    <div className="form-group">
                      <label>
                        {t('cards.creditLimit') || 'Credit Limit'}
                      </label>
                      <input
                        type="number"
                        name="credit_limit"
                        step="0.01"
                        value={formData.credit_limit}
                        onChange={handleChange}
                        placeholder="e.g., 50000"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        {t('cards.currentBalance') || 'Current Balance'}
                      </label>
                      <input
                        type="number"
                        name="current_balance"
                        step="0.01"
                        value={formData.current_balance}
                        onChange={handleChange}
                        placeholder="e.g., 15000"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        {t('cards.statementDate') || 'Statement Date (Day)'}
                      </label>
                      <input
                        type="number"
                        name="statement_date"
                        min="1"
                        max="31"
                        value={formData.statement_date}
                        onChange={handleChange}
                        placeholder="e.g., 15"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        {t('cards.paymentDueDate') || 'Payment Due Date (Day)'}
                      </label>
                      <input
                        type="number"
                        name="payment_due_date"
                        min="1"
                        max="31"
                        value={formData.payment_due_date}
                        onChange={handleChange}
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        {t('cards.minimumPayment') || 'Minimum Payment'}
                      </label>
                      <input
                        type="number"
                        name="minimum_payment"
                        step="0.01"
                        value={formData.minimum_payment}
                        onChange={handleChange}
                        placeholder="e.g., 500"
                      />
                      <p className="form-hint">{t('cards.minimumPaymentHint') || 'Fixed amount, or use % below'}</p>
                    </div>
                    <div className="form-group">
                      <label>
                        {t('cards.minimumPaymentPercent') || 'Minimum Payment %'}
                      </label>
                      <input
                        type="number"
                        name="minimum_payment_percentage"
                        min="0"
                        max="100"
                        step="0.5"
                        value={formData.minimum_payment_percentage}
                        onChange={handleChange}
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
                  <h3 className="form-section-title">
                    {t('cards.notes') || 'Notes'}
                  </h3>
                </div>

                <div className="form-group">
                  <textarea
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder={t('cards.notesPlaceholder') || 'Add any additional notes about this card...'}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-submit"
                >
                  <Save size={16} />
                  <span>
                    {saving
                      ? (t('common.loading') || 'Loading...')
                      : (t('cards.updateCard') || t('common.save') || 'Save')}
                  </span>
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
      </div>
    </Layout>
  );
}
