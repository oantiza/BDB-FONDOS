"""
Tests for CORS hardening in api/endpoints_admin.py.

Validates:
  - Allowed origins receive Access-Control-Allow-Origin header.
  - Disallowed origins do NOT receive Access-Control-Allow-Origin header.
  - The wildcard '*' is never returned.
  - The ALLOWED_ORIGINS list contains expected production and dev origins.
  - Admin auth logic is unchanged (import check only).

INVARIANTS:
  - No Firestore writes or reads.
  - No real Firebase auth calls.
  - No network calls.
  - Pure unit tests.
"""

import pytest
from unittest.mock import MagicMock


# ===========================================================================
# _is_origin_allowed
# ===========================================================================

class TestIsOriginAllowed:
    def test_production_web_app_allowed(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("https://bdb-fondos.web.app") is True

    def test_production_firebaseapp_allowed(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("https://bdb-fondos.firebaseapp.com") is True

    def test_localhost_5173_allowed(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("http://localhost:5173") is True

    def test_localhost_3000_allowed(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("http://localhost:3000") is True

    def test_other_web_app_subdomain_allowed(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("https://other-project.web.app") is True

    def test_other_firebaseapp_subdomain_allowed(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("https://other-project.firebaseapp.com") is True

    def test_random_origin_rejected(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("https://evil.com") is False

    def test_wildcard_not_allowed(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("*") is False

    def test_empty_string_rejected(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("") is False

    def test_none_rejected(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed(None) is False

    def test_http_web_app_rejected(self):
        """Only https is allowed for .web.app domains."""
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("http://bdb-fondos.web.app") is False

    def test_localhost_wrong_port_rejected(self):
        from api.endpoints_admin import _is_origin_allowed
        assert _is_origin_allowed("http://localhost:8080") is False


# ===========================================================================
# get_cors_headers
# ===========================================================================

class TestGetCorsHeaders:
    def _make_request(self, origin=None):
        req = MagicMock()
        headers = {}
        if origin is not None:
            headers["Origin"] = origin
        req.headers = headers
        return req

    def test_allowed_origin_reflected(self):
        from api.endpoints_admin import get_cors_headers
        req = self._make_request("https://bdb-fondos.web.app")
        headers = get_cors_headers(req)
        assert headers.get("Access-Control-Allow-Origin") == "https://bdb-fondos.web.app"

    def test_disallowed_origin_no_header(self):
        from api.endpoints_admin import get_cors_headers
        req = self._make_request("https://evil.com")
        headers = get_cors_headers(req)
        assert "Access-Control-Allow-Origin" not in headers

    def test_no_request_no_origin_header(self):
        from api.endpoints_admin import get_cors_headers
        headers = get_cors_headers()
        assert "Access-Control-Allow-Origin" not in headers

    def test_wildcard_never_returned(self):
        from api.endpoints_admin import get_cors_headers
        # Test with allowed origin
        req_allowed = self._make_request("https://bdb-fondos.web.app")
        h1 = get_cors_headers(req_allowed)
        assert h1.get("Access-Control-Allow-Origin") != "*"

        # Test with no origin
        h2 = get_cors_headers()
        assert h2.get("Access-Control-Allow-Origin") != "*"

        # Test with disallowed origin
        req_bad = self._make_request("https://evil.com")
        h3 = get_cors_headers(req_bad)
        assert h3.get("Access-Control-Allow-Origin") != "*"

    def test_methods_header_present(self):
        from api.endpoints_admin import get_cors_headers
        headers = get_cors_headers()
        assert "POST" in headers["Access-Control-Allow-Methods"]
        assert "GET" in headers["Access-Control-Allow-Methods"]
        assert "OPTIONS" in headers["Access-Control-Allow-Methods"]

    def test_authorization_in_allowed_headers(self):
        from api.endpoints_admin import get_cors_headers
        headers = get_cors_headers()
        assert "Authorization" in headers["Access-Control-Allow-Headers"]

    def test_max_age_present(self):
        from api.endpoints_admin import get_cors_headers
        headers = get_cors_headers()
        assert headers["Access-Control-Max-Age"] == "3600"


# ===========================================================================
# ALLOWED_ORIGINS list
# ===========================================================================

class TestAllowedOriginsList:
    def test_contains_production_origins(self):
        from api.endpoints_admin import ALLOWED_ORIGINS
        assert "https://bdb-fondos.web.app" in ALLOWED_ORIGINS
        assert "https://bdb-fondos.firebaseapp.com" in ALLOWED_ORIGINS

    def test_contains_dev_origins(self):
        from api.endpoints_admin import ALLOWED_ORIGINS
        assert "http://localhost:5173" in ALLOWED_ORIGINS
        assert "http://localhost:3000" in ALLOWED_ORIGINS

    def test_no_wildcard_in_list(self):
        from api.endpoints_admin import ALLOWED_ORIGINS
        assert "*" not in ALLOWED_ORIGINS


# ===========================================================================
# cors_config does not contain wildcard
# ===========================================================================

class TestCorsConfig:
    def test_cors_config_not_wildcard(self):
        from api.endpoints_admin import cors_config
        # cors_origins should be a list, not "*"
        assert cors_config.cors_origins != "*"


# ===========================================================================
# Security invariant: no wildcard in source
# ===========================================================================

class TestNoWildcardInSource:
    def test_no_wildcard_cors_in_source(self):
        import inspect
        import api.endpoints_admin as mod
        source = inspect.getsource(mod)
        # The string 'cors_origins="*"' must not appear
        assert 'cors_origins="*"' not in source, (
            "Wildcard CORS origin still present in endpoints_admin.py"
        )
        # The string '"Access-Control-Allow-Origin": "*"' must not appear
        assert '"Access-Control-Allow-Origin": "*"' not in source, (
            "Wildcard Access-Control-Allow-Origin still present in endpoints_admin.py"
        )
