from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Sum, Q, Count
from django.utils import timezone
from datetime import datetime, timedelta
from .models import Card, Transaction, CashEntry, ChatSession, ChatMessage
from .serializers import (
    UserSerializer, RegisterSerializer, CardSerializer, CardUpdateSerializer,
    TransactionSerializer, CashEntrySerializer, ChatSessionSerializer, ChatMessageSerializer
)
from .services import encryption_service, parse_card_text, update_card_balance
from .sms_parser import SMSParserEngine


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


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get('email')
    password = request.data.get('password')
    
    if not email or not password:
        return Response({'detail': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)
    
    user = authenticate(request, username=email, password=password)
    if user:
        refresh = RefreshToken.for_user(user)
        return Response({
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'token_type': 'bearer'
        })
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
    if request.method == 'GET':
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    else:
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
        return Card.objects.filter(user=self.request.user, is_deleted=False)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['reveal'] = self.request.query_params.get('reveal', 'false').lower() == 'true'
        return context
    
    def list(self, request):
        queryset = self.get_queryset()
        bank_name = request.query_params.get('bank_name')
        if bank_name:
            queryset = queryset.filter(bank_name__icontains=bank_name)
        
        # Return all cards without pagination for now
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'items': serializer.data,
            'total': queryset.count()
        })
    
    def retrieve(self, request, pk=None):
        instance = self.get_object()
        reveal = request.query_params.get('reveal', 'false').lower() == 'true'
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
                        is_deleted=False
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
                    target_card = Card.objects.get(id=card_id, user=request.user, is_deleted=False)
                except Card.DoesNotExist:
                    pass
                except Exception:
                    pass
            
            # Auto-create transaction if requested OR if card is auto-detected
            should_auto_create = auto_create or (target_card and parsed.card_last_four)
            
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
                            is_deleted=False
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


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Transaction.objects.filter(
            user=self.request.user, is_deleted=False
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
                is_deleted=False
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
            instance = Transaction.objects.get(id=pk, user=request.user)
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
            is_deleted=False
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
        return CashEntry.objects.filter(user=self.request.user, is_deleted=False).order_by('-entry_date')
    
    def destroy(self, request, pk=None):
        instance = self.get_object()
        instance.is_deleted = True
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['get'])
    def balance(self, request):
        entries = CashEntry.objects.filter(user=request.user, is_deleted=False)
        income = entries.filter(entry_type='income').aggregate(Sum('amount'))['amount__sum'] or 0
        expense = entries.filter(entry_type='expense').aggregate(Sum('amount'))['amount__sum'] or 0
        balance = float(income - expense)
        
        return Response({
            'balance': balance,
            'currency': 'AED'
        })


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
