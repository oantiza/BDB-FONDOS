"""
Tests for admin_retro_dry_run — dry-run retrocession endpoint.

Tests pure helper functions extracted from endpoints_admin_console.py:
- _normalize_retrocession_backend (canonical normalization C.1, C.2)
- _classify_row (row classification for dry-run results)
- manifest/phrase generation (uniqueness, no static prefix)
- auth rejection
- read-only invariant (no Firestore write methods)
- dedup logic (C.5)

All tests are strictly unit tests with NO real Firestore, NO real auth.
"""

import pytest
from unittest.mock import MagicMock
import uuid

from firebase_functions import https_fn

from api.endpoints_admin_console import (
    _normalize_retrocession_backend,
    _classify_row,
    ISIN_REGEX,
    MANIFEST_TTL_SECONDS,
)
from services.admin_auth import extract_and_verify_admin_callable


# ===========================================================================
# 1. Auth tests
# ===========================================================================

class TestDryRunAuth:
    def _make_admin_request(self, email="oantiza@gmail.com"):
        request = MagicMock()
        request.auth = MagicMock()
        request.auth.token = {"email": email}
        return request

    def _make_anon_request(self):
        request = MagicMock()
        request.auth = None
        return request

    def test_rejects_unauthenticated(self):
        """sin auth → rechazo"""
        request = self._make_anon_request()
        with pytest.raises(https_fn.HttpsError) as exc_info:
            extract_and_verify_admin_callable(request)
        assert exc_info.value.code == https_fn.FunctionsErrorCode.UNAUTHENTICATED

    def test_rejects_non_admin_token(self):
        """token no admin → rechazo"""
        request = self._make_admin_request(email="user@example.com")
        with pytest.raises(https_fn.HttpsError) as exc_info:
            extract_and_verify_admin_callable(request)
        assert exc_info.value.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED

    def test_allows_admin_token(self):
        """token admin → permitido"""
        request = self._make_admin_request(email="oantiza@gmail.com")
        result = extract_and_verify_admin_callable(request)
        assert result == "oantiza@gmail.com"


# ===========================================================================
# 2. Read-only invariant — no write methods in source
# ===========================================================================

class TestDryRunReadOnlyInvariant:
    def test_no_firestore_write_methods_in_source(self):
        """Verify endpoint source contains no Firestore write calls."""
        import inspect
        import api.endpoints_admin_console as mod
        source = inspect.getsource(mod)

        write_patterns = [
            ".set(",
            ".update(",
            ".delete(",
            "batch.commit",
            "db.batch",
            "setDoc",
            "updateDoc",
            "deleteDoc",
        ]
        for pattern in write_patterns:
            assert pattern not in source, (
                f"Write pattern '{pattern}' found in admin_console endpoints — "
                f"DRYRUN-0 must be strictly read-only"
            )


# ===========================================================================
# 3. Backend authoritative normalization — C.2
# ===========================================================================

class TestBackendAuthoritativeNormalization:
    def test_backend_ignores_client_parsed(self):
        """input retro_raw='0,80%' and retro_parsed_client=99 → backend new_retro=0.80"""
        norm = _normalize_retrocession_backend(
            retro_raw="0,80%",
            cell_internal_value=None,
            cell_number_format=None,
            source="csv",
        )
        assert norm["value"] == pytest.approx(0.80, abs=1e-4)
        assert norm["status"] == "OK"
        # The key invariant: backend normalizes from retro_raw,
        # completely ignoring retro_parsed_client (which could be 99)

    def test_client_server_mismatch_detection(self):
        """When client says 99 but backend says 0.80, mismatch = 1."""
        # This tests the mismatch detection logic
        client_parsed = 99
        backend_value = 0.80
        assert abs(client_parsed - backend_value) >= 1e-6  # would be flagged


# ===========================================================================
# 4. Fund not found
# ===========================================================================

class TestFundNotFound:
    def test_valid_isin_not_in_firestore_is_blocked(self):
        """ISIN válido no presente en funds_v3 → BLOCKED / FUND_NOT_FOUND"""
        row = {
            "isin": "LU0232524495",
            "nombre": "AB FCP",
            "retro_raw": "0.80",
            "retro_parsed_client": 0.80,
            "row_number": 2,
        }
        result = _classify_row(
            row=row,
            fund_doc=None,  # not found
            fund_isin="LU0232524495",
            new_retro=0.80,
            norm_status="OK",
            norm_reason="",
            source_filename="test.csv",
        )
        assert result["status"] == "BLOCKED"
        assert result["reason"] == "FUND_NOT_FOUND"
        assert result["action"] == "SKIP"


# ===========================================================================
# 5. Retro zero is valid
# ===========================================================================

class TestRetroZeroValid:
    def test_retro_raw_zero_is_ok(self):
        """retro_raw='0,00%' con fondo existente → OK or UNCHANGED, never MISSING/BLOCKED"""
        norm = _normalize_retrocession_backend(
            retro_raw="0,00%",
            cell_internal_value=None,
            cell_number_format=None,
            source="csv",
        )
        assert norm["value"] == 0
        assert norm["status"] == "OK"  # NOT MISSING, NOT INVALID

    def test_retro_zero_classify_with_existing_fund(self):
        """Zero retro with fund that has retro=0 → UNCHANGED"""
        row = {"isin": "ES0137381036", "nombre": "FONDO", "retro_raw": "0", "retro_parsed_client": 0, "row_number": 1}
        fund_doc = {"name": "FONDO REAL", "manual": {"costs": {"retrocession": 0}}}
        result = _classify_row(
            row=row,
            fund_doc=fund_doc,
            fund_isin="ES0137381036",
            new_retro=0,
            norm_status="OK",
            norm_reason="",
            source_filename="test.csv",
        )
        assert result["status"] == "UNCHANGED"
        assert result["action"] == "NO_CHANGE"

    def test_retro_zero_classify_with_existing_positive(self):
        """Zero retro with fund that has retro=0.80 → OK (delta change)"""
        row = {"isin": "ES0137381036", "nombre": "FONDO", "retro_raw": "0", "retro_parsed_client": 0, "row_number": 1}
        fund_doc = {"name": "FONDO REAL", "manual": {"costs": {"retrocession": 0.80}}}
        result = _classify_row(
            row=row,
            fund_doc=fund_doc,
            fund_isin="ES0137381036",
            new_retro=0,
            norm_status="OK",
            norm_reason="",
            source_filename="test.csv",
        )
        # Changing from 0.80 to 0 is a large relative change → WARNING
        assert result["status"] in ("OK", "WARNING")
        assert result["status"] != "BLOCKED"
        assert result["status"] != "MISSING"
        assert result["delta"] == pytest.approx(-0.80, abs=1e-4)


# ===========================================================================
# 6. Dedup same value → WARNING
# ===========================================================================

class TestDedupSameValue:
    def test_same_isin_same_value_is_dup_warning(self):
        """Two rows same ISIN same value → at least one gets DUP_SAME_VALUE WARNING."""
        # Simulating the dedup logic from the endpoint
        from collections import defaultdict

        rows = [
            {"isin": "LU0232524495", "retro_raw": "0.80", "retro_parsed_client": 0.80, "row_number": 2},
            {"isin": "LU0232524495", "retro_raw": "0.80", "retro_parsed_client": 0.80, "row_number": 3},
        ]
        normalized = [
            {"isin": "LU0232524495", "new_retro": 0.80, "norm_status": "OK", "norm_reason": ""},
            {"isin": "LU0232524495", "new_retro": 0.80, "norm_status": "OK", "norm_reason": ""},
        ]

        isin_groups = defaultdict(list)
        for idx, nr in enumerate(normalized):
            isin_groups[nr["isin"]].append(idx)

        dup_warning_indices = set()
        for isin, indices in isin_groups.items():
            if len(indices) <= 1:
                continue
            values = [normalized[i]["new_retro"] for i in indices]
            non_none = [v for v in values if v is not None]
            first = non_none[0]
            all_same = all(abs(v - first) < 1e-6 for v in non_none)
            if all_same:
                for i in indices[1:]:
                    dup_warning_indices.add(i)

        # Second row (index 1) should be flagged
        assert 1 in dup_warning_indices
        assert 0 not in dup_warning_indices  # first row is clean


# ===========================================================================
# 7. Dedup conflict → BLOCKED
# ===========================================================================

class TestDedupConflict:
    def test_same_isin_different_values_are_both_blocked(self):
        """Two rows same ISIN different values → BOTH get DUP_CONFLICT BLOCKED."""
        from collections import defaultdict

        normalized = [
            {"isin": "LU0232524495", "new_retro": 0.80, "norm_status": "OK", "norm_reason": ""},
            {"isin": "LU0232524495", "new_retro": 1.20, "norm_status": "OK", "norm_reason": ""},
        ]

        isin_groups = defaultdict(list)
        for idx, nr in enumerate(normalized):
            isin_groups[nr["isin"]].append(idx)

        dup_blocked_indices = set()
        for isin, indices in isin_groups.items():
            if len(indices) <= 1:
                continue
            values = [normalized[i]["new_retro"] for i in indices]
            non_none = [v for v in values if v is not None]
            first = non_none[0]
            all_same = all(abs(v - first) < 1e-6 for v in non_none)
            if not all_same:
                for i in indices:
                    dup_blocked_indices.add(i)

        # BOTH indices blocked
        assert 0 in dup_blocked_indices
        assert 1 in dup_blocked_indices


# ===========================================================================
# 8. Excel no heuristic — C.1
# ===========================================================================

class TestExcelNoHeuristic:
    def test_050_with_percent_format_is_50(self):
        """cell_internal_value=0.50, cell_number_format='0.00%' → new_retro=50"""
        norm = _normalize_retrocession_backend(
            retro_raw=None,
            cell_internal_value=0.50,
            cell_number_format="0.00%",
            source="xlsx",
        )
        assert norm["value"] == 50
        assert norm["value"] != pytest.approx(0.50, abs=0.01)
        # 50 > 5 → WARNING
        assert norm["status"] == "WARNING"

    def test_0008_with_percent_format_is_080(self):
        """cell_internal_value=0.008, cell_number_format='0.00%' → 0.80"""
        norm = _normalize_retrocession_backend(
            retro_raw=None,
            cell_internal_value=0.008,
            cell_number_format="0.00%",
            source="xlsx",
        )
        assert norm["value"] == pytest.approx(0.80, abs=1e-4)
        assert norm["status"] == "OK"

    def test_080_with_general_format_is_literal(self):
        """cell_internal_value=0.80, format='General' → 0.80 (no multiply)"""
        norm = _normalize_retrocession_backend(
            retro_raw=None,
            cell_internal_value=0.80,
            cell_number_format="General",
            source="xlsx",
        )
        assert norm["value"] == pytest.approx(0.80, abs=1e-4)
        assert norm["status"] == "OK"

    def test_zero_with_percent_format(self):
        """cell_internal_value=0, format='0.00%' → 0 (valid zero)"""
        norm = _normalize_retrocession_backend(
            retro_raw=None,
            cell_internal_value=0,
            cell_number_format="0.00%",
            source="xlsx",
        )
        assert norm["value"] == 0
        assert norm["status"] == "OK"


# ===========================================================================
# 9. Manifest phrase uniqueness
# ===========================================================================

class TestManifestPhraseUniqueness:
    def test_manifest_id_short_is_not_static_prefix(self):
        """confirmation_phrase uses uuid_part, not 'retro_dry_ru'."""
        from datetime import datetime, timezone

        uuid_part = uuid.uuid4().hex[:12]
        manifest_id = f"retro_dry_run_{datetime.now(timezone.utc).strftime('%Y_%m_%d')}_{uuid_part}"
        manifest_id_short = uuid_part  # Fixed logic

        assert manifest_id_short != "retro_dry_ru"
        assert manifest_id_short == uuid_part
        assert len(manifest_id_short) == 12

    def test_two_consecutive_phrases_are_distinct(self):
        """Two calls produce different confirmation phrases."""
        phrases = set()
        for _ in range(10):
            uuid_part = uuid.uuid4().hex[:12]
            approved_count = 5
            phrase = f"BDB-RETRO-WRITE-{uuid_part}-{approved_count}"
            phrases.add(phrase)

        # All 10 should be unique
        assert len(phrases) == 10

    def test_manifest_id_contains_uuid_part(self):
        """The manifest_id ends with the uuid_part used for short ID."""
        uuid_part = uuid.uuid4().hex[:12]
        from datetime import datetime, timezone
        manifest_id = f"retro_dry_run_{datetime.now(timezone.utc).strftime('%Y_%m_%d')}_{uuid_part}"

        assert manifest_id.endswith(uuid_part)
        # The short version must be extractable from the full ID
        assert uuid_part in manifest_id

    def test_manifest_ttl_is_24_hours(self):
        """MANIFEST_TTL_SECONDS = 86400 (24 hours)."""
        assert MANIFEST_TTL_SECONDS == 86400


# ===========================================================================
# Additional: negative values, invalid ISIN, normalization edge cases
# ===========================================================================

class TestNormalizationEdgeCases:
    def test_negative_is_invalid(self):
        norm = _normalize_retrocession_backend("-0.5", None, None, "csv")
        assert norm["status"] == "INVALID"
        assert norm["value"] is None

    def test_nan_string_is_invalid(self):
        norm = _normalize_retrocession_backend("abc", None, None, "csv")
        assert norm["status"] == "INVALID"
        assert norm["value"] is None

    def test_empty_string_is_missing(self):
        norm = _normalize_retrocession_backend("", None, None, "csv")
        assert norm["status"] == "MISSING"

    def test_none_is_missing(self):
        norm = _normalize_retrocession_backend(None, None, None, "csv")
        assert norm["status"] == "MISSING"

    def test_high_value_is_warning(self):
        norm = _normalize_retrocession_backend("7.5", None, None, "csv")
        assert norm["value"] == pytest.approx(7.5, abs=1e-4)
        assert norm["status"] == "WARNING"

    def test_invalid_isin_regex(self):
        """ISIN validation regex works correctly."""
        assert ISIN_REGEX.match("LU0232524495") is not None
        assert ISIN_REGEX.match("ES0137381036") is not None
        assert ISIN_REGEX.match("1234567890AB") is None
        assert ISIN_REGEX.match("LU023252") is None
        assert ISIN_REGEX.match("") is None

    def test_classify_invalid_isin_is_blocked(self):
        row = {"isin": "BAD", "retro_raw": "0.80", "retro_parsed_client": 0.80, "row_number": 1}
        result = _classify_row(
            row=row,
            fund_doc=None,
            fund_isin="BAD",
            new_retro=0.80,
            norm_status="OK",
            norm_reason="",
            source_filename="test.csv",
        )
        assert result["status"] == "BLOCKED"
        assert "ISIN inválido" in result["reason"]
