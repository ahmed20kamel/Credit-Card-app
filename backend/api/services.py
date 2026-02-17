import os
import re
import logging
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from django.conf import settings
from django.db.models import Sum

logger = logging.getLogger(__name__)


class EncryptionService:
    def __init__(self):
        raw_key = settings.ENCRYPTION_KEY.encode("utf-8")
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'cardvault-encryption-salt-v1',
            iterations=100_000,
        )
        self._aesgcm = AESGCM(kdf.derive(raw_key))

    def encrypt(self, plaintext: str) -> bytes:
        if not plaintext:
            return b''
        nonce = os.urandom(12)
        ciphertext = self._aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return nonce + ciphertext

    def decrypt(self, data: bytes) -> str:
        if not data:
            return ''
        try:
            if len(data) < 12:
                logger.warning(f'Encrypted data too short: {len(data)} bytes')
                return ''
            nonce = data[:12]
            ciphertext = data[12:]
            if not ciphertext:
                logger.warning('No ciphertext found after nonce')
                return ''
            plaintext = self._aesgcm.decrypt(nonce, ciphertext, None)
            return plaintext.decode("utf-8")
        except Exception as e:
            logger.error(f'Decryption error: {e}, data length: {len(data) if data else 0}')
            return ''


encryption_service = EncryptionService()


def update_card_balance(card):
    """Recalculate and update card balance based on transactions."""
    from .models import Transaction

    if not card or card.card_type != 'credit':
        return

    charges = Transaction.objects.filter(
        card=card,
        is_deleted=False,
        transaction_type__in=['purchase', 'withdrawal']
    ).aggregate(total=Sum('amount'))['total'] or 0

    credits = Transaction.objects.filter(
        card=card,
        is_deleted=False,
        transaction_type__in=['payment', 'refund', 'transfer']
    ).aggregate(total=Sum('amount'))['total'] or 0

    card.current_balance = float(charges) - float(credits)
    if card.credit_limit:
        card.available_balance = float(card.credit_limit) - float(card.current_balance)

    card.save(update_fields=['current_balance', 'available_balance', 'updated_at'])


def detect_card_network(card_number: str) -> str | None:
    num = re.sub(r"\D", "", card_number)
    if not num:
        return None
    if num[0] == "4":
        return "visa"
    if num[:2] in ("51", "52", "53", "54", "55") or (len(num) >= 4 and 2221 <= int(num[:4]) <= 2720):
        return "mastercard"
    if num[:2] in ("34", "37"):
        return "amex"
    if num[:4] in ("6011", "6441", "6442"):
        return "discover"
    return None


def extract_last_four(card_number: str) -> str:
    digits = re.sub(r"\D", "", card_number)
    return digits[-4:] if len(digits) >= 4 else digits


def parse_card_text(text: str) -> dict:
    result = {}
    card_num_match = re.search(r"\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b", text)
    if card_num_match:
        result["card_number"] = re.sub(r"[\s-]", "", card_num_match.group(1))
        result["card_network"] = detect_card_network(result["card_number"])

    expiry_match = re.search(r"(\d{2})\s*/\s*(\d{2,4})", text)
    if expiry_match:
        result["expiry_month"] = int(expiry_match.group(1))
        year = int(expiry_match.group(2))
        result["expiry_year"] = year if year > 100 else 2000 + year

    cvv_match = re.search(r"(?:CVV|CVC|CVN|CCV)[:\s]*(\d{3,4})", text, re.IGNORECASE)
    if cvv_match:
        result["cvv"] = cvv_match.group(1)

    name_match = re.search(r"(?:name|holder)[:\s]*([A-Z][A-Z\s]+)", text, re.IGNORECASE)
    if name_match:
        result["cardholder_name"] = name_match.group(1).strip()

    return result
