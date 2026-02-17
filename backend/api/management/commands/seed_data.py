"""
Django management command to seed test data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from api.models import Card
from api.services import encryption_service
import uuid
from datetime import datetime

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed database with test cards for UAE banks'

    def handle(self, *args, **options):
        # Create or get test user
        email = 'test@cardvault.com'
        password = 'test123456'
        
        try:
            user = User.objects.get(email=email)
            # Update password to ensure it's correct
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.WARNING(f'ℹ️  Test user already exists: {email} - Password updated'))
        except User.DoesNotExist:
            user = User.objects.create_user(
                email=email,
                password=password,
                full_name='Test User',
                preferred_language='en'
            )
            self.stdout.write(self.style.SUCCESS(f'✅ Created test user: {email} / {password}'))
        
        # Delete existing cards and transactions for this user
        from api.models import Transaction
        deleted_cards_count = Card.objects.filter(user=user).delete()[0]
        deleted_transactions_count = Transaction.objects.filter(user=user).delete()[0]
        if deleted_cards_count > 0:
            self.stdout.write(self.style.WARNING(f'🗑️  Cleared {deleted_cards_count} existing cards'))
        if deleted_transactions_count > 0:
            self.stdout.write(self.style.WARNING(f'🗑️  Cleared {deleted_transactions_count} existing transactions'))
        
        # UAE Banks Cards Data
        banks_data = [
            {
                'card_name': 'ADCB Platinum Credit Card',
                'bank_name': 'Abu Dhabi Commercial Bank',
                'card_type': 'credit',
                'card_network': 'visa',
                'card_number': '4532123456789012',
                'cardholder_name': 'AHMED MOHAMED ALI',
                'expiry_month': 12,
                'expiry_year': 2026,
                'cvv': '123',
                'iban': 'AE030331234567890123456',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 25000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 1250.00,
                'color_hex': '#0066CC',
                'is_favorite': True,
                'notes': 'Main credit card for daily expenses'
            },
            {
                'card_name': 'Emirates NBD Infinite',
                'bank_name': 'Emirates NBD',
                'card_type': 'credit',
                'card_network': 'mastercard',
                'card_number': '5555123456789012',
                'cardholder_name': 'FATIMA KHALED AL MANSURI',
                'expiry_month': 6,
                'expiry_year': 2027,
                'cvv': '456',
                'iban': 'AE260211000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 50000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 2500.00,
                'color_hex': '#FF6600',
                'is_favorite': False,
                'notes': 'Premium card with high limit'
            },
            {
                'card_name': 'DIB Gold Credit Card',
                'bank_name': 'Dubai Islamic Bank',
                'card_type': 'credit',
                'card_network': 'visa',
                'card_number': '4111111111111111',
                'cardholder_name': 'OMAR SAEED AL ZAABI',
                'expiry_month': 9,
                'expiry_year': 2025,
                'cvv': '789',
                'iban': 'AE380330000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 35000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 1750.00,
                'color_hex': '#00AA44',
                'is_favorite': False,
                'notes': 'Daily spending credit card'
            },
            {
                'card_name': 'FAB World Elite',
                'bank_name': 'First Abu Dhabi Bank',
                'card_type': 'credit',
                'card_network': 'mastercard',
                'card_number': '5555555555554444',
                'cardholder_name': 'MARIAM HASSAN AL SUWAIDI',
                'expiry_month': 3,
                'expiry_year': 2028,
                'cvv': '321',
                'iban': 'AE100330000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 75000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 3750.00,
                'color_hex': '#9900CC',
                'is_favorite': True,
                'notes': 'Premium travel card with airport lounge access'
            },
            {
                'card_name': 'Mashreq Cashback Card',
                'bank_name': 'Mashreq Bank',
                'card_type': 'credit',
                'card_network': 'visa',
                'card_number': '4000000000000002',
                'cardholder_name': 'KHALID ABDULLAH AL DHAHERI',
                'expiry_month': 11,
                'expiry_year': 2026,
                'cvv': '654',
                'iban': 'AE230330000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 30000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 1500.00,
                'color_hex': '#FF0066',
                'is_favorite': False,
                'notes': 'Cashback rewards card'
            },
            {
                'card_name': 'RAK Bank Titanium',
                'bank_name': 'RAK Bank',
                'card_type': 'credit',
                'card_network': 'mastercard',
                'card_number': '5105105105105100',
                'cardholder_name': 'NOORA SULTAN AL QASIMI',
                'expiry_month': 8,
                'expiry_year': 2027,
                'cvv': '987',
                'iban': 'AE640330000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 20000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 1000.00,
                'color_hex': '#006699',
                'is_favorite': False,
                'notes': 'Titanium card with travel benefits'
            },
            {
                'card_name': 'ADIB Islamic Credit',
                'bank_name': 'Abu Dhabi Islamic Bank',
                'card_type': 'credit',
                'card_network': 'visa',
                'card_number': '4242424242424242',
                'cardholder_name': 'YOUSEF MOHAMED AL HAMELI',
                'expiry_month': 5,
                'expiry_year': 2026,
                'cvv': '147',
                'iban': 'AE070330000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 35000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 1750.00,
                'color_hex': '#00CC99',
                'is_favorite': False,
                'notes': 'Sharia-compliant credit card'
            },
            {
                'card_name': 'HSBC Premier Credit',
                'bank_name': 'HSBC UAE',
                'card_type': 'credit',
                'card_network': 'visa',
                'card_number': '4000002760003184',
                'cardholder_name': 'LATIFA AHMED AL MUTAWA',
                'expiry_month': 7,
                'expiry_year': 2027,
                'cvv': '258',
                'iban': 'AE120330000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 40000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 2000.00,
                'color_hex': '#CC0000',
                'is_favorite': True,
                'notes': 'Premier banking credit card'
            },
            {
                'card_name': 'Standard Chartered Platinum',
                'bank_name': 'Standard Chartered UAE',
                'card_type': 'credit',
                'card_network': 'mastercard',
                'card_number': '5200828282828210',
                'cardholder_name': 'HAMAD KHALIFA AL NUAIMI',
                'expiry_month': 4,
                'expiry_year': 2026,
                'cvv': '369',
                'iban': 'AE150330000000123456789',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 28000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 1400.00,
                'color_hex': '#0066FF',
                'is_favorite': False,
                'notes': 'Platinum rewards card'
            },
            {
                'card_name': 'ENBD Credit Card',
                'bank_name': 'Emirates NBD',
                'card_type': 'credit',
                'card_network': 'visa',
                'card_number': '4000000000000010',
                'cardholder_name': 'SARA MOHAMED AL SHAMSI',
                'expiry_month': 10,
                'expiry_year': 2025,
                'cvv': '741',
                'iban': 'AE260211000000987654321',
                'available_balance': None,
                'balance_currency': 'AED',
                'credit_limit': 45000.00,
                'current_balance': 0.00,  # Empty - full available
                'statement_date': 9,
                'payment_due_date': 5,
                'minimum_payment': 2250.00,
                'color_hex': '#FF9900',
                'is_favorite': False,
                'notes': 'Primary credit card'
            }
        ]
        
        # Create cards
        created_count = 0
        for bank_data in banks_data:
            card = Card.objects.create(
            id=uuid.uuid4(),
            user=user,
            card_name=bank_data['card_name'],
            bank_name=bank_data['bank_name'],
            card_type=bank_data['card_type'],
            card_network=bank_data['card_network'],
            card_number_encrypted=encryption_service.encrypt(bank_data['card_number']),
            card_last_four=bank_data['card_number'][-4:],
            cardholder_name_encrypted=encryption_service.encrypt(bank_data['cardholder_name']),
            expiry_month=bank_data['expiry_month'],
            expiry_year=bank_data['expiry_year'],
            cvv_encrypted=encryption_service.encrypt(bank_data['cvv']),
            iban_encrypted=encryption_service.encrypt(bank_data['iban']),
            available_balance=bank_data.get('available_balance'),
            balance_currency=bank_data['balance_currency'],
            credit_limit=bank_data.get('credit_limit'),
            current_balance=bank_data.get('current_balance'),
            statement_date=bank_data.get('statement_date'),
            payment_due_date=bank_data.get('payment_due_date'),
            minimum_payment=bank_data.get('minimum_payment'),
            color_hex=bank_data['color_hex'],
            is_favorite=bank_data['is_favorite'],
            notes=bank_data['notes'],
            is_deleted=False
        )
            created_count += 1
            limit_info = ''
            if bank_data.get('credit_limit'):
                limit_info = f'Credit Limit: {bank_data["credit_limit"]:,.2f} {bank_data["balance_currency"]}'
            elif bank_data.get('available_balance'):
                limit_info = f'Balance: {bank_data["available_balance"]:,.2f} {bank_data["balance_currency"]}'
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Created: {bank_data["card_name"]} - {bank_data["bank_name"]} ({limit_info})'
                )
            )
        
        self.stdout.write(self.style.SUCCESS(f'\n🎉 Successfully created {created_count} cards!'))
        self.stdout.write(self.style.SUCCESS(f'\n📝 Test Account:'))
        self.stdout.write(self.style.SUCCESS(f'   Email: {email}'))
        self.stdout.write(self.style.SUCCESS(f'   Password: {password}'))
        self.stdout.write(self.style.SUCCESS(f'\n🌐 Login at: http://localhost:3000/login'))
