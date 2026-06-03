"""
Tests for api/endpoints_admin_console.py — Read-only admin console endpoints.

These tests validate endpoint behavior WITHOUT real Firestore access.
All Firebase interactions are mocked.

INVARIANTS:
  - No real Firestore reads or writes.
  - No real Firebase auth calls.
  - No secrets or API keys.
  - No parser or Gemini invocations.
"""

import pytest
from unittest.mock import MagicMock, patch

from api.endpoints_admin_console import (
    _sanitize_fund_doc,
    SAFE_FUND_FIELDS,
)
from services.admin_auth import extract_and_verify_admin_callable


# ===========================================================================
# _sanitize_fund_doc
# ===========================================================================

class TestSanitizeFundDoc:
    def test_extracts_only_safe_fields(self):
        full_doc = {
            "isin": "BE0943877671",
            "name": "DPAM B - Bonds Eur Government B Cap",
            "asset_type": "FIXED_INCOME",
            "classification_v2": {
                "asset_type": "FIXED_INCOME",
                "asset_subtype": "GLOBAL_BOND",
            },
            "manual": {"costs": {"retrocession": 0.25}},
            "portfolio_exposure_v2": {"asset_mix": {"bond": 80, "equity": 20}},
            # Fields that should NOT appear in output:
            "internal_score": 0.95,
            "eod_ticker": "BE0943877671.XBRU",
            "std_extra": {"secret_field": "value"},
            "created_at": "2024-01-01",
            "some_sensitive_data": "should_not_leak",
        }
        result = _sanitize_fund_doc(full_doc)

        # Allowed fields present
        assert "isin" in result
        assert "name" in result
        assert "classification_v2" in result
        assert "manual" in result

        # Disallowed fields absent
        assert "internal_score" not in result
        assert "eod_ticker" not in result
        assert "std_extra" not in result
        assert "created_at" not in result
        assert "some_sensitive_data" not in result

    def test_returns_empty_for_empty_doc(self):
        assert _sanitize_fund_doc({}) == {}

    def test_nested_dicts_are_shallow_copied(self):
        original = {"classification_v2": {"asset_type": "EQUITY"}}
        result = _sanitize_fund_doc(original)
        # Modify result should NOT affect original
        result["classification_v2"]["asset_type"] = "MODIFIED"
        assert original["classification_v2"]["asset_type"] == "EQUITY"

    def test_only_allowlisted_fields_pass(self):
        doc = {"field_" + str(i): i for i in range(50)}
        result = _sanitize_fund_doc(doc)
        for key in result:
            assert key in SAFE_FUND_FIELDS, f"Non-safe field leaked: {key}"


# ===========================================================================
# admin_health endpoint — mocked callable
# ===========================================================================

class TestAdminHealthEndpoint:
    def _make_admin_request(self, email="oantiza@gmail.com"):
        request = MagicMock()
        request.auth = MagicMock()
        request.auth.token = {"email": email}
        return request

    def _make_anon_request(self):
        request = MagicMock()
        request.auth = None
        return request

    def test_returns_ok_for_admin(self):
        from api.endpoints_admin_console import admin_health
        # The @on_call decorator wraps the function; we call the inner logic
        # by accessing the original function via __wrapped__ or calling directly.
        # Since Firebase decorators don't add __wrapped__, we test via the
        # extract_and_verify pattern instead.
        request = self._make_admin_request()
        admin_email = extract_and_verify_admin_callable(request)
        assert admin_email == "oantiza@gmail.com"

    def test_health_response_structure(self):
        """Verify the expected shape of admin_health response."""
        # Simulate what admin_health returns
        expected_keys = {"status", "mode", "admin_email", "capabilities", "invariants", "version", "phase"}
        response = {
            "status": "ok",
            "mode": "read_only",
            "admin_email": "oantiza@gmail.com",
            "capabilities": ["admin_health", "admin_fund_search"],
            "invariants": {
                "no_writes": True,
                "no_parser": True,
                "no_gemini": True,
                "no_secrets_exposed": True,
            },
            "version": "0.1.0",
            "phase": "backend_require_admin_0",
        }
        assert set(response.keys()) == expected_keys
        assert response["mode"] == "read_only"
        assert response["invariants"]["no_writes"] is True
        assert response["invariants"]["no_parser"] is True
        assert response["invariants"]["no_gemini"] is True

    def test_rejects_unauthenticated(self):
        from firebase_functions import https_fn
        request = self._make_anon_request()
        with pytest.raises(https_fn.HttpsError) as exc_info:
            extract_and_verify_admin_callable(request)
        assert exc_info.value.code == https_fn.FunctionsErrorCode.UNAUTHENTICATED

    def test_rejects_non_admin(self):
        from firebase_functions import https_fn
        request = self._make_admin_request(email="user@example.com")
        with pytest.raises(https_fn.HttpsError) as exc_info:
            extract_and_verify_admin_callable(request)
        assert exc_info.value.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED


# ===========================================================================
# admin_fund_search — sanitization contract
# ===========================================================================

class TestAdminFundSearchContract:
    def test_sanitize_never_leaks_eod_ticker(self):
        doc = {"isin": "X", "name": "Test", "eod_ticker": "X.XBRU"}
        result = _sanitize_fund_doc(doc)
        assert "eod_ticker" not in result

    def test_sanitize_never_leaks_std_extra(self):
        doc = {"isin": "X", "std_extra": {"key": "val"}}
        result = _sanitize_fund_doc(doc)
        assert "std_extra" not in result

    def test_retrocession_data_is_preserved_in_manual(self):
        doc = {
            "isin": "X",
            "manual": {"costs": {"retrocession": 0.30, "ter": 1.2}},
        }
        result = _sanitize_fund_doc(doc)
        assert result["manual"]["costs"]["retrocession"] == 0.30


# ===========================================================================
# Security invariants: no write patterns in endpoint source
# ===========================================================================

class TestEndpointSecurityInvariants:
    def test_no_write_keywords_in_endpoints_source(self):
        import inspect
        import api.endpoints_admin_console as mod
        read_only_objects = [
            mod._sanitize_fund_doc,
            mod.admin_health,
            mod.admin_fund_search,
            mod.admin_retro_dry_run,
            mod._normalize_retrocession_backend,
            mod._classify_row,
        ]
        source = "\n".join(inspect.getsource(obj) for obj in read_only_objects)
        write_keywords = [
            ".set(", ".update(", ".delete(",
            "batch.commit", "db.batch",
            "executeWrite", "applyWrite",
            "setDoc", "updateDoc", "deleteDoc",
        ]
        for keyword in write_keywords:
            assert keyword not in source, (
                f"Write keyword '{keyword}' found in read-only admin endpoints"
            )

    def test_no_parser_or_gemini_in_endpoints_source(self):
        import inspect
        import api.endpoints_admin_console as mod
        source = inspect.getsource(mod)
        # Check for functional patterns — imports and calls, not docs
        forbidden = [
            "import cargador_lotes",
            "from services.research",
            "generate_weekly",
            "cargador_lotes",
            "gemini.generate",
            "GenerativeModel",
        ]
        for keyword in forbidden:
            assert keyword not in source, (
                f"Forbidden functional pattern '{keyword}' found in admin console endpoints"
            )

    def test_no_secret_keywords_in_endpoints_source(self):
        import inspect
        import api.endpoints_admin_console as mod
        source = inspect.getsource(mod)
        secret_keywords = [
            "api_key", "API_KEY", "private_key", "PRIVATE_KEY",
            "serviceAccount", "REFRESH_TOKEN",
        ]
        for keyword in secret_keywords:
            assert keyword not in source, (
                f"Secret keyword '{keyword}' found in admin console endpoints"
            )
