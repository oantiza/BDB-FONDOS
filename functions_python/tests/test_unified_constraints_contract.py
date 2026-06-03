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
    _build_unified_bounds_info,
    _check_feasibility_and_autoexpand,
    _inject_unified_bounds,
    _postprocess_weights,
    _validate_optimizer_result,
    run_optimization,
)


class _Snap:
    def __init__(self, exists: bool, data: dict | None = None):
        self.exists = exists
        self._data = data or {}

    def to_dict(self):
        return self._data


class _DocRef:
    def __init__(self, docs: dict, doc_id: str):
        self._docs = docs
        self._doc_id = doc_id

    def get(self):
        return self._docs.get(self._doc_id, _Snap(False))

    def set(self, data):
        self._docs[self._doc_id] = _Snap(True, data)


class _Collection:
    def __init__(self, docs: dict):
        self._docs = docs

    def document(self, doc_id: str):
        return _DocRef(self._docs, doc_id)


class _DB:
    def __init__(self, docs: dict):
        self._docs = docs

    def collection(self, name: str):
        assert name == "system_settings"
        return _Collection(self._docs)


class _CutoffCleaningEF:
    def __init__(self, weights: dict[str, float]):
        self._weights = weights

    def clean_weights(self, cutoff: float = 0.0) -> dict[str, float]:
        return {
            isin: 0.0 if abs(weight) < cutoff else weight
            for isin, weight in self._weights.items()
        }


PROFILE_DOC = {
    "5": {
        "RV": {"min": 0.40, "max": 0.60},
        "RF": {"min": 0.20, "max": 0.60},
        "Monetario": {"min": 0.0, "max": 0.20},
        "Alternativos": {"min": 0.0, "max": 0.20},
        "Otros": {"min": 0.0, "max": 0.10},
    }
}


def _db_with_profiles():
    return _DB({
        "risk_profiles": _Snap(True, PROFILE_DOC),
        "risk_profiles_staging": _Snap(True, PROFILE_DOC),
    })


def _patch_run_until_precheck(monkeypatch, captured: dict):
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

    def fake_precheck(**kwargs):
        captured["active_bounds"] = kwargs["active_bounds"]
        captured["exposure_vectors"] = kwargs["exposure_vectors"]
        captured["equity_floor"] = kwargs["equity_floor"]
        return {
            "is_feasible": False,
            "blocks": [{"code": "TEST_BLOCK", "message": "blocked by test"}],
        }

    monkeypatch.setattr(optimizer_core, "_apply_suitability_filter", lambda assets, *_args: assets)
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
    monkeypatch.setattr(optimizer_core, "run_feasibility_precheck", fake_precheck)


def test_inject_unified_bounds_returns_effective_bounds_and_ignored_overrides():
    ef = MagicMock()
    one = np.array([1.0])
    zero = np.array([0.0])

    info = _inject_unified_bounds(
        ef,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets={5: {"RV": {"min": 0.40, "max": 0.60}}},
        bucket_bounds_v1={"equity": {"min": 0.10, "max": 0.90}},
        eq_v=one,
        bd_v=zero,
        cs_v=zero,
        al_v=zero,
        ra_v=zero,
        ot_v=zero,
    )

    assert info["bucket_constraints_source"] == "unified_effective_bounds"
    assert info["effective_bounds"]["RV"] == {"min": 0.40, "max": 0.60}
    assert {
        (entry["bucket"], entry["field"], entry["reason"])
        for entry in info["ignored_overrides"]
    } == {
        ("RV", "min", "widening_not_allowed"),
        ("RV", "max", "widening_not_allowed"),
    }
    assert ef.add_constraint.call_count == 2


def test_unified_validation_uses_canonical_alternativos_vector():
    universe = ["ALT", "REAL"]
    weights = {"ALT": 0.60, "REAL": 0.40}
    zero = np.zeros(2)

    validation = _validate_optimizer_result(
        weights=weights,
        universe=universe,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets={},
        bucket_bounds_v1={
            "alternative": {"max": 1.0},
            "real_asset": {"max": 1.0},
        },
        eq_v=zero,
        bd_v=zero,
        cs_v=zero,
        al_v=np.array([1.0, 0.0]),
        ra_v=np.array([0.0, 1.0]),
        ot_v=zero,
        effective_bounds={"Alternativos": {"min": 0.0, "max": 0.30}},
    )

    assert validation["compliant"] is False
    assert validation["violations"][0]["bucket"] == "Alternativos"
    assert validation["violations"][0]["actual"] == pytest.approx(1.0)


def test_unified_postprocess_uses_effective_bounds_for_cutoff_restore():
    universe = ["EQ_CORE", "EQ_SMALL", "BD"]
    raw_weights = {"EQ_CORE": 0.3815, "EQ_SMALL": 0.0190, "BD": 0.5995}
    eq_vec = np.array([1.0, 1.0, 0.0])
    bd_vec = np.array([0.0, 0.0, 1.0])
    zero = np.zeros(3)

    postprocessed = _postprocess_weights(
        ef=_CutoffCleaningEF(raw_weights),
        raw_weights=raw_weights,
        cutoff=0.02,
        universe=universe,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets={},
        eq_vec=eq_vec,
        bd_vec=bd_vec,
        cs_vec=zero,
        al_vec=zero,
        ra_vec=zero,
        ot_vec=zero,
        lock_mode="free",
        locked_assets=[],
        fixed_weights={},
        bucket_bounds_v1={},
        effective_bounds={"RV": {"min": 0.40, "max": 1.0}},
    )

    assert postprocessed["EQ_SMALL"] == pytest.approx(raw_weights["EQ_SMALL"])
    assert _validate_optimizer_result(
        weights=postprocessed,
        universe=universe,
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets={},
        bucket_bounds_v1={},
        eq_v=eq_vec,
        bd_v=bd_vec,
        cs_v=zero,
        al_v=zero,
        ra_v=zero,
        ot_v=zero,
        effective_bounds={"RV": {"min": 0.40, "max": 1.0}},
    )["compliant"] is True


def test_run_optimization_flag_on_precheck_uses_effective_bounds_and_explainability(monkeypatch):
    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "1")
    captured = {}
    _patch_run_until_precheck(monkeypatch, captured)

    result = run_optimization(
        assets_list=["EQ", "BD"],
        risk_level=5,
        db=_db_with_profiles(),
        constraints={"apply_profile": True, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        constraints_v1={"bucket_bounds": {"equity": {"min": 0.10, "max": 0.90}}},
        asset_metadata={},
    )

    assert result["status"] == "infeasible"
    assert set(captured["active_bounds"]) == {"RV", "RF", "Monetario", "Alternativos", "Otros"}
    assert captured["active_bounds"]["RV"] == {"min": 0.40, "max": 0.60}
    assert "RV" in captured["exposure_vectors"]
    assert "equity" not in captured["exposure_vectors"]
    assert captured["equity_floor"] == pytest.approx(0.40)
    assert result["explainability"]["bucket_constraints_source"] == "unified_effective_bounds"
    assert result["explainability"]["effective_bounds"]["RV"] == {"min": 0.40, "max": 0.60}
    assert len(result["explainability"]["ignored_overrides"]) == 2


def test_run_optimization_flag_off_precheck_keeps_legacy_v1_bounds(monkeypatch):
    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "0")
    captured = {}
    _patch_run_until_precheck(monkeypatch, captured)

    result = run_optimization(
        assets_list=["EQ", "BD"],
        risk_level=5,
        db=_db_with_profiles(),
        constraints={"apply_profile": True, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        constraints_v1={"bucket_bounds": {"equity": {"min": 0.10, "max": 0.90}}},
        asset_metadata={},
    )

    assert result["status"] == "infeasible"
    assert captured["active_bounds"] == {"equity": {"min": 0.10, "max": 0.90}}
    assert "equity" in captured["exposure_vectors"]
    assert "RV" not in captured["exposure_vectors"]
    assert "effective_bounds" not in result["explainability"]


def test_unified_equity_floor_infeasible_keeps_explainability():
    zero = np.zeros(2)
    profile_bounds = {5: PROFILE_DOC["5"]}
    unified_info = _build_unified_bounds_info(
        apply_profile=True,
        risk_level_i=5,
        current_risk_buckets=profile_bounds,
        bucket_bounds_v1={},
    )

    is_feasible, result, *_rest = _check_feasibility_and_autoexpand(
        db=_db_with_profiles(),
        fetcher=MagicMock(),
        price_data={},
        universe=["BD1", "BD2"],
        assets_list=["BD1", "BD2"],
        apply_profile=True,
        equity_floor=0.40,
        max_weight=0.20,
        eq_vec=zero,
        locked_assets=[],
        constraints={"auto_expand_universe": False},
        asset_metadata={},
        min_weight=0.0,
        gamma=1.0,
        bd_vec=np.ones(2),
        cs_vec=zero,
        al_vec=zero,
        ra_vec=zero,
        ot_vec=zero,
        lock_mode="free",
        risk_level_i=5,
        fixed_weights={},
        current_risk_buckets=profile_bounds,
        candidate_funds=None,
        bucket_bounds_v1={},
        unified=True,
        unified_bounds_info=unified_info,
    )

    assert is_feasible is False
    assert result["status"] == "infeasible_equity_floor"
    assert result["explainability"]["bucket_constraints_source"] == "unified_effective_bounds"
    assert result["explainability"]["effective_bounds"]["RV"] == {"min": 0.40, "max": 0.60}
