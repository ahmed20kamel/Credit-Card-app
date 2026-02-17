"""Custom JWT auth that never raises 500 - invalid/expired token returns 401."""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import get_authorization_header
from rest_framework import exceptions


class SafeJWTAuthentication(JWTAuthentication):
    """Wrap JWTAuthentication so any token error returns 401, never 500."""

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except Exception:
            # Invalid/expired token or any JWT error -> 401
            raise exceptions.AuthenticationFailed(
                'Invalid or expired token. Please log in again.'
            )
