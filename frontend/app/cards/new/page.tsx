'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI } from '@/app/api/cards';
import Layout from '@/components/Layout';
import { useTranslations } from '@/lib/i18n';
import { ArrowLeft, CreditCard as CreditCardIcon, Building2, Wallet, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { CreditCard, type CreditCardValue } from '@/components/ui/CreditCard';

function NewCardContent() {
  const router = useRouter();
  const { isAuthenticated, loadUser } = useAuthStore();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardValid, setCardValid] = useState(false);
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
    credit_limit: '',
    current_balance: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      loadUser().catch(() => router.push('/login'));
    }
  }, [isAuthenticated, loadUser, router]);

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
      const data: any = {
        ...formData,
        card_number: creditCard.cardNumber.replace(/\s/g, ''),
        cardholder_name: creditCard.cardholderName,
        expiry_month: creditCard.expiryMonth ? parseInt(creditCard.expiryMonth) : null,
        expiry_year: creditCard.expiryYear ? parseInt(creditCard.expiryYear) : null,
        cvv: creditCard.cvv,
        available_balance: formData.available_balance ? parseFloat(formData.available_balance) : null,
        statement_date: formData.statement_date ? parseInt(formData.statement_date) : null,
        payment_due_date: formData.payment_due_date ? parseInt(formData.payment_due_date) : null,
        minimum_payment: formData.minimum_payment ? parseFloat(formData.minimum_payment) : null,
        credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : null,
        current_balance: formData.current_balance ? parseFloat(formData.current_balance) : null,
      };
      await cardsAPI.create(data);
      toast.success(t('success.cardCreated') || 'Card created successfully');
      router.push('/cards');
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to create card';
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
                    <input
                      type="text"
                      required
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="e.g., Emirates NBD"
                    />
                  </div>
                </div>

                <div className="grid grid-2">
                  <div className="form-group">
                    <label>{t('cards.cardType') || 'Card Type'} *</label>
                    <select
                      required
                      value={formData.card_type}
                      onChange={(e) => setFormData({ ...formData, card_type: e.target.value })}
                    >
                      <option value="credit">{t('cards.credit') || 'Credit'}</option>
                      <option value="debit">{t('cards.debit') || 'Debit'}</option>
                      <option value="prepaid">{t('cards.prepaid') || 'Prepaid'}</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t('cards.cardNetwork') || 'Card Network'}</label>
                    <select
                      value={formData.card_network}
                      onChange={(e) => setFormData({ ...formData, card_network: e.target.value })}
                    >
                      <option value="">{t('common.autoDetected') || 'Auto-detected'}</option>
                      <option value="visa">VISA</option>
                      <option value="mastercard">Mastercard</option>
                      <option value="amex">American Express</option>
                      <option value="discover">Discover</option>
                    </select>
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
                    <input
                      type="number"
                      step="0.01"
                      value={formData.available_balance}
                      onChange={(e) => setFormData({ ...formData, available_balance: e.target.value })}
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
                      <input
                        type="number"
                        step="0.01"
                        value={formData.credit_limit}
                        onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                        placeholder="e.g., 50000"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('cards.currentBalance') || 'Current Balance'}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.current_balance}
                        onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                        placeholder="e.g., 15000"
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
                      <input
                        type="number"
                        step="0.01"
                        value={formData.minimum_payment}
                        onChange={(e) => setFormData({ ...formData, minimum_payment: e.target.value })}
                        placeholder="e.g., 500"
                      />
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
