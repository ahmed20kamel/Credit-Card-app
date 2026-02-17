from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Card, Transaction, CashEntry, ChatSession, ChatMessage


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'preferred_language', 'is_active', 'is_staff', 'created_at']
    list_filter = ['is_active', 'is_staff', 'preferred_language']
    search_fields = ['email', 'full_name']
    ordering = ['-created_at']
    filter_horizontal = ()
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('full_name', 'preferred_language')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'password1', 'password2', 'full_name')}),
    )


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ['card_name', 'bank_name', 'card_type', 'card_network', 'card_last_four', 'user', 'is_favorite', 'created_at']
    list_filter = ['card_type', 'card_network', 'bank_name', 'is_favorite', 'is_deleted']
    search_fields = ['card_name', 'bank_name', 'card_last_four']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']
    exclude = ['card_number_encrypted', 'cardholder_name_encrypted', 'cvv_encrypted', 'iban_encrypted']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['merchant_name', 'transaction_type', 'amount', 'currency', 'card', 'user', 'transaction_date', 'source']
    list_filter = ['transaction_type', 'currency', 'source', 'is_deleted']
    search_fields = ['merchant_name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-transaction_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user', 'card')


@admin.register(CashEntry)
class CashEntryAdmin(admin.ModelAdmin):
    list_display = ['description', 'entry_type', 'amount', 'currency', 'user', 'entry_date']
    list_filter = ['entry_type', 'currency', 'is_deleted']
    search_fields = ['description', 'category']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-entry_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'created_at', 'updated_at']
    search_fields = ['title']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['role', 'session', 'tokens_used', 'created_at']
    list_filter = ['role']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('session', 'session__user')
