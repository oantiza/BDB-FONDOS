from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.config import RISK_TARGETS
from services.portfolio.constraints_builder_v1 import build_constraints_v1
from services.portfolio.optimizer_core import (
    _apply_standard_constraints,
    _build_exposure_vectors,
    _build_profile_bucket_vectors,
)


def _make_ef_mock():
    ef = MagicMock()
    ef.tickers = ["EQ", "BD", "CS"]
    ef._constraints_added = []

    def _track_constraint(fn):
        ef._constraints_added.append(fn)

    ef.add_constraint.side_effect = _track_constraint
    return ef


def _make_vectors():
    eq_v = np.array([1.0, 0.0, 0.0])
    bd_v = np.array([0.0, 1.0, 0.0])
    cs_v = np.array([0.0, 0.0, 1.0])
    al_v = np.zeros(3)
    ra_v = np.zeros(3)
    ot_v = np.zeros(3)
    return eq_v, bd_v, cs_v, al_v, ra_v, ot_v


def test_profile_id_is_canonical_over_profile_risk_level_when_both_present():
    constraints = build_constraints_v1(
        profile={"risk_level": "3"},
        optimization_mode=None,
        locked_positions=None,
        tactical_views=None,
        overrides={"profile_id": "7"},
    )

    assert constraints.profile_id == "7"
    assert constraints.risk_budget.target_vol == pytest.approx(RISK_TARGETS[7])


def test_optimization_mode_priority_is_documented():
    direct_mode = build_constraints_v1(
        profile={},
        optimization_mode="max_sharpe",
        locked_positions=None,
        tactical_views=None,
        overrides={"optimization_mode": "min_vol"},
    )
    override_mode = build_constraints_v1(
        profile={},
        optimization_mode=None,
        locked_positions=None,
        tactical_views=None,
        overrides={"optimization_mode": "min_vol"},
    )

    assert direct_mode.optimization_mode == "max_sharpe"
    assert direct_mode.objective == "max_sharpe"
    assert override_mode.optimization_mode == "min_vol"
    assert override_mode.objective == "min_vol"


def test_locked_positions_supersede_legacy_fixed_weights_contract():
    constraints = build_constraints_v1(
        profile={},
        optimization_mode=None,
        locked_positions={"mode": "min_keep", "positions": {"LOCKED_A": 25, "LOCKED_B": 0.4}},
        tactical_views=None,
        overrides={
            "fixed_weights": {"LEGACY_ONLY": 0.75},
            "lock_mode": "keep_money",
        },
    )

    assert constraints.locks.mode == "min_keep"
    assert constraints.locks.positions == {
        "LOCKED_A": pytest.approx(0.25),
        "LOCKED_B": pytest.approx(0.4),
    }
    assert "LEGACY_ONLY" not in constraints.locks.positions


def test_legacy_fixed_weights_are_compatibility_fallback_only():
    constraints = build_constraints_v1(
        profile={},
        optimization_mode=None,
        locked_positions=None,
        tactical_views=None,
        overrides={
            "fixed_weights": {"LEGACY_LOCK": 50},
            "lock_mode": "keep_money",
        },
    )

    assert constraints.locks.mode == "keep_money"
    assert constraints.locks.positions == {"LEGACY_LOCK": pytest.approx(0.5)}


def test_bucket_bounds_v1_is_solver_constraint_source_and_ignores_mixto_keys():
    ef = _make_ef_mock()
    eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

    _apply_standard_constraints(
        ef_inst=ef,
        constraints={},
        lock_mode="free",
        apply_profile=True,
        risk_level_i=5,
        locked_assets=[],
        fixed_weights={},
        asset_metadata={},
        current_risk_buckets={
            5: {
                "RV": {"min": 0.1, "max": 0.9},
                "RF": {"min": 0.1, "max": 0.9},
                "Mixto": {"min": 0.9, "max": 1.0},
            }
        },
        eq_v=eq_v,
        bd_v=bd_v,
        cs_v=cs_v,
        al_v=al_v,
        ra_v=ra_v,
        ot_v=ot_v,
        bucket_bounds_v1={
            "equity": {"min": 0.4, "max": 0.8},
            "Mixto": {"min": 0.9, "max": 1.0},
            "mixed": {"min": 0.9, "max": 1.0},
        },
    )

    assert ef.add_constraint.call_count == 2


def test_current_risk_buckets_is_not_duplicate_solver_constraint_when_v1_active():
    ef = _make_ef_mock()
    eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

    _apply_standard_constraints(
        ef_inst=ef,
        constraints={},
        lock_mode="free",
        apply_profile=True,
        risk_level_i=5,
        locked_assets=[],
        fixed_weights={},
        asset_metadata={},
        current_risk_buckets={
            5: {
                "RV": {"min": 0.1, "max": 0.9},
                "RF": {"min": 0.1, "max": 0.9},
                "Monetario": {"min": 0.0, "max": 0.9},
                "Alternativos": {"min": 0.0, "max": 0.9},
                "Otros": {"min": 0.0, "max": 0.9},
                "Mixto": {"min": 0.2, "max": 0.5},
            }
        },
        eq_v=eq_v,
        bd_v=bd_v,
        cs_v=cs_v,
        al_v=al_v,
        ra_v=ra_v,
        ot_v=ot_v,
        bucket_bounds_v1={"equity": {"min": 0.4, "max": None}},
    )

    assert ef.add_constraint.call_count == 1


def test_portfolio_exposure_v2_asset_mix_overrides_classification_for_solver():
    asset_metadata = {
        "COMMERCIAL_EQUITY": {
            "classification_v2": {
                "asset_type": "EQUITY",
                "asset_subtype": "GLOBAL_EQUITY",
                "risk_bucket": "MEDIUM",
            },
            "portfolio_exposure_v2": {
                "asset_mix": {"equity": 0.0, "bond": 1.0, "cash": 0.0, "other": 0.0},
            },
        }
    }

    eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _build_exposure_vectors(["COMMERCIAL_EQUITY"], asset_metadata)

    assert eq_v[0] == pytest.approx(0.0)
    assert bd_v[0] == pytest.approx(1.0)
    assert cs_v[0] == pytest.approx(0.0)


def test_classification_v2_remains_reporting_or_suitability_metadata_not_solver_bucket():
    asset_metadata = {
        "MIXED_LOOKTHROUGH": {
            "classification_v2": {
                "asset_type": "MIXED",
                "asset_subtype": "MODERATE_ALLOCATION",
                "risk_bucket": "MEDIUM",
            },
            "portfolio_exposure_v2": {
                "asset_mix": {"equity": 0.35, "bond": 0.55, "cash": 0.10, "other": 0.0},
            },
        }
    }

    eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _build_exposure_vectors(["MIXED_LOOKTHROUGH"], asset_metadata)
    profile_vectors = _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v)

    assert profile_vectors["RV"][0] == pytest.approx(0.35)
    assert profile_vectors["RF"][0] == pytest.approx(0.55)
    assert profile_vectors["Monetario"][0] == pytest.approx(0.10)
    assert "Mixto" not in profile_vectors


def test_economic_exposure_is_fallback_not_primary_when_asset_mix_exists():
    asset_metadata = {
        "HAS_BOTH": {
            "classification_v2": {
                "asset_type": "MIXED",
                "asset_subtype": "MODERATE_ALLOCATION",
                "risk_bucket": "MEDIUM",
            },
            "portfolio_exposure_v2": {
                "asset_mix": {"equity": 0.2, "bond": 0.8, "cash": 0.0, "other": 0.0},
                "economic_exposure": {"equity": 0.9, "bond": 0.1, "cash": 0.0, "other": 0.0},
            },
        }
    }

    eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _build_exposure_vectors(["HAS_BOTH"], asset_metadata)

    assert eq_v[0] == pytest.approx(0.2)
    assert bd_v[0] == pytest.approx(0.8)
