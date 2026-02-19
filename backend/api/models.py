import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255, null=True, blank=True)
    preferred_language = models.CharField(max_length=5, default='en')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.email


class ActiveManager(models.Manager):
    """Manager that automatically filters out soft-deleted records."""
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    """Manager that returns all records including soft-deleted ones."""
    pass


class Card(models.Model):
    CARD_TYPES = [('credit', 'Credit'), ('debit', 'Debit'), ('prepaid', 'Prepaid')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cards')
    card_name = models.CharField(max_length=255)
    bank_name = models.CharField(max_length=100)
    card_type = models.CharField(max_length=50, choices=CARD_TYPES)
    card_network = models.CharField(max_length=50, null=True, blank=True)
    card_number_encrypted = models.BinaryField()
    card_last_four = models.CharField(max_length=4)
    cardholder_name_encrypted = models.BinaryField(null=True, blank=True)
    expiry_month = models.SmallIntegerField(null=True, blank=True)
    expiry_year = models.SmallIntegerField(null=True, blank=True)
    cvv_encrypted = models.BinaryField(null=True, blank=True)
    iban_encrypted = models.BinaryField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    color_hex = models.CharField(max_length=7, null=True, blank=True)
    is_favorite = models.BooleanField(default=False)
    available_balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    balance_currency = models.CharField(max_length=3, default='AED')
    
    # Credit Card Management Fields
    statement_date = models.IntegerField(null=True, blank=True, help_text='Day of month for statement (1-31)')
    payment_due_date = models.IntegerField(null=True, blank=True, help_text='Day of month for payment due (1-31)')
    minimum_payment = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Fixed minimum amount (optional if percentage set)')
    minimum_payment_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Min payment as % of amount due (e.g. 5 for 5%), varies by bank')
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Total credit limit')
    current_balance = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, help_text='Current outstanding balance')
    card_benefits = models.TextField(null=True, blank=True, help_text='JSON array of card benefits/features')

    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        db_table = 'cards'
        indexes = [models.Index(fields=['user_id'])]


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('purchase', 'Purchase'),
        ('withdrawal', 'Withdrawal'),
        ('payment', 'Payment'),
        ('refund', 'Refund'),
        ('transfer', 'Transfer'),
        ('deposit', 'Deposit'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    card = models.ForeignKey(Card, on_delete=models.SET_NULL, null=True, related_name='transactions')
    transaction_type = models.CharField(max_length=50, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=3, default='AED')
    merchant_name = models.CharField(max_length=255, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    transaction_date = models.DateTimeField()
    source = models.CharField(max_length=50, default='manual')
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        db_table = 'transactions'
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['card_id']),
            models.Index(fields=['transaction_date']),
        ]


class CashEntry(models.Model):
    ENTRY_TYPES = [('income', 'Income'), ('expense', 'Expense')]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cash_entries')
    entry_type = models.CharField(max_length=50, choices=ENTRY_TYPES)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    currency = models.CharField(max_length=3, default='AED')
    description = models.TextField(null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    entry_date = models.DateTimeField(default=timezone.now)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = AllObjectsManager()

    class Meta:
        db_table = 'cash_entries'
        indexes = [models.Index(fields=['user_id'])]


class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_sessions')
    title = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chat_sessions'
        indexes = [models.Index(fields=['user_id'])]


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20)  # user, assistant
    content = models.TextField()
    tool_calls = models.JSONField(null=True, blank=True)
    tool_results = models.JSONField(null=True, blank=True)
    tokens_used = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chat_messages'
        indexes = [models.Index(fields=['session_id'])]
        ordering = ['created_at']


class WebAuthnCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='webauthn_credentials')
    credential_id = models.TextField(unique=True)  # base64url encoded
    public_key = models.TextField()  # base64url encoded
    sign_count = models.IntegerField(default=0)
    device_name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'webauthn_credentials'
        indexes = [models.Index(fields=['user_id'])]

    def __str__(self):
        return f'{self.user.email} - {self.device_name or self.credential_id[:20]}'
