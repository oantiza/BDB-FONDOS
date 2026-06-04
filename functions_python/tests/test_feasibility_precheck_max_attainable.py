from __future__ import annotations

import numpy as np
import pytest

from services.portfolio.feasibility_precheck import run_feasibility_precheck


def _read_bound(raw):
    return raw.get("min"), raw.get("max")


def _run(
    *,
    universe,
    exposure,
    required_min,
    max_weight,
    min_weight=0.0,
    fixed_weights=None,
    lock_mode="free",
):
    return run_feasibility_precheck(
        universe=universe,
        max_weight=max_weight,
        min_weight=min_weight,
        active_bounds={"RV": {"min": required_min, "max": 1.0}},
        exposure_vectors={"RV": np.array(exposure, dtype=float)},
        fixed_weights=fixed_weights or {},
        lock_mode=lock_mode,
        _read_bound_fn=_read_bound,
    )


def _unattainable_block(result):
    return next(
        (
            block
            for block in result["blocks"]
            if block["code"] == "BLOCK_BUCKET_MIN_UNATTAINABLE"
        ),
        None,
    )


def test_bucket_min_blocks_when_asset_cap_limits_total_exposure():
    result = _run(
        universe=["EQ1", "EQ2", "BD1", "BD2", "BD3"],
        exposure=[1.0, 1.0, 0.0, 0.0, 0.0],
        required_min=0.50,
        max_weight=0.20,
    )

    block = _unattainable_block(result)

    assert block is not None
    assert block["details"]["required_min"] == pytest.approx(0.50)
    assert block["details"]["max_achievable_exposure"] == pytest.approx(0.40)


def test_fractional_exposure_uses_best_case_weighted_sum():
    result = _run(
        universe=["MIX1", "MIX2", "MIX3", "BD"],
        exposure=[0.60, 0.40, 0.20, 0.0],
        required_min=0.37,
        max_weight=0.30,
    )

    block = _unattainable_block(result)

    assert block is not None
    assert block["details"]["max_achievable_exposure"] == pytest.approx(0.36)


def test_keep_weight_cannot_add_more_to_exactly_locked_asset():
    result = _run(
        universe=["EQ_LOCK", "BD1", "BD2", "BD3"],
        exposure=[1.0, 0.0, 0.0, 0.0],
        required_min=0.20,
        max_weight=0.40,
        fixed_weights={"EQ_LOCK": 0.10},
        lock_mode="keep_weight",
    )

    block = _unattainable_block(result)

    assert block is not None
    assert block["details"]["max_achievable_exposure"] == pytest.approx(0.10)


def test_min_keep_can_add_more_to_locked_asset_up_to_max_weight():
    result = _run(
        universe=["EQ_LOCK", "BD1", "BD2", "BD3"],
        exposure=[1.0, 0.0, 0.0, 0.0],
        required_min=0.30,
        max_weight=0.40,
        fixed_weights={"EQ_LOCK": 0.10},
        lock_mode="min_keep",
    )

    assert _unattainable_block(result) is None


def test_free_mode_ignores_supplied_fixed_weights():
    result = _run(
        universe=["EQ", "BD1", "BD2", "BD3"],
        exposure=[1.0, 0.0, 0.0, 0.0],
        required_min=0.40,
        max_weight=0.40,
        fixed_weights={"EQ": 0.05},
        lock_mode="free",
    )

    assert _unattainable_block(result) is None


def test_min_weight_can_make_bucket_min_unattainable():
    result = _run(
        universe=["EQ", "BD1", "BD2", "BD3"],
        exposure=[1.0, 0.0, 0.0, 0.0],
        required_min=0.50,
        max_weight=0.70,
        min_weight=0.20,
    )

    block = _unattainable_block(result)

    assert block is not None
    assert block["details"]["max_achievable_exposure"] == pytest.approx(0.40)
    assert block["details"]["min_weight"] == pytest.approx(0.20)
