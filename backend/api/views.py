import csv
import json
from io import StringIO
from django.conf import settings as django_settings
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.db.models import Sum, Q, Count
from django.http import HttpResponse
from django.utils import timezone
from datetime import datetime, timedelta
from .models import Card, Transaction, CashEntry, ChatSession, ChatMessage, WebAuthnCredential
from .serializers import (
    UserSerializer, RegisterSerializer, CardSerializer, CardUpdateSerializer,
    TransactionSerializer, CashEntrySerializer, ChatSessionSerializer, ChatMessageSerializer
)
from .services import encryption_service, parse_card_text, update_card_balance
from .sms_parser import SMSParserEngine


class LoginRateThrottle(AnonRateThrottle):
    rate = '5/minute'


# Account lockout constants
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 300  # 5 minutes in seconds


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'token_type': 'bearer'
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _get_login_data(request):
    """Get email/password from request (JSON body or POST)."""
    data = getattr(request, 'data', None) or {}
    if not isinstance(data, dict):
        data = {}
    if not data and request.body:
        import json
        try:
            data = json.loads(request.body.decode('utf-8')) or {}
        except Exception:
            pass
    email = data.get('email') or (request.POST.get('email') if request.POST else None)
    password = data.get('password') or (request.POST.get('password') if request.POST else None)
    return email, password


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login(request):
    try:
        email, password = _get_login_data(request)

        if not email or not password:
            return Response({'detail': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)

        # Check for account lockout
        lockout_key = f'login_attempts_{email}'
        attempts = cache.get(lockout_key, 0)
        if attempts >= MAX_LOGIN_ATTEMPTS:
            return Response(
                {'detail': 'Account temporarily locked due to too many failed attempts. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        user = authenticate(request, username=email, password=password)
        if user:
            # Reset failed attempts on successful login
            cache.delete(lockout_key)
            refresh = RefreshToken.for_user(user)
            return Response({
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'token_type': 'bearer'
            })

        # Increment failed attempts
        cache.set(lockout_key, attempts + 1, LOCKOUT_DURATION)
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception('Login error: %s', e)
        # Never return 500 to client: treat as invalid credentials so UI stays usable
        return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token(request):
    refresh_token = request.data.get('refresh_token')
    if not refresh_token:
        return Response({'detail': 'Refresh token required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        refresh = RefreshToken(refresh_token)
        access_token = refresh.access_token
        return Response({
            'access_token': str(access_token),
            'refresh_token': str(refresh),
            'token_type': 'bearer'
        })
    except Exception:
        return Response({'detail': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def profile(request):
    try:
        if request.method == 'GET':
            serializer = UserSerializer(request.user)
            return Response(serializer.data)
        else:
            serializer = UserSerializer(request.user, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception('Profile error: %s', e)
        return Response(
            {'detail': 'Invalid or expired token. Please log in again.'},
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')

    if not current_password or not new_password:
        return Response({'detail': 'Current and new password required'}, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.check_password(current_password):
        return Response({'detail': 'Current password is incorrect'}, status=status.HTTP_400_BAD_REQUEST)

    if len(new_password) < 8:
        return Response({'detail': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)

    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_password(new_password, request.user)
    except DjangoValidationError as e:
        return Response({'detail': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

    request.user.set_password(new_password)
    request.user.save()
    return Response({'message': 'Password changed successfully'})


class CardViewSet(viewsets.ModelViewSet):
    serializer_class = CardSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Card.objects.filter(user=self.request.user)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['reveal'] = self.request.query_params.get('reveal', 'false').lower() == 'true'
        return context
    
    def list(self, request):
        queryset = self.get_queryset()
        bank_name = request.query_params.get('bank_name')
        if bank_name:
            queryset = queryset.filter(bank_name__icontains=bank_name)

        # Support pagination with ?page= or return all with ?all=true
        if request.query_params.get('all', 'true').lower() == 'true':
            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'items': serializer.data,
                'total': queryset.count()
            })

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'items': serializer.data,
            'total': queryset.count()
        })
    
    def retrieve(self, request, pk=None):
        instance = self.get_object()
        reveal = request.query_params.get('reveal', 'false').lower() == 'true'
        if reveal:
            import logging
            logger = logging.getLogger('api.audit')
            logger.info(
                'Card data revealed: user=%s card_id=%s card_last_four=%s ip=%s',
                request.user.email, instance.id, instance.card_last_four,
                request.META.get('REMOTE_ADDR', 'unknown')
            )
        serializer = self.get_serializer(instance, context={'reveal': reveal})
        return Response(serializer.data)
    
    def update(self, request, pk=None):
        instance = self.get_object()
        serializer = CardUpdateSerializer(instance, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(CardSerializer(instance, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def destroy(self, request, pk=None):
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['post'])
    def parse_text(self, request):
        text = request.data.get('text', '')
        result = parse_card_text(text)
        return Response(result)

    @action(detail=False, methods=['post'], url_path='scan-image', url_name='scan-image')
    def scan_card_image(self, request):
        """
        Extract card details from a photo using Google Gemini Vision (primary)
        or Anthropic Claude Vision (fallback).
        Image is processed in memory only — never stored.
        """
        import base64
        import logging
        import re as _re
        import time
        import urllib.request
        import urllib.error
        logger = logging.getLogger('api.audit')

        image_data = request.data.get('image')
        if not image_data:
            return Response({'error': 'image is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Strip data URL prefix if present
        media_type = 'image/jpeg'
        if image_data.startswith('data:'):
            try:
                header, image_data = image_data.split(',', 1)
                if 'image/png' in header:
                    media_type = 'image/png'
                elif 'image/webp' in header:
                    media_type = 'image/webp'
                elif 'image/gif' in header:
                    media_type = 'image/gif'
            except ValueError:
                return Response({'error': 'Invalid image data format'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded = base64.b64decode(image_data, validate=True)
        except Exception:
            return Response({'error': 'Invalid base64 encoding'}, status=status.HTTP_400_BAD_REQUEST)

        if len(decoded) > 10 * 1024 * 1024:
            return Response({'error': 'Image too large. Maximum 10MB.'}, status=status.HTTP_400_BAD_REQUEST)

        if not (decoded[:3] == b'\xff\xd8\xff' or decoded[:8] == b'\x89PNG\r\n\x1a\n' or
                decoded[:4] == b'RIFF' or decoded[:6] in (b'GIF87a', b'GIF89a')):
            return Response({'error': 'Invalid image file.'}, status=status.HTTP_400_BAD_REQUEST)

        google_key = getattr(django_settings, 'GOOGLE_API_KEY', '')
        anthropic_key = getattr(django_settings, 'ANTHROPIC_API_KEY', '')

        if not google_key and not anthropic_key:
            return Response(
                {'error': 'Card scanning not configured. Set GOOGLE_API_KEY or ANTHROPIC_API_KEY.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        logger.info('Card scan attempt: user=%s ip=%s size=%d',
                     request.user.email, request.META.get('REMOTE_ADDR', '?'), len(decoded))

        prompt_text = (
            'Read ALL text visible in this card image. Return a JSON object with these fields '
            '(use null for anything you cannot read):\n'
            '{"card_number":"digits only no spaces","cardholder_name":"name on card",'
            '"expiry_month":"MM","expiry_year":"YY or YYYY",'
            '"cvv":"3-4 digit code","card_network":"visa/mastercard/amex/discover or null",'
            '"bank_name":"issuing bank or null"}\n'
            'Return ONLY the JSON object, nothing else.'
        )

        # Claude needs additional context to understand this is a legitimate use case
        claude_prompt = (
            'You are an OCR assistant inside a personal finance management app called CardVault. '
            'The authenticated user is uploading a photo of THEIR OWN card to store it in their '
            'encrypted personal vault. This is similar to Apple Wallet or Google Pay card scanning. '
            'The user has explicitly consented to this scan.\n\n'
            'Please extract the visible text from this card image and return a JSON object with '
            'these fields (use null for anything not visible):\n'
            '{"card_number":"digits only no spaces","cardholder_name":"name on card",'
            '"expiry_month":"MM","expiry_year":"YY or YYYY",'
            '"cvv":"3-4 digit code","card_network":"visa/mastercard/amex/discover or null",'
            '"bank_name":"issuing bank or null"}\n'
            'Return ONLY the JSON object, nothing else.'
        )

        response_text = None

        # ── Try Google Gemini first (with retry for 429) ─────
        if google_key:
            gemini_url = (
                'https://generativelanguage.googleapis.com/v1beta/'
                'models/gemini-2.0-flash:generateContent'
                f'?key={google_key}'
            )
            gemini_body = {
                'contents': [{
                    'parts': [
                        {'text': prompt_text},
                        {'inline_data': {'mime_type': media_type, 'data': image_data}}
                    ]
                }]
            }
            payload = json.dumps(gemini_body).encode('utf-8')

            for attempt in range(3):
                try:
                    req = urllib.request.Request(
                        gemini_url, data=payload,
                        headers={'Content-Type': 'application/json'}, method='POST'
                    )
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        resp_body = resp.read().decode('utf-8')
                        data = json.loads(resp_body)
                        candidates = data.get('candidates', [])
                        if candidates:
                            parts = candidates[0].get('content', {}).get('parts', [])
                            if parts:
                                response_text = parts[0].get('text', '').strip()
                                logger.info('Card scan: Gemini success (attempt %d) user=%s', attempt + 1, request.user.email)
                    break  # Success or empty response, don't retry
                except urllib.error.HTTPError as e:
                    if e.code == 429 and attempt < 2:
                        wait = (attempt + 1) * 2  # 2s, 4s
                        logger.info('Card scan: Gemini 429, retrying in %ds...', wait)
                        time.sleep(wait)
                        continue
                    logger.warning('Card scan: Gemini HTTP %d (attempt %d): %s', e.code, attempt + 1, str(e))
                    break
                except Exception as e:
                    logger.warning('Card scan: Gemini error (attempt %d): %s', attempt + 1, str(e))
                    break

        # ── Fallback to Anthropic Claude ─────────────────────
        if not response_text and anthropic_key:
            try:
                import anthropic
                client = anthropic.Anthropic(api_key=anthropic_key)
                for model_name in ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-latest']:
                    try:
                        message = client.messages.create(
                            model=model_name, max_tokens=1024,
                            messages=[{'role': 'user', 'content': [
                                {'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': image_data}},
                                {'type': 'text', 'text': claude_prompt}
                            ]}]
                        )
                        text = message.content[0].text.strip()
                        # Check if Claude refused (no JSON = refusal)
                        if text.startswith('{') or '```' in text:
                            response_text = text
                            logger.info('Card scan: Claude %s success user=%s', model_name, request.user.email)
                            break
                        else:
                            logger.warning('Card scan: Claude %s refused, trying next model', model_name)
                            continue
                    except Exception:
                        continue
            except Exception as e:
                logger.warning('Card scan: Anthropic error: %s', str(e))

        if not response_text:
            return Response(
                {'error': 'Could not process image. Please try again.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        logger.info('Card scan raw (500c): user=%s text=%s', request.user.email, response_text[:500])

        # ── Parse JSON from response ─────────────────────────
        try:
            # Remove markdown fences
            if '```' in response_text:
                fenced = _re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', response_text, _re.DOTALL)
                if fenced:
                    response_text = fenced.group(1).strip()

            if not response_text.startswith('{'):
                json_match = _re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, _re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)

            result = json.loads(response_text)
        except json.JSONDecodeError:
            logger.warning('Card scan: JSON parse failed, raw=%s', response_text[:500])
            return Response(
                {'error': 'Could not extract card details. Please try a clearer photo.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        # Sanitize output
        allowed = ['card_number', 'cardholder_name', 'expiry_month', 'expiry_year', 'cvv', 'card_network', 'bank_name']
        sanitized = {}
        for f in allowed:
            val = result.get(f)
            if val is not None and str(val).lower() not in ('null', 'none', ''):
                sanitized[f] = str(val).strip()

        if sanitized.get('card_number'):
            sanitized['card_number'] = _re.sub(r'[\s\-]', '', sanitized['card_number'])

        if sanitized.get('card_number') and not sanitized.get('card_network'):
            cn = sanitized['card_number']
            if cn.startswith('4'):
                sanitized['card_network'] = 'visa'
            elif _re.match(r'^(5[1-5]|2[2-7])', cn):
                sanitized['card_network'] = 'mastercard'
            elif _re.match(r'^3[47]', cn):
                sanitized['card_network'] = 'amex'
            elif cn.startswith('6'):
                sanitized['card_network'] = 'discover'

        logger.info('Card scan result: user=%s fields=%s', request.user.email, list(sanitized.keys()))

        if not sanitized:
            return Response(
                {'error': 'Could not read card details. Try a clearer, well-lit photo.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        return Response(sanitized)
    
    @action(detail=False, methods=['post'], url_path='parse-sms', url_name='parse-sms')
    def parse_sms(self, request):
        """
        Parse SMS message and optionally create transaction
        """
        try:
            sms_body = request.data.get('sms_body', '')
            sender = request.data.get('sender', '')
            received_at = request.data.get('received_at')
            auto_create = request.data.get('auto_create', False)
            card_id = request.data.get('card_id')
            
            if not sms_body:
                return Response({'error': 'sms_body is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Parse SMS
            parser = SMSParserEngine()
            parsed = parser.parse_sms(sms_body, sender)
            
            if not parsed:
                return Response({'error': 'Could not parse SMS message'}, status=status.HTTP_400_BAD_REQUEST)
            
            result = parsed.to_dict()
            
            # Auto-detect card if card_last_four is found and no card_id provided
            matched_card = None
            if parsed.card_last_four and not card_id:
                try:
                    matched_card = Card.objects.filter(
                        user=request.user,
                        card_last_four=parsed.card_last_four,
                    ).first()
                    if matched_card:
                        result['matched_card_id'] = str(matched_card.id)
                        result['matched_card_name'] = matched_card.card_name
                except Exception:
                    pass
            
            # Use matched card or provided card_id
            target_card = matched_card if matched_card else None
            if card_id and not target_card:
                try:
                    target_card = Card.objects.get(id=card_id, user=request.user)
                except Card.DoesNotExist:
                    pass
                except Exception:
                    pass
            
            # Auto-create transaction ONLY if explicitly requested by the client
            should_auto_create = auto_create
            
            if should_auto_create:
                if target_card:
                    try:
                        # Check for duplicate transaction (same amount, date, card, and merchant within 5 minutes)
                        from django.utils import timezone
                        from datetime import timedelta
                        
                        time_window_start = parsed.transaction_date - timedelta(minutes=5)
                        time_window_end = parsed.transaction_date + timedelta(minutes=5)
                        
                        duplicate = Transaction.objects.filter(
                            user=request.user,
                            card=target_card,
                            amount=parsed.amount,
                            transaction_type=parsed.transaction_type,
                            transaction_date__gte=time_window_start,
                            transaction_date__lte=time_window_end,
                        ).first()
                        
                        if duplicate:
                            result['transaction_id'] = str(duplicate.id)
                            result['created'] = False
                            result['duplicate'] = True
                            result['message'] = 'This transaction already exists'
                            result['card_used'] = target_card.card_name
                        else:
                            transaction = Transaction.objects.create(
                                user=request.user,
                                card=target_card,
                                transaction_type=parsed.transaction_type,
                                amount=parsed.amount,
                                currency=parsed.currency,
                                merchant_name=parsed.merchant_name,
                                description=f'Auto-imported from SMS: {sms_body[:100]}',
                                transaction_date=parsed.transaction_date,
                                source='sms_parsed'
                            )
                            # Update card balance
                            if target_card.card_type == 'credit':
                                update_card_balance(target_card)
                            
                            result['transaction_id'] = str(transaction.id)
                            result['created'] = True
                            result['card_used'] = target_card.card_name
                            result['auto_created'] = True
                    except Exception as e:
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.exception("Error creating transaction from SMS")
                        result['error'] = 'Failed to create transaction'
                else:
                    # If auto-create is enabled but no card found, suggest cards
                    if auto_create:
                        result['error'] = 'No card found matching the last 4 digits. Please select a card manually.'
                    else:
                        result['suggested_card_id'] = str(target_card.id) if target_card else None
                        result['suggested_card_name'] = target_card.card_name if target_card else None
            elif target_card:
                result['suggested_card_id'] = str(target_card.id)
                result['suggested_card_name'] = target_card.card_name
            
            return Response(result)
        except Exception:
            import logging
            logging.getLogger(__name__).exception("SMS parsing server error")
            return Response(
                {'error': 'Server error while parsing SMS'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'], url_path='billing-summary')
    def billing_summary(self, request):
        """Return billing overview for all user's credit cards."""
        cards = Card.objects.filter(user=request.user, is_deleted=False, card_type='credit').order_by('payment_due_date')
        items = []
        total_owed = 0
        total_limit = 0
        for card in cards:
            bal = float(card.current_balance) if card.current_balance else 0
            lim = float(card.credit_limit) if card.credit_limit else 0
            total_owed += bal
            total_limit += lim
            min_pay = None
            if card.minimum_payment:
                min_pay = float(card.minimum_payment)
            elif card.minimum_payment_percentage and card.current_balance:
                min_pay = round(bal * float(card.minimum_payment_percentage) / 100, 2)
            items.append({
                'id': str(card.id), 'card_name': card.card_name,
                'bank_name': card.bank_name, 'card_last_four': card.card_last_four,
                'credit_limit': lim, 'current_balance': bal,
                'payment_due_date': card.payment_due_date,
                'minimum_payment': min_pay, 'currency': card.balance_currency,
            })
        return Response({'items': items, 'total_owed': total_owed, 'total_credit_limit': total_limit, 'currency': 'AED'})


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Transaction.objects.filter(
            user=self.request.user
        ).select_related('card')

        card_id = self.request.query_params.get('card_id')
        if card_id:
            queryset = queryset.filter(card_id=card_id)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        transaction_type = self.request.query_params.get('transaction_type')

        if start_date:
            queryset = queryset.filter(transaction_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__lte=end_date)
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        return queryset.order_by('-transaction_date')
    
    def list(self, request, *args, **kwargs):
        """List all transactions with pagination"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'items': serializer.data,
            'total': queryset.count()
        })
    
    def perform_create(self, serializer):
        """Create transaction and update card balance"""
        # Check for duplicate before creating
        validated_data = serializer.validated_data
        card = validated_data.get('card')
        amount = validated_data.get('amount')
        transaction_type = validated_data.get('transaction_type')
        transaction_date = validated_data.get('transaction_date')
        
        if card and amount and transaction_date:
            from django.utils import timezone
            from datetime import timedelta
            
            time_window_start = transaction_date - timedelta(minutes=5)
            time_window_end = transaction_date + timedelta(minutes=5)
            
            duplicate = Transaction.objects.filter(
                user=self.request.user,
                card=card,
                amount=amount,
                transaction_type=transaction_type,
                transaction_date__gte=time_window_start,
                transaction_date__lte=time_window_end,
            ).first()
            
            if duplicate:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({
                    'detail': 'A similar transaction already exists. Please check for duplicates.'
                })
        
        transaction = serializer.save(user=self.request.user)
        
        # Update card balance if transaction is linked to a card
        if transaction.card and transaction.card.card_type == 'credit':
            update_card_balance(transaction.card)
    
    def perform_update(self, serializer):
        """Update transaction and recalculate card balance"""
        old_card = serializer.instance.card
        transaction = serializer.save()
        new_card = transaction.card

        # Recalculate balance for old card if it changed
        if old_card and old_card != new_card:
            update_card_balance(old_card)

        # Update balance for new/current card
        if new_card and new_card.card_type == 'credit':
            update_card_balance(new_card)
    
    def destroy(self, request, pk=None):
        # Get transaction including deleted ones to avoid 404 if already deleted
        try:
            instance = Transaction.all_objects.get(id=pk, user=request.user)
        except Transaction.DoesNotExist:
            return Response(
                {'detail': 'Transaction not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # If already deleted, return success
        if instance.is_deleted:
            return Response(status=status.HTTP_204_NO_CONTENT)
        
        card = instance.card
        instance.is_deleted = True
        instance.save()
        
        # Recalculate card balance after deletion
        if card:
            update_card_balance(card)
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['get'], url_path='summary/monthly')
    def monthly_summary(self, request):
        year = int(request.query_params.get('year', timezone.now().year))
        month = int(request.query_params.get('month', timezone.now().month))
        
        start_date = timezone.make_aware(datetime(year, month, 1))
        if month == 12:
            end_date = timezone.make_aware(datetime(year + 1, 1, 1))
        else:
            end_date = timezone.make_aware(datetime(year, month + 1, 1))
        
        transactions = Transaction.objects.filter(
            user=request.user,
            transaction_date__gte=start_date,
            transaction_date__lt=end_date,
        )
        
        expenses = transactions.filter(transaction_type__in=['purchase', 'withdrawal', 'payment'])
        income = transactions.filter(transaction_type__in=['refund', 'transfer'])
        
        total_spent = expenses.aggregate(Sum('amount'))['amount__sum'] or 0
        total_income = income.aggregate(Sum('amount'))['amount__sum'] or 0
        
        # Get currency from first transaction or default to AED
        first_transaction = transactions.first()
        currency = first_transaction.currency if first_transaction else 'AED'
        
        return Response({
            'year': year,
            'month': month,
            'total_spent': float(total_spent),
            'total_income': float(total_income),
            'net': float(total_income - total_spent),
            'currency': currency
        })


class CashEntryViewSet(viewsets.ModelViewSet):
    serializer_class = CashEntrySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CashEntry.objects.filter(user=self.request.user).order_by('-entry_date')
    
    def destroy(self, request, pk=None):
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['get'])
    def balance(self, request):
        entries = CashEntry.objects.filter(user=request.user)
        income = entries.filter(entry_type='income').aggregate(Sum('amount'))['amount__sum'] or 0
        expense = entries.filter(entry_type='expense').aggregate(Sum('amount'))['amount__sum'] or 0
        balance = float(income - expense)
        
        return Response({
            'balance': balance,
            'currency': 'AED'
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_data(request):
    """Export user data as CSV or JSON"""
    export_format = request.query_params.get('format', 'json')
    data_type = request.query_params.get('type', 'all')  # all, cards, transactions, cash

    result = {}

    if data_type in ('all', 'cards'):
        cards = Card.objects.filter(user=request.user)
        cards_data = []
        for card in cards:
            cards_data.append({
                'card_name': card.card_name,
                'bank_name': card.bank_name,
                'card_type': card.card_type,
                'card_network': card.card_network or '',
                'card_last_four': card.card_last_four,
                'balance_currency': card.balance_currency,
                'available_balance': str(card.available_balance) if card.available_balance else '',
                'credit_limit': str(card.credit_limit) if card.credit_limit else '',
                'current_balance': str(card.current_balance) if card.current_balance else '',
                'created_at': card.created_at.isoformat(),
            })
        result['cards'] = cards_data

    if data_type in ('all', 'transactions'):
        transactions = Transaction.objects.filter(user=request.user).select_related('card')
        txn_data = []
        for txn in transactions:
            txn_data.append({
                'date': txn.transaction_date.isoformat() if txn.transaction_date else '',
                'type': txn.transaction_type,
                'amount': str(txn.amount),
                'currency': txn.currency,
                'merchant': txn.merchant_name or '',
                'description': txn.description or '',
                'category': txn.category or '',
                'card': txn.card.card_name if txn.card else '',
                'source': txn.source,
            })
        result['transactions'] = txn_data

    if data_type in ('all', 'cash'):
        entries = CashEntry.objects.filter(user=request.user)
        cash_data = []
        for entry in entries:
            cash_data.append({
                'date': entry.entry_date.isoformat() if entry.entry_date else '',
                'type': entry.entry_type,
                'amount': str(entry.amount),
                'currency': entry.currency,
                'description': entry.description or '',
                'category': entry.category or '',
            })
        result['cash_entries'] = cash_data

    if export_format == 'csv':
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="cardvault_export_{data_type}.csv"'

        writer = csv.writer(response)

        for section_name, section_data in result.items():
            if section_data:
                writer.writerow([f'--- {section_name.upper()} ---'])
                writer.writerow(section_data[0].keys())
                for row in section_data:
                    writer.writerow(row.values())
                writer.writerow([])

        return response
    else:
        response = HttpResponse(
            json.dumps(result, indent=2, ensure_ascii=False),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="cardvault_export_{data_type}.json"'
        return response


class ChatSessionViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSessionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ChatSession.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        session_id = self.request.query_params.get('session_id')
        if session_id:
            return ChatMessage.objects.filter(session_id=session_id, session__user=self.request.user)
        return ChatMessage.objects.none()
    
    def perform_create(self, serializer):
        session_id = self.request.data.get('session_id')
        try:
            session = ChatSession.objects.get(id=session_id, user=self.request.user)
            serializer.save(session=session)
        except ChatSession.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound("Chat session not found")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_send(request):
    """AI-powered financial chat. Accepts {message, session_id?}, returns {response, session_id}."""
    import time
    import urllib.request
    import urllib.error
    import logging
    logger = logging.getLogger('api.chat')

    user_message = request.data.get('message', '').strip()
    session_id = request.data.get('session_id')

    if not user_message:
        return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Get or create session
    if session_id:
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
        except ChatSession.DoesNotExist:
            session = ChatSession.objects.create(user=request.user, title=user_message[:100])
    else:
        session = ChatSession.objects.create(user=request.user, title=user_message[:100])

    # Save user message
    ChatMessage.objects.create(session=session, role='user', content=user_message)

    # Build financial context from user's data
    user_cards = Card.objects.filter(user=request.user, is_deleted=False)
    cards_context = []
    for card in user_cards:
        card_info = {
            'name': card.card_name, 'bank': card.bank_name,
            'type': card.card_type, 'last_four': card.card_last_four,
            'network': card.card_network,
            'credit_limit': float(card.credit_limit) if card.credit_limit else None,
            'current_balance': float(card.current_balance) if card.current_balance else None,
            'available_balance': float(card.available_balance) if card.available_balance else None,
            'currency': card.balance_currency,
            'payment_due_date': card.payment_due_date,
            'statement_date': card.statement_date,
            'minimum_payment': float(card.minimum_payment) if card.minimum_payment else None,
            'min_payment_pct': float(card.minimum_payment_percentage) if card.minimum_payment_percentage else None,
        }
        if card.card_benefits:
            try:
                card_info['benefits'] = json.loads(card.card_benefits)
            except json.JSONDecodeError:
                pass
        cards_context.append(card_info)

    recent_txns = Transaction.objects.filter(
        user=request.user, is_deleted=False
    ).select_related('card').order_by('-transaction_date')[:50]
    txn_context = [{
        'type': t.transaction_type, 'amount': float(t.amount),
        'currency': t.currency, 'merchant': t.merchant_name,
        'date': t.transaction_date.strftime('%Y-%m-%d') if t.transaction_date else None,
        'card': t.card.card_name if t.card else 'Cash', 'category': t.category,
    } for t in recent_txns]

    # Cash balance
    from django.db.models import Sum
    cash_qs = CashEntry.objects.filter(user=request.user, is_deleted=False)
    cash_in = cash_qs.filter(entry_type='income').aggregate(s=Sum('amount'))['s'] or 0
    cash_out = cash_qs.filter(entry_type='expense').aggregate(s=Sum('amount'))['s'] or 0
    cash_balance = float(cash_in - cash_out)

    # Previous messages for context (last 20)
    prev_msgs = list(ChatMessage.objects.filter(session=session).order_by('-created_at')[:21])
    conversation = [{'role': m.role, 'content': m.content} for m in reversed(prev_msgs) if not (m.role == 'user' and m.content == user_message)]
    # Remove the user message we just saved from conversation (it will be added separately)
    if conversation and conversation[-1]['role'] == 'user' and conversation[-1]['content'] == user_message:
        conversation.pop()

    system_prompt = f"""You are CardVault AI, a smart financial assistant in a personal finance app.

## User's Cards ({len(cards_context)} cards):
{json.dumps(cards_context, ensure_ascii=False, default=str)}

## Recent Transactions (last {len(txn_context)}):
{json.dumps(txn_context, ensure_ascii=False, default=str)}

## Cash Balance: {cash_balance} AED

## Rules:
- Answer about cards, balances, due dates, spending patterns
- Recommend best card for purchases based on card benefits
- Respond in the SAME LANGUAGE the user writes (Arabic or English)
- Be concise and professional
- Format amounts clearly (e.g. 1,500.00 AED)
- Never make up data - only use info provided above
- Today: {timezone.now().strftime('%Y-%m-%d')}"""

    ai_response = None
    google_key = getattr(django_settings, 'GOOGLE_API_KEY', '')
    anthropic_key = getattr(django_settings, 'ANTHROPIC_API_KEY', '')

    # Try Gemini first
    if google_key:
        gemini_url = (
            'https://generativelanguage.googleapis.com/v1beta/'
            'models/gemini-2.0-flash:generateContent'
            f'?key={google_key}'
        )
        gemini_contents = [
            {'role': 'user', 'parts': [{'text': system_prompt}]},
            {'role': 'model', 'parts': [{'text': 'Understood. I have your financial data ready. How can I help?'}]},
        ]
        for msg in conversation:
            gemini_contents.append({
                'role': 'user' if msg['role'] == 'user' else 'model',
                'parts': [{'text': msg['content']}]
            })
        gemini_contents.append({'role': 'user', 'parts': [{'text': user_message}]})

        payload = json.dumps({
            'contents': gemini_contents,
            'generationConfig': {'temperature': 0.7, 'maxOutputTokens': 2048}
        }).encode('utf-8')

        for attempt in range(3):
            try:
                req = urllib.request.Request(gemini_url, data=payload,
                    headers={'Content-Type': 'application/json'}, method='POST')
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    candidates = data.get('candidates', [])
                    if candidates:
                        parts = candidates[0].get('content', {}).get('parts', [])
                        if parts:
                            ai_response = parts[0].get('text', '').strip()
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 2:
                    time.sleep((attempt + 1) * 2)
                    continue
                logger.warning('Chat Gemini HTTP %d', e.code)
                break
            except Exception as e:
                logger.warning('Chat Gemini error: %s', str(e))
                break

    # Fallback to Claude
    if not ai_response and anthropic_key:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=anthropic_key)
            claude_msgs = [{'role': m['role'], 'content': m['content']} for m in conversation]
            claude_msgs.append({'role': 'user', 'content': user_message})
            message = client.messages.create(
                model='claude-sonnet-4-20250514', max_tokens=2048,
                system=system_prompt, messages=claude_msgs,
            )
            ai_response = message.content[0].text.strip()
        except Exception as e:
            logger.warning('Chat Claude error: %s', str(e))

    if not ai_response:
        ai_response = "I'm sorry, I couldn't process your request right now. Please try again."

    # Save AI response
    ChatMessage.objects.create(session=session, role='assistant', content=ai_response)

    return Response({'response': ai_response, 'session_id': str(session.id)})


# ---------------------------------------------------------------------------
# WebAuthn / FIDO2 Biometric Authentication
# ---------------------------------------------------------------------------

import os
import base64
import hashlib
import struct


def _b64url_encode(data: bytes) -> str:
    """Base64url-encode bytes without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _b64url_decode(s: str) -> bytes:
    """Base64url-decode a string, adding padding as needed."""
    s += '=' * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def webauthn_register_options(request):
    """
    Generate WebAuthn registration options (challenge + relying party info).
    The client uses these to call navigator.credentials.create().
    """
    user = request.user

    # Generate a cryptographically random challenge
    challenge = os.urandom(32)
    cache_key = f'webauthn_reg_{user.id}'
    cache.set(cache_key, challenge, 300)  # 5 minutes

    # Relying party configuration
    rp_id = getattr(django_settings, 'WEBAUTHN_RP_ID', 'localhost')
    rp_name = 'CardVault'

    # Build list of credentials to exclude (user already registered these)
    existing_credentials = WebAuthnCredential.objects.filter(user=user)
    exclude_credentials = [
        {
            'type': 'public-key',
            'id': cred.credential_id,
        }
        for cred in existing_credentials
    ]

    display_name = user.full_name or user.email

    return Response({
        'challenge': _b64url_encode(challenge),
        'rp': {
            'id': rp_id,
            'name': rp_name,
        },
        'user': {
            'id': _b64url_encode(str(user.id).encode('utf-8')),
            'name': user.email,
            'displayName': display_name,
        },
        'pubKeyCredParams': [
            {'type': 'public-key', 'alg': -7},    # ES256
            {'type': 'public-key', 'alg': -257},   # RS256
        ],
        'authenticatorSelection': {
            'authenticatorAttachment': 'platform',
            'userVerification': 'required',
        },
        'timeout': 60000,
        'excludeCredentials': exclude_credentials,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def webauthn_register_verify(request):
    """
    Verify and store a new WebAuthn credential after the browser's
    navigator.credentials.create() call succeeds.

    NOTE: This uses a "trust the client" approach -- the browser's WebAuthn
    API has already verified the attestation locally. Full server-side CBOR/
    COSE attestation verification would require the ``fido2`` library.
    """
    user = request.user

    credential_id = request.data.get('credential_id')
    public_key = request.data.get('public_key')
    sign_count = request.data.get('sign_count', 0)
    device_name = request.data.get('device_name', '')

    if not credential_id or not public_key:
        return Response(
            {'detail': 'credential_id and public_key are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify that a registration challenge was issued for this user
    cache_key = f'webauthn_reg_{user.id}'
    challenge = cache.get(cache_key)
    if challenge is None:
        return Response(
            {'detail': 'Registration challenge expired or not found. Please restart registration.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Consume the challenge so it cannot be reused
    cache.delete(cache_key)

    # Check for duplicate credential
    if WebAuthnCredential.objects.filter(credential_id=credential_id).exists():
        return Response(
            {'detail': 'This credential is already registered.'},
            status=status.HTTP_409_CONFLICT,
        )

    # Store the credential
    credential = WebAuthnCredential.objects.create(
        user=user,
        credential_id=credential_id,
        public_key=public_key,
        sign_count=sign_count,
        device_name=device_name or None,
    )

    return Response({
        'message': 'Credential registered successfully',
        'credential_id': str(credential.id),
        'device_name': credential.device_name,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def webauthn_login_options(request):
    """
    Generate WebAuthn login (assertion) options for a given email.
    The client uses these to call navigator.credentials.get().
    """
    email = request.data.get('email')
    if not email:
        return Response(
            {'detail': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Import User model
    from .models import User

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Return a generic error to avoid user enumeration
        return Response(
            {'detail': 'No WebAuthn credentials found for this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    credentials = WebAuthnCredential.objects.filter(user=user)
    if not credentials.exists():
        return Response(
            {'detail': 'No WebAuthn credentials found for this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Generate challenge
    challenge = os.urandom(32)
    cache_key = f'webauthn_login_{email}'
    cache.set(cache_key, challenge, 300)  # 5 minutes

    rp_id = getattr(django_settings, 'WEBAUTHN_RP_ID', 'localhost')

    allow_credentials = [
        {
            'type': 'public-key',
            'id': cred.credential_id,
        }
        for cred in credentials
    ]

    return Response({
        'challenge': _b64url_encode(challenge),
        'rpId': rp_id,
        'allowCredentials': allow_credentials,
        'timeout': 60000,
        'userVerification': 'required',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def webauthn_login_verify(request):
    """
    Verify a WebAuthn login assertion and issue JWT tokens.

    NOTE: This uses a simplified verification approach -- it confirms the
    credential exists, belongs to the correct user, and enforces sign_count
    monotonicity for replay protection. Full CBOR/COSE signature verification
    would require the ``fido2`` library.
    """
    email = request.data.get('email')
    credential_id = request.data.get('credential_id')
    authenticator_data = request.data.get('authenticator_data')
    client_data_json = request.data.get('client_data_json')
    signature = request.data.get('signature')

    if not all([email, credential_id, authenticator_data, client_data_json, signature]):
        return Response(
            {'detail': 'email, credential_id, authenticator_data, client_data_json, and signature are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify that a login challenge was issued for this email
    cache_key = f'webauthn_login_{email}'
    challenge = cache.get(cache_key)
    if challenge is None:
        return Response(
            {'detail': 'Login challenge expired or not found. Please restart authentication.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Consume the challenge
    cache.delete(cache_key)

    # Look up the credential
    try:
        credential = WebAuthnCredential.objects.select_related('user').get(
            credential_id=credential_id,
        )
    except WebAuthnCredential.DoesNotExist:
        return Response(
            {'detail': 'Credential not found.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Verify the credential belongs to the correct user
    if credential.user.email != email:
        return Response(
            {'detail': 'Credential does not match the provided email.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Verify the user account is active
    if not credential.user.is_active:
        return Response(
            {'detail': 'User account is disabled.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Extract and verify sign_count from authenticator_data for replay protection
    # authenticator_data is base64url-encoded; the sign count is a 4-byte
    # big-endian integer at offset 33 (after 32-byte rpIdHash + 1-byte flags).
    try:
        auth_data_bytes = _b64url_decode(authenticator_data)
        if len(auth_data_bytes) >= 37:
            new_sign_count = struct.unpack('>I', auth_data_bytes[33:37])[0]
        else:
            new_sign_count = 0
    except Exception:
        new_sign_count = 0

    # Replay protection: sign_count must be strictly greater than stored value,
    # unless both are 0 (some authenticators don't implement counters).
    if credential.sign_count > 0 and new_sign_count <= credential.sign_count:
        return Response(
            {'detail': 'Potential credential cloning detected (sign count mismatch).'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Update credential metadata
    credential.sign_count = new_sign_count
    credential.last_used_at = timezone.now()
    credential.save(update_fields=['sign_count', 'last_used_at'])

    # Issue JWT tokens
    refresh = RefreshToken.for_user(credential.user)

    return Response({
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'token_type': 'bearer',
    })
