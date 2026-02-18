"""
SMS Parser for Bank Transaction Messages
"""
import re
import logging
from datetime import datetime
from typing import Optional, Dict
from decimal import Decimal, InvalidOperation
from django.utils import timezone as tz

logger = logging.getLogger(__name__)


class ParsedTransaction:
    def __init__(self, bank_name: str, currency: str, amount: Decimal,
                 card_last_four: Optional[str] = None, merchant_name: Optional[str] = None,
                 transaction_date: Optional[datetime] = None, transaction_type: str = 'purchase',
                 raw_message: str = ''):
        self.bank_name = bank_name
        self.currency = currency
        self.amount = amount
        self.card_last_four = card_last_four
        self.merchant_name = merchant_name
        self.transaction_date = transaction_date or tz.now()
        self.transaction_type = transaction_type
        self.raw_message = raw_message

    def to_dict(self):
        return {
            'bank_name': self.bank_name,
            'currency': self.currency,
            'amount': float(self.amount),
            'card_last_four': self.card_last_four,
            'merchant_name': self.merchant_name,
            'transaction_date': self.transaction_date.isoformat(),
            'transaction_type': self.transaction_type,
            'raw_message': self.raw_message
        }


def detect_transaction_type(sms_body: str) -> str:
    """
    Detect transaction type from SMS body text.
    Supports both English and Arabic keywords.
    Returns one of: purchase, withdrawal, payment, refund, transfer, deposit
    """
    lower_body = sms_body.lower()

    # --- Payment (paying card bill / settling balance) ---
    payment_en = any(w in lower_body for w in [
        'payment received', 'payment credited', 'bill payment',
        'payment towards', 'payment of', 'payment to card',
        'paid to credit card', 'payment successful',
        'thank you for your payment', 'payment has been',
    ])
    payment_ar = any(w in sms_body for w in [
        'سداد', 'تم السداد', 'سددت', 'دفعة',
        'تسديد', 'تم تسديد', 'سداد فاتورة',
    ])

    # --- Deposit / credit to account (money IN) ---
    deposit_en = any(w in lower_body for w in [
        'deposited', 'deposit', 'credited to your account',
        'credit alert', 'incoming transfer', 'salary',
        'received', 'incoming', 'credit to',
    ])
    deposit_ar = any(w in sms_body for w in [
        'إيداع', 'تم إيداع', 'أودع', 'راتب', 'تحويل وارد',
        'تم تحويل', 'وارد', 'إضافة', 'تم إضافة',
    ])

    # --- Refund ---
    refund_en = any(w in lower_body for w in [
        'refund', 'reversal', 'reversed', 'refunded', 'cashback', 'cash back',
    ])
    refund_ar = any(w in sms_body for w in [
        'استرداد', 'تم استرداد', 'مرتجع', 'استرجاع',
    ])

    # --- Withdrawal ---
    withdrawal_en = any(w in lower_body for w in [
        'withdraw', 'withdrawal', 'atm', 'cash withdrawal',
    ])
    withdrawal_ar = any(w in sms_body for w in [
        'سحب', 'سحبت', 'صراف', 'سحب نقدي',
    ])

    # --- Transfer ---
    transfer_en = any(w in lower_body for w in [
        'transfer to', 'transferred to', 'sent to', 'outgoing transfer',
    ])
    transfer_ar = any(w in sms_body for w in [
        'تحويل إلى', 'حوالة', 'تم التحويل إلى',
    ])

    # --- Purchase ---
    purchase_en = any(w in lower_body for w in [
        'purchase', 'used', 'spent', 'charged', 'pos', 'transaction at', 'payment at',
    ])
    purchase_ar = any(w in sms_body for w in [
        'شراء', 'عملية شراء', 'استخدام', 'استخدمت', 'مشتريات',
    ])

    # Priority-based detection

    # 1. Payment (credit card bill payment)
    if payment_en or payment_ar:
        return 'payment'

    # 2. Refund
    if refund_en or refund_ar:
        return 'refund'

    # 3. Deposit (salary, incoming transfer, general credit)
    if deposit_en or deposit_ar:
        return 'deposit'

    # 4. Check debited/credited keywords
    if 'debited' in lower_body:
        if withdrawal_en or withdrawal_ar:
            return 'withdrawal'
        return 'purchase'

    if 'credited' in lower_body:
        # "credited" with card/bill context → payment
        if any(w in lower_body for w in ['card', 'bill', 'outstanding', 'due']):
            return 'payment'
        return 'deposit'

    # 5. Transfer
    if transfer_en or transfer_ar:
        return 'transfer'

    # 6. Withdrawal
    if withdrawal_en or withdrawal_ar:
        return 'withdrawal'

    # 7. Purchase
    if purchase_en or purchase_ar:
        return 'purchase'

    # 8. "دفع" alone (Arabic for payment) - lower priority to avoid conflicts
    if 'دفع' in sms_body or 'payment' in lower_body:
        return 'payment'

    # 9. Handle "credit" keyword carefully
    if 'credit' in lower_body:
        credit_pos = lower_body.find('credit')
        context_start = max(0, credit_pos - 15)
        context_end = min(len(lower_body), credit_pos + len('credit') + 15)
        context = lower_body[context_start:context_end]
        if 'card' in context:
            return 'purchase'
        return 'deposit'

    return 'purchase'  # Default


class BaseBankParser:
    def __init__(self, bank_name: str, sender_patterns: list):
        self.bank_name = bank_name
        self.sender_patterns = [re.compile(p, re.IGNORECASE) for p in sender_patterns]

    def matches_sender(self, sender: str) -> bool:
        return any(pattern.search(sender) for pattern in self.sender_patterns)

    def parse(self, sms_body: str, sender: str, received_at: datetime) -> Optional[ParsedTransaction]:
        raise NotImplementedError


class ADCBParser(BaseBankParser):
    def __init__(self):
        super().__init__('ADCB', [r'ADCB', r'AbuDhabi.*Commercial'])

    def parse(self, sms_body: str, sender: str, received_at: datetime) -> Optional[ParsedTransaction]:
        # Pattern: AED 1,234.56 was spent on your ADCB Card ending 1234 at MERCHANT on 15-Jan-2024
        purchase_pattern = re.compile(
            r'(AED|USD|EUR|GBP)\s*([\d,]+\.?\d*)\s*(?:was\s+)?spent\s+(?:on\s+)?your\s+(?:ADCB\s+)?Card\s+ending\s+(\d{4})\s+at\s+(.+?)(?:\s+on\s+(\d{2}-\w{3}-\d{4}))?',
            re.IGNORECASE
        )

        match = purchase_pattern.search(sms_body)
        if match:
            currency = match.group(1)
            amount = Decimal(match.group(2).replace(',', ''))
            card_last_four = match.group(3)
            merchant_name = match.group(4).strip() if match.group(4) else None

            transaction_date = received_at
            if match.group(5):
                try:
                    transaction_date = tz.make_aware(datetime.strptime(match.group(5), '%d-%b-%Y'))
                except (ValueError, TypeError):
                    pass

            return ParsedTransaction(
                bank_name=self.bank_name,
                currency=currency,
                amount=amount,
                card_last_four=card_last_four,
                merchant_name=merchant_name,
                transaction_date=transaction_date,
                transaction_type='purchase',
                raw_message=sms_body
            )

        # Payment/deposit pattern: AED X credited/deposited to Card ending 1234
        credit_pattern = re.compile(
            r'(AED|USD|EUR|GBP)\s*([\d,]+\.?\d*)\s+(?:has\s+been\s+)?(?:credited|deposited|received)\s+.*?(?:card|account)\s+(?:ending\s+)?(\d{4})',
            re.IGNORECASE
        )
        credit_match = credit_pattern.search(sms_body)
        if credit_match:
            currency = credit_match.group(1)
            amount = Decimal(credit_match.group(2).replace(',', ''))
            card_last_four = credit_match.group(3)
            transaction_type = detect_transaction_type(sms_body)

            return ParsedTransaction(
                bank_name=self.bank_name,
                currency=currency,
                amount=amount,
                card_last_four=card_last_four,
                transaction_date=received_at,
                transaction_type=transaction_type,
                raw_message=sms_body
            )

        # Balance update pattern
        balance_pattern = re.compile(
            r'(?:ADCB\s+)?Card\s+ending\s+(\d{4})\s+available\s+balance\s+(?:is\s+)?(AED|USD)\s*([\d,]+\.?\d*)',
            re.IGNORECASE
        )
        if balance_pattern.search(sms_body):
            return None

        return None


class DIBParser(BaseBankParser):
    def __init__(self):
        super().__init__('Dubai Islamic Bank', [r'DIB', r'Dubai.*Islamic'])

    def parse(self, sms_body: str, sender: str, received_at: datetime) -> Optional[ParsedTransaction]:
        txn_pattern = re.compile(
            r'(AED|USD)\s*([\d,]+\.?\d*)\s+(?:has\s+been\s+)?(debited|credited|spent|charged|deposited|received)\s+.*?(?:card|account)\s+(?:ending\s+)?(\d{4})',
            re.IGNORECASE
        )

        match = txn_pattern.search(sms_body)
        if match:
            currency = match.group(1)
            amount = Decimal(match.group(2).replace(',', ''))
            type_word = match.group(3).lower()
            card_last_four = match.group(4)

            if type_word in ('credited', 'deposited', 'received'):
                transaction_type = detect_transaction_type(sms_body)
            elif type_word == 'debited':
                if any(w in sms_body.lower() for w in ['atm', 'cash', 'withdraw']):
                    transaction_type = 'withdrawal'
                else:
                    transaction_type = 'purchase'
            else:
                transaction_type = 'purchase'

            return ParsedTransaction(
                bank_name=self.bank_name,
                currency=currency,
                amount=amount,
                card_last_four=card_last_four,
                transaction_date=received_at,
                transaction_type=transaction_type,
                raw_message=sms_body
            )

        return None


class ENBDParser(BaseBankParser):
    def __init__(self):
        super().__init__('Emirates NBD', [r'ENBD', r'Emirates.*NBD'])

    def parse(self, sms_body: str, sender: str, received_at: datetime) -> Optional[ParsedTransaction]:
        pattern = re.compile(
            r'(AED|USD)\s*([\d,]+\.?\d*)\s+(?:has\s+been\s+)?(debited|credited|spent|charged|withdrawn|deposited|received)\s+.*?(?:card|account)\s+(?:ending\s+)?(\d{4})',
            re.IGNORECASE
        )

        match = pattern.search(sms_body)
        if match:
            currency = match.group(1)
            amount = Decimal(match.group(2).replace(',', ''))
            type_word = match.group(3).lower()
            card_last_four = match.group(4)

            if type_word in ('credited', 'deposited', 'received'):
                transaction_type = detect_transaction_type(sms_body)
            elif type_word == 'withdrawn' or 'atm' in sms_body.lower():
                transaction_type = 'withdrawal'
            elif type_word == 'debited':
                transaction_type = 'purchase'
            else:
                transaction_type = 'purchase'

            return ParsedTransaction(
                bank_name=self.bank_name,
                currency=currency,
                amount=amount,
                card_last_four=card_last_four,
                transaction_date=received_at,
                transaction_type=transaction_type,
                raw_message=sms_body
            )

        return None


class GenericParser(BaseBankParser):
    def __init__(self):
        super().__init__('Unknown', [])

    def parse(self, sms_body: str, sender: str, received_at: datetime) -> Optional[ParsedTransaction]:
        if len(sms_body) > 1000:
            sms_body = sms_body[:1000]

        # Amount patterns (Arabic and English)
        amount_patterns = [
            re.compile(r'(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),
            re.compile(r'([\d,]+\.?\d*)\s*(AED|USD|EUR|GBP|SAR|INR)', re.IGNORECASE),
            re.compile(r'في\s+(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),
            re.compile(r'سحب\s+(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),
            re.compile(r'إيداع\s+(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),
            re.compile(r'سداد\s+(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),
        ]

        amount_match = None
        currency = 'AED'
        amount = None

        for pattern in amount_patterns:
            amount_match = pattern.search(sms_body)
            if amount_match:
                if len(amount_match.groups()) == 2:
                    if amount_match.group(1) in ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR']:
                        currency = amount_match.group(1)
                        amount = Decimal(amount_match.group(2).replace(',', ''))
                    else:
                        currency = amount_match.group(2)
                        amount = Decimal(amount_match.group(1).replace(',', ''))
                break

        if not amount_match or amount is None:
            fallback_amount_pattern = re.compile(r'([\d,]+\.?\d{2})\s*(?:AED|USD|EUR|GBP|SAR|INR|درهم|دولار)', re.IGNORECASE)
            fallback_match = fallback_amount_pattern.search(sms_body)
            if fallback_match:
                try:
                    amount = Decimal(fallback_match.group(1).replace(',', ''))
                    if 'USD' in sms_body.upper() or 'دولار' in sms_body:
                        currency = 'USD'
                    elif 'EUR' in sms_body.upper():
                        currency = 'EUR'
                    else:
                        currency = 'AED'
                except (ValueError, InvalidOperation):
                    pass

            if amount is None:
                last_resort_pattern = re.compile(r'([\d,]+\.\d{2})', re.IGNORECASE)
                last_resort_match = last_resort_pattern.search(sms_body)
                if last_resort_match:
                    try:
                        amount = Decimal(last_resort_match.group(1).replace(',', ''))
                        currency = 'AED'
                    except (ValueError, InvalidOperation):
                        pass

        if amount is None:
            return None

        # Card last 4 patterns
        last4_patterns = [
            re.compile(r'XXX(\d{4})', re.IGNORECASE),
            re.compile(r'XX(\d{4})', re.IGNORECASE),
            re.compile(r'(?:card|بطاقة|بطاقتك|card\s+ending|ending|xxxx|covered\s+card|المنتهية\s+ب|المنتهية|ب)\s*[\s:]*[Xx]*\s*(\d{4})', re.IGNORECASE),
            re.compile(r'البطاقة\s+(\d{4})', re.IGNORECASE),
            re.compile(r'بطاقتك\s+(\d{4})', re.IGNORECASE),
        ]

        card_last_four = None
        for pattern in last4_patterns:
            last4_match = pattern.search(sms_body)
            if last4_match:
                potential_last4 = last4_match.group(1)
                if potential_last4 and len(potential_last4) == 4:
                    if not re.search(rf'\d+{potential_last4}\d+', sms_body):
                        card_last_four = potential_last4
                        break

        if not card_last_four:
            fallback_last4 = re.findall(r'\b(\d{4})\b', sms_body)
            for num in fallback_last4:
                if not (1900 <= int(num) <= 2100):
                    if not re.search(rf'{num}\.\d{{2}}|\.\d{{2}}{num}', sms_body):
                        card_last_four = num
                        break

        # Merchant name patterns
        merchant_patterns = [
            re.compile(r'at\s+(.+?)(?:\s+on\s+|\s+-\s+[A-Z]{2,3}|\.|$)', re.IGNORECASE),
            re.compile(r'في\s+(.+?)(?:\s+على\s+|\s+-\s+[A-Z]{2,3}|\.|$)', re.IGNORECASE),
            re.compile(r'من\s+(.+?)(?:\s+،|\.|$)', re.IGNORECASE),
            re.compile(r'([A-Z][A-Z\s&]+(?:LLC|INC|LTD|CORP|SERVICES|HYPERMARKET|MALL|STORE))', re.IGNORECASE),
        ]

        merchant_name = None
        for pattern in merchant_patterns:
            merchant_match = pattern.search(sms_body)
            if merchant_match:
                merchant_name = merchant_match.group(1).strip()
                merchant_name = re.sub(r'\s*-\s*[A-Z]{2,3}$', '', merchant_name)
                merchant_name = re.sub(r',\s*[A-Z\s]+$', '', merchant_name)
                merchant_name = re.sub(r'\s+', ' ', merchant_name)
                if merchant_name and len(merchant_name) > 2:
                    break

        # Date patterns
        date_patterns = [
            re.compile(r'(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})', re.IGNORECASE),
            re.compile(r'(\d{2})/(\d{2})/(\d{4})', re.IGNORECASE),
            re.compile(r'(\d{4})-(\d{2})-(\d{2})', re.IGNORECASE),
            re.compile(r'(\d{2})-(\w{3})-(\d{4})\s+(\d{2}):(\d{2})', re.IGNORECASE),
        ]
        month_abbr = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}

        transaction_date = received_at
        for pattern in date_patterns:
            date_match = pattern.search(sms_body)
            if date_match:
                try:
                    if len(date_match.groups()) == 6:
                        day, month, year, hour, minute, second = date_match.groups()
                        transaction_date = datetime(int(year), int(month), int(day), int(hour), int(minute), int(second))
                    elif len(date_match.groups()) == 5:
                        day, month_str, year, hour, minute = date_match.groups()
                        month = month_abbr.get(month_str.lower()[:3], 1)
                        transaction_date = datetime(int(year), month, int(day), int(hour), int(minute), 0)
                    elif len(date_match.groups()) == 3:
                        if len(date_match.group(1)) == 4:
                            year, month, day = date_match.groups()
                            transaction_date = datetime(int(year), int(month), int(day))
                        else:
                            day, month, year = date_match.groups()
                            transaction_date = datetime(int(year), int(month), int(day))
                    break
                except (ValueError, TypeError, KeyError):
                    pass

        transaction_type = detect_transaction_type(sms_body)

        return ParsedTransaction(
            bank_name=sender,
            currency=currency,
            amount=amount,
            card_last_four=card_last_four,
            merchant_name=merchant_name,
            transaction_date=transaction_date,
            transaction_type=transaction_type,
            raw_message=sms_body
        )


class SMSParserEngine:
    def __init__(self):
        self.parsers = [
            ADCBParser(),
            DIBParser(),
            ENBDParser(),
            GenericParser(),  # Fallback
        ]

    def parse_sms(self, sms_body: str, sender: str, received_at: Optional[datetime] = None) -> Optional[ParsedTransaction]:
        """
        Parse SMS message and extract transaction information
        """
        if received_at is None:
            received_at = tz.now()

        for parser in self.parsers:
            if parser.matches_sender(sender):
                result = parser.parse(sms_body, sender, received_at)
                if result:
                    return result

        for parser in self.parsers[:-1]:
            if parser.bank_name.lower() in sms_body.lower():
                result = parser.parse(sms_body, sender, received_at)
                if result:
                    return result

        return self.parsers[-1].parse(sms_body, sender, received_at)
