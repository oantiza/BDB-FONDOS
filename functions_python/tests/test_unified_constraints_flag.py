"""REM-5A — Tests del resolver de lectura dual (ligero, sin stack pesado)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.feature_flags import (  # noqa: E402
    unified_constraints_enabled,
    resolve_risk_profiles_doc,
    RISK_PROFILES_DOC,
    RISK_PROFILES_STAGING_DOC,
)


class _Snap:
    def __init__(self, exists, data=None):
        self.exists = exists
        self._data = data or {}

    def to_dict(self):
        return self._data


class _DocRef:
    def __init__(self, snap):
        self._snap = snap

    def get(self):
        return self._snap


class _Collection:
    def __init__(self, docs):
        self._docs = docs

    def document(self, doc_id):
        return _DocRef(self._docs.get(doc_id, _Snap(False)))


class _DB:
    """Fake Firestore: docs es {doc_id: _Snap} dentro de system_settings."""
    def __init__(self, docs):
        self._docs = docs

    def collection(self, name):
        assert name == "system_settings"
        return _Collection(self._docs)


def _clear_env(monkeypatch):
    monkeypatch.delenv("UNIFIED_CONSTRAINTS", raising=False)


def test_flag_off_by_default_reads_canonical(monkeypatch):
    _clear_env(monkeypatch)
    db = _DB({"risk_profiles": _Snap(True, {"5": {}})})  # sin feature_flags doc
    assert unified_constraints_enabled(db) is False
    snap, source = resolve_risk_profiles_doc(db)
    assert source == RISK_PROFILES_DOC
    assert snap.exists is True


def test_flag_on_with_staging_reads_staging(monkeypatch):
    _clear_env(monkeypatch)
    db = _DB({
        "feature_flags": _Snap(True, {"unified_constraints": True}),
        "risk_profiles": _Snap(True, {"5": {}}),
        "risk_profiles_staging": _Snap(True, {"5": {}}),
    })
    assert unified_constraints_enabled(db) is True
    _snap, source = resolve_risk_profiles_doc(db)
    assert source == RISK_PROFILES_STAGING_DOC


def test_flag_on_without_staging_falls_back_to_canonical(monkeypatch):
    _clear_env(monkeypatch)
    db = _DB({
        "feature_flags": _Snap(True, {"unified_constraints": True}),
        "risk_profiles": _Snap(True, {"5": {}}),
        # sin risk_profiles_staging
    })
    _snap, source = resolve_risk_profiles_doc(db)
    assert source == RISK_PROFILES_DOC


def test_env_override_forces_on(monkeypatch):
    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "1")
    db = _DB({"risk_profiles_staging": _Snap(True, {"5": {}})})  # sin feature_flags doc
    assert unified_constraints_enabled(db) is True
    _snap, source = resolve_risk_profiles_doc(db)
    assert source == RISK_PROFILES_STAGING_DOC


def test_env_override_forces_off(monkeypatch):
    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "0")
    db = _DB({
        "feature_flags": _Snap(True, {"unified_constraints": True}),
        "risk_profiles_staging": _Snap(True, {"5": {}}),
    })
    assert unified_constraints_enabled(db) is False
    _snap, source = resolve_risk_profiles_doc(db)
    assert source == RISK_PROFILES_DOC
