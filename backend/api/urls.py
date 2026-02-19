from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    register, login, refresh_token, profile, change_password, export_data,
    CardViewSet, TransactionViewSet, CashEntryViewSet,
    ChatSessionViewSet, ChatMessageViewSet, chat_send,
    webauthn_register_options, webauthn_register_verify,
    webauthn_login_options, webauthn_login_verify,
    webauthn_list_credentials, webauthn_delete_credential,
)

router = DefaultRouter()
router.register(r'cards', CardViewSet, basename='card')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'cash', CashEntryViewSet, basename='cash')
router.register(r'chat/sessions', ChatSessionViewSet, basename='chatsession')
router.register(r'chat/messages', ChatMessageViewSet, basename='chatmessage')

from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'ok'})

urlpatterns = [
    path('health/', health_check, name='health'),
    path('auth/register/', register, name='register'),
    path('auth/login/', login, name='login'),
    path('auth/refresh/', refresh_token, name='refresh'),
    path('auth/me/', profile, name='profile'),
    path('auth/change-password/', change_password, name='change-password'),
    path('export/', export_data, name='export-data'),
    path('chat/send/', chat_send, name='chat-send'),
    path('auth/webauthn/register/options/', webauthn_register_options, name='webauthn-register-options'),
    path('auth/webauthn/register/verify/', webauthn_register_verify, name='webauthn-register-verify'),
    path('auth/webauthn/login/options/', webauthn_login_options, name='webauthn-login-options'),
    path('auth/webauthn/login/verify/', webauthn_login_verify, name='webauthn-login-verify'),
    path('auth/webauthn/credentials/', webauthn_list_credentials, name='webauthn-credentials'),
    path('auth/webauthn/credentials/<int:pk>/', webauthn_delete_credential, name='webauthn-delete-credential'),
    path('', include(router.urls)),
]
