"""
Design tests for future locks-compatibility checks in feasibility precheck.

These tests define the EXPECTED FUTURE BEHAVIOR of two new BLOCK codes:
- BLOCK_LOCKS_INCOMPATIBLE_BUCKET  (covers GAP-H1 from audit)
- BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR  (covers GAP-H2 from audit)

All tests are marked xfail(strict=True) because the runtime checks do NOT
exist yet. They will start passing once the runtime is implemented.

Tests marked with pytest.skip() have PENDING DESIGN DECISIONS that must be
resolved with the user before implementation.

NO runtime changes. NO imports of unwritten code. Test-only file.
"""

import pytest
import numpy as np

from services.portfolio.feasibility_precheck import run_feasibility_precheck


# =========================================================================
# Helper: minimal _read_bound implementation (mirrors test_feasibility_precheck.py)
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
def ten_asset_universe():
    """10-asset universe: 5 equity + 5 bond."""
    return [f"EQ{i}" for i in range(5)] + [f"BD{i}" for i in range(5)]


@pytest.fixture
def ten_asset_exposure():
    """Exposure vectors for 10-asset universe (5 equity + 5 bond)."""
    return {
        "equity": np.array([1.0]*5 + [0.0]*5),
        "bond":   np.array([0.0]*5 + [1.0]*5),
        "cash":   np.zeros(10),
        "alternative": np.zeros(10),
        "real_asset":  np.zeros(10),
        "other":  np.zeros(10),
    }


# =========================================================================
# BLOCK_LOCKS_INCOMPATIBLE_BUCKET — Design tests (GAP-H1)
#
# Future check: detect when locked positions in one bucket make it
# mathematically impossible to satisfy another bucket's minimum requirement.
# =========================================================================

class TestLocksIncompatibleBucket:
    """
    Design contract for BLOCK_LOCKS_INCOMPATIBLE_BUCKET.

    Scenario: user locks assets in RF (bond) that consume so much budget
    that the RV (equity) minimum cannot be reached, or vice versa.
    """

    def test_case_a_lock_60_rf_aggressive_profile(
        self, ten_asset_universe, ten_asset_exposure,
    ):
        """
        Case A: lock 60% in RF + aggressive profile requiring RV min=85%.

        Lock consumes 60% budget in bond → only 40% left for equity.
        bond.max = 20% but locked = 60% → exceeds bucket max.
        Expected: BLOCK_LOCKS_INCOMPATIBLE_BUCKET. Implemented in BLOCK-7.
        """
        bounds = {
            "equity": {"min": 0.85, "max": 1.0},
            "bond":   {"min": 0.0,  "max": 0.20},
        }
        # BD0=20%, BD1=20%, BD2=20% → 60% locked in bond
        fixed_weights = {"BD0": 0.20, "BD1": 0.20, "BD2": 0.20}

        result = run_feasibility_precheck(
            universe=ten_asset_universe,
            max_weight=0.20,
            active_bounds=bounds,
            exposure_vectors=ten_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )

        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes

    def test_case_b_lock_30_equity_max_20(
        self, six_asset_universe, six_asset_exposure,
    ):
        """
        Case B: lock 30% in equity but bucket equity.max = 20%.

        The lock itself (30%) exceeds the bucket maximum (20%).
        Expected: BLOCK_LOCKS_INCOMPATIBLE_BUCKET. Implemented in BLOCK-7.
        """
        bounds = {
            "equity": {"min": 0.0, "max": 0.20},
            "bond":   {"min": 0.40, "max": 1.0},
        }
        # EQ0=15%, EQ1=15% → 30% locked in equity, but max equity = 20%
        fixed_weights = {"EQ0": 0.15, "EQ1": 0.15}

        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )

        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes

    def test_case_c_lock_10_rf_aggressive_compatible(
        self, ten_asset_universe, ten_asset_exposure,
    ):
        """
        Case C: lock 10% in RF + aggressive profile requiring RV min=85%.

        Lock consumes 10% in bond → 90% left for equity.
        equity.min = 85% → 90% >= 85% → compatible.
        Expected future: NOT blocked (no BLOCK_LOCKS_INCOMPATIBLE_BUCKET).
        """
        bounds = {
            "equity": {"min": 0.85, "max": 1.0},
            "bond":   {"min": 0.0,  "max": 0.20},
        }
        fixed_weights = {"BD0": 0.10}

        result = run_feasibility_precheck(
            universe=ten_asset_universe,
            max_weight=0.20,
            active_bounds=bounds,
            exposure_vectors=ten_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )

        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" not in codes

    def test_case_d_lock_mode_free_always_compatible(
        self, six_asset_universe, six_asset_exposure,
    ):
        """
        Case D: lock_mode="free" → weights are NOT enforced.

        Even with high fixed_weights values, lock_mode=free means the
        optimizer is free to choose any weight. No bucket incompatibility.
        Expected: compatible (no BLOCK_LOCKS_INCOMPATIBLE_BUCKET).

        NOTE: This test is NOT xfail because the current runtime already
        skips lock checks when lock_mode="free" (see BLOCK-4 behavior).
        """
        bounds = {
            "equity": {"min": 0.85, "max": 1.0},
            "bond":   {"min": 0.0,  "max": 0.20},
        }
        # High locked values but mode is "free" → ignored
        fixed_weights = {"BD0": 0.40, "BD1": 0.40}

        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="free",
            _read_bound_fn=_test_read_bound,
        )

        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" not in codes

    def test_case_e_lock_mode_min_keep_exceeds_bucket(
        self, six_asset_universe, six_asset_exposure,
    ):
        """
        Case E: lock_mode="min_keep" with locked weight exceeding bucket max.

        Decision P3 (closed): min_keep counts against bucket ceiling.
        min_keep 60% in bond but bond.max = 20% → BLOCK.
        Implemented in BLOCK-7.
        """
        bounds = {
            "equity": {"min": 0.70, "max": 1.0},
            "bond":   {"min": 0.0,  "max": 0.20},
        }
        # BD0=30%, BD1=30% → 60% locked in bond, but max bond = 20%
        fixed_weights = {"BD0": 0.30, "BD1": 0.30}

        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="min_keep",
            _read_bound_fn=_test_read_bound,
        )

        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes


# =========================================================================
# BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR — Design tests (GAP-H2)
#
# Future check: detect when locked positions in non-equity buckets
# consume so much budget that equity_floor cannot be reached.
# =========================================================================

class TestLocksIncompatibleEquityFloor:
    """
    Design contract for BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR.

    Scenario: user locks assets in RF/cash that consume enough budget
    to make the equity_floor unreachable.

    NOTE: equity_floor is a separate concept from bucket equity.min,
    computed by _check_feasibility_and_autoexpand(). This check would
    need to receive equity_floor as an additional parameter to
    run_feasibility_precheck() — which is a contract extension.
    """

    @pytest.mark.xfail(
        strict=True,
        reason="GAP-H2 pending runtime implementation: "
               "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR not yet in feasibility_precheck.py "
               "(also requires equity_floor parameter addition)",
    )
    def test_case_a_rf_cash_locks_35_equity_floor_75(
        self, ten_asset_universe, ten_asset_exposure,
    ):
        """
        Case A: locks in RF/cash totalize 35%, equity_floor=75%.

        Budget consumed by non-equity locks: 35%.
        Maximum achievable equity: 100% - 35% = 65%.
        equity_floor = 75% → 65% < 75% → incompatible.
        Expected future: BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR.
        """
        bounds = {
            "equity": {"min": 0.70, "max": 1.0},
            "bond":   {"min": 0.0,  "max": 0.30},
            "cash":   {"min": 0.0,  "max": 0.10},
        }
        # BD0=15%, BD1=10%, BD2=10% → 35% locked in bond/cash
        fixed_weights = {"BD0": 0.15, "BD1": 0.10, "BD2": 0.10}
        # equity_floor would be 0.75 (derived from profile)
        # NOTE: This test assumes equity_floor will be passed as a
        # parameter to run_feasibility_precheck in the future.
        # For now, we test against current API which lacks equity_floor.

        result = run_feasibility_precheck(
            universe=ten_asset_universe,
            max_weight=0.20,
            active_bounds=bounds,
            exposure_vectors=ten_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )

        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR" in codes

    def test_case_b_equity_locks_50_equity_floor_75_compatible(
        self, ten_asset_universe, ten_asset_exposure,
    ):
        """
        Case B: locks in equity totalize 50%, equity_floor=75%.

        Budget already in equity via locks: 50%.
        Remaining budget: 50%. Can allocate more to equity.
        Total achievable equity: 50% + remaining → up to 100%.
        equity_floor = 75% → 100% >= 75% → compatible.
        Expected future: NOT blocked.
        """
        bounds = {
            "equity": {"min": 0.70, "max": 1.0},
            "bond":   {"min": 0.0,  "max": 0.30},
        }
        # EQ0=20%, EQ1=15%, EQ2=15% → 50% locked in equity
        fixed_weights = {"EQ0": 0.20, "EQ1": 0.15, "EQ2": 0.15}

        result = run_feasibility_precheck(
            universe=ten_asset_universe,
            max_weight=0.20,
            active_bounds=bounds,
            exposure_vectors=ten_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )

        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR" not in codes

    def test_case_c_equity_floor_zero_always_compatible(
        self, six_asset_universe, six_asset_exposure,
    ):
        """
        Case C: equity_floor = 0 → any lock configuration is compatible.

        If there is no equity floor requirement, locks in RF/cash
        cannot violate a non-existent constraint.
        Expected future: NOT blocked.
        """
        bounds = {
            "equity": {"min": 0.0, "max": 1.0},
            "bond":   {"min": 0.0, "max": 1.0},
        }
        # Heavy RF locks but equity_floor=0
        fixed_weights = {"BD0": 0.40, "BD1": 0.30, "BD2": 0.20}

        result = run_feasibility_precheck(
            universe=six_asset_universe,
            max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=six_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )

        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR" not in codes

    def test_case_d_equity_locks_exactly_equal_floor(
        self, ten_asset_universe, ten_asset_exposure,
    ):
        """
        Case D: locks in equity exactly equal to equity_floor.

        equity locked = 75%, equity_floor = 75%.
        Exactly meets the floor → compatible.
        Expected future: NOT blocked.
        """
        bounds = {
            "equity": {"min": 0.70, "max": 1.0},
            "bond":   {"min": 0.0,  "max": 0.30},
        }
        # EQ0=20%, EQ1=20%, EQ2=20%, EQ3=15% → 75% locked in equity
        fixed_weights = {"EQ0": 0.20, "EQ1": 0.20, "EQ2": 0.20, "EQ3": 0.15}

        result = run_feasibility_precheck(
            universe=ten_asset_universe,
            max_weight=0.20,
            active_bounds=bounds,
            exposure_vectors=ten_asset_exposure,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_test_read_bound,
        )

        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR" not in codes
