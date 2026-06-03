from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.audit.shadow_compare_optimizer import (  # noqa: E402
    VERDICT_EXPECTED,
    VERDICT_FAIL,
    VERDICT_INVESTIGATE,
    VERDICT_PASS,
    compare_case_results,
    max_abs_diff,
    summarize,
)


def _case(has_override: bool = False, allow_equity_floor_status_diff: bool = False) -> dict:
    return {
        "id": "case",
        "constraints_v1": {"bucket_bounds": {"equity": {"min": 0.50}}} if has_override else {},
        "allow_equity_floor_status_diff": allow_equity_floor_status_diff,
    }


def _response(
    weights: dict[str, float] | None = None,
    allocation: dict[str, float] | None = None,
    status: str = "optimal_compliant",
    solver_path: str = "min_vol_custom",
    explainability: dict | None = None,
) -> dict:
    return {
        "status": status,
        "solver_path": solver_path,
        "applicable": status.endswith("compliant"),
        "usable": status.endswith("compliant"),
        "weights": weights or {"A": 0.5, "B": 0.5},
        "portfolio_allocation": allocation or {"RV": 0.5, "RF": 0.5},
        "metrics": {"return": 0.05, "volatility": 0.10, "sharpe": 0.50},
        "violations": [],
        "explainability": explainability or {},
    }


def test_identical_without_override_is_pass():
    result = compare_case_results(_case(), _response(), _response())
    assert result["verdict"] == VERDICT_PASS
    assert summarize([result]) == {"total": 1, "pass": 1, "expected_diff": 0, "fail": 0, "investigate": 0}


def test_weight_diff_without_override_is_fail():
    legacy = _response(weights={"A": 0.5, "B": 0.5})
    unified = _response(weights={"A": 0.7, "B": 0.3})
    result = compare_case_results(_case(), legacy, unified)
    assert result["verdict"] == VERDICT_FAIL
    assert result["weights_max_abs_diff"] == 0.2


def test_weight_diff_with_override_is_expected():
    legacy = _response(weights={"A": 0.5, "B": 0.5})
    unified = _response(
        weights={"A": 0.7, "B": 0.3},
        explainability={"effective_bounds": {"RV": {"min": 0.5, "max": 0.6}}},
    )
    result = compare_case_results(_case(has_override=True), legacy, unified)
    assert result["verdict"] == VERDICT_EXPECTED


def test_status_diff_due_to_equity_floor_is_expected():
    legacy = _response(status="optimal_compliant", weights={"A": 0.5, "B": 0.5})
    unified = _response(status="infeasible_equity_floor", weights={})
    result = compare_case_results(_case(allow_equity_floor_status_diff=True), legacy, unified)
    assert result["verdict"] == VERDICT_EXPECTED
    assert "equity_floor" in result["notes"]


def test_unexplained_status_diff_without_override_is_investigate():
    legacy = _response(status="optimal_compliant")
    unified = _response(status="fallback_compliant")
    result = compare_case_results(_case(), legacy, unified)
    assert result["verdict"] == VERDICT_INVESTIGATE


def test_error_status_is_investigate():
    legacy = _response()
    unified = _response(status="error")
    result = compare_case_results(_case(has_override=True), legacy, unified)
    assert result["verdict"] == VERDICT_INVESTIGATE


def test_max_abs_diff_uses_union_of_keys():
    assert max_abs_diff({"A": 0.4}, {"A": 0.1, "B": 0.2}) == pytest.approx(0.3)


def test_summary_counts_all_verdicts():
    results = [
        {"verdict": VERDICT_PASS},
        {"verdict": VERDICT_EXPECTED},
        {"verdict": VERDICT_FAIL},
        {"verdict": VERDICT_INVESTIGATE},
    ]
    assert summarize(results) == {"total": 4, "pass": 1, "expected_diff": 1, "fail": 1, "investigate": 1}
