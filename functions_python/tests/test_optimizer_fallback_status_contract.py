from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.optimizer_core import run_optimization


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


def _prices_for(isins: list[str], periods: int = 800) -> dict[str, pd.Series]:
    dates = pd.date_range("2021-01-01", periods=periods, freq="B")
    data: dict[str, pd.Series] = {}
    for idx, isin in enumerate(isins):
        returns = np.full(periods, 0.0001 * (idx + 1), dtype=float)
        returns[::47] += 0.0005 * (idx + 1)
        data[isin] = pd.Series(100.0 * np.cumprod(1.0 + returns), index=dates)
    return data


def _fund_meta(asset_type: str, mix: dict[str, float]) -> dict:
    return {
        "classification_v2": {
            "asset_type": asset_type,
            "asset_subtype": "MODERATE_ALLOCATION" if asset_type == "MIXED" else "GLOBAL_BOND",
            "risk_bucket": "MEDIUM",
            "is_suitable_low_risk": asset_type != "EQUITY",
            "classification_confidence": 0.95,
        },
        "portfolio_exposure_v2": {
            "asset_mix": mix,
            "economic_exposure": mix,
        },
    }


class _FakeFetcher:
    def __init__(self, db):
        self.db = db
        self._price_data = _prices_for(["MIX", "BD"])

    def get_price_data(self, assets, **kwargs):
        return ({isin: self._price_data[isin] for isin in assets}, False)

    def get_dynamic_risk_free_rate(self):
        return 0.02


class _FakeCleanWeights:
    def clean_weights(self, cutoff=0.0):
        return {"MIX": 0.5, "BD": 0.5}


def test_fallback_status_is_not_reported_as_plain_optimal(monkeypatch):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _FakeFetcher)
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda mu, s: [])
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (_FakeCleanWeights(), {"MIX": 0.5, "BD": 0.5}, "fallback_equal_weight", {}),
    )

    result = run_optimization(
        assets_list=["MIX", "BD"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        constraints_v1={
            "construction": {"max_weight": 1.0, "cutoff": 0.0},
            "risk_budget": {"target_vol": 0.06},
        },
        asset_metadata={
            "MIX": _fund_meta("MIXED", {"equity": 0.5, "bond": 0.5, "cash": 0.0, "other": 0.0}),
            "BD": _fund_meta("FIXED_INCOME", {"equity": 0.0, "bond": 1.0, "cash": 0.0, "other": 0.0}),
        },
    )

    assert result["status"] == "fallback_compliant"
    assert result["applicable"] is True
    assert result["usable"] is True
    assert result["status"] != "optimal_compliant"
    assert result["explainability"]["solver_fallback_used"] is True
    assert "solver_fallback_used" in result["warnings"]


def test_target_achieved_volatility_fields_are_present_when_available(monkeypatch):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _FakeFetcher)
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda mu, s: [])
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (_FakeCleanWeights(), {"MIX": 0.5, "BD": 0.5}, "fallback_equal_weight", {}),
    )

    result = run_optimization(
        assets_list=["MIX", "BD"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        constraints_v1={
            "construction": {"max_weight": 1.0, "cutoff": 0.0},
            "risk_budget": {"target_vol": 0.06},
        },
        asset_metadata={
            "MIX": _fund_meta("MIXED", {"equity": 0.5, "bond": 0.5, "cash": 0.0, "other": 0.0}),
            "BD": _fund_meta("FIXED_INCOME", {"equity": 0.0, "bond": 1.0, "cash": 0.0, "other": 0.0}),
        },
    )

    metrics = result["metrics"]

    assert metrics["target_vol"] == 0.06
    assert "achieved_vol" in metrics
    assert "vol_deviation" in metrics
    assert metrics["vol_deviation"] == round(metrics["achieved_vol"] - metrics["target_vol"], 6)
