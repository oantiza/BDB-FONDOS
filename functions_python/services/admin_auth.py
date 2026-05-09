"""
Admin authentication and authorization helpers.

This module provides the canonical backend admin validation layer.
The frontend AdminGuard is UX-only; this module is authoritative.

Security model (3 layers):
  1. Frontend AdminGuard — UX convenience only, bypassable.
  2. Backend require_admin — THIS MODULE — authoritative check.
  3. Firestore Security Rules — defence in depth (future).

INVARIANTS:
  - No Firestore writes.
  - No secrets or API keys.
  - No parser or Gemini calls.
  - Pure validation logic only.
"""

import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Admin allowlist — canonical source of truth for backend admin authorization.
# Must match frontend ADMIN_EMAILS in hooks/useAdminAuth.ts.
# ---------------------------------------------------------------------------
ADMIN_EMAILS: frozenset[str] = frozenset({
    "oantiza@gmail.com",
})


def normalize_email(email: str | None) -> str:
    """Normalize an email for comparison: lowercase, strip whitespace.

    Returns empty string for None/empty/non-string inputs.
    """
    if not email or not isinstance(email, str):
        return ""
    return email.strip().lower()


def is_admin_email(email: str | None) -> bool:
    """Check if email is in the admin allowlist (case-insensitive)."""
    normalized = normalize_email(email)
    if not normalized:
        return False
    return normalized in ADMIN_EMAILS


def require_admin_email(email: str | None) -> str:
    """Validate and return normalized admin email, or raise ValueError.

    Returns the normalized email on success.
    Raises ValueError with a clear message for non-admin or missing emails.
    """
    normalized = normalize_email(email)
    if not normalized:
        raise ValueError("Missing or empty email — admin access denied")
    if normalized not in ADMIN_EMAILS:
        raise ValueError(f"Email '{normalized}' is not an authorized admin")
    return normalized


def extract_and_verify_admin_callable(request) -> str:
    """Extract email from a Firebase Callable request and verify admin status.

    For use with @https_fn.on_call endpoints.
    Returns normalized admin email on success.
    Raises https_fn.HttpsError on failure.

    Args:
        request: firebase_functions.https_fn.CallableRequest

    Returns:
        str: The normalized admin email.

    Raises:
        https_fn.HttpsError: UNAUTHENTICATED if no auth context.
        https_fn.HttpsError: PERMISSION_DENIED if not admin.
    """
    from firebase_functions import https_fn

    if not request.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required",
        )

    email = request.auth.token.get("email", "")
    normalized = normalize_email(email)

    if not is_admin_email(normalized):
        logger.warning(f"Admin access denied for email: {normalized}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin privileges required",
        )

    return normalized


def extract_and_verify_admin_http(req) -> str:
    """Extract email from a Firebase HTTP request via Bearer token and verify admin.

    For use with @https_fn.on_request endpoints.
    Returns normalized admin email on success.
    Raises ValueError on failure (caller should return appropriate HTTP response).

    Args:
        req: firebase_functions.https_fn.Request

    Returns:
        str: The normalized admin email.

    Raises:
        ValueError: If token is missing, invalid, or email is not admin.
    """
    auth_header = req.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")

    id_token = auth_header.split("Bearer ")[1]

    try:
        from firebase_admin import auth
        decoded_token = auth.verify_id_token(id_token)
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        raise ValueError(f"Invalid authentication token: {e}")

    email = decoded_token.get("email", "")
    return require_admin_email(email)
