"""
Tests for the feasibility pre-check module (Phase 1).

All tests use synthetic data — no DB, no Firebase, no mocks of external services.
"""

import pytest
import numpy as np

from services.portfolio.feasibility_precheck import (
    run_feasibility_precheck,
    _check_empty_universe,
    _check_universe_too_small,
    _check_bucket_mins_exceed_100,
    _check_bucket_maxs_below_100,
    _check_fixed_weights_exceed_100,
    _check_bucket_not_representable,
)


# =========================================================================
# Helper: minimal _read_bound implementation for tests
# =========================================================================

def _test_read_bound(raw):
    """Mirrors optimizer_core._read_bound for test isolation."""
    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        return (float(raw[0]), float(raw[1]))
    if isinstance(raw, dict):
        min_v = raw.get("min")
        max_v = raw.get("max")
        return (
            float(min_v) if min_v is not None else None,
            float(max_v) if max_v is not None else None,
        )
    return (None, None)


# =========================================================================
# Fixtures
# =========================================================================

@pytest.fixture
def six_asset_universe():
    """Standard 6-asset universe with 3 equity + 3 bond."""
    return [f"EQ{i}" for i in range(3)] + [f"BD{i}" for i in range(3)]


@pytest.fixture
def six_asset_exposure():
    """Exposure vectors for 6-asset universe (3 equity + 3 bond)."""
    return {
        "equity": np.array([1.0, 1.0, 1.0, 0.0, 0.0, 0.0]),
        "bond":   np.array([0.0, 0.0, 0.0, 1.0, 1.0, 1.0]),
        "cash":   np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "alternative": np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "real_asset":  np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "other":  np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
    }


@pytest.fixture
def standard_bounds():
    """Normal P5 bounds — should pass all checks."""
    return {
        "equity": {"min": 0.40, "max": 0.60},
        "bond":   {"min": 0.20, "max": 0.40},
        "cash":   {"min": None, "max": 0.10},
        "alternative": {"min": None, "max": 0.20},
        "real_asset":  {"min": None, "max": None},
        "other":  {"min": None, "max": 0.25},
    }


# =========================================================================
# BLOCK-5: Empty universe
# =========================================================================

class TestEmptyUniverse:
    def test_empty_list_blocks(self):
        result = run_feasibility_precheck(
            universe=[],
            max_weight=0.20,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        assert len(result["blocks"]) == 1
        assert result["blocks"][0]["code"] == "BLOCK_EMPTY_UNIVERSE"

    def test_none_universe_blocks(self):
        result = run_feasibility_precheck(
            universe=None,
            max_weight=0.20,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        assert result["blocks"][0]["code"] == "BLOCK_EMPTY_UNIVERSE"


# =========================================================================
# BLOCK-1: Universe too small for max_weight
# =========================================================================

class TestUniverseTooSmall:
    def test_3_assets_max_weight_20_blocks(self):
        """3 * 0.20 = 0.60 < 1.0 → BLOCK"""
        result = run_feasibility_precheck(
            universe=["A", "B", "C"],
            max_weight=0.20,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_UNIVERSE_TOO_SMALL" in codes

    def test_4_assets_max_weight_20_blocks(self):
        """4 * 0.20 = 0.80 < 1.0 → BLOCK"""
        result = run_feasibility_precheck(
            universe=["A", "B", "C", "D"],
            max_weight=0.20,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_UNIVERSE_TOO_SMALL" in codes

    def test_5_assets_max_weight_20_passes(self):
        """5 * 0.20 = 1.00 → OK (exactly 1.0)"""
        result = run_feasibility_precheck(
            universe=["A", "B", "C", "D", "E"],
            max_weight=0.20,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is True

    def test_6_assets_max_weight_20_passes(self, six_asset_universe):
        """6 * 0.20 = 1.20 > 1.0 → OK"""
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.20,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is True

    def test_2_assets_max_weight_50_passes(self):
        """2 * 0.50 = 1.00 → OK"""
        result = run_feasibility_precheck(
            universe=["A", "B"],
            max_weight=0.50,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is True


# =========================================================================
# BLOCK-2: Bucket mins exceed 100%
# =========================================================================

class TestBucketMinsExceed100:
    def test_mins_sum_110_blocks(self, six_asset_universe, six_asset_exposure):
        bounds = {
            "equity": {"min": 0.60, "max": 1.0},
            "bond":   {"min": 0.50, "max": 1.0},
        }
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_BUCKET_MINS_EXCEED_100" in codes

    def test_mins_sum_100_passes(self, six_asset_universe, six_asset_exposure):
        bounds = {
            "equity": {"min": 0.60, "max": 1.0},
            "bond":   {"min": 0.40, "max": 1.0},
        }
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_BUCKET_MINS_EXCEED_100" not in codes


# =========================================================================
# BLOCK-3: Bucket maxs below 100%
# =========================================================================

class TestBucketMaxsBelow100:
    def test_maxs_sum_60_blocks(self, six_asset_universe, six_asset_exposure):
        bounds = {
            "equity": {"min": 0.0, "max": 0.30},
            "bond":   {"min": 0.0, "max": 0.30},
        }
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_BUCKET_MAXS_BELOW_100" in codes

    def test_maxs_sum_100_passes(self, six_asset_universe, six_asset_exposure):
        bounds = {
            "equity": {"min": 0.0, "max": 0.60},
            "bond":   {"min": 0.0, "max": 0.40},
        }
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_BUCKET_MAXS_BELOW_100" not in codes

    def test_no_max_defined_passes(self, six_asset_universe, six_asset_exposure):
        """If a bucket has no max, we assume 1.0 → never blocks."""
        bounds = {
            "equity": {"min": 0.40, "max": None},
            "bond":   {"min": 0.20, "max": 0.40},
        }
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_BUCKET_MAXS_BELOW_100" not in codes


# =========================================================================
# BLOCK-4: Fixed weights exceed 100%
# =========================================================================

class TestFixedWeightsExceed100:
    def test_locked_120_blocks(self, six_asset_universe):
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={"EQ0": 0.40, "EQ1": 0.40, "EQ2": 0.40},
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_FIXED_WEIGHTS_EXCEED_100" in codes

    def test_locked_80_passes(self, six_asset_universe):
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={"EQ0": 0.40, "EQ1": 0.40},
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_FIXED_WEIGHTS_EXCEED_100" not in codes

    def test_lock_mode_free_skips(self, six_asset_universe):
        """lock_mode='free' means weights are NOT enforced → skip check."""
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={"EQ0": 0.40, "EQ1": 0.40, "EQ2": 0.40},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_FIXED_WEIGHTS_EXCEED_100" not in codes


# =========================================================================
# BLOCK-6: Bucket not representable
# =========================================================================

class TestBucketNotRepresentable:
    def test_equity_min_no_equity_blocks(self):
        """Equity min=85% but all assets are bonds → BLOCK."""
        universe = ["BD0", "BD1", "BD2", "BD3", "BD4", "BD5"]
        exposure = {
            "equity": np.zeros(6),
            "bond":   np.ones(6),
            "cash":   np.zeros(6),
            "alternative": np.zeros(6),
            "real_asset":  np.zeros(6),
            "other":  np.zeros(6),
        }
        bounds = {"equity": {"min": 0.85, "max": 1.0}}
        result = run_feasibility_precheck(
            universe=universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_BUCKET_NOT_REPRESENTABLE" in codes

    def test_equity_min_with_equity_passes(self, six_asset_universe, six_asset_exposure):
        bounds = {"equity": {"min": 0.40, "max": 0.60}}
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_BUCKET_NOT_REPRESENTABLE" not in codes


# =========================================================================
# PASS: Normal valid case
# =========================================================================

class TestValidCase:
    def test_standard_p5_passes(self, six_asset_universe, six_asset_exposure, standard_bounds):
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.20,
            active_bounds=standard_bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is True
        assert len(result["blocks"]) == 0

    def test_aggressive_p10_passes(self):
        """P10: 8 equity + 2 bond, high equity min."""
        universe = [f"EQ{i}" for i in range(8)] + [f"BD{i}" for i in range(2)]
        exposure = {
            "equity": np.array([1.0]*8 + [0.0]*2),
            "bond":   np.array([0.0]*8 + [1.0]*2),
            "cash":   np.zeros(10),
            "alternative": np.zeros(10),
            "real_asset":  np.zeros(10),
            "other":  np.zeros(10),
        }
        bounds = {
            "equity": {"min": 0.95, "max": 1.0},
            "bond":   {"min": None, "max": 0.05},
        }
        result = run_feasibility_precheck(
            universe=universe,
            max_weight=0.20,
            active_bounds=bounds,
            exposure_vectors=exposure,
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert result["is_feasible"] is True

    def test_result_structure(self, six_asset_universe):
        """Verify output contract."""
        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.20,
            active_bounds={},
            exposure_vectors={},
            fixed_weights={},
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )
        assert "is_feasible" in result
        assert "blocks" in result
        assert "warnings" in result
        assert "info" in result
        assert isinstance(result["blocks"], list)
        assert isinstance(result["warnings"], list)
        assert isinstance(result["info"], list)
