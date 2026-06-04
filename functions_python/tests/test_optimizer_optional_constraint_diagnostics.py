from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
import pandas as pd

import services.portfolio.optimizer_core as optimizer_core
from services.portfolio.optimizer_core import (
    _apply_standard_constraints,
    _postprocess_weights,
    _validate_optimizer_result,
    run_optimization,
)


def _constraint_args(ef, constraints):
    zero = np.zeros(1)
    return {
        "ef_inst": ef,
        "constraints": constraints,
        "lock_mode": "free",
        "apply_profile": False,
        "risk_level_i": 5,
        "locked_assets": [],
        "fixed_weights": {},
        "asset_metadata": {"FUND": {}},
        "current_risk_buckets": {},
        "eq_v": zero,
        "bd_v": zero,
        "cs_v": zero,
        "al_v": zero,
        "ra_v": zero,
        "ot_v": zero,
        "bucket_bounds_v1": {},
    }


def test_geo_failure_is_structured_and_other_geo_constraints_still_apply(monkeypatch):
    ef = MagicMock()
    ef.tickers = ["FUND"]

    def fake_group_vector(_universe, _metadata, _group_type, group_name):
        if group_name == "europe":
            raise ValueError("missing europe vector")
        return np.ones(1)

    monkeypatch.setattr(optimizer_core, "_build_group_vector", fake_group_vector)

    diagnostics = _apply_standard_constraints(
        **_constraint_args(ef, {"europe": 0.20, "americas": 0.70})
    )

    assert ef.add_constraint.call_count == 1
    assert diagnostics["applied_optional_constraints"][0]["group_name"] == "americas"
    assert diagnostics["skipped_constraints"] == [{
        "code": "GEO_CONSTRAINT_SKIPPED",
        "scope": "geo",
        "group_type": "regions",
        "group_name": "europe",
        "min": 0.20,
        "max": None,
        "reason": "missing europe vector",
    }]


def test_group_failure_is_structured_and_other_group_constraints_still_apply(monkeypatch):
    ef = MagicMock()
    ef.tickers = ["FUND"]

    def fake_group_vector(_universe, _metadata, _group_type, group_name):
        if group_name == "bad":
            raise ValueError("bad group vector")
        return np.ones(1)

    monkeypatch.setattr(optimizer_core, "_build_group_vector", fake_group_vector)

    diagnostics = _apply_standard_constraints(
        **_constraint_args(
            ef,
            {
                "group_limits": {
                    "sectors": {
                        "bad": {"max": 0.20},
                        "good": {"max": 0.50},
                    }
                }
            },
        )
    )

    assert ef.add_constraint.call_count == 1
    assert diagnostics["applied_optional_constraints"][0]["group_name"] == "good"
    assert diagnostics["skipped_constraints"][0]["code"] == "GROUP_CONSTRAINT_SKIPPED"
    assert diagnostics["skipped_constraints"][0]["group_name"] == "bad"
    assert diagnostics["skipped_constraints"][0]["reason"] == "bad group vector"


def test_requested_geo_constraint_without_metadata_is_not_silent():
    ef = MagicMock()
    ef.tickers = ["FUND"]
    args = _constraint_args(ef, {"europe": 0.20})
    args["asset_metadata"] = {}

    diagnostics = _apply_standard_constraints(**args)

    assert ef.add_constraint.call_count == 0
    assert diagnostics["skipped_constraints"][0]["code"] == "GEO_CONSTRAINT_SKIPPED"
    assert diagnostics["skipped_constraints"][0]["reason"] == "asset_metadata unavailable"


class _CleanWeights:
    def clean_weights(self, cutoff=0.0):
        return {"FUND": 1.0}


def _patch_run_pipeline(monkeypatch, diagnostics):
    dates = pd.date_range("2021-01-01", periods=120, freq="B")
    df = pd.DataFrame(
        {"FUND": np.linspace(100.0, 110.0, len(dates))},
        index=dates,
    )
    fetcher = MagicMock()
    fetcher.get_dynamic_risk_free_rate.return_value = 0.02
    zero = np.zeros(1)

    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "0")
    monkeypatch.setattr(
        optimizer_core,
        "_apply_suitability_filter",
        lambda assets, *_args: assets,
    )
    monkeypatch.setattr(
        optimizer_core,
        "_build_candidate_universe",
        lambda *args, **kwargs: (
            fetcher,
            {},
            False,
            df,
            ["FUND"],
            [],
            zero,
            np.ones(1),
            zero,
            zero,
            zero,
            zero,
        ),
    )
    monkeypatch.setattr(
        optimizer_core,
        "_build_expected_returns_and_cov",
        lambda *args, **kwargs: (
            pd.Series({"FUND": 0.05}),
            pd.DataFrame([[0.01]], index=["FUND"], columns=["FUND"]),
        ),
    )
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        optimizer_core,
        "_apply_standard_constraints",
        lambda *args, **kwargs: diagnostics,
    )


def _run_with_strict_flag(strict_feasibility: bool):
    return run_optimization(
        assets_list=["FUND"],
        risk_level=5,
        db=MagicMock(),
        constraints={
            "apply_profile": False,
            "objective": "min_vol",
            "max_weight": 1.0,
        },
        constraints_v1={
            "objective": "min_vol",
            "construction": {"max_weight": 1.0, "cutoff": 0.0},
            "flags": {
                "apply_profile": False,
                "strict_feasibility": strict_feasibility,
            },
        },
        asset_metadata={"FUND": {}},
    )


def test_strict_mode_blocks_when_an_optional_constraint_was_skipped(monkeypatch):
    diagnostics = {
        "applied_optional_constraints": [],
        "skipped_constraints": [{
            "code": "GEO_CONSTRAINT_SKIPPED",
            "scope": "geo",
            "group_type": "regions",
            "group_name": "europe",
            "reason": "missing vector",
        }],
    }
    _patch_run_pipeline(monkeypatch, diagnostics)
    run_solver = MagicMock(side_effect=AssertionError("solver must not run"))
    monkeypatch.setattr(optimizer_core, "_run_solver", run_solver)

    result = _run_with_strict_flag(True)

    assert result["status"] == "infeasible_constraints"
    assert result["solver_path"] == "blocked_skipped_constraints"
    assert result["applicable"] is False
    assert result["usable"] is False
    assert result["explainability"]["skipped_constraints"] == diagnostics["skipped_constraints"]
    run_solver.assert_not_called()


def test_non_strict_mode_surfaces_skipped_constraints_as_warning(monkeypatch):
    diagnostics = {
        "applied_optional_constraints": [],
        "skipped_constraints": [{
            "code": "GROUP_CONSTRAINT_SKIPPED",
            "scope": "group",
            "group_type": "sectors",
            "group_name": "technology",
            "reason": "missing vector",
        }],
    }
    _patch_run_pipeline(monkeypatch, diagnostics)
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (
            _CleanWeights(),
            {"FUND": 1.0},
            "min_vol_custom",
            {},
        ),
    )

    result = _run_with_strict_flag(False)

    assert result["status"] == "optimal_compliant"
    assert result["applicable"] is True
    assert "optional_constraints_skipped" in result["warnings"]
    assert result["explainability"]["skipped_constraints"] == diagnostics["skipped_constraints"]


def test_final_validation_rejects_applied_optional_constraint_violation(monkeypatch):
    monkeypatch.setattr(
        optimizer_core,
        "_build_group_vector",
        lambda *_args, **_kwargs: np.array([1.0, 0.0]),
    )
    zero = np.zeros(2)

    validation = _validate_optimizer_result(
        weights={"EU": 0.30, "US": 0.70},
        universe=["EU", "US"],
        apply_profile=False,
        risk_level_i=5,
        current_risk_buckets={},
        bucket_bounds_v1={},
        eq_v=zero,
        bd_v=zero,
        cs_v=zero,
        al_v=zero,
        ra_v=zero,
        ot_v=zero,
        asset_metadata={},
        applied_optional_constraints=[{
            "scope": "geo",
            "group_type": "regions",
            "group_name": "europe",
            "min": 0.40,
            "max": None,
        }],
    )

    assert validation["compliant"] is False
    assert validation["violations"] == [{
        "code": "OPTIONAL_CONSTRAINT_MIN_VIOLATION",
        "severity": "HIGH",
        "scope": "geo",
        "group_type": "regions",
        "group_name": "europe",
        "actual": 0.30,
        "min": 0.40,
    }]


def test_final_validation_rejects_applied_group_max_violation(monkeypatch):
    monkeypatch.setattr(
        optimizer_core,
        "_build_group_vector",
        lambda *_args, **_kwargs: np.array([1.0, 0.0]),
    )
    zero = np.zeros(2)

    validation = _validate_optimizer_result(
        weights={"TECH": 0.50, "OTHER": 0.50},
        universe=["TECH", "OTHER"],
        apply_profile=False,
        risk_level_i=5,
        current_risk_buckets={},
        bucket_bounds_v1={},
        eq_v=zero,
        bd_v=zero,
        cs_v=zero,
        al_v=zero,
        ra_v=zero,
        ot_v=zero,
        asset_metadata={},
        applied_optional_constraints=[{
            "scope": "group",
            "group_type": "sectors",
            "group_name": "technology",
            "min": None,
            "max": 0.40,
        }],
    )

    assert validation["compliant"] is False
    assert validation["violations"][0]["code"] == "OPTIONAL_CONSTRAINT_MAX_VIOLATION"
    assert validation["violations"][0]["scope"] == "group"
    assert validation["violations"][0]["actual"] == 0.50
    assert validation["violations"][0]["max"] == 0.40


class _CutoffBreaksGeoConstraint:
    def clean_weights(self, cutoff=0.0):
        return {"EU": 0.0, "US": 1.0}


def test_postprocess_restores_raw_weights_when_cutoff_breaks_optional_constraint(monkeypatch):
    monkeypatch.setattr(
        optimizer_core,
        "_build_group_vector",
        lambda *_args, **_kwargs: np.array([1.0, 0.0]),
    )
    zero = np.zeros(2)

    weights = _postprocess_weights(
        ef=_CutoffBreaksGeoConstraint(),
        raw_weights={"EU": 0.50, "US": 0.50},
        cutoff=0.60,
        universe=["EU", "US"],
        apply_profile=False,
        risk_level_i=5,
        current_risk_buckets={},
        eq_vec=zero,
        bd_vec=zero,
        cs_vec=zero,
        al_vec=zero,
        ra_vec=zero,
        ot_vec=zero,
        lock_mode="free",
        locked_assets=[],
        fixed_weights={},
        asset_metadata={},
        applied_optional_constraints=[{
            "scope": "geo",
            "group_type": "regions",
            "group_name": "europe",
            "min": 0.40,
            "max": None,
        }],
    )

    assert weights == {"EU": 0.50, "US": 0.50}


def test_equal_weight_fallback_that_loses_optional_constraint_is_non_applicable(monkeypatch):
    diagnostics = {
        "applied_optional_constraints": [{
            "scope": "geo",
            "group_type": "regions",
            "group_name": "europe",
            "min": 0.50,
            "max": None,
        }],
        "skipped_constraints": [],
    }
    _patch_run_pipeline(monkeypatch, diagnostics)
    monkeypatch.setattr(
        optimizer_core,
        "_build_group_vector",
        lambda *_args, **_kwargs: np.zeros(1),
    )
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (MagicMock(), None, "fallback_equal_weight", {}),
    )

    result = _run_with_strict_flag(False)

    assert result["status"] == "fallback_non_compliant"
    assert result["applicable"] is False
    assert result["usable"] is False
    assert result["constraint_violations"][0]["code"] == "OPTIONAL_CONSTRAINT_MIN_VIOLATION"
