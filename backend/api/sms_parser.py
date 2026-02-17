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
        
        # Balance update pattern
        balance_pattern = re.compile(
            r'(?:ADCB\s+)?Card\s+ending\s+(\d{4})\s+available\s+balance\s+(?:is\s+)?(AED|USD)\s*([\d,]+\.?\d*)',
            re.IGNORECASE
        )
        
        balance_match = balance_pattern.search(sms_body)
        if balance_match:
            # This is a balance update, not a transaction
            return None
        
        return None


class DIBParser(BaseBankParser):
    def __init__(self):
        super().__init__('Dubai Islamic Bank', [r'DIB', r'Dubai.*Islamic'])
    
    def parse(self, sms_body: str, sender: str, received_at: datetime) -> Optional[ParsedTransaction]:
        # Pattern: AED 1,234.56 has been debited/credited from card ending 1234
        txn_pattern = re.compile(
            r'(AED|USD)\s*([\d,]+\.?\d*)\s+(?:has\s+been\s+)?(debited|credited|spent|charged)\s+.*?(?:card|account)\s+(?:ending\s+)?(\d{4})',
            re.IGNORECASE
        )
        
        match = txn_pattern.search(sms_body)
        if match:
            currency = match.group(1)
            amount = Decimal(match.group(2).replace(',', ''))
            type_word = match.group(3).lower()
            card_last_four = match.group(4)
            
            transaction_type = 'refund' if type_word == 'credited' else 'purchase'
            
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
        # Generic pattern for ENBD
        pattern = re.compile(
            r'(AED|USD)\s*([\d,]+\.?\d*)\s+(?:has\s+been\s+)?(debited|credited|spent|charged|withdrawn)\s+.*?(?:card|account)\s+(?:ending\s+)?(\d{4})',
            re.IGNORECASE
        )
        
        match = pattern.search(sms_body)
        if match:
            currency = match.group(1)
            amount = Decimal(match.group(2).replace(',', ''))
            type_word = match.group(3).lower()
            card_last_four = match.group(4)
            
            if 'credited' in type_word or 'refund' in sms_body.lower():
                transaction_type = 'refund'
            elif 'withdrawn' in type_word or 'atm' in sms_body.lower():
                transaction_type = 'withdrawal'
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
        # Truncate long messages to prevent ReDoS
        if len(sms_body) > 1000:
            sms_body = sms_body[:1000]

        # Amount patterns (Arabic and English)
        amount_patterns = [
            re.compile(r'(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),
            re.compile(r'([\d,]+\.?\d*)\s*(AED|USD|EUR|GBP|SAR|INR)', re.IGNORECASE),
            re.compile(r'في\s+(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),  # Arabic: في AED
            re.compile(r'سحب\s+(AED|USD|EUR|GBP|SAR|INR)\s*([\d,]+\.?\d*)', re.IGNORECASE),  # Arabic: سحب AED
        ]
        
        amount_match = None
        currency = 'AED'
        amount = None
        
        for pattern in amount_patterns:
            amount_match = pattern.search(sms_body)
            if amount_match:
                if len(amount_match.groups()) == 2:
                    # Check which group is currency
                    if amount_match.group(1) in ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR']:
                        currency = amount_match.group(1)
                        amount = Decimal(amount_match.group(2).replace(',', ''))
                    else:
                        currency = amount_match.group(2)
                        amount = Decimal(amount_match.group(1).replace(',', ''))
                break
        
        # If no amount found, try to find any number that looks like an amount
        if not amount_match or amount is None:
            # Try to find any decimal number that could be an amount
            fallback_amount_pattern = re.compile(r'([\d,]+\.?\d{2})\s*(?:AED|USD|EUR|GBP|SAR|INR|درهم|دولار)', re.IGNORECASE)
            fallback_match = fallback_amount_pattern.search(sms_body)
            if fallback_match:
                try:
                    amount = Decimal(fallback_match.group(1).replace(',', ''))
                    # Try to find currency
                    if 'USD' in sms_body.upper() or 'دولار' in sms_body:
                        currency = 'USD'
                    elif 'EUR' in sms_body.upper():
                        currency = 'EUR'
                    else:
                        currency = 'AED'  # Default
                except (ValueError, InvalidOperation):
                    pass

            # Last resort: find any number with 2 decimal places
            if amount is None:
                last_resort_pattern = re.compile(r'([\d,]+\.\d{2})', re.IGNORECASE)
                last_resort_match = last_resort_pattern.search(sms_body)
                if last_resort_match:
                    try:
                        amount = Decimal(last_resort_match.group(1).replace(',', ''))
                        currency = 'AED'  # Default
                    except (ValueError, InvalidOperation):
                        pass
        
        if amount is None:
            return None
        
        # Card last 4 patterns (Arabic and English)
        last4_patterns = [
            re.compile(r'XXX(\d{4})', re.IGNORECASE),  # XXX3287 format - check first
            re.compile(r'(?:card|بطاقة|بطاقتك|card\s+ending|ending|xxxx|المنتهية\s+ب|المنتهية|ب)\s*[\s:]*(\d{4})', re.IGNORECASE),
            re.compile(r'البطاقة\s+(\d{4})', re.IGNORECASE),  # Arabic: البطاقة 7665
            re.compile(r'بطاقتك\s+(\d{4})', re.IGNORECASE),  # Arabic: بطاقتك 7665
        ]
        
        card_last_four = None
        for pattern in last4_patterns:
            last4_match = pattern.search(sms_body)
            if last4_match:
                potential_last4 = last4_match.group(1)
                # Validate it's not part of amount or date
                if potential_last4 and len(potential_last4) == 4:
                    # Make sure it's not part of a larger number (like year or amount)
                    if not re.search(rf'\d+{potential_last4}\d+', sms_body):  # Not part of larger number
                        card_last_four = potential_last4
                        break
        
        # Fallback: find any standalone 4-digit number that's not a year or part of amount
        if not card_last_four:
            fallback_last4 = re.findall(r'\b(\d{4})\b', sms_body)
            for num in fallback_last4:
                # Exclude years (1900-2100) and amounts
                if not (1900 <= int(num) <= 2100):
                    # Check if it's not part of amount
                    if not re.search(rf'{num}\.\d{{2}}|\.\d{{2}}{num}', sms_body):
                        card_last_four = num
                        break
        
        # Merchant name patterns
        merchant_patterns = [
            re.compile(r'at\s+(.+?)(?:\s+on\s+|\s+-\s+[A-Z]{2,3}|\.|$)', re.IGNORECASE),  # English: at MERCHANT
            re.compile(r'في\s+(.+?)(?:\s+على\s+|\s+-\s+[A-Z]{2,3}|\.|$)', re.IGNORECASE),  # Arabic: في MERCHANT
            re.compile(r'من\s+(.+?)(?:\s+،|\.|$)', re.IGNORECASE),  # Arabic: من MERCHANT
            re.compile(r'([A-Z][A-Z\s&]+(?:LLC|INC|LTD|CORP|SERVICES|HYPERMARKET|MALL|STORE))', re.IGNORECASE),  # Company names
        ]
        
        merchant_name = None
        for pattern in merchant_patterns:
            merchant_match = pattern.search(sms_body)
            if merchant_match:
                merchant_name = merchant_match.group(1).strip()
                # Clean up merchant name
                merchant_name = re.sub(r'\s*-\s*[A-Z]{2,3}$', '', merchant_name)  # Remove -AE, -UAE
                merchant_name = re.sub(r',\s*[A-Z\s]+$', '', merchant_name)  # Remove location suffixes
                merchant_name = re.sub(r'\s+', ' ', merchant_name)  # Normalize spaces
                if merchant_name and len(merchant_name) > 2:
                    break
        
        # Date patterns
        date_patterns = [
            re.compile(r'(\d{2})/(\d{2})/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})', re.IGNORECASE),  # 10/02/2026 13:36:02
            re.compile(r'(\d{2})/(\d{2})/(\d{4})', re.IGNORECASE),  # 10/02/2026
            re.compile(r'(\d{4})-(\d{2})-(\d{2})', re.IGNORECASE),  # 2026-02-10
        ]
        
        transaction_date = received_at
        for pattern in date_patterns:
            date_match = pattern.search(sms_body)
            if date_match:
                try:
                    if len(date_match.groups()) == 6:  # With time
                        day, month, year, hour, minute, second = date_match.groups()
                        transaction_date = datetime(int(year), int(month), int(day), int(hour), int(minute), int(second))
                    elif len(date_match.groups()) == 3:
                        if len(date_match.group(1)) == 4:  # YYYY-MM-DD
                            year, month, day = date_match.groups()
                            transaction_date = datetime(int(year), int(month), int(day))
                        else:  # DD/MM/YYYY
                            day, month, year = date_match.groups()
                            transaction_date = datetime(int(year), int(month), int(day))
                    break
                except (ValueError, TypeError):
                    pass
        
        # Determine transaction type (Arabic and English)
        lower_body = sms_body.lower()
        arabic_purchase = any(word in sms_body for word in ['شراء', 'عملية شراء', 'استخدام', 'استخدمت'])
        arabic_withdrawal = any(word in sms_body for word in ['سحب', 'سحبت', 'سحبت'])
        
        # Priority 1: Check for "debited" (money taken out) - this is purchase/withdrawal
        if 'debited' in lower_body:
            if 'atm' in lower_body or 'cash' in lower_body or 'withdraw' in lower_body:
                transaction_type = 'withdrawal'
            else:
                transaction_type = 'purchase'  # debited = purchase by default
        # Priority 2: Check for "credited" (money added) - this is refund
        elif 'credited' in lower_body:
            transaction_type = 'refund'
        # Priority 3: Check for Arabic purchase words
        elif arabic_purchase:
            transaction_type = 'purchase'
        # Priority 4: Check for Arabic withdrawal words
        elif arabic_withdrawal:
            transaction_type = 'withdrawal'
        # Priority 5: Check for English purchase indicators
        elif 'purchase' in lower_body or 'used' in lower_body or 'spent' in lower_body or 'charged' in lower_body:
            transaction_type = 'purchase'
        # Priority 6: Check for withdrawal indicators
        elif 'withdraw' in lower_body or 'withdrawal' in lower_body or 'atm' in lower_body:
            transaction_type = 'withdrawal'
        # Priority 7: Check for refund/credit (but exclude "credit card")
        elif 'refund' in lower_body or 'reversal' in lower_body or 'استرداد' in sms_body:
            transaction_type = 'refund'
        # Priority 8: Check for "credit" but make sure it's not "credit card"
        elif 'credit' in lower_body:
            # Check if "credit" is part of "credit card" phrase
            credit_pos = lower_body.find('credit')
            # Look for "card" within 15 characters before or after "credit"
            context_start = max(0, credit_pos - 15)
            context_end = min(len(lower_body), credit_pos + len('credit') + 15)
            context = lower_body[context_start:context_end]
            
            if 'card' in context:
                # It's "credit card", treat as purchase (default)
                transaction_type = 'purchase'
            else:
                # It's a credit transaction (refund)
                transaction_type = 'refund'
        # Priority 9: Check for payment
        elif 'payment' in lower_body or 'دفع' in sms_body:
            transaction_type = 'payment'
        else:
            transaction_type = 'purchase'  # Default
        
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
        
        Args:
            sms_body: SMS message text
            sender: SMS sender number/name
            received_at: When SMS was received (defaults to now)
        
        Returns:
            ParsedTransaction or None if parsing failed
        """
        if received_at is None:
            received_at = tz.now()
        
        # First: try sender-matched parser
        for parser in self.parsers:
            if parser.matches_sender(sender):
                result = parser.parse(sms_body, sender, received_at)
                if result:
                    return result
        
        # Second: try body content matching
        for parser in self.parsers[:-1]:  # Exclude generic
            if parser.bank_name.lower() in sms_body.lower():
                result = parser.parse(sms_body, sender, received_at)
                if result:
                    return result
        
        # Fallback: generic parser
        return self.parsers[-1].parse(sms_body, sender, received_at)
