"""FIX lote 2 (auditoria logica 2026-06-09) — resiliencia H5/H6/H7/H8/H9 + H12 parcial.

- H5: _as_fraction alinea su umbral %/fraccion con el resto del backend (>1.0).
- H6: la fuente de los perfiles de riesgo se hace visible (risk_profiles_source)
  y existe comparador read-only seed vs canonico (scripts/audit).
- H7: el feature flag usa last-known-good ante fallos de lectura.
- H8: sin banda de volatilidad sintetica (+-2pp) para perfiles 8-10.
- H9: el precheck legacy reconoce las claves canonicas de los bounds del perfil.
- H12: alias 'frontier' y claves applicable/usable/metrics en retornos bloqueados.
"""
import importlib.util
from pathlib import Path
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

import services.feature_flags as feature_flags
import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.constraints_builder_v1 import build_constraints_v1
from services.portfolio.optimizer_core import _build_optimization_context, run_optimization
from services.portfolio.utils import _as_fraction


def _readonly_dummy_db() -> MagicMock:
    db = MagicMock()
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {str(k): v for k, v in RISK_BUCKETS_LABELS.items()}
    document = MagicMock()
    document.get.return_value = doc
    collection = MagicMock()
    collection.document.return_value = document
    db.collection.return_value = collection
    return db


# =========================================================================
# H5 — umbral %/fraccion
# =========================================================================

def test_h5_percent_values_in_former_ambiguous_band_read_as_percent():
    assert _as_fraction(1.2) == pytest.approx(0.012)
    assert _as_fraction(1.5) == pytest.approx(0.015)
    assert _as_fraction(45) == pytest.approx(0.45)


def test_h5_fraction_values_unchanged():
    assert _as_fraction(0.45) == pytest.approx(0.45)
    assert _as_fraction(1.0) == pytest.approx(1.0)
    assert _as_fraction(0.0) == 0.0


# =========================================================================
# H7 — last-known-good del feature flag
# =========================================================================

class _RaisingDB:
    def collection(self, name):
        raise RuntimeError("firestore caido")


class _FlagDB:
    def __init__(self, value):
        self._value = value

    def collection(self, name):
        outer = self

        class _Doc:
            def get(self_inner):
                snap = MagicMock()
                snap.exists = True
                snap.to_dict.return_value = {"unified_constraints": outer._value}
                return snap

        class _Col:
            def document(self_inner, doc_id):
                return _Doc()

        return _Col()


def test_h7_read_failure_uses_last_known_good(monkeypatch):
    monkeypatch.delenv("UNIFIED_CONSTRAINTS", raising=False)
    feature_flags.reset_unified_constraints_cache()
    assert feature_flags.unified_constraints_enabled(_FlagDB(True)) is True
    # Fallo transitorio: conserva la ultima lectura valida (antes: False).
    assert feature_flags.unified_constraints_enabled(_RaisingDB()) is True
    feature_flags.reset_unified_constraints_cache()


def test_h7_read_failure_without_cache_defaults_off(monkeypatch):
    monkeypatch.delenv("UNIFIED_CONSTRAINTS", raising=False)
    feature_flags.reset_unified_constraints_cache()
    assert feature_flags.unified_constraints_enabled(_RaisingDB()) is False
    feature_flags.reset_unified_constraints_cache()


def test_h7_env_override_still_wins(monkeypatch):
    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "0")
    feature_flags.reset_unified_constraints_cache()
    assert feature_flags.unified_constraints_enabled(_FlagDB(True)) is False
    feature_flags.reset_unified_constraints_cache()


# =========================================================================
# H6 — fuente de perfiles visible + comparador de drift
# =========================================================================

def test_h6_context_reports_firestore_source(monkeypatch):
    monkeypatch.delenv("UNIFIED_CONSTRAINTS", raising=False)
    feature_flags.reset_unified_constraints_cache()
    (_ap, _mode, _lock, _fw, buckets, _floor, source) = _build_optimization_context(
        _readonly_dummy_db(), {}
    )
    assert source == "firestore:risk_profiles"
    assert set(buckets.keys()) == set(range(1, 11))
    feature_flags.reset_unified_constraints_cache()


def test_h6_context_reports_seed_fallback_on_read_error(monkeypatch):
    monkeypatch.delenv("UNIFIED_CONSTRAINTS", raising=False)
    feature_flags.reset_unified_constraints_cache()
    (_ap, _mode, _lock, _fw, buckets, _floor, source) = _build_optimization_context(
        _RaisingDB(), {}
    )
    assert source == "seed_fallback_read_error"
    assert buckets == RISK_BUCKETS_LABELS
    feature_flags.reset_unified_constraints_cache()


def _load_drift_module():
    path = (
        Path(__file__).resolve().parents[1]
        / "scripts" / "audit" / "check_risk_profiles_seed_drift.py"
    )
    spec = importlib.util.spec_from_file_location("seed_drift", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_h6_drift_comparator_detects_divergences():
    mod = _load_drift_module()
    seed = {9: {"RV": (0.95, 1.0), "Monetario": (0.0, 0.0)}}
    live = {"9": {"RV": [0.90, 1.0], "Monetario": [0, 0.06]}}
    drifts = mod.compare_profiles(seed, live)
    assert {(d["profile"], d["bucket"]) for d in drifts} == {("9", "RV"), ("9", "Monetario")}


def test_h6_drift_comparator_clean_when_equal():
    mod = _load_drift_module()
    seed = {5: {"RV": (0.4, 0.6)}}
    live = {"5": {"RV": [0.4, 0.6]}}
    assert mod.compare_profiles(seed, live) == []


# =========================================================================
# H8 — sin banda sintetica para perfiles 8-10
# =========================================================================

def test_h8_no_synthetic_vol_band_for_aggressive_profiles():
    for pid in ("8", "9", "10"):
        c = build_constraints_v1(
            profile={"profile_id": pid},
            optimization_mode="rebalance_to_profile",
            locked_positions=None,
            tactical_views=None,
            overrides={},
        )
        assert c.objective == "max_sharpe"
        assert c.risk_budget.vol_band.min is None
        assert c.risk_budget.vol_band.max is None


def test_h8_default_vol_band_kept_for_profiles_1_to_7():
    c = build_constraints_v1(
        profile={"profile_id": "5"},
        optimization_mode="rebalance_to_profile",
        locked_positions=None,
        tactical_views=None,
        overrides={},
    )
    assert c.risk_budget.vol_band.min == pytest.approx(0.085)
    assert c.risk_budget.vol_band.max == pytest.approx(0.125)


def test_h8_explicit_vol_band_still_honored_for_aggressive():
    c = build_constraints_v1(
        profile={"profile_id": "10"},
        optimization_mode="rebalance_to_profile",
        locked_positions=None,
        tactical_views=None,
        overrides={"vol_band": {"min": 0.15, "max": 0.35}},
    )
    assert c.risk_budget.vol_band.min == pytest.approx(0.15)
    assert c.risk_budget.vol_band.max == pytest.approx(0.35)


# =========================================================================
# H9 — precheck legacy con claves canonicas (+ H12 alias frontier)
# =========================================================================

def _prices(isins, periods=800):
    rng = np.random.default_rng(11)
    dates = pd.date_range("2022-01-03", periods=periods, freq="B")
    return {
        isin: pd.Series(
            100.0 * np.exp(np.cumsum(rng.normal(0.0003, 0.006, periods))),
            index=dates,
        )
        for isin in isins
    }


_H9_UNIVERSE = [f"BD{i}" for i in range(5)] + ["MIX0"]


class _H9Fetcher:
    def __init__(self, db):
        self.db = db
        self._prices = _prices(_H9_UNIVERSE)

    def get_price_data(self, assets, **kwargs):
        return ({i: self._prices[i] for i in assets if i in self._prices}, [])

    def get_dynamic_risk_free_rate(self):
        return 0.02


def _bond_meta():
    return {
        "classification_v2": {"asset_type": "FIXED_INCOME"},
        "portfolio_exposure_v2": {"asset_mix": {"bond": 1.0}},
    }


def _mixed_meta():
    return {
        "classification_v2": {"asset_type": "MIXED"},
        "portfolio_exposure_v2": {"asset_mix": {"equity": 0.4, "bond": 0.6}},
    }


def test_h9_legacy_precheck_blocks_unattainable_rv_min(monkeypatch):
    """Perfil 9 (RV min 95%) con universo de bonos + un mixto: max RV alcanzable
    = 8%. Antes del fix, el precheck legacy NO lo detectaba (claves desalineadas)
    y se llegaba al solver; ahora bloquea de forma determinista."""
    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "0")
    feature_flags.reset_unified_constraints_cache()
    monkeypatch.setattr(optimizer_core, "DataFetcher", _H9Fetcher)

    meta = {isin: _bond_meta() for isin in _H9_UNIVERSE[:5]}
    meta["MIX0"] = _mixed_meta()
    result = run_optimization(
        assets_list=list(_H9_UNIVERSE),
        risk_level=9,
        db=_readonly_dummy_db(),
        constraints={},
        asset_metadata=meta,
    )

    assert result["status"] == "infeasible_equity_floor"
    codes = [b["code"] for b in result["feasibility_precheck"]["blocks"]]
    assert "BLOCK_BUCKET_MIN_UNATTAINABLE" in codes
    block = next(
        b for b in result["feasibility_precheck"]["blocks"]
        if b["code"] == "BLOCK_BUCKET_MIN_UNATTAINABLE"
    )
    assert block["details"]["bucket"] == "RV"
    assert "Renta Variable" in block["message"]
    # H12: alias 'frontier' presente en el retorno bloqueado
    assert result["frontier"] == result["frontier_points"]
    feature_flags.reset_unified_constraints_cache()


def test_h6_success_path_exposes_risk_profiles_source(monkeypatch):
    """En un resultado de exito, explainability declara la fuente de la politica."""
    monkeypatch.delenv("UNIFIED_CONSTRAINTS", raising=False)
    feature_flags.reset_unified_constraints_cache()
    monkeypatch.setattr(optimizer_core, "DataFetcher", _H9Fetcher)

    meta = {isin: _bond_meta() for isin in _H9_UNIVERSE[:5]}
    meta["MIX0"] = _mixed_meta()
    result = run_optimization(
        assets_list=list(_H9_UNIVERSE),
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={"apply_profile": False},
        constraints_v1={
            "objective": "min_vol",
            "construction": {"max_weight": 0.5, "cutoff": 0.0},
            "flags": {"apply_profile": False},
        },
        asset_metadata=meta,
    )

    assert result["status"] == "optimal_compliant"
    assert result["explainability"]["risk_profiles_source"] == "firestore:risk_profiles"
    feature_flags.reset_unified_constraints_cache()
