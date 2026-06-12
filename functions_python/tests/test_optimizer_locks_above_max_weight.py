"""FIX H1 (auditoria logica 2026-06-09) — locks por encima de max_weight.

Antes del fix, un peso bloqueado mayor que max_weight (caso cotidiano: bloquear
una posicion del 25-30% con MAX_WEIGHT_DEFAULT=0.20) era una contradiccion dura
en el solver: el precheck lo daba por viable, fallaban el objetivo y los dos
fallbacks y el resultado degradaba EN SILENCIO a equal-weight
(fallback_equal_weight), presentado al usuario como propuesta alternativa.

Contrato vigente: el lock PISA el bound por activo (techo = max(max_weight, fw))
en el EF principal, el EF post-expansion y los dos fallbacks; el solver resuelve
de forma OPTIMA manteniendo el lock y respetando max_weight en el resto.
"""
from unittest.mock import MagicMock

import numpy as np
import pandas as pd

import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.optimizer_core import _resolve_weight_bounds, run_optimization


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


def _prices(isins, periods=800):
    rng = np.random.default_rng(7)
    dates = pd.date_range("2022-01-03", periods=periods, freq="B")
    out = {}
    for idx, isin in enumerate(isins):
        rets = rng.normal(0.0003 + idx * 0.00002, 0.008 + idx * 0.0004, periods)
        out[isin] = pd.Series(100.0 * np.exp(np.cumsum(rets)), index=dates)
    return out


_UNIVERSE = [f"EQ{i}" for i in range(5)] + [f"BD{i}" for i in range(4)] + ["MM0"]


class _FakeFetcher:
    def __init__(self, db):
        self.db = db
        self._prices = _prices(_UNIVERSE)

    def get_price_data(self, assets, **kwargs):
        return ({isin: self._prices[isin] for isin in assets if isin in self._prices}, [])

    def get_dynamic_risk_free_rate(self):
        return 0.02


def _equity_meta():
    return {
        "classification_v2": {"asset_type": "EQUITY"},
        "portfolio_exposure_v2": {"asset_mix": {"equity": 1.0}},
    }


def _bond_meta():
    return {
        "classification_v2": {"asset_type": "FIXED_INCOME"},
        "portfolio_exposure_v2": {"asset_mix": {"bond": 1.0}},
    }


def _cash_meta():
    return {
        "classification_v2": {"asset_type": "MONEY_MARKET"},
        "portfolio_exposure_v2": {"asset_mix": {"cash": 1.0}},
    }


def _metadata():
    meta = {isin: _equity_meta() for isin in _UNIVERSE[:5]}
    meta.update({isin: _bond_meta() for isin in _UNIVERSE[5:9]})
    meta["MM0"] = _cash_meta()
    return meta


def _run(monkeypatch, *, lock_mode, positions, apply_profile, risk_level=5):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _FakeFetcher)
    return run_optimization(
        assets_list=list(_UNIVERSE),
        risk_level=risk_level,
        db=_readonly_dummy_db(),
        constraints={"apply_profile": apply_profile},
        constraints_v1={
            "objective": "min_vol",
            "construction": {"max_weight": 0.20, "cutoff": 0.0},
            "locks": {"mode": lock_mode, "positions": positions},
            "flags": {"apply_profile": apply_profile},
        },
        asset_metadata=_metadata(),
    )


# =========================================================================
# 1. Unidad: resolucion de cotas
# =========================================================================

def test_bounds_unchanged_without_locks():
    assert _resolve_weight_bounds(["A", "B"], 0.0, 0.2, "keep_weight", [], {}) == (0.0, 0.2)


def test_bounds_unchanged_when_lock_within_max():
    assert _resolve_weight_bounds(
        ["A", "B"], 0.0, 0.2, "keep_weight", ["A"], {"A": 0.15}
    ) == (0.0, 0.2)


def test_bounds_raised_for_lock_above_max():
    bounds = _resolve_weight_bounds(
        ["A", "B"], 0.0, 0.2, "keep_weight", ["A"], {"A": 0.30}
    )
    assert bounds == [(0.0, 0.30), (0.0, 0.2)]


def test_bounds_unchanged_in_free_mode():
    assert _resolve_weight_bounds(
        ["A", "B"], 0.0, 0.2, "free", ["A"], {"A": 0.30}
    ) == (0.0, 0.2)


def test_bounds_lower_floor_for_lock_below_min_weight():
    bounds = _resolve_weight_bounds(
        ["A", "B"], 0.05, 0.2, "keep_weight", ["A"], {"A": 0.0}
    )
    assert bounds == [(0.0, 0.2), (0.05, 0.2)]


# =========================================================================
# 2. End-to-end: lock 30% con max_weight 20% resuelve OPTIMO (no equal-weight)
# =========================================================================

def test_lock_above_max_weight_solves_optimally_without_profile(monkeypatch):
    result = _run(
        monkeypatch, lock_mode="keep_weight", positions={"EQ0": 0.30}, apply_profile=False
    )

    assert result["status"] == "optimal_compliant"
    assert result["solver_path"] == "min_vol_custom"
    assert result["explainability"]["solver_fallback_used"] is False
    assert abs(result["weights"]["EQ0"] - 0.30) < 1e-4
    others = [w for isin, w in result["weights"].items() if isin != "EQ0"]
    assert max(others) <= 0.20 + 1e-6


def test_lock_above_max_weight_solves_optimally_with_profile(monkeypatch):
    result = _run(
        monkeypatch, lock_mode="keep_weight", positions={"EQ0": 0.30}, apply_profile=True
    )

    assert result["status"] == "optimal_compliant"
    assert result["explainability"]["solver_fallback_used"] is False
    assert abs(result["weights"]["EQ0"] - 0.30) < 1e-4
    others = [w for isin, w in result["weights"].items() if isin != "EQ0"]
    assert max(others) <= 0.20 + 1e-6
    # Bandas del perfil 5 respetadas sobre exposicion agregada
    alloc = result["portfolio_allocation"]
    assert 0.40 - 1e-4 <= alloc["RV"] <= 0.60 + 1e-4
    assert 0.20 - 1e-4 <= alloc["RF"] <= 0.40 + 1e-4


def test_min_keep_above_max_weight_solves_optimally(monkeypatch):
    result = _run(
        monkeypatch, lock_mode="min_keep", positions={"EQ0": 0.25}, apply_profile=False
    )

    assert result["status"] == "optimal_compliant"
    assert result["explainability"]["solver_fallback_used"] is False
    assert result["weights"]["EQ0"] >= 0.25 - 1e-4


def test_lock_within_max_weight_keeps_previous_behavior(monkeypatch):
    result = _run(
        monkeypatch, lock_mode="keep_weight", positions={"EQ0": 0.15}, apply_profile=False
    )

    assert result["status"] == "optimal_compliant"
    assert abs(result["weights"]["EQ0"] - 0.15) < 1e-4
    assert max(result["weights"].values()) <= 0.20 + 1e-6
