"""
Tests for admin_retro_write (WRITE-MVP-0).

Targets the testable core `_run_admin_retro_write_core` directly so the suite
runs without firebase_functions runtime / emulator. The core function is a
pure logic wrapper that the decorated callable `admin_retro_write` delegates
to; testing the core covers all decision branches.

Coverage (per WRITE-MVP-0 spec):
  - retro 0 write allowed
  - empty / null / undefined retro blocked
  - invalid ISIN blocked
  - fund not found blocked (re-classification) and at write-time
  - duplicate same ISIN same retro → second copy WARNING (DUP_SAME_VALUE)
  - duplicate same ISIN different retro → all entries BLOCKED (DUP_CONFLICT)
  - presence of BLOCKED rows in lote → write aborts entirely
  - WARNING rows require explicit acknowledgement
  - reason required (≥3 chars), confirm required
  - update() targets ONLY manual.costs.retrocession
  - no fund creation (existence re-checked before write)
  - audit document is created with PASS/FAIL/SKIPPED entries
  - before/after captured in audit

Run with: `pytest functions_python/api/test_admin_retro_write.py -v`

Requires: pytest, firebase_functions in PYTHONPATH (already a runtime dep).
"""
import sys
import os
import math

import pytest

# Ensure the functions_python directory is on path so `services.admin_auth`
# and `api.endpoints_admin_console` resolve when running via pytest from repo root.
_FUNCTIONS_PYTHON_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..")
)
if _FUNCTIONS_PYTHON_DIR not in sys.path:
    sys.path.insert(0, _FUNCTIONS_PYTHON_DIR)

from api.endpoints_admin_console import (  # noqa: E402
    _normalize_retrocession_backend,
    _classify_row,
    _re_classify_for_write,
    _run_admin_retro_write_core,
)
from firebase_functions import https_fn  # noqa: E402


# ============================================================================
# Fixtures: in-memory Firestore mock
# ============================================================================

class _MockDocSnap:
    def __init__(self, data):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None


class _MockDocRef:
    def __init__(self, store, isin):
        self._store = store
        self._isin = isin
        self.id = isin  # audit_doc_ref.id uses this

    def get(self):
        return _MockDocSnap(self._store.funds.get(self._isin))

    def update(self, fields: dict):
        # Strict invariant: never auto-create. Caller must verify existence first.
        if self._isin not in self._store.funds:
            raise RuntimeError(
                f"update() called on non-existent fund {self._isin} — "
                "function should have re-checked existence first"
            )
        # Apply dotted-path updates to the in-memory document
        existing = self._store.funds[self._isin]
        for key, value in fields.items():
            self._store.update_log.append((self._isin, key, value))
            parts = key.split(".")
            cursor = existing
            for p in parts[:-1]:
                if p not in cursor or not isinstance(cursor[p], dict):
                    cursor[p] = {}
                cursor = cursor[p]
            cursor[parts[-1]] = value

    def set(self, data):
        # Audit collection uses set(); funds collection should NEVER reach this
        # in admin_retro_write. We allow set() on the audit collection only.
        if self._store.disallow_set_on_funds and self._isin.startswith("AUDIT_"):
            self._store.audit_docs[self._isin] = data
            return
        if self._store.disallow_set_on_funds:
            raise AssertionError(
                f"set() called on fund document {self._isin} — must use update()"
            )
        self._store.funds[self._isin] = data


class _MockColl:
    def __init__(self, store, name):
        self._store = store
        self._name = name
        if name == "admin_audit_log":
            self._counter_seed = "AUDIT_"
        else:
            self._counter_seed = ""

    def document(self, doc_id=None):
        if doc_id is None:
            # Auto-id (used by audit collection)
            self._store.audit_counter += 1
            new_id = f"{self._counter_seed}{self._store.audit_counter:06d}"
            return _MockDocRef(self._store, new_id)
        return _MockDocRef(self._store, doc_id)


class _MockStore:
    def __init__(self):
        self.funds: dict = {}
        self.audit_docs: dict = {}
        self.audit_counter = 0
        self.update_log: list = []
        self.disallow_set_on_funds = True

    def collection(self, name):
        return _MockColl(self, name)


@pytest.fixture
def store():
    return _MockStore()


SERVER_TS = "<SERVER_TIMESTAMP>"


def _row(isin, retro_raw, *, source="csv", cell_internal_value=None,
         cell_number_format=None, retro_parsed_client=None, row_number=1,
         nombre="Fondo X"):
    return {
        "isin": isin,
        "nombre": nombre,
        "retro_raw": retro_raw,
        "retro_parsed_client": retro_parsed_client,
        "source": source,
        "cell_internal_value": cell_internal_value,
        "cell_number_format": cell_number_format,
        "row_number": row_number,
    }


def _call_core(store, data, *, admin_email="oantiza@gmail.com", actor_uid="uid-1"):
    return _run_admin_retro_write_core(
        admin_email=admin_email,
        actor_uid=actor_uid,
        data=data,
        db=store,
        server_timestamp=SERVER_TS,
    )


# ============================================================================
# Pre-flight validation gates
# ============================================================================

def test_missing_confirm_rejected(store):
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {"rows": [], "reason": "test reason"})
    assert "confirm" in exc.value.message.lower()


def test_short_reason_rejected(store):
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {"rows": [], "reason": "ok", "confirm": True})
    assert "reason" in exc.value.message.lower()


def test_no_rows_rejected(store):
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {"rows": [], "reason": "valid reason", "confirm": True})
    assert "no rows" in exc.value.message.lower()


def test_too_many_rows_rejected(store):
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": [_row(f"ES{i:010d}", "0,80%") for i in range(501)],
            "reason": "valid reason",
            "confirm": True,
        })
    assert "too many" in exc.value.message.lower()


def test_invalid_source_rejected(store):
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": [_row("ES0137381036", "0,80%")],
            "reason": "valid reason",
            "confirm": True,
            "source": "fax",
        })
    assert "source" in exc.value.message.lower()


# ============================================================================
# Retro = 0 is valid
# ============================================================================

def test_retro_zero_is_written(store):
    store.funds["ES0137381036"] = {"name": "F0", "manual": {"costs": {"retrocession": 0.5}}}
    resp = _call_core(store, {
        "rows": [_row("ES0137381036", "0")],
        "reason": "actualizar a cero",
        "confirm": True,
        "source": "csv",
        "warning_acks": ["ES0137381036"],  # delta -0.5 triggers large-change WARNING
    })
    assert resp["writes_executed"] == 1
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 0
    # No other fields touched
    assert store.funds["ES0137381036"]["name"] == "F0"


def test_retro_zero_with_percent_format_is_written(store):
    store.funds["ES0137381036"] = {"name": "F0", "manual": {"costs": {"retrocession": 0.5}}}
    resp = _call_core(store, {
        "rows": [_row(
            "ES0137381036", "",
            source="xlsx",
            cell_internal_value=0,
            cell_number_format="0.00%",
        )],
        "reason": "from excel zero",
        "confirm": True,
        "source": "excel",
        "warning_acks": ["ES0137381036"],  # delta -0.5 triggers large-change WARNING
    })
    assert resp["writes_executed"] == 1
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 0


# ============================================================================
# Empty / null / invalid blocked
# ============================================================================

def test_empty_retro_blocks_lote(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": [_row("ES0137381036", "")],
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    assert "BLOCKED" in exc.value.message
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 0.5


def test_null_retro_blocks_lote(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    row = _row("ES0137381036", None)
    with pytest.raises(https_fn.HttpsError):
        _call_core(store, {
            "rows": [row],
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 0.5


def test_undefined_retro_blocks_lote(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    row = _row("ES0137381036", "")
    del row["retro_raw"]  # simulates undefined
    with pytest.raises(https_fn.HttpsError):
        _call_core(store, {
            "rows": [row],
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })


def test_invalid_isin_blocks_lote(store):
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": [_row("NOT_AN_ISIN", "0,80%")],
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    assert "BLOCKED" in exc.value.message


def test_negative_retro_blocks_lote(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    with pytest.raises(https_fn.HttpsError):
        _call_core(store, {
            "rows": [_row("ES0137381036", "-0.5")],
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })


def test_nan_retro_blocks_lote(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    with pytest.raises(https_fn.HttpsError):
        _call_core(store, {
            "rows": [_row(
                "ES0137381036", "",
                source="xlsx",
                cell_internal_value=float("nan"),
                cell_number_format="0.00%",
            )],
            "reason": "test",
            "confirm": True,
            "source": "excel",
        })


# ============================================================================
# Fund not found
# ============================================================================

def test_fund_not_found_blocks_lote(store):
    # No funds in store
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": [_row("ES0137381036", "0,80%")],
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    assert "BLOCKED" in exc.value.message or "FUND_NOT_FOUND" in exc.value.message


def test_no_fund_creation_attempted(store):
    # store has no funds; lote blocked, no new fund should appear
    try:
        _call_core(store, {
            "rows": [_row("ES0137381036", "0,80%")],
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    except https_fn.HttpsError:
        pass
    assert "ES0137381036" not in store.funds


# ============================================================================
# Duplicates
# ============================================================================

def test_duplicate_same_value_warning_consolidated(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    rows = [
        _row("ES0137381036", "0,80%", row_number=2),
        _row("ES0137381036", "0,80%", row_number=3),
    ]
    # DUP_SAME_VALUE is a WARNING; without ack the write aborts
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": rows,
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    msg = exc.value.message.lower()
    assert "warning" in msg or "acuse" in msg
    # With ack the write proceeds (only one effective write because of UNCHANGED or single-write logic)
    resp = _call_core(store, {
        "rows": rows,
        "reason": "test",
        "confirm": True,
        "source": "csv",
        "warning_acks": ["ES0137381036"],
    })
    # The same value should result in one write that is idempotent.
    # writes_executed counts every WARNING/OK row that produced an update,
    # but UNCHANGED rows (existing 0.80 == new 0.80) are skipped.
    # In our case existing is 0.5 so first OK row writes, second is also flagged
    # as DUP_SAME_VALUE WARNING but new_retro is same so 2nd write attempt
    # finds existing == new and SKIPS as NO_OP_EQUAL_VALUE.
    assert resp["writes_executed"] >= 1
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 0.8


def test_duplicate_conflict_blocks_lote(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    rows = [
        _row("ES0137381036", "0,80%", row_number=2),
        _row("ES0137381036", "1,20%", row_number=3),
    ]
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": rows,
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    assert "BLOCKED" in exc.value.message
    # Fund untouched
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 0.5


# ============================================================================
# Mixed: any BLOCKED aborts everything
# ============================================================================

def test_any_blocked_aborts_entire_lote(store):
    store.funds["ES0137381036"] = {"name": "A", "manual": {"costs": {"retrocession": 0.5}}}
    # Two OK + one BLOCKED → entire lote aborts
    rows = [
        _row("ES0137381036", "0,80%", row_number=2),
        _row("ES0000000000", "0,90%", row_number=3),  # fund not found → BLOCKED
    ]
    with pytest.raises(https_fn.HttpsError):
        _call_core(store, {
            "rows": rows,
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    # First fund untouched
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 0.5


# ============================================================================
# Warnings require explicit ack
# ============================================================================

def test_warning_requires_ack(store):
    # > 5 triggers WARNING in normalization
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    rows = [_row("ES0137381036", "7,50%")]
    with pytest.raises(https_fn.HttpsError) as exc:
        _call_core(store, {
            "rows": rows,
            "reason": "test",
            "confirm": True,
            "source": "csv",
        })
    assert "acuse" in exc.value.message.lower() or "warning" in exc.value.message.lower()


def test_warning_proceeds_with_ack(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    rows = [_row("ES0137381036", "7,50%")]
    resp = _call_core(store, {
        "rows": rows,
        "reason": "test",
        "confirm": True,
        "source": "csv",
        "warning_acks": ["ES0137381036"],
    })
    assert resp["writes_executed"] == 1
    assert store.funds["ES0137381036"]["manual"]["costs"]["retrocession"] == 7.5


# ============================================================================
# Only retrocession field updated
# ============================================================================

def test_only_retrocession_field_updated(store):
    store.funds["ES0137381036"] = {
        "name": "Important Fund",
        "isin": "ES0137381036",
        "asset_type": "EQUITY",
        "manual": {
            "costs": {"retrocession": 0.5, "ter": 1.2, "ongoing": 0.9},
            "notes": "preserve me",
        },
        "classification_v2": {"category": "X"},
    }
    resp = _call_core(store, {
        "rows": [_row("ES0137381036", "0,80%")],
        "reason": "preserve everything else",
        "confirm": True,
        "source": "csv",
        "warning_acks": ["ES0137381036"],  # delta +0.3 but relative 60% triggers WARNING
    })
    assert resp["writes_executed"] == 1
    fund = store.funds["ES0137381036"]
    assert fund["manual"]["costs"]["retrocession"] == 0.8
    # Preserved fields
    assert fund["name"] == "Important Fund"
    assert fund["asset_type"] == "EQUITY"
    assert fund["manual"]["costs"]["ter"] == 1.2
    assert fund["manual"]["costs"]["ongoing"] == 0.9
    assert fund["manual"]["notes"] == "preserve me"
    assert fund["classification_v2"]["category"] == "X"
    # Update log shows ONLY the retrocession dotted key was touched
    assert all(key == "manual.costs.retrocession" for _, key, _ in store.update_log)


# ============================================================================
# Audit record
# ============================================================================

def test_audit_document_created(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    resp = _call_core(store, {
        "rows": [_row("ES0137381036", "0,80%")],
        "reason": "auditable change",
        "confirm": True,
        "source": "csv",
        "source_filename": "lote.csv",
        "dry_run_manifest_id": "manifest_xyz",
        "warning_acks": ["ES0137381036"],  # delta relative >= 50% triggers WARNING
    })
    audit_id = resp["audit_id"]
    assert audit_id in store.audit_docs
    audit = store.audit_docs[audit_id]
    assert audit["actor_email"] == "oantiza@gmail.com"
    assert audit["action"] == "admin_retro_write"
    assert audit["reason"] == "auditable change"
    assert audit["source"] == "csv"
    assert audit["source_filename"] == "lote.csv"
    assert audit["dry_run_manifest_id"] == "manifest_xyz"
    assert audit["writes_executed"] == 1
    assert audit["isins_updated"] == ["ES0137381036"]
    assert audit["timestamp"] == SERVER_TS


def test_audit_captures_before_and_after(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    resp = _call_core(store, {
        "rows": [_row("ES0137381036", "0,80%")],
        "reason": "captures before/after",
        "confirm": True,
        "source": "csv",
        "warning_acks": ["ES0137381036"],  # delta relative >= 50% triggers WARNING
    })
    audit = store.audit_docs[resp["audit_id"]]
    entries = audit["entries"]
    pass_entry = next(e for e in entries if e["result"] == "PASS")
    assert pass_entry["isin"] == "ES0137381036"
    assert pass_entry["previous"] == 0.5
    assert pass_entry["new"] == 0.8


def test_audit_includes_warning_acks(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
    resp = _call_core(store, {
        "rows": [_row("ES0137381036", "7,50%")],
        "reason": "high value with ack",
        "confirm": True,
        "source": "csv",
        "warning_acks": ["ES0137381036"],
    })
    audit = store.audit_docs[resp["audit_id"]]
    assert "ES0137381036" in audit["warning_acks"]
    assert audit["warning_count"] >= 1


# ============================================================================
# UNCHANGED rows are not written
# ============================================================================

def test_unchanged_row_is_skipped(store):
    store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.8}}}
    resp = _call_core(store, {
        "rows": [_row("ES0137381036", "0,80%")],
        "reason": "no-op same value",
        "confirm": True,
        "source": "csv",
    })
    # writes_planned counts OK+WARNING, but UNCHANGED rows are not in writes_to_apply
    # so writes_executed should be 0
    assert resp["unchanged_count"] == 1
    assert resp["writes_executed"] == 0


# ============================================================================
# Helper unit tests (normalize / classify)
# ============================================================================

class TestNormalizeBackend:
    def test_csv_0_is_ok(self):
        r = _normalize_retrocession_backend("0", None, None, "csv")
        assert r["value"] == 0 and r["status"] == "OK"

    def test_csv_080_pct_is_ok(self):
        r = _normalize_retrocession_backend("0,80%", None, None, "csv")
        assert math.isclose(r["value"], 0.8) and r["status"] == "OK"

    def test_csv_empty_is_missing(self):
        r = _normalize_retrocession_backend("", None, None, "csv")
        assert r["status"] == "MISSING"

    def test_csv_none_is_missing(self):
        r = _normalize_retrocession_backend(None, None, None, "csv")
        assert r["status"] == "MISSING"

    def test_csv_negative_is_invalid(self):
        r = _normalize_retrocession_backend("-0.5", None, None, "csv")
        assert r["status"] == "INVALID"

    def test_xlsx_format_only_no_size_heuristic(self):
        # 0.008 with % → 0.80
        r = _normalize_retrocession_backend(None, 0.008, "0.00%", "xlsx")
        assert math.isclose(r["value"], 0.8)
        # 0.50 with % → 50 (no size heuristic)
        r = _normalize_retrocession_backend(None, 0.5, "0.00%", "xlsx")
        assert r["value"] == 50
        # 0.80 without % → 0.80
        r = _normalize_retrocession_backend(None, 0.8, "General", "xlsx")
        assert math.isclose(r["value"], 0.8)


class TestReClassifyForWrite:
    def test_dup_same_value_marks_warning_on_extras(self, store):
        store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
        rows = [
            _row("ES0137381036", "0,80%", row_number=2),
            _row("ES0137381036", "0,80%", row_number=3),
        ]
        results, _, _ = _re_classify_for_write(rows, "test", store)
        statuses = [r["status"] for r in results]
        assert "WARNING" in statuses
        assert "BLOCKED" not in statuses

    def test_dup_conflict_blocks_all(self, store):
        store.funds["ES0137381036"] = {"name": "F", "manual": {"costs": {"retrocession": 0.5}}}
        rows = [
            _row("ES0137381036", "0,80%", row_number=2),
            _row("ES0137381036", "1,20%", row_number=3),
        ]
        results, _, _ = _re_classify_for_write(rows, "test", store)
        for r in results:
            assert r["status"] == "BLOCKED"
            assert "DUP" in r["reason"] or "INVALID" in r["status"]
