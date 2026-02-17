"""Custom exception handler so JWT/auth errors return 401 instead of 500."""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import logging


def api_exception_handler(exc, context):
    """Catch JWT and auth exceptions and return 401/403 instead of 500."""
    response = exception_handler(exc, context)
    if response is not None:
        return response
    # Handle JWT/simplejwt exceptions that DRF doesn't catch
    exc_name = type(exc).__name__
    if 'Token' in exc_name or 'Invalid' in exc_name or 'Authentication' in exc_name:
        return Response(
            {'detail': 'Invalid or expired token. Please log in again.'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    # Log unhandled exception and return safe 500 with detail only in DEBUG
    logger = logging.getLogger(__name__)
    logger.exception('Unhandled API exception: %s', exc)
    if settings.DEBUG:
        import traceback
        return Response(
            {'detail': str(exc), 'traceback': traceback.format_exc()},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    return Response(
        {'detail': 'An error occurred. Please try again.'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
