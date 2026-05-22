from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import services.portfolio.optimizer_core as optimizer_core  # noqa: E402
from services.portfolio.optimizer_core import (  # noqa: E402
    _postprocess_weights,
    _restore_cutoff_weights_for_bucket_mins,
    _validate_optimizer_result,
    run_optimization,
)
from services.portfolio.utils import _normalize  # noqa: E402


class _CutoffCleaningEF:
    def __init__(self, weights: dict[str, float]):
        self._weights = weights

    def clean_weights(self, cutoff: float = 0.0) -> dict[str, float]:
        return {
            isin: 0.0 if abs(weight) < cutoff else weight
            for isin, weight in self._weights.items()
        }


def _validation(weights: dict[str, float]) -> dict:
    universe = ["EQ_CORE", "EQ_SMALL", "BD"]
    return _validation_for_bounds(
        weights,
        universe,
        bucket_bounds_v1={"equity": {"min": 0.40, "max": 1.0}},
        current_risk_buckets={5: {"RV": {"min": 0.40, "max": 1.0}}},
    )


def _validation_for_bounds(
    weights: dict[str, float],
    universe: list[str],
    bucket_bounds_v1: dict,
    current_risk_buckets: dict | None = None,
) -> dict:
    eq_vec = np.array([1.0, 1.0, 0.0])
    bd_vec = np.array([0.0, 0.0, 1.0])
    zero_vec = np.zeros(3)

    return _validate_optimizer_result(
        weights=weights,
        universe=universe,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets=current_risk_buckets or {},
        bucket_bounds_v1=bucket_bounds_v1,
        eq_v=eq_vec,
        bd_v=bd_vec,
        cs_v=zero_vec,
        al_v=zero_vec,
        ra_v=zero_vec,
        ot_v=zero_vec,
    )


def _postprocess(raw_weights: dict[str, float], cutoff: float, bucket_bounds_v1: dict) -> dict[str, float]:
    universe = ["EQ_CORE", "EQ_SMALL", "BD"]
    eq_vec = np.array([1.0, 1.0, 0.0])
    bd_vec = np.array([0.0, 0.0, 1.0])
    zero_vec = np.zeros(3)

    return _postprocess_weights(
        ef=_CutoffCleaningEF(raw_weights),
        raw_weights=raw_weights,
        cutoff=cutoff,
        universe=universe,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets={5: {"RV": {"min": 0.40, "max": 1.0}}},
        eq_vec=eq_vec,
        bd_vec=bd_vec,
        cs_vec=zero_vec,
        al_vec=zero_vec,
        ra_vec=zero_vec,
        ot_vec=zero_vec,
        lock_mode="free",
        locked_assets=[],
        fixed_weights={},
        bucket_bounds_v1=bucket_bounds_v1,
    )


def _assert_weights_close(actual: dict[str, float], expected: dict[str, float]) -> None:
    assert set(actual) == set(expected)
    for isin, weight in expected.items():
        assert actual[isin] == pytest.approx(weight)


def test_postprocess_preserves_cutoff_weight_needed_for_bucket_minimum():
    universe = ["EQ_CORE", "EQ_SMALL", "BD"]
    raw_weights = {"EQ_CORE": 0.3815, "EQ_SMALL": 0.0190, "BD": 0.5995}
    eq_vec = np.array([1.0, 1.0, 0.0])
    bd_vec = np.array([0.0, 0.0, 1.0])
    zero_vec = np.zeros(3)

    raw_validation = _validation(_normalize(raw_weights))
    assert raw_validation["compliant"] is True

    naive_cleaned = _normalize(_CutoffCleaningEF(raw_weights).clean_weights(cutoff=0.02))
    naive_validation = _validation(naive_cleaned)

    assert naive_cleaned["EQ_SMALL"] == 0.0
    assert naive_validation["compliant"] is False
    assert any(
        violation["code"] == "BUCKET_MIN_VIOLATION"
        and violation["bucket"] == "equity"
        for violation in naive_validation["violations"]
    )

    postprocessed = _postprocess_weights(
        ef=_CutoffCleaningEF(raw_weights),
        raw_weights=raw_weights,
        cutoff=0.02,
        universe=universe,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets={5: {"RV": {"min": 0.40, "max": 1.0}}},
        eq_vec=eq_vec,
        bd_vec=bd_vec,
        cs_vec=zero_vec,
        al_vec=zero_vec,
        ra_vec=zero_vec,
        ot_vec=zero_vec,
        lock_mode="free",
        locked_assets=[],
        fixed_weights={},
        bucket_bounds_v1={"equity": {"min": 0.40, "max": 1.0}},
    )

    assert postprocessed["EQ_SMALL"] == pytest.approx(raw_weights["EQ_SMALL"])
    assert _validation(postprocessed)["compliant"] is True


def test_postprocess_skips_when_raw_already_violates_min():
    universe = ["EQ_CORE", "EQ_SMALL", "BD"]
    raw_weights = {"EQ_CORE": 0.3700, "EQ_SMALL": 0.0190, "BD": 0.6110}
    cleaned_weights = _CutoffCleaningEF(raw_weights).clean_weights(cutoff=0.02)
    eq_vec = np.array([1.0, 1.0, 0.0])
    bd_vec = np.array([0.0, 0.0, 1.0])
    zero_vec = np.zeros(3)

    assert _validation(_normalize(raw_weights))["compliant"] is False
    assert _validation(_normalize(cleaned_weights))["compliant"] is False

    restored = _restore_cutoff_weights_for_bucket_mins(
        cleaned_weights=cleaned_weights,
        raw_weights=raw_weights,
        cutoff=0.02,
        universe=universe,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets={5: {"RV": {"min": 0.40, "max": 1.0}}},
        bucket_bounds_v1={"equity": {"min": 0.40, "max": 1.0}},
        eq_vec=eq_vec,
        bd_vec=bd_vec,
        cs_vec=zero_vec,
        al_vec=zero_vec,
        ra_vec=zero_vec,
        ot_vec=zero_vec,
    )

    assert restored == cleaned_weights
    postprocessed = _postprocess(raw_weights, cutoff=0.02, bucket_bounds_v1={"equity": {"min": 0.40, "max": 1.0}})

    assert postprocessed["EQ_SMALL"] == 0.0
    assert _validation(postprocessed)["compliant"] is False


def test_postprocess_noop_when_cutoff_zero():
    raw_weights = {"EQ_CORE": 0.3815, "EQ_SMALL": 0.0190, "BD": 0.5995}
    cleaned_weights = _CutoffCleaningEF(raw_weights).clean_weights(cutoff=0.0)

    postprocessed = _postprocess(raw_weights, cutoff=0.0, bucket_bounds_v1={"equity": {"min": 0.40, "max": 1.0}})

    _assert_weights_close(postprocessed, _normalize(cleaned_weights))


def test_postprocess_noop_when_no_removed_by_cutoff():
    raw_weights = {"EQ_CORE": 0.4200, "EQ_SMALL": 0.0200, "BD": 0.5600}
    cleaned_weights = _CutoffCleaningEF(raw_weights).clean_weights(cutoff=0.02)

    assert cleaned_weights["EQ_SMALL"] == raw_weights["EQ_SMALL"]

    postprocessed = _postprocess(raw_weights, cutoff=0.02, bucket_bounds_v1={"equity": {"min": 0.40, "max": 1.0}})

    _assert_weights_close(postprocessed, _normalize(cleaned_weights))


def test_postprocess_does_not_create_bucket_max_violation():
    universe = ["EQ_CORE", "EQ_SMALL", "BD"]
    raw_weights = {"EQ_CORE": 0.3815, "EQ_SMALL": 0.0190, "BD": 0.5995}
    bucket_bounds = {
        "equity": {"min": 0.40, "max": 0.401},
        "bond": {"min": None, "max": 0.60},
    }

    assert _validation_for_bounds(_normalize(raw_weights), universe, bucket_bounds)["compliant"] is True

    naive_cleaned = _normalize(_CutoffCleaningEF(raw_weights).clean_weights(cutoff=0.02))
    naive_validation = _validation_for_bounds(naive_cleaned, universe, bucket_bounds)

    assert any(v["code"] == "BUCKET_MIN_VIOLATION" for v in naive_validation["violations"])
    assert any(v["code"] == "BUCKET_MAX_VIOLATION" and v["bucket"] == "bond" for v in naive_validation["violations"])

    postprocessed = _postprocess(raw_weights, cutoff=0.02, bucket_bounds_v1=bucket_bounds)
    final_validation = _validation_for_bounds(postprocessed, universe, bucket_bounds)

    assert final_validation["compliant"] is True
    assert not any(v["code"] == "BUCKET_MAX_VIOLATION" for v in final_validation["violations"])


def _readonly_dummy_db() -> MagicMock:
    db = MagicMock()
    doc = MagicMock()
    doc.exists = False
    document = MagicMock()
    document.get.return_value = doc
    collection = MagicMock()
    collection.document.return_value = document
    db.collection.return_value = collection
    return db


class _FixedCleanWeights:
    def __init__(self, weights: dict[str, float]):
        self._weights = weights

    def clean_weights(self, cutoff: float = 0.0) -> dict[str, float]:
        return dict(self._weights)


def test_status_optimal_non_compliant_when_restore_insufficient(monkeypatch):
    dates = pd.date_range("2021-01-01", periods=120, freq="B")
    df = pd.DataFrame(
        {
            "EQ": pd.Series(100.0 * np.cumprod(np.full(120, 1.0002)), index=dates),
            "BD": pd.Series(100.0 * np.cumprod(np.full(120, 1.0001)), index=dates),
        }
    )

    def fake_candidate_universe(*args, **kwargs):
        zero = np.zeros(2)
        fetcher = MagicMock()
        fetcher.get_dynamic_risk_free_rate.return_value = 0.02
        return (
            fetcher,
            {},
            False,
            df,
            ["EQ", "BD"],
            [],
            np.array([1.0, 0.0]),
            np.array([0.0, 1.0]),
            zero,
            zero,
            zero,
            zero,
        )

    monkeypatch.setattr(optimizer_core, "_build_candidate_universe", fake_candidate_universe)
    monkeypatch.setattr(
        optimizer_core,
        "_build_expected_returns_and_cov",
        lambda *args, **kwargs: (
            pd.Series({"EQ": 0.08, "BD": 0.02}),
            pd.DataFrame([[0.04, 0.0], [0.0, 0.01]], index=["EQ", "BD"], columns=["EQ", "BD"]),
        ),
    )
    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", lambda mu, s: [])
    monkeypatch.setattr(optimizer_core, "_apply_standard_constraints", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        optimizer_core,
        "_check_feasibility_and_autoexpand",
        lambda *args, **kwargs: (
            True,
            None,
            [],
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        ),
    )
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (
            _FixedCleanWeights({"EQ": 0.50, "BD": 0.50}),
            {"EQ": 0.50, "BD": 0.50},
            "max_sharpe_custom",
            {},
        ),
    )

    result = run_optimization(
        assets_list=["EQ", "BD"],
        risk_level=5,
        db=_readonly_dummy_db(),
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        constraints_v1={
            "construction": {"max_weight": 1.0, "cutoff": 0.0},
            "bucket_bounds": {"equity": {"min": 0.90, "max": 1.0}},
        },
        asset_metadata={},
    )

    assert result["status"] == "optimal_non_compliant", result
    assert result["applicable"] is False
    assert result["usable"] is False
    assert any(v["code"] == "BUCKET_MIN_VIOLATION" for v in result["violations"])
