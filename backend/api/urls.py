from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    register, login, refresh_token, profile, change_password,
    CardViewSet, TransactionViewSet, CashEntryViewSet,
    ChatSessionViewSet, ChatMessageViewSet
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
    path('health', health_check, name='health'),
    path('auth/register', register, name='register'),
    path('auth/login', login, name='login'),
    path('auth/refresh', refresh_token, name='refresh'),
    path('auth/me', profile, name='profile'),
    path('auth/change-password', change_password, name='change-password'),
    path('', include(router.urls)),
]
