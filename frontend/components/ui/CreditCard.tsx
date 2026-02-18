'use client';

import * as React from 'react';
import { useTranslations } from '@/lib/i18n';

export type CreditCardValue = {
  cardholderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cvvLabel?: 'CVC' | 'CVV';
};

type Props = {
  value?: CreditCardValue;
  onChange?: (v: CreditCardValue) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
  className?: string;
  cvvLabel?: 'CVC' | 'CVV';
  showVendor?: boolean;
  cardStyle?: 'default' | 'shiny-silver';
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, '');
}

const CARD_NUMBER_LENGTH = 16;

function formatCardNumber(raw: string) {
  const digits = onlyDigits(raw).slice(0, CARD_NUMBER_LENGTH);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) parts.push(digits.slice(i, i + 4));
  return parts.join(' ').trim();
}

function luhnCheck(num: string) {
  const digits = onlyDigits(num);
  if (digits.length !== CARD_NUMBER_LENGTH) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function detectVendor(num: string) {
  const d = onlyDigits(num);
  if (/^4/.test(d)) return 'VISA';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'MASTERCARD';
  if (/^3[47]/.test(d)) return 'AMEX';
  if (/^6/.test(d)) return 'DISCOVER';
  return 'CARD';
}

export function CreditCard({
  value,
  onChange,
  onValidationChange,
  className,
  cvvLabel = 'CVC',
  showVendor = true,
  cardStyle = 'default',
}: Props) {
  const [local, setLocal] = React.useState<CreditCardValue>({
    cardholderName: '',
    cardNumber: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    cvvLabel,
    ...(value ?? {}),
  });

  React.useEffect(() => {
    if (value) setLocal((p) => ({ ...p, ...value }));
  }, [value]);

  const [focused, setFocused] = React.useState<'front' | 'back'>('front');
  const { t } = useTranslations();

  const vendor = detectVendor(local.cardNumber);

  const errors = React.useMemo(() => {
    const e: Record<string, string> = {};

    const clean = onlyDigits(local.cardNumber);
    if (!clean) e.cardNumber = 'Card number is required';
    else if (clean.length !== CARD_NUMBER_LENGTH) e.cardNumber = `Card number must be exactly ${CARD_NUMBER_LENGTH} digits`;
    else if (!luhnCheck(clean)) e.cardNumber = 'Invalid card number';

    const mm = parseInt(local.expiryMonth || '0', 10);
    if (!local.expiryMonth) e.expiryMonth = 'Month is required';
    else if (!(mm >= 1 && mm <= 12)) e.expiryMonth = 'Invalid month';

    const yy = parseInt(local.expiryYear || '0', 10);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (!local.expiryYear) e.expiryYear = 'Year is required';
    else if (!(yy >= currentYear && yy <= currentYear + 20)) e.expiryYear = 'Invalid year';
    else if (yy === currentYear && mm && mm < currentMonth) e.expiryYear = 'Card expired';

    const cvv = onlyDigits(local.cvv);
    if (!cvv) e.cvv = 'CVV is required';
    else if (!(cvv.length === 3 || cvv.length === 4)) e.cvv = 'CVV must be 3–4 digits';

    if (!local.cardholderName || local.cardholderName.trim().length < 2) {
      e.cardholderName = 'Name is required';
    }

    return e;
  }, [local]);

  const isValid = Object.keys(errors).length === 0;

  React.useEffect(() => {
    onValidationChange?.(isValid, errors);
  }, [isValid, errors, onValidationChange]);

  const update = (patch: Partial<CreditCardValue>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange?.(next);
  };

  return (
    <div className={`credit-card-form-ltr ${className ?? ''}`.trim()} dir="ltr">
      {/* Card Preview - always LTR so number reads left-to-right */}
      <div className="credit-card-preview-wrapper">
        <div className="credit-card-perspective">
          <div
            className="credit-card-3d"
            style={{ transform: focused === 'back' ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            {/* Front */}
            <div className={`credit-card-front ${cardStyle === 'shiny-silver' ? 'credit-card-silver' : 'credit-card-default'}`}>
              <div className="credit-card-front-header">
                <div className="credit-card-chip-placeholder"></div>
                {showVendor && (
                  <div className="credit-card-vendor-badge">
                    {vendor === 'VISA' && <div className="card-network-visa">VISA</div>}
                    {vendor === 'MASTERCARD' && <div className="card-network-mastercard"></div>}
                    {vendor === 'AMEX' && <div className="card-network-amex">AMEX</div>}
                    {vendor === 'DISCOVER' && <div className="card-network-discover">DISCOVER</div>}
                    {!['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'].includes(vendor) && (
                      <div className="card-network-generic">{vendor}</div>
                    )}
                  </div>
                )}
              </div>

              <div className="credit-card-number-display">
                {formatCardNumber(local.cardNumber) || '•••• •••• •••• ••••'}
              </div>

              <div className="credit-card-front-footer">
                <div className="credit-card-holder-section">
                  <div className="credit-card-label-small">{t('cards.cardholderName') || 'Cardholder Name'}</div>
                  <div className="credit-card-name-display">
                    {(local.cardholderName || 'YOUR NAME').toUpperCase()}
                  </div>
                </div>

                <div className="credit-card-expiry-display">
                  <div className="credit-card-label-small">{t('cards.expires') || 'Expires'}</div>
                  <div className="credit-card-expiry-value-display">
                    {(local.expiryMonth || 'MM').padStart(2, '0')}/{(local.expiryYear ? String(local.expiryYear).slice(-2) : 'YY')}
                  </div>
                </div>
              </div>
            </div>

            {/* Back */}
            <div className={`credit-card-back ${cardStyle === 'shiny-silver' ? 'credit-card-silver' : 'credit-card-default'}`}>
              <div className="credit-card-back-stripe"></div>
              <div className="credit-card-back-cvv-section">
                <div className="credit-card-label-small">{local.cvvLabel ?? cvvLabel}</div>
                <div className="credit-card-cvv-display">
                  {(onlyDigits(local.cvv) ? '•'.repeat(Math.min(onlyDigits(local.cvv).length, 4)) : '•••')}
                </div>
              </div>
              <div className="credit-card-back-footer">
                Never store real card data. Use tokens from your payment gateway.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="credit-card-inputs">
        <div className="credit-card-input-group">
          <label>{t('cards.cardholderName') || 'Cardholder Name'}</label>
          <input
            name="cc-name"
            autoComplete="cc-name"
            value={local.cardholderName}
            onChange={(e) => update({ cardholderName: e.target.value })}
            onFocus={() => setFocused('front')}
            placeholder="John Doe"
            aria-label="Cardholder name"
          />
          {errors.cardholderName && <p className="credit-card-error">{errors.cardholderName}</p>}
        </div>

        <div className="credit-card-input-group">
          <label>{t('cards.cardNumber') || 'Card Number'}</label>
          <input
            name="cc-number"
            type="tel"
            inputMode="numeric"
            pattern="[0-9\s]*"
            autoComplete="cc-number"
            value={local.cardNumber}
            onChange={(e) => {
              const digitsOnly = onlyDigits(e.target.value).slice(0, CARD_NUMBER_LENGTH);
              update({ cardNumber: formatCardNumber(digitsOnly) });
            }}
            onFocus={() => setFocused('front')}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            aria-label="Card number"
          />
          {errors.cardNumber && <p className="credit-card-error">{errors.cardNumber}</p>}
        </div>

        <div className="credit-card-input-row">
          <div className="credit-card-input-group">
            <label>{t('cards.month') || 'Month'}</label>
            <input
              name="cc-exp-month"
              type="tel"
              inputMode="numeric"
              autoComplete="cc-exp-month"
              value={local.expiryMonth}
              onChange={(e) => update({ expiryMonth: onlyDigits(e.target.value).slice(0, 2) })}
              onFocus={() => setFocused('front')}
              placeholder="MM"
              minLength={1}
              maxLength={2}
              aria-label="Expiry month"
            />
            {errors.expiryMonth && <p className="credit-card-error">{errors.expiryMonth}</p>}
          </div>

          <div className="credit-card-input-group">
            <label>{t('cards.year') || 'Year'}</label>
            <input
              name="cc-exp-year"
              type="tel"
              inputMode="numeric"
              autoComplete="cc-exp-year"
              value={local.expiryYear}
              onChange={(e) => update({ expiryYear: onlyDigits(e.target.value).slice(0, 4) })}
              onFocus={() => setFocused('front')}
              placeholder="YYYY"
              maxLength={4}
              aria-label="Expiry year"
            />
            {errors.expiryYear && <p className="credit-card-error">{errors.expiryYear}</p>}
          </div>

          <div className="credit-card-input-group">
            <label>{local.cvvLabel ?? cvvLabel}</label>
            <input
              name="cc-csc"
              type="tel"
              inputMode="numeric"
              autoComplete="cc-csc"
              value={local.cvv}
              onChange={(e) => update({ cvv: onlyDigits(e.target.value).slice(0, 4) })}
              onFocus={() => setFocused('back')}
              onBlur={() => setFocused('front')}
              placeholder="123"
              maxLength={4}
              aria-label="CVV"
            />
            {errors.cvv && <p className="credit-card-error">{errors.cvv}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
