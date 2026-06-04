from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

import services.portfolio.optimizer_core as optimizer_core
from services.portfolio.constraints_builder_v1 import build_constraints_v1
from services.portfolio.optimizer_core import _run_solver, run_optimization


def _solver_args(ef, *, strict_feasibility: bool) -> dict:
    zero = np.zeros(1)
    return {
        "ef": ef,
        "mu": pd.Series({"FUND": 0.05}),
        "S": pd.DataFrame([[0.01]], index=["FUND"], columns=["FUND"]),
        "constraints": {"objective": "min_vol"},
        "risk_level_i": 5,
        "rf_rate": 0.02,
        "max_weight": 1.0,
        "gamma": 1.0,
        "apply_profile": False,
        "universe": ["FUND"],
        "lock_mode": "free",
        "locked_assets": [],
        "fixed_weights": {},
        "asset_metadata": {},
        "current_risk_buckets": {},
        "eq_vec": zero,
        "bd_vec": zero,
        "cs_vec": zero,
        "al_vec": zero,
        "ra_vec": zero,
        "ot_vec": zero,
        "objective": "min_vol",
        "strict_feasibility": strict_feasibility,
    }


def test_constraints_builder_defaults_to_non_strict_for_compatibility():
    constraints = build_constraints_v1({}, "min_vol", None, None)

    assert constraints.flags.strict_feasibility is False


@pytest.mark.parametrize("raw", [True, "true", "1", "yes", "on"])
def test_constraints_builder_accepts_explicit_strict_opt_in(raw):
    constraints = build_constraints_v1(
        {},
        "min_vol",
        None,
        None,
        overrides={"strict_feasibility": raw},
    )

    assert constraints.flags.strict_feasibility is True


@pytest.mark.parametrize("raw", [False, None, 0, "false", "off", "unexpected"])
def test_constraints_builder_keeps_non_explicit_values_non_strict(raw):
    constraints = build_constraints_v1(
        {},
        "min_vol",
        None,
        None,
        overrides={"strict_feasibility": raw},
    )

    assert constraints.flags.strict_feasibility is False


def test_strict_feasibility_stops_before_fallbacks(monkeypatch):
    primary = MagicMock()
    primary.min_volatility.side_effect = RuntimeError("primary infeasible")
    fallback_constructor = MagicMock(
        side_effect=AssertionError("fallback must not be constructed")
    )
    monkeypatch.setattr(optimizer_core, "EfficientFrontier", fallback_constructor)

    _ef, raw_weights, solver_path, feasibility = _run_solver(
        **_solver_args(primary, strict_feasibility=True)
    )

    assert raw_weights is None
    assert solver_path == "infeasible_strict_feasibility"
    assert feasibility["objective"] == "min_vol"
    assert feasibility["strict_feasibility"] is True
    assert "primary infeasible" in feasibility["reason"]
    fallback_constructor.assert_not_called()


def test_non_strict_default_preserves_fallback_chain(monkeypatch):
    primary = MagicMock()
    primary.min_volatility.side_effect = RuntimeError("primary infeasible")
    fallback = MagicMock()
    fallback.max_sharpe.return_value = {"FUND": 1.0}
    monkeypatch.setattr(
        optimizer_core,
        "EfficientFrontier",
        MagicMock(return_value=fallback),
    )
    monkeypatch.setattr(
        optimizer_core,
        "_apply_standard_constraints",
        lambda *args, **kwargs: None,
    )

    _ef, raw_weights, solver_path, feasibility = _run_solver(
        **_solver_args(primary, strict_feasibility=False)
    )

    assert raw_weights == {"FUND": 1.0}
    assert solver_path == "fallback_relaxed_sharpe"
    assert feasibility["strict_feasibility"] is False
    fallback.max_sharpe.assert_called_once()


def test_run_optimization_threads_strict_flag_and_returns_non_applicable(monkeypatch):
    dates = pd.date_range("2021-01-01", periods=120, freq="B")
    df = pd.DataFrame(
        {"FUND": np.linspace(100.0, 110.0, len(dates))},
        index=dates,
    )
    fetcher = MagicMock()
    fetcher.get_dynamic_risk_free_rate.return_value = 0.02
    zero = np.zeros(1)
    captured: dict = {}

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
        lambda *args, **kwargs: None,
    )

    def fake_run_solver(*args, **kwargs):
        captured["strict_feasibility"] = kwargs["strict_feasibility"]
        return MagicMock(), None, "infeasible_strict_feasibility", {
            "status": "infeasible",
            "objective": "min_vol",
            "reason": "primary infeasible",
            "strict_feasibility": True,
        }

    monkeypatch.setattr(optimizer_core, "_run_solver", fake_run_solver)

    result = run_optimization(
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
            "flags": {"apply_profile": False, "strict_feasibility": True},
        },
        asset_metadata={},
    )

    assert captured["strict_feasibility"] is True
    assert result["status"] == "infeasible_constraints"
    assert result["solver_path"] == "infeasible_strict_feasibility"
    assert result["weights"] == {}
    assert result["applicable"] is False
    assert result["usable"] is False
    assert result["explainability"]["strict_feasibility"] is True
    assert result["explainability"]["fallbacks_disabled"] is True
