from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import scripts.audit.shadow_compare_optimizer as shadow  # noqa: E402
from scripts.audit.shadow_compare_optimizer import (  # noqa: E402
    VERDICT_EXPECTED,
    VERDICT_FAIL,
    VERDICT_INVESTIGATE,
    VERDICT_PASS,
    build_live_cases,
    check_live_preflight,
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
        "weights": {"A": 0.5, "B": 0.5} if weights is None else weights,
        "portfolio_allocation": {"RV": 0.5, "RF": 0.5} if allocation is None else allocation,
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
    unified = _response(status="infeasible_equity_floor", weights={}, allocation={})
    result = compare_case_results(_case(allow_equity_floor_status_diff=True), legacy, unified)
    assert result["verdict"] == VERDICT_EXPECTED
    assert "equity_floor" in result["notes"]


def test_status_diff_due_to_equity_floor_with_material_weight_diff_is_fail():
    legacy = _response(
        status="optimal_compliant",
        weights={"A": 0.5, "B": 0.5},
        allocation={"RV": 0.5, "RF": 0.5},
    )
    unified = _response(
        status="fallback_compliant",
        weights={"A": 0.8, "B": 0.2},
        allocation={"RV": 0.8, "RF": 0.2},
    )
    result = compare_case_results(_case(allow_equity_floor_status_diff=True), legacy, unified)
    assert result["verdict"] == VERDICT_FAIL
    assert result["weights_max_abs_diff"] == 0.3


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


def _profiles_doc() -> dict:
    return {"5": {"buckets": {"RV": {"min": 0.35, "max": 0.60}}}}


def _settings_db(risk_profiles: dict | None = None, staging: dict | None = None):
    docs = {
        "risk_profiles": shadow._Snap(True, risk_profiles or _profiles_doc()),
        "feature_flags": shadow._Snap(True, {"unified_constraints": False}),
    }
    if staging is not None:
        docs["risk_profiles_staging"] = shadow._Snap(True, staging)
    return shadow._DB(docs)


def test_live_preflight_passes_when_profiles_match():
    profiles = _profiles_doc()
    result = check_live_preflight(_settings_db(profiles, staging=profiles))
    assert result["status"] == "pass"
    assert result["profiles_equal"] is True
    assert result["remote_unified_constraints"] is False


def test_live_preflight_fails_when_staging_missing():
    result = check_live_preflight(_settings_db(staging=None))
    assert result["status"] == "fail"
    assert "missing_system_settings/risk_profiles_staging" in result["failures"]


def test_live_preflight_can_record_allowed_profile_drift():
    result = check_live_preflight(
        _settings_db(staging={"5": {"buckets": {"RV": {"min": 0.40, "max": 0.65}}}}),
        allow_profile_drift=True,
    )
    assert result["status"] == "allowed_profile_drift"
    assert result["profiles_equal"] is False


def test_build_live_cases_uses_supplied_assets_and_production_constraints():
    cases = build_live_cases(["A", "B"], [1, 5], include_overrides=False, include_fallback=False)
    assert [case["id"] for case in cases] == [
        "live_profile_1_efficient_risk_no_override",
        "live_profile_5_efficient_risk_no_override",
    ]
    assert all(case["assets"] == ["A", "B"] for case in cases)
    assert all(case["constraints"]["objective"] == "efficient_risk" for case in cases)
    assert all(case["constraints"]["max_weight"] == 0.20 for case in cases)


def test_run_live_preflight_failure_skips_optimizer(monkeypatch, tmp_path):
    called = {"run_live_case": False}

    def fail_if_called(*_args, **_kwargs):
        called["run_live_case"] = True
        raise AssertionError("optimizer should not run when live preflight fails")

    monkeypatch.setattr(shadow, "run_live_case", fail_if_called)
    monkeypatch.setattr(
        shadow,
        "write_manifest",
        lambda case_results, mode="deterministic", metadata=None: tmp_path / "manifest.json",
    )

    results, manifest_path, preflight = shadow.run_live(
        assets=["A", "B"],
        risk_levels=[5],
        db=_settings_db(staging=None),
    )

    assert results == []
    assert manifest_path == tmp_path / "manifest.json"
    assert preflight["status"] == "fail"
    assert called["run_live_case"] is False


def test_main_live_setup_error_returns_preflight_exit(monkeypatch, capsys):
    monkeypatch.setattr(shadow, "run_live", lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("no creds")))
    exit_code = shadow.main(["--live", "--risk-levels", "5", "--no-overrides", "--no-fallback"])
    captured = capsys.readouterr()
    assert exit_code == 2
    assert "live shadow could not start" in captured.out
