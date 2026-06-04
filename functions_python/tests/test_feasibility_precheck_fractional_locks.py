from __future__ import annotations

import numpy as np
import pytest

from services.portfolio.feasibility_precheck import run_feasibility_precheck


def _read_bound(raw):
    return raw.get("min"), raw.get("max")


def _run_bucket_precheck(
    *,
    universe: list[str],
    bond_exposure: list[float],
    fixed_weights: dict[str, float],
    bond_max: float,
) -> dict:
    return run_feasibility_precheck(
        universe=universe,
        max_weight=1.0,
        active_bounds={"bond": {"min": 0.0, "max": bond_max}},
        exposure_vectors={"bond": np.array(bond_exposure)},
        fixed_weights=fixed_weights,
        lock_mode="keep_weight",
        _read_bound_fn=_read_bound,
    )


def _bucket_block(result: dict) -> dict | None:
    return next(
        (
            block
            for block in result["blocks"]
            if block["code"] == "BLOCK_LOCKS_INCOMPATIBLE_BUCKET"
        ),
        None,
    )


def test_fractional_exposure_below_half_still_counts_toward_bucket_max():
    result = _run_bucket_precheck(
        universe=["MIXED"],
        bond_exposure=[0.40],
        fixed_weights={"MIXED": 0.60},
        bond_max=0.20,
    )

    block = _bucket_block(result)

    assert block is not None
    assert block["details"]["locked_sum"] == pytest.approx(0.24)
    assert block["details"]["locked_contributions"]["MIXED"] == {
        "locked_weight": 0.60,
        "bucket_exposure": 0.40,
        "contribution": 0.24,
    }


def test_fractional_exposure_above_half_does_not_count_full_locked_weight():
    result = _run_bucket_precheck(
        universe=["MIXED"],
        bond_exposure=[0.60],
        fixed_weights={"MIXED": 0.60},
        bond_max=0.40,
    )

    assert _bucket_block(result) is None


def test_multiple_fractional_locks_are_summed_by_weighted_exposure():
    result = _run_bucket_precheck(
        universe=["MIXED_A", "MIXED_B"],
        bond_exposure=[0.40, 0.30],
        fixed_weights={"MIXED_A": 0.40, "MIXED_B": 0.30},
        bond_max=0.20,
    )

    block = _bucket_block(result)

    assert block is not None
    assert block["details"]["locked_sum"] == pytest.approx(0.25)
    assert block["details"]["locked_contributions"]["MIXED_A"]["contribution"] == pytest.approx(0.16)
    assert block["details"]["locked_contributions"]["MIXED_B"]["contribution"] == pytest.approx(0.09)


def test_free_mode_still_ignores_fractional_fixed_weights():
    result = run_feasibility_precheck(
        universe=["MIXED"],
        max_weight=1.0,
        active_bounds={"bond": {"min": 0.0, "max": 0.20}},
        exposure_vectors={"bond": np.array([0.80])},
        fixed_weights={"MIXED": 0.80},
        lock_mode="free",
        _read_bound_fn=_read_bound,
    )

    assert _bucket_block(result) is None


def test_canonical_rv_vector_enforces_equity_floor_with_fractional_lock():
    result = run_feasibility_precheck(
        universe=["MIXED_LOCK", "EQ_FREE"],
        max_weight=1.0,
        active_bounds={},
        exposure_vectors={"RV": np.array([0.25, 1.0])},
        fixed_weights={"MIXED_LOCK": 0.80},
        lock_mode="keep_weight",
        _read_bound_fn=_read_bound,
        equity_floor=0.50,
    )

    block = next(
        (
            issue
            for issue in result["blocks"]
            if issue["code"] == "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR"
        ),
        None,
    )

    assert block is not None
    assert block["details"]["locked_equity"] == pytest.approx(0.20)
    assert block["details"]["free_budget"] == pytest.approx(0.20)
    assert block["details"]["max_achievable_equity"] == pytest.approx(0.40)
