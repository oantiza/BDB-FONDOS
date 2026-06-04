"""
Expected behavior tests for locks + feasibility precheck.

Based on user-approved decisions P1–P5 documented in:
- docs/BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0.md (84d7246)

These tests cover the approved behavior implemented by the current runtime.
Future-only design notes remain in the decision document instead of appearing
as executable placeholders. Every collected test in this module must pass.

NO runtime changes. NO imports of unwritten code. Test-only file.

Coverage map:
  A1–A4: keep_weight / keep_money (P2)
  B5–B7: min_keep (P3)
  C8:    free (P4)
  D9:     equity_floor hard in standard mode (P1)
  E11:    effective bounds source (P5)
  F13:   Mixto (P5 note)
"""

import pytest
import numpy as np

from services.portfolio.feasibility_precheck import run_feasibility_precheck


# =========================================================================
# Helper
# =========================================================================

def _read_bound(raw):
    """Mirrors optimizer_core._read_bound for test isolation."""
    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        return (float(raw[0]), float(raw[1]))
    if isinstance(raw, dict):
        mn = raw.get("min")
        mx = raw.get("max")
        return (
            float(mn) if mn is not None else None,
            float(mx) if mx is not None else None,
        )
    return (None, None)


# =========================================================================
# Fixtures
# =========================================================================

@pytest.fixture
def uni10():
    """10-asset universe: 5 equity + 5 bond."""
    return [f"EQ{i}" for i in range(5)] + [f"BD{i}" for i in range(5)]


@pytest.fixture
def exp10():
    """Exposure vectors for 10-asset universe."""
    return {
        "equity": np.array([1.0]*5 + [0.0]*5),
        "bond":   np.array([0.0]*5 + [1.0]*5),
        "cash":   np.zeros(10),
        "alternative": np.zeros(10),
        "real_asset":  np.zeros(10),
        "other":  np.zeros(10),
    }


@pytest.fixture
def uni12_with_mixto():
    """12-asset universe: 4 equity + 4 bond + 4 mixto."""
    return (
        [f"EQ{i}" for i in range(4)]
        + [f"BD{i}" for i in range(4)]
        + [f"MX{i}" for i in range(4)]
    )


@pytest.fixture
def exp12_with_mixto():
    """Exposure vectors for 12-asset universe with Mixto bucket."""
    return {
        "equity": np.array([1.0]*4 + [0.0]*4 + [0.0]*4),
        "bond":   np.array([0.0]*4 + [1.0]*4 + [0.0]*4),
        "mixto":  np.array([0.0]*4 + [0.0]*4 + [1.0]*4),
        "cash":   np.zeros(12),
        "alternative": np.zeros(12),
        "real_asset":  np.zeros(12),
        "other":  np.zeros(12),
    }


AGGRESSIVE_BOUNDS = {
    "equity": {"min": 0.85, "max": 1.0},
    "bond":   {"min": 0.0,  "max": 0.20},
}

MODERATE_BOUNDS = {
    "equity": {"min": 0.40, "max": 0.60},
    "bond":   {"min": 0.20, "max": 0.40},
}


# =========================================================================
# A. keep_weight / keep_money — Decision P2
# =========================================================================

class TestKeepWeightBehavior:
    """P2: keep_weight = hard equality. BLOCK if incompatible."""

    def test_a1_keep_weight_compatible_no_block(self, uni10, exp10):
        """A1: keep_weight with small lock compatible with bounds.
        Decision P2: no BLOCK expected. Current runtime supports this."""
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.20,
            active_bounds=AGGRESSIVE_BOUNDS,
            exposure_vectors=exp10,
            fixed_weights={"BD0": 0.05},
            lock_mode="keep_weight",
            _read_bound_fn=_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" not in codes

    def test_a2_keep_weight_exceeds_bucket_max(self, uni10, exp10):
        """A2: lock 30% equity but equity.max=20%. Pure math contradiction.
        Decision P2: BLOCK. Implemented in BLOCK-7."""
        bounds = {"equity": {"min": 0.0, "max": 0.20},
                  "bond": {"min": 0.40, "max": 1.0}}
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=exp10,
            fixed_weights={"EQ0": 0.15, "EQ1": 0.15},
            lock_mode="keep_weight",
            _read_bound_fn=_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes

    def test_a3_keep_weight_blocks_equity_floor(self, uni10, exp10):
        """A3: lock 40% in bond, equity_floor=75%. Max equity=60%<75%.
        Decision P1+P2: BLOCK in standard mode. Implemented in BLOCK-8."""
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.20,
            active_bounds=AGGRESSIVE_BOUNDS,
            exposure_vectors=exp10,
            fixed_weights={"BD0": 0.15, "BD1": 0.15, "BD2": 0.10},
            lock_mode="keep_weight",
            _read_bound_fn=_read_bound,
            equity_floor=0.75,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR" in codes

    def test_a4_keep_money_equivalent_to_keep_weight(self, uni10, exp10):
        """A4: keep_money treated same as keep_weight once converted.
        Decision P2: same BLOCK behavior. Implemented in BLOCK-7."""
        bounds = {"equity": {"min": 0.0, "max": 0.20},
                  "bond": {"min": 0.40, "max": 1.0}}
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=exp10,
            fixed_weights={"EQ0": 0.15, "EQ1": 0.15},
            lock_mode="keep_money",
            _read_bound_fn=_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes


# =========================================================================
# B. min_keep — Decision P3
# =========================================================================

class TestMinKeepBehavior:
    """P3: min_keep = mandatory minimum. Counts against bucket/equity."""

    def test_b5_min_keep_compatible(self, uni10, exp10):
        """B5: min_keep 10% bond, aggressive profile. 90%>=85%. OK.
        Decision P3: no BLOCK. Current runtime already passes (no check)."""
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.20,
            active_bounds=AGGRESSIVE_BOUNDS,
            exposure_vectors=exp10,
            fixed_weights={"BD0": 0.10},
            lock_mode="min_keep",
            _read_bound_fn=_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" not in codes

    def test_b6_min_keep_exceeds_bucket_max(self, uni10, exp10):
        """B6: min_keep 40% bond but bond.max=20%. Floor>ceiling.
        Decision P3: BLOCK. Implemented in BLOCK-7."""
        bounds = {"equity": {"min": 0.70, "max": 1.0},
                  "bond": {"min": 0.0, "max": 0.20}}
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=exp10,
            fixed_weights={"BD0": 0.20, "BD1": 0.20},
            lock_mode="min_keep",
            _read_bound_fn=_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes

    def test_b7_min_keep_reduces_margin_warning(self, uni10, exp10):
        """B7: min_keep 65% total. Doesn't break math but reduces margin.
        Decision P3: WARNING, not BLOCK. Implemented."""
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.20,
            active_bounds=MODERATE_BOUNDS,
            exposure_vectors=exp10,
            fixed_weights={"EQ0": 0.15, "EQ1": 0.15, "BD0": 0.15, "BD1": 0.10, "BD2": 0.10},
            lock_mode="min_keep",
            _read_bound_fn=_read_bound,
        )
        # Must NOT be blocked (mathematically feasible)
        assert result["is_feasible"] is True
        # Must have warning
        codes_w = [w["code"] for w in result["warnings"]]
        assert "WARNING_LOCKS_HIGH_CONCENTRATION" in codes_w


# =========================================================================
# C. free — Decision P4
# =========================================================================

class TestFreeBehavior:
    """P4: free = no constraint. Not counted as lock."""

    def test_c8_free_never_blocks(self, uni10, exp10):
        """C8: free mode with heavy weights. No constraint generated.
        Decision P4: no BLOCK. Current runtime already supports this."""
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.50,
            active_bounds=AGGRESSIVE_BOUNDS,
            exposure_vectors=exp10,
            fixed_weights={"BD0": 0.40, "BD1": 0.40},
            lock_mode="free",
            _read_bound_fn=_read_bound,
        )
        assert result["is_feasible"] is True
        assert len(result["blocks"]) == 0

    def test_c8b_free_not_counted_in_fixed_exceed(self, uni10, exp10):
        """C8b: free with sum>100%. BLOCK_FIXED_WEIGHTS_EXCEED_100 skipped.
        Decision P4: free is excluded from lock calculations entirely."""
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.50,
            active_bounds=MODERATE_BOUNDS,
            exposure_vectors=exp10,
            fixed_weights={"EQ0": 0.50, "BD0": 0.60},
            lock_mode="free",
            _read_bound_fn=_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_FIXED_WEIGHTS_EXCEED_100" not in codes


# =========================================================================
# D. equity_floor — Decision P1
# =========================================================================

class TestEquityFloorBehavior:
    """P1: equity_floor is HARD in standard mode."""

    def test_d9_equity_floor_hard_standard(self, uni10, exp10):
        """D9: 35% locked non-equity, equity_floor=75%. Max equity=65%<75%.
        Decision P1: BLOCK in standard optimization. Implemented in BLOCK-8."""
        bounds = {"equity": {"min": 0.70, "max": 1.0},
                  "bond": {"min": 0.0, "max": 0.30},
                  "cash": {"min": 0.0, "max": 0.10}}
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.20,
            active_bounds=bounds,
            exposure_vectors=exp10,
            fixed_weights={"BD0": 0.15, "BD1": 0.10, "BD2": 0.10},
            lock_mode="keep_weight",
            _read_bound_fn=_read_bound,
            equity_floor=0.75,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR" in codes

# =========================================================================
# E. Bounds source — Decision P5
# =========================================================================

class TestBoundsSourceBehavior:
    """P5: precheck uses same effective source as solver."""

    def test_e11_precheck_uses_effective_bounds(self, uni10, exp10):
        """E11: precheck receives effective bounds (same as solver will use).
        Decision P5: validate against the same source the solver will use. Implemented in BLOCK-7.
        If bucket_bounds_v1 says equity.max=20% and lock=30%, BLOCK."""
        bounds_v1 = {"equity": {"min": 0.0, "max": 0.20},
                     "bond": {"min": 0.40, "max": 1.0}}
        result = run_feasibility_precheck(
            universe=uni10, max_weight=0.50,
            active_bounds=bounds_v1,
            exposure_vectors=exp10,
            fixed_weights={"EQ0": 0.15, "EQ1": 0.15},
            lock_mode="keep_weight",
            _read_bound_fn=_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes

# =========================================================================
# F. Mixto — Decision P5 note
# =========================================================================

class TestMixtoBehavior:
    """P5 note: Mixto only validated if it has defined bounds."""

    def test_f13a_mixto_with_bounds_validated(
        self, uni12_with_mixto, exp12_with_mixto,
    ):
        """F13a: Mixto has bounds (max=20%). Lock 35% in Mixto. BLOCK. Implemented in BLOCK-7.
        Decision P5 note: if Mixto has bounds, validate like any bucket."""
        bounds = {
            "equity": {"min": 0.40, "max": 0.60},
            "bond":   {"min": 0.20, "max": 0.40},
            "mixto":  {"min": 0.0,  "max": 0.20},
        }
        fixed_weights = {"MX0": 0.15, "MX1": 0.10, "MX2": 0.10}
        result = run_feasibility_precheck(
            universe=uni12_with_mixto, max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=exp12_with_mixto,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_read_bound,
        )
        assert result["is_feasible"] is False
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" in codes

    def test_f13b_mixto_open_bounds_no_block(
        self, uni12_with_mixto, exp12_with_mixto,
    ):
        """F13b: Mixto has open bounds (0%–100%). Lock 60% in Mixto.
        Decision P5 note: open bounds cannot generate incompatibility."""
        bounds = {
            "equity": {"min": 0.0, "max": 1.0},
            "bond":   {"min": 0.0, "max": 1.0},
            "mixto":  {"min": 0.0, "max": 1.0},
        }
        fixed_weights = {"MX0": 0.20, "MX1": 0.20, "MX2": 0.20}
        result = run_feasibility_precheck(
            universe=uni12_with_mixto, max_weight=0.50,
            active_bounds=bounds,
            exposure_vectors=exp12_with_mixto,
            fixed_weights=fixed_weights,
            lock_mode="keep_weight",
            _read_bound_fn=_read_bound,
        )
        codes = [b["code"] for b in result["blocks"]]
        assert "BLOCK_LOCKS_INCOMPATIBLE_BUCKET" not in codes
