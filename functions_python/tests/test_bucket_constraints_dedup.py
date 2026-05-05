# functions_python/tests/test_bucket_constraints_dedup.py
# -*- coding: utf-8 -*-

"""
Tests for the bucket constraints deduplication quick win.

Verifies that:
1. When bucket_bounds_v1 has active bounds, profile constraints are NOT duplicated.
2. When bucket_bounds_v1 is empty, profile legacy constraints still apply.
3. Aggressive profiles P8-P10 maintain constraints regardless of source.
4. Fallback chain is not broken.
"""

import numpy as np
import pytest
from unittest.mock import MagicMock, patch, call
import logging

from services.portfolio.optimizer_core import _apply_standard_constraints


def _make_ef_mock(n_assets=3):
    """Create a mock EfficientFrontier with constraint tracking."""
    ef = MagicMock()
    ef.tickers = [f"Fund{i}" for i in range(n_assets)]
    ef._constraints_added = []

    def _track_constraint(fn):
        ef._constraints_added.append(fn)

    ef.add_constraint.side_effect = _track_constraint
    return ef


def _make_vectors(n=3):
    """Create simple exposure vectors for n assets."""
    eq_v = np.array([1.0, 0.0, 0.0])[:n]
    bd_v = np.array([0.0, 1.0, 0.0])[:n]
    cs_v = np.array([0.0, 0.0, 1.0])[:n]
    al_v = np.zeros(n)
    ra_v = np.zeros(n)
    ot_v = np.zeros(n)
    return eq_v, bd_v, cs_v, al_v, ra_v, ot_v


class TestBucketConstraintsDedup:
    """Tests for the deduplication logic in _apply_standard_constraints."""

    def test_v1_active_skips_profile_constraints(self):
        """When bucket_bounds_v1 has active bounds, profile block should be skipped."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        # Active v1 bounds
        bucket_bounds_v1 = {
            "equity": {"min": 0.4, "max": 0.8},
            "bond": {"min": 0.1, "max": 0.5},
        }

        # Profile buckets that would add redundant constraints
        current_risk_buckets = {
            5: {
                "RV": {"min": 0.4, "max": 0.6},
                "RF": {"min": 0.2, "max": 0.4},
                "Monetario": {"min": 0.0, "max": 0.1},
                "Alternativos": {"min": 0.0, "max": 0.2},
                "Otros": {"min": 0.0, "max": 0.25},
            }
        }

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="free",
            apply_profile=True,
            risk_level_i=5,
            locked_assets=[],
            fixed_weights={},
            asset_metadata={},
            current_risk_buckets=current_risk_buckets,
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1=bucket_bounds_v1,
        )

        # Should have constraints from v1 (equity min, equity max, bond min, bond max = 4)
        # Should NOT have constraints from profile (RV, RF, Monetario, Alternativos, Otros)
        # Total: exactly 4 constraints from v1, 0 from profile
        assert ef.add_constraint.call_count == 4, (
            f"Expected 4 constraints from v1 only, got {ef.add_constraint.call_count}"
        )

    def test_v1_empty_uses_profile_legacy(self):
        """When bucket_bounds_v1 is empty, profile constraints should apply."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        # Empty v1 bounds
        bucket_bounds_v1 = {}

        # Profile with active constraints
        current_risk_buckets = {
            5: {
                "RV": {"min": 0.4, "max": 0.6},
                "RF": {"min": 0.2, "max": 0.4},
                "Monetario": {"min": 0.0, "max": 0.1},
                "Alternativos": {"min": 0.0, "max": 0.2},
                "Otros": {"min": 0.0, "max": 0.25},
            }
        }

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="free",
            apply_profile=True,
            risk_level_i=5,
            locked_assets=[],
            fixed_weights={},
            asset_metadata={},
            current_risk_buckets=current_risk_buckets,
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1=bucket_bounds_v1,
        )

        # Profile has 5 buckets × 2 (min/max) = up to 10 constraints
        # Some mins are 0.0 which get skipped (min_val is not None but 0.0 passes)
        # All max values < 1.0 should be applied
        # At minimum we should have constraints from the profile
        assert ef.add_constraint.call_count > 0, (
            "Expected profile constraints to apply when v1 is empty"
        )

    def test_v1_none_uses_profile_legacy(self):
        """When bucket_bounds_v1 is None, profile constraints should apply."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        current_risk_buckets = {
            8: {
                "RV": {"min": 0.85, "max": 1.0},
                "RF": {"min": 0.0, "max": 0.05},
                "Monetario": {"min": 0.0, "max": 0.05},
                "Alternativos": {"min": 0.0, "max": 0.1},
                "Otros": {"min": 0.0, "max": 0.15},
            }
        }

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="free",
            apply_profile=True,
            risk_level_i=8,
            locked_assets=[],
            fixed_weights={},
            asset_metadata={},
            current_risk_buckets=current_risk_buckets,
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1=None,
        )

        # With v1=None, profile should apply
        assert ef.add_constraint.call_count > 0, (
            "Expected profile constraints when v1 is None"
        )

    def test_aggressive_p8_maintains_equity_constraint_via_v1(self):
        """P8 with v1 active should still have equity constraint (from v1 not profile)."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        # P8 v1 bounds with high equity floor
        bucket_bounds_v1 = {
            "equity": {"min": 0.85, "max": 1.0},
            "bond": {"min": None, "max": 0.05},
            "cash": {"min": None, "max": 0.05},
        }

        current_risk_buckets = {
            8: {
                "RV": {"min": 0.85, "max": 1.0},
                "RF": {"min": 0.0, "max": 0.05},
                "Monetario": {"min": 0.0, "max": 0.05},
            }
        }

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="free",
            apply_profile=True,
            risk_level_i=8,
            locked_assets=[],
            fixed_weights={},
            asset_metadata={},
            current_risk_buckets=current_risk_buckets,
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1=bucket_bounds_v1,
        )

        # v1 should add constraints: equity.min(0.85), bond.max(0.05), cash.max(0.05) = 3
        # Profile should be skipped
        assert ef.add_constraint.call_count == 3, (
            f"Expected 3 constraints from v1 for P8, got {ef.add_constraint.call_count}"
        )

    def test_aggressive_p10_maintains_constraints(self):
        """P10 with v1 active should still enforce high equity and low everything else."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        bucket_bounds_v1 = {
            "equity": {"min": 0.95, "max": 1.0},
            "bond": {"min": None, "max": 0.05},
            "cash": {"min": None, "max": 0.05},
            "alternative": {"min": None, "max": 0.05},
            "other": {"min": None, "max": None},
        }

        current_risk_buckets = {
            10: {
                "RV": {"min": 0.95, "max": 1.0},
                "RF": {"min": 0.0, "max": 0.05},
                "Monetario": {"min": 0.0, "max": 0.05},
                "Alternativos": {"min": 0.0, "max": 0.05},
                "Otros": {"min": 0.0, "max": 0.0},
            }
        }

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="free",
            apply_profile=True,
            risk_level_i=10,
            locked_assets=[],
            fixed_weights={},
            asset_metadata={},
            current_risk_buckets=current_risk_buckets,
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1=bucket_bounds_v1,
        )

        # v1 active → profile skipped. v1 adds: equity.min(0.95), bond.max(0.05),
        # cash.max(0.05), alternative.max(0.05) = 4 constraints
        # equity.max(1.0) → skipped (>= 1.0-1e-6)
        # other.max(None) → skipped
        assert ef.add_constraint.call_count == 4, (
            f"Expected 4 constraints from v1 for P10, got {ef.add_constraint.call_count}"
        )

    def test_no_profile_no_constraints_applied(self):
        """When apply_profile=False, no bucket constraints from either source."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="free",
            apply_profile=False,
            risk_level_i=5,
            locked_assets=[],
            fixed_weights={},
            asset_metadata={},
            current_risk_buckets={},
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1={},
        )

        assert ef.add_constraint.call_count == 0

    def test_skip_log_emitted_when_v1_active(self, caplog):
        """When v1 is active, a log message should indicate profile was skipped."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        bucket_bounds_v1 = {"equity": {"min": 0.5, "max": 0.9}}
        current_risk_buckets = {5: {"RV": {"min": 0.4, "max": 0.6}}}

        with caplog.at_level(logging.INFO, logger="services.portfolio.optimizer_core"):
            _apply_standard_constraints(
                ef_inst=ef,
                constraints={},
                lock_mode="free",
                apply_profile=True,
                risk_level_i=5,
                locked_assets=[],
                fixed_weights={},
                asset_metadata={},
                current_risk_buckets=current_risk_buckets,
                eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
                al_v=al_v, ra_v=ra_v, ot_v=ot_v,
                bucket_bounds_v1=bucket_bounds_v1,
            )

        log_messages = caplog.text
        assert "SKIPPED" in log_messages or "bucket_bounds_v1 already active" in log_messages, (
            f"Expected skip log message, got: {log_messages}"
        )

    def test_mixto_not_injected_as_hard_constraint(self):
        """Mixto should never appear as a hard constraint vector in the solver."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        # Even if profile has Mixto bounds, _build_profile_bucket_vectors doesn't generate Mixto
        # This is a structural test: bucket_bounds_v1 has no "mixto" key
        bucket_bounds_v1 = {
            "equity": {"min": 0.3, "max": 0.7},
        }

        current_risk_buckets = {
            5: {
                "RV": {"min": 0.4, "max": 0.6},
                "Mixto": {"min": 0.2, "max": 0.5},  # This should NOT be applied
            }
        }

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="free",
            apply_profile=True,
            risk_level_i=5,
            locked_assets=[],
            fixed_weights={},
            asset_metadata={},
            current_risk_buckets=current_risk_buckets,
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1=bucket_bounds_v1,
        )

        # v1 active → profile skipped entirely. Mixto never injected.
        # v1 adds: equity.min(0.3), equity.max(0.7) = 2
        assert ef.add_constraint.call_count == 2

    def test_locked_assets_preserved_with_v1_active(self):
        """Locked asset constraints should always apply regardless of v1/profile."""
        ef = _make_ef_mock()
        eq_v, bd_v, cs_v, al_v, ra_v, ot_v = _make_vectors()

        bucket_bounds_v1 = {"equity": {"min": 0.4, "max": 0.8}}
        current_risk_buckets = {5: {"RV": {"min": 0.4, "max": 0.6}}}

        _apply_standard_constraints(
            ef_inst=ef,
            constraints={},
            lock_mode="keep_weight",
            apply_profile=True,
            risk_level_i=5,
            locked_assets=["Fund0"],
            fixed_weights={"Fund0": 0.3},
            asset_metadata={},
            current_risk_buckets=current_risk_buckets,
            eq_v=eq_v, bd_v=bd_v, cs_v=cs_v,
            al_v=al_v, ra_v=ra_v, ot_v=ot_v,
            bucket_bounds_v1=bucket_bounds_v1,
        )

        # 1 locked asset constraint + 2 v1 constraints (equity min, equity max) = 3
        assert ef.add_constraint.call_count == 3
