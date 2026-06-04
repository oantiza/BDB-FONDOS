from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.optimizer_core import _evaluate_vol_band, run_optimization


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
    return {
        isin: pd.Series(
            100.0 * np.cumprod(np.full(periods, 1.0001 + idx * 0.00001)),
            index=dates,
        )
        for idx, isin in enumerate(isins)
    }


class _FakeFetcher:
    def __init__(self, db):
        self.db = db
        self._price_data = _prices_for(["A", "B"])

    def get_price_data(self, assets, **kwargs):
        return ({isin: self._price_data[isin] for isin in assets}, False)

    def get_dynamic_risk_free_rate(self):
        return 0.02


class _FixedCleanWeights:
    def clean_weights(self, cutoff=0.0):
        return {"A": 0.5, "B": 0.5}


def _run_with_band(monkeypatch, *, strict_feasibility: bool, achieved_vol: float):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _FakeFetcher)
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda mu, s: [])
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (
            _FixedCleanWeights(),
            {"A": 0.5, "B": 0.5},
            "min_vol_custom",
            {},
        ),
    )
    monkeypatch.setattr(
        optimizer_core,
        "calculate_portfolio_metrics",
        lambda *args, **kwargs: {
            "return": 0.05,
            "volatility": achieved_vol,
            "sharpe": 0.3,
        },
    )

    return run_optimization(
        assets_list=["A", "B"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={
            "apply_profile": False,
            "objective": "min_vol",
            "max_weight": 1.0,
            "cutoff": 0.0,
        },
        constraints_v1={
            "objective": "min_vol",
            "construction": {"max_weight": 1.0, "cutoff": 0.0},
            "risk_budget": {
                "target_vol": 0.08,
                "vol_band": {"min": 0.06, "max": 0.10},
            },
            "flags": {
                "apply_profile": False,
                "strict_feasibility": strict_feasibility,
            },
        },
        asset_metadata={},
    )


def test_vol_band_is_audited_as_soft_warning_by_default():
    result = _evaluate_vol_band(
        0.12,
        {"target_vol": 0.08, "vol_band": {"min": 0.06, "max": 0.10}},
    )

    assert result["configured"] is True
    assert result["compliant"] is False
    assert result["enforcement"] == "soft_warning"
    assert result["violations"] == []
    assert result["warnings"] == ["VOL_BAND_MAX_VIOLATION"]


def test_vol_band_is_hard_final_check_in_strict_mode():
    result = _evaluate_vol_band(
        0.04,
        {"target_vol": 0.08, "vol_band": {"min": 0.06, "max": 0.10}},
        strict_feasibility=True,
    )

    assert result["configured"] is True
    assert result["compliant"] is False
    assert result["enforcement"] == "strict_postcheck"
    assert result["warnings"] == []
    assert result["violations"][0]["code"] == "VOL_BAND_MIN_VIOLATION"


def test_non_strict_outside_vol_band_remains_usable_with_warning(monkeypatch):
    result = _run_with_band(monkeypatch, strict_feasibility=False, achieved_vol=0.12)

    assert result["status"] == "optimal_with_warnings"
    assert result["applicable"] is True
    assert result["usable"] is True
    assert result["violations"] == []
    assert "VOL_BAND_MAX_VIOLATION" in result["warnings"]
    assert result["metrics"]["vol_band_compliant"] is False
    assert result["metrics"]["vol_band_enforcement"] == "soft_warning"
    assert result["explainability"]["volatility_compliance"]["compliant"] is False


def test_strict_outside_vol_band_is_non_compliant(monkeypatch):
    result = _run_with_band(monkeypatch, strict_feasibility=True, achieved_vol=0.12)

    assert result["status"] == "optimal_non_compliant"
    assert result["applicable"] is False
    assert result["usable"] is False
    assert any(v["code"] == "VOL_BAND_MAX_VIOLATION" for v in result["violations"])
    assert result["metrics"]["vol_band_compliant"] is False
    assert result["metrics"]["vol_band_enforcement"] == "strict_postcheck"
    assert "volatilidad m" in result["message"].lower()


@pytest.mark.parametrize("achieved_vol", [0.06, 0.08, 0.10])
def test_vol_band_boundaries_are_compliant(achieved_vol):
    result = _evaluate_vol_band(
        achieved_vol,
        {"target_vol": 0.08, "vol_band": {"min": 0.06, "max": 0.10}},
        strict_feasibility=True,
    )

    assert result["compliant"] is True
    assert result["violations"] == []
    assert result["warnings"] == []
