"""
Tests for services/admin_auth.py — Backend admin authorization helpers.

These tests validate the canonical admin auth layer WITHOUT any
Firestore access, real credentials, or network calls.

INVARIANTS:
  - No Firestore writes or reads.
  - No real Firebase auth calls.
  - No secrets or API keys.
  - Pure unit tests.
"""

import pytest

from services.admin_auth import (
    ADMIN_EMAILS,
    normalize_email,
    is_admin_email,
    require_admin_email,
    extract_and_verify_admin_callable,
)


# ===========================================================================
# ADMIN_EMAILS
# ===========================================================================

class TestAdminEmails:
    def test_contains_primary_admin(self):
        assert "oantiza@gmail.com" in ADMIN_EMAILS

    def test_is_non_empty_frozenset(self):
        assert isinstance(ADMIN_EMAILS, frozenset)
        assert len(ADMIN_EMAILS) > 0

    def test_all_entries_are_lowercase(self):
        for email in ADMIN_EMAILS:
            assert email == email.lower(), f"Admin email not lowercase: {email}"


# ===========================================================================
# normalize_email
# ===========================================================================

class TestNormalizeEmail:
    def test_lowercases_and_trims(self):
        assert normalize_email("  OAntiza@Gmail.COM  ") == "oantiza@gmail.com"

    def test_returns_empty_for_none(self):
        assert normalize_email(None) == ""

    def test_returns_empty_for_empty_string(self):
        assert normalize_email("") == ""

    def test_returns_empty_for_non_string(self):
        assert normalize_email(12345) == ""

    def test_handles_already_normalized(self):
        assert normalize_email("oantiza@gmail.com") == "oantiza@gmail.com"

    def test_handles_tabs_and_newlines(self):
        assert normalize_email("\t oantiza@gmail.com \n") == "oantiza@gmail.com"


# ===========================================================================
# is_admin_email
# ===========================================================================

class TestIsAdminEmail:
    def test_true_for_exact_admin(self):
        assert is_admin_email("oantiza@gmail.com") is True

    def test_true_case_insensitive_upper(self):
        assert is_admin_email("OANTIZA@GMAIL.COM") is True

    def test_true_case_insensitive_mixed(self):
        assert is_admin_email("Oantiza@Gmail.Com") is True

    def test_true_with_whitespace(self):
        assert is_admin_email("  oantiza@gmail.com  ") is True

    def test_false_for_non_admin(self):
        assert is_admin_email("hacker@evil.com") is False

    def test_false_for_similar_email(self):
        assert is_admin_email("oantiza@gmail.co") is False

    def test_false_for_none(self):
        assert is_admin_email(None) is False

    def test_false_for_empty(self):
        assert is_admin_email("") is False

    def test_false_for_non_string(self):
        assert is_admin_email(42) is False


# ===========================================================================
# require_admin_email
# ===========================================================================

class TestRequireAdminEmail:
    def test_returns_normalized_for_valid_admin(self):
        result = require_admin_email("  OANTIZA@GMAIL.COM  ")
        assert result == "oantiza@gmail.com"

    def test_raises_for_non_admin(self):
        with pytest.raises(ValueError, match="not an authorized admin"):
            require_admin_email("intruder@evil.com")

    def test_raises_for_none(self):
        with pytest.raises(ValueError, match="Missing or empty"):
            require_admin_email(None)

    def test_raises_for_empty(self):
        with pytest.raises(ValueError, match="Missing or empty"):
            require_admin_email("")


# ===========================================================================
# extract_and_verify_admin_callable — with mocked request
# ===========================================================================

class TestExtractAndVerifyAdminCallable:
    def _make_request(self, email=None, has_auth=True):
        """Create a mock CallableRequest."""
        from unittest.mock import MagicMock
        request = MagicMock()
        if has_auth:
            request.auth = MagicMock()
            request.auth.token = {"email": email} if email else {}
        else:
            request.auth = None
        return request

    def test_returns_admin_email_for_valid_admin(self):
        request = self._make_request(email="oantiza@gmail.com")
        result = extract_and_verify_admin_callable(request)
        assert result == "oantiza@gmail.com"

    def test_returns_admin_email_case_insensitive(self):
        request = self._make_request(email="OANTIZA@GMAIL.COM")
        result = extract_and_verify_admin_callable(request)
        assert result == "oantiza@gmail.com"

    def test_raises_unauthenticated_for_no_auth(self):
        from firebase_functions import https_fn
        request = self._make_request(has_auth=False)
        with pytest.raises(https_fn.HttpsError) as exc_info:
            extract_and_verify_admin_callable(request)
        assert exc_info.value.code == https_fn.FunctionsErrorCode.UNAUTHENTICATED

    def test_raises_permission_denied_for_non_admin(self):
        from firebase_functions import https_fn
        request = self._make_request(email="user@example.com")
        with pytest.raises(https_fn.HttpsError) as exc_info:
            extract_and_verify_admin_callable(request)
        assert exc_info.value.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED

    def test_raises_permission_denied_for_empty_email(self):
        from firebase_functions import https_fn
        request = self._make_request(email="")
        with pytest.raises(https_fn.HttpsError) as exc_info:
            extract_and_verify_admin_callable(request)
        assert exc_info.value.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED


# ===========================================================================
# Security invariant: no write keywords in admin_auth module source
# ===========================================================================

class TestAdminAuthSecurityInvariants:
    def test_no_write_keywords_in_module_source(self):
        import inspect
        import services.admin_auth as mod
        source = inspect.getsource(mod)
        write_keywords = [
            "setDoc", "updateDoc", "deleteDoc",
            ".set(", ".update(", ".delete(",
            "batch.commit", "db.batch",
            "executeWrite", "applyWrite",
        ]
        for keyword in write_keywords:
            assert keyword not in source, (
                f"Write keyword '{keyword}' found in admin_auth module"
            )

    def test_no_secret_keywords_in_module_source(self):
        import inspect
        import services.admin_auth as mod
        source = inspect.getsource(mod)
        secret_keywords = [
            "api_key", "API_KEY", "private_key", "PRIVATE_KEY",
            "serviceAccount", "service_account",
            "REFRESH_TOKEN",
        ]
        for keyword in secret_keywords:
            assert keyword not in source, (
                f"Secret keyword '{keyword}' found in admin_auth module"
            )
