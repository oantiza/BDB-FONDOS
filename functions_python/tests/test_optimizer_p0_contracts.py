from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.optimizer_core import run_optimization
from services.portfolio.suitability_engine import is_fund_eligible_for_profile
from services.portfolio.utils import _normalize


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
        returns[::53] += 0.001 * (idx + 1)
        data[isin] = pd.Series(100.0 * np.cumprod(1.0 + returns), index=dates)
    return data


def _fund_meta(asset_type: str, mix: dict[str, float]) -> dict:
    return {
        "classification_v2": {
            "asset_type": asset_type,
            "asset_subtype": "GLOBAL_EQUITY" if asset_type == "EQUITY" else "GLOBAL_BOND",
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
        self._price_data = _prices_for(["EQ", "BD"])

    def get_price_data(self, assets, **kwargs):
        return ({isin: self._price_data[isin] for isin in assets}, False)

    def get_dynamic_risk_free_rate(self):
        return 0.02


def test_opt1_t001_fallback_that_violates_bucket_bounds_is_non_compliant(monkeypatch):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _FakeFetcher)
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda mu, s: [])
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (None, None, "fallback_equal_weight", {}),
    )

    result = run_optimization(
        assets_list=["EQ", "BD"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        constraints_v1={
            "construction": {"max_weight": 1.0},
            "bucket_bounds": {"equity": {"min": 0.90, "max": 1.0}},
        },
        asset_metadata={
            "EQ": _fund_meta("EQUITY", {"equity": 100.0, "bond": 0.0, "cash": 0.0, "other": 0.0}),
            "BD": _fund_meta("FIXED_INCOME", {"equity": 0.0, "bond": 100.0, "cash": 0.0, "other": 0.0}),
        },
    )

    assert result["status"] == "fallback_non_compliant"
    assert result.get("applicable") is False or result.get("usable") is False
    assert result.get("violations") or result.get("lost_constraints")


def test_opt1_t003_missing_v2_exposure_is_not_silent_zero_equity():
    fund_without_exposure = {
        "isin": "NOEXP",
        "classification_v2": {
            "asset_type": "FIXED_INCOME",
            "asset_subtype": "GLOBAL_BOND",
            "risk_bucket": "LOW",
            "is_suitable_low_risk": True,
            "classification_confidence": 0.95,
        },
    }

    eligible, reason = is_fund_eligible_for_profile(fund_without_exposure, risk_profile=1)

    assert eligible is False
    assert "missing" in reason.lower()
    assert "exposure" in reason.lower()


def test_opt1_t004_negative_upstream_weights_do_not_survive_normalization():
    normalized = _normalize({"A": -0.25, "B": 1.25})

    assert all(weight >= 0.0 for weight in normalized.values())
    assert abs(sum(normalized.values()) - 1.0) < 1e-9


class _FakeCleanWeights:
    def clean_weights(self, cutoff=0.0):
        return {"REQ": 0.4, "AUTO": 0.6}


def test_opt1_t009_used_assets_weights_are_complete_when_universe_expands(monkeypatch):
    dates = pd.date_range("2021-01-01", periods=800, freq="B")
    df = pd.DataFrame(
        {
            "REQ": pd.Series(100.0 * np.cumprod(np.full(800, 1.0001)), index=dates),
            "AUTO": pd.Series(100.0 * np.cumprod(np.full(800, 1.0002)), index=dates),
        }
    )

    def fake_candidate_universe(*args, **kwargs):
        universe = ["REQ", "AUTO"]
        fetcher = MagicMock()
        fetcher.get_dynamic_risk_free_rate.return_value = 0.02
        zero = np.array([0.0, 0.0])
        return (
            fetcher,
            {},
            False,
            df,
            universe,
            [],
            np.array([0.4, 0.9]),
            np.array([0.5, 0.0]),
            np.array([0.1, 0.1]),
            zero,
            zero,
            zero,
        )

    monkeypatch.setattr(optimizer_core, "_build_candidate_universe", fake_candidate_universe)
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda mu, s: [])
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (_FakeCleanWeights(), {"REQ": 0.4, "AUTO": 0.6}, "max_sharpe_custom", {}),
    )

    result = run_optimization(
        assets_list=["REQ"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        asset_metadata={
            "REQ": _fund_meta("MIXED", {"equity": 40.0, "bond": 50.0, "cash": 10.0, "other": 0.0}),
            "AUTO": _fund_meta("EQUITY", {"equity": 90.0, "bond": 0.0, "cash": 10.0, "other": 0.0}),
        },
    )

    missing_weight_isins = set(result["used_assets"]) - set(result["weights"])
    assert not missing_weight_isins
    assert result["weights"]["AUTO"] > 0.0
