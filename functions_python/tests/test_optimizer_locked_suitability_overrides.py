from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.optimizer_core import (
    _apply_suitability_filter,
    _enrich_locked_suitability_overrides,
    run_optimization,
)


def _fund_meta(asset_type: str, mix: dict[str, float], *, suitable_low_risk: bool) -> dict:
    return {
        "classification_v2": {
            "asset_type": asset_type,
            "asset_subtype": {
                "EQUITY": "GLOBAL_EQUITY",
                "FIXED_INCOME": "GLOBAL_BOND",
                "MONEY_MARKET": "MONEY_MARKET",
            }[asset_type],
            "risk_bucket": "HIGH" if asset_type == "EQUITY" else "LOW",
            "is_suitable_low_risk": suitable_low_risk,
            "classification_confidence": 0.95,
        },
        "portfolio_exposure_v2": {
            "asset_mix": mix,
            "economic_exposure": mix,
        },
    }


UNSUITABLE_EQ = _fund_meta(
    "EQUITY",
    {"equity": 1.0, "bond": 0.0, "cash": 0.0, "other": 0.0},
    suitable_low_risk=False,
)
SUITABLE_BD = _fund_meta(
    "FIXED_INCOME",
    {"equity": 0.0, "bond": 1.0, "cash": 0.0, "other": 0.0},
    suitable_low_risk=True,
)
SUITABLE_CS = _fund_meta(
    "MONEY_MARKET",
    {"equity": 0.0, "bond": 0.0, "cash": 1.0, "other": 0.0},
    suitable_low_risk=True,
)


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
        self._price_data = _prices_for(["EQ", "BD", "CS"])

    def get_price_data(self, assets, **kwargs):
        return ({isin: self._price_data[isin] for isin in assets}, False)

    def get_dynamic_risk_free_rate(self):
        return 0.02


class _FixedCleanWeights:
    def clean_weights(self, cutoff=0.0):
        return {"EQ": 0.05, "BD": 0.35, "CS": 0.60}


def test_locked_unsuitable_asset_is_kept_and_disclosed():
    filtered, overrides = _apply_suitability_filter(
        ["EQ", "CS"],
        {"EQ": UNSUITABLE_EQ, "CS": SUITABLE_CS},
        risk_level=1,
        apply_profile=True,
        locked_assets=["EQ"],
        return_diagnostics=True,
    )

    assert filtered == ["EQ", "CS"]
    assert overrides == [{
        "isin": "EQ",
        "risk_profile": 1,
        "reason": "Fund flagged as not suitable for low risk. Type: equity, Subtype: GLOBAL_EQUITY",
        "override_source": "locked_asset",
    }]


def test_unlocked_unsuitable_asset_is_still_excluded():
    filtered = _apply_suitability_filter(
        ["EQ", "CS"],
        {"EQ": UNSUITABLE_EQ, "CS": SUITABLE_CS},
        risk_level=1,
        apply_profile=True,
        locked_assets=[],
    )

    assert filtered == ["CS"]


def test_locked_override_exposure_contribution_uses_final_weight():
    enriched = _enrich_locked_suitability_overrides(
        [{"isin": "EQ", "reason": "not suitable"}],
        {"EQ": 0.05},
        {"EQ": UNSUITABLE_EQ},
    )

    assert enriched[0]["final_weight"] == pytest.approx(0.05)
    assert enriched[0]["exposure_contribution"] == {"equity": pytest.approx(0.05)}


def test_optimizer_surfaces_locked_suitability_override_without_blocking(monkeypatch):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _FakeFetcher)
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda mu, s: [])
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (
            _FixedCleanWeights(),
            {"EQ": 0.05, "BD": 0.35, "CS": 0.60},
            "min_vol_custom",
            {},
        ),
    )
    monkeypatch.setattr(
        optimizer_core,
        "calculate_portfolio_metrics",
        lambda *args, **kwargs: {
            "return": 0.03,
            "volatility": 0.025,
            "sharpe": 0.4,
        },
    )

    result = run_optimization(
        assets_list=["EQ", "BD", "CS"],
        risk_level=1,
        db=_readonly_dummy_db(),
        constraints={
            "apply_profile": True,
            "objective": "min_vol",
            "max_weight": 1.0,
            "cutoff": 0.0,
            "lock_mode": "keep_weight",
            "fixed_weights": {"EQ": 0.05},
        },
        constraints_v1={
            "objective": "min_vol",
            "construction": {"max_weight": 1.0, "cutoff": 0.0},
            "locks": {"mode": "keep_weight", "positions": {"EQ": 0.05}},
        },
        asset_metadata={"EQ": UNSUITABLE_EQ, "BD": SUITABLE_BD, "CS": SUITABLE_CS},
        locked_assets=["EQ"],
    )

    assert result["status"] == "optimal_with_warnings"
    assert result["applicable"] is True
    assert result["usable"] is True
    assert "locked_suitability_override" in result["warnings"]
    assert result["locked_suitability_overrides"][0]["isin"] == "EQ"
    assert result["locked_suitability_overrides"][0]["final_weight"] == pytest.approx(0.05)
    assert result["locked_suitability_overrides"][0]["exposure_contribution"]["equity"] == pytest.approx(0.05)
    assert result["explainability"]["locked_suitability_overrides"] == result["locked_suitability_overrides"]
