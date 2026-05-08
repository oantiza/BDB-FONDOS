"""
Contract tests for mixed/allocation funds in the optimizer.

These tests document the current canonical policy:
- Mixto is a commercial/reporting label.
- The solver consumes real economic exposure/look-through vectors.
- Missing-exposure legacy fallbacks are identified, not fixed here.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.portfolio.optimizer_core import (
    _build_exposure_vectors,
    _build_profile_bucket_vectors,
)
from services.portfolio.utils import get_effective_asset_mix, get_profile_bucket_exposure


def _mixed_meta(asset_mix):
    return {
        "classification_v2": {
            "asset_type": "MIXED",
            "asset_subtype": "MODERATE_ALLOCATION",
            "risk_bucket": "MEDIUM",
            "is_suitable_low_risk": False,
            "classification_confidence": 0.95,
        },
        "portfolio_exposure_v2": {
            "asset_mix": asset_mix,
            "economic_exposure": asset_mix,
        },
    }


def test_mixed_fund_asset_mix_50_50_contributes_to_equity_and_bond():
    meta = {"MIX": _mixed_meta({"equity": 0.5, "bond": 0.5, "cash": 0.0, "other": 0.0})}

    eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _build_exposure_vectors(["MIX"], meta)
    profile_vectors = _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v)

    assert eq_v[0] == pytest.approx(0.5)
    assert bd_v[0] == pytest.approx(0.5)
    assert cs_v[0] == pytest.approx(0.0)
    assert profile_vectors["RV"][0] == pytest.approx(0.5)
    assert profile_vectors["RF"][0] == pytest.approx(0.5)
    assert "Mixto" not in profile_vectors


def test_commercial_classification_does_not_override_solver_exposure():
    fund = _mixed_meta({"equity": 0.8, "bond": 0.15, "cash": 0.05, "other": 0.0})

    mix = get_effective_asset_mix(fund)
    profile_exposure = get_profile_bucket_exposure(fund)

    assert fund["classification_v2"]["asset_type"] == "MIXED"
    assert mix["equity"] == pytest.approx(0.8)
    assert mix["bond"] == pytest.approx(0.15)
    assert profile_exposure["RV"] == pytest.approx(0.8)
    assert profile_exposure["RF"] == pytest.approx(0.15)
    assert "Mixto" not in profile_exposure


def test_mixed_fund_does_not_fall_to_otros_when_asset_mix_exists():
    fund = _mixed_meta({"equity": 0.35, "bond": 0.55, "cash": 0.10, "other": 0.0})

    mix = get_effective_asset_mix(fund)
    profile_exposure = get_profile_bucket_exposure(fund)

    assert mix["equity"] == pytest.approx(0.35)
    assert mix["bond"] == pytest.approx(0.55)
    assert mix["cash"] == pytest.approx(0.10)
    assert mix["other"] == pytest.approx(0.0)
    assert profile_exposure["Otros"] == pytest.approx(0.0)


def test_mixed_without_asset_mix_uses_documented_legacy_50_50_fallback():
    fund = {
        "label": "Mixto",
        "asset_class": "Mixto",
    }

    mix = get_effective_asset_mix(fund)
    profile_exposure = get_profile_bucket_exposure(fund)

    assert mix == {
        "equity": 0.5,
        "bond": 0.5,
        "cash": 0.0,
        "alternative": 0.0,
        "real_asset": 0.0,
        "other": 0.0,
    }
    assert profile_exposure["RV"] == pytest.approx(0.5)
    assert profile_exposure["RF"] == pytest.approx(0.5)
    assert "Mixto" not in profile_exposure
