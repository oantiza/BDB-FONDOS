"""
Tests for buildPortfolioExposureV2 Morningstar portfolio.asset_allocation fix.

Validates that the exposure source precedence is:
  1. metrics (top-level legacy field)
  2. ms.portfolio.asset_allocation (Morningstar real data)
  3. Fallback by classification subtype

BDB-MIXED-EXPOSURE-FIX-DRYRUN-0
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "maintenance"))

from populate_taxonomy_v2 import classifyFundV2, buildPortfolioExposureV2


# ──────────────────────────────────────────────────────────────
# 1. MIXED flexible sin metrics pero con ms.portfolio.asset_allocation
# ──────────────────────────────────────────────────────────────

class TestMixedWithMsPortfolio:
    """When metrics is empty but ms.portfolio.asset_allocation has real data,
    buildPortfolioExposureV2 should use Morningstar data, NOT 50/50 fallback."""

    def test_flexible_uses_morningstar_data(self):
        """Brightgate Focus A FI case: ms.equity=85.58, should NOT be 50/50."""
        data = {
            "name": "Brightgate Focus A FI",
            "ms": {
                "category_morningstar": "Mixtos Flexibles EUR",
                "portfolio": {
                    "asset_allocation": {
                        "equity": 85.58,
                        "bond": 0.0,
                        "cash": 10.94,
                        "other": 3.48,
                    }
                },
            },
        }
        klass = classifyFundV2("ES0114904008", data)
        exp = buildPortfolioExposureV2("ES0114904008", data, klass)

        # Should use Morningstar, not 50/50
        assert exp.economic_exposure.equity > 80.0, (
            f"Expected equity > 80 from Morningstar, got {exp.economic_exposure.equity}"
        )
        assert exp.economic_exposure.bond < 5.0, (
            f"Expected bond < 5 from Morningstar, got {exp.economic_exposure.bond}"
        )
        assert "EXPOSURE_SOURCE_MS_PORTFOLIO" in exp.warnings
        assert "EXPOSURE_INFERRED_FROM_CLASSIFICATION" not in exp.warnings
        assert exp.exposure_confidence >= 0.80

    def test_conservative_uses_morningstar_data(self):
        """Cartesio X FI case: ms.equity=24.44, ms.bond=80.23. Should use real, not 20/80."""
        data = {
            "name": "Cartesio X FI",
            "ms": {
                "category_morningstar": "Mixtos Defensivos EUR",
                "portfolio": {
                    "asset_allocation": {
                        "equity": 24.44,
                        "bond": 80.23,
                        "cash": 0.0,
                        "other": 0.0,
                    }
                },
            },
        }
        klass = classifyFundV2("ES0116567035", data)
        exp = buildPortfolioExposureV2("ES0116567035", data, klass)

        # Should use Morningstar: ~24.44 equity, not 20 (conservative fallback) or 50 (flex fallback)
        assert 23.0 < exp.economic_exposure.equity < 26.0, (
            f"Expected equity ~24.44 from Morningstar, got {exp.economic_exposure.equity}"
        )
        assert exp.economic_exposure.bond > 75.0
        assert "EXPOSURE_SOURCE_MS_PORTFOLIO" in exp.warnings
        assert exp.exposure_confidence >= 0.80


# ──────────────────────────────────────────────────────────────
# 2. MIXED sin metrics Y sin ms.portfolio.asset_allocation
# ──────────────────────────────────────────────────────────────

class TestMixedFallback:
    """When neither metrics nor ms.portfolio exists, fallback should still work
    as before, but be clearly marked as inferred."""

    def test_flexible_fallback_50_50(self):
        """Without any data source, flexible MIXED falls back to 50/50."""
        data = {
            "name": "Some Flexible Mixed Fund",
            "ms": {"category_morningstar": "Mixtos Flexibles EUR"},
        }
        klass = classifyFundV2("TEST_FLEX", data)
        exp = buildPortfolioExposureV2("TEST_FLEX", data, klass)

        assert exp.economic_exposure.equity == pytest.approx(50.0, abs=1.0)
        assert exp.economic_exposure.bond == pytest.approx(50.0, abs=1.0)
        assert "EXPOSURE_INFERRED_FROM_CLASSIFICATION" in exp.warnings
        assert "EXPOSURE_SOURCE_MS_PORTFOLIO" not in exp.warnings
        assert exp.exposure_confidence == pytest.approx(0.55, abs=0.01)

    def test_conservative_fallback_20_80(self):
        """Conservative MIXED without Morningstar data → 20/80."""
        data = {
            "name": "Some Conservative Fund Defensivo",
            "ms": {"category_morningstar": "Mixtos Defensivos EUR"},
        }
        klass = classifyFundV2("TEST_CONS", data)
        exp = buildPortfolioExposureV2("TEST_CONS", data, klass)

        assert exp.economic_exposure.equity == pytest.approx(20.0, abs=1.0)
        assert exp.economic_exposure.bond == pytest.approx(80.0, abs=1.0)
        assert "EXPOSURE_INFERRED_FROM_CLASSIFICATION" in exp.warnings
        assert exp.exposure_confidence == pytest.approx(0.55, abs=0.01)

    def test_aggressive_fallback_80_20(self):
        """Aggressive MIXED without Morningstar data → 80/20."""
        data = {
            "name": "Some Aggressive Fund Crecimiento",
            "ms": {"category_morningstar": "Mixtos Agresivos EUR"},
        }
        klass = classifyFundV2("TEST_AGG", data)
        exp = buildPortfolioExposureV2("TEST_AGG", data, klass)

        assert exp.economic_exposure.equity == pytest.approx(80.0, abs=1.0)
        assert exp.economic_exposure.bond == pytest.approx(20.0, abs=1.0)
        assert "EXPOSURE_INFERRED_FROM_CLASSIFICATION" in exp.warnings


# ──────────────────────────────────────────────────────────────
# 3. Fondo con metrics válido (precedencia sobre Morningstar)
# ──────────────────────────────────────────────────────────────

class TestMetricsPrecedence:
    """When top-level metrics has valid data, it takes precedence over
    ms.portfolio.asset_allocation."""

    def test_metrics_takes_precedence(self):
        """If metrics has equity=90, that should be used even if ms.portfolio differs."""
        data = {
            "name": "Fund With Metrics",
            "metrics": {"equity": 90.0, "bond": 5.0, "cash": 3.0, "other": 2.0},
            "ms": {
                "portfolio": {
                    "asset_allocation": {
                        "equity": 70.0,
                        "bond": 20.0,
                        "cash": 5.0,
                        "other": 5.0,
                    }
                }
            },
        }
        klass = classifyFundV2("TEST_MET", data)
        exp = buildPortfolioExposureV2("TEST_MET", data, klass)

        assert exp.economic_exposure.equity == pytest.approx(90.0, abs=1.0)
        assert "EXPOSURE_SOURCE_MS_PORTFOLIO" not in exp.warnings
        assert "EXPOSURE_INFERRED_FROM_CLASSIFICATION" not in exp.warnings
        assert exp.exposure_confidence >= 0.85


# ──────────────────────────────────────────────────────────────
# 4. Escala: Morningstar 0-100 → economic_exposure 0-100
# ──────────────────────────────────────────────────────────────

class TestScaleConsistency:
    """Morningstar data is in 0-100 scale and economic_exposure should be 0-100."""

    def test_morningstar_scale_preserved(self):
        """Values from ms.portfolio should stay in 0-100 scale."""
        data = {
            "name": "Scale Test Fund",
            "ms": {
                "category_morningstar": "Mixtos Flexibles EUR",
                "portfolio": {
                    "asset_allocation": {
                        "equity": 60.0,
                        "bond": 25.0,
                        "cash": 10.0,
                        "other": 5.0,
                    }
                },
            },
        }
        klass = classifyFundV2("TEST_SCALE", data)
        exp = buildPortfolioExposureV2("TEST_SCALE", data, klass)

        assert exp.economic_exposure.equity == pytest.approx(60.0, abs=1.0)
        assert exp.economic_exposure.bond == pytest.approx(25.0, abs=1.0)
        assert exp.economic_exposure.cash == pytest.approx(10.0, abs=1.0)
        assert exp.economic_exposure.other == pytest.approx(5.0, abs=1.0)

    def test_morningstar_sum_normalizes(self):
        """If Morningstar sum != 100, _normalize_pct_block should normalize it."""
        data = {
            "name": "Normalize Test Fund",
            "ms": {
                "category_morningstar": "Mixtos Flexibles EUR",
                "portfolio": {
                    "asset_allocation": {
                        "equity": 50.0,
                        "bond": 30.0,
                        "cash": 10.0,
                        "other": 5.0,
                    }
                },
            },
        }
        klass = classifyFundV2("TEST_NORM", data)
        exp = buildPortfolioExposureV2("TEST_NORM", data, klass)

        # Sum is 95, should normalize to 100
        total = (
            exp.economic_exposure.equity
            + exp.economic_exposure.bond
            + exp.economic_exposure.cash
            + exp.economic_exposure.other
        )
        assert total == pytest.approx(100.0, abs=0.5)

    def test_morningstar_low_sum_rejected(self):
        """If ms.portfolio sum < 10, it should be treated as invalid and fall back."""
        data = {
            "name": "Low Sum Fund",
            "ms": {
                "category_morningstar": "Mixtos Flexibles EUR",
                "portfolio": {
                    "asset_allocation": {
                        "equity": 3.0,
                        "bond": 2.0,
                        "cash": 1.0,
                        "other": 0.0,
                    }
                },
            },
        }
        klass = classifyFundV2("TEST_LOW", data)
        exp = buildPortfolioExposureV2("TEST_LOW", data, klass)

        # Should fall back to 50/50 since ms_total < 10
        assert exp.economic_exposure.equity == pytest.approx(50.0, abs=1.0)
        assert "EXPOSURE_INFERRED_FROM_CLASSIFICATION" in exp.warnings


# ──────────────────────────────────────────────────────────────
# 5. Non-MIXED types should be unaffected
# ──────────────────────────────────────────────────────────────

class TestNonMixedUnaffected:
    """The fix should not change behavior for EQUITY, FIXED_INCOME, etc."""

    def test_equity_still_infers_100(self):
        """EQUITY fund without metrics should still get equity=100."""
        data = {
            "name": "Pure Equity Fund Global",
            "ms": {"category_morningstar": "RV Global Cap. Grande Blend"},
        }
        klass = classifyFundV2("TEST_EQ", data)
        exp = buildPortfolioExposureV2("TEST_EQ", data, klass)

        assert exp.economic_exposure.equity == pytest.approx(100.0, abs=1.0)

    def test_fixed_income_still_infers_100(self):
        """FIXED_INCOME fund without metrics should still get bond=100."""
        data = {
            "name": "Euro Bond Fund",
            "legacy_category": "RF Deuda Corporativa EUR",
            "ms": {"category_morningstar": "RF Deuda Corporativa EUR"},
        }
        klass = classifyFundV2("TEST_FI", data)
        exp = buildPortfolioExposureV2("TEST_FI", data, klass)

        assert exp.economic_exposure.bond == pytest.approx(100.0, abs=1.0)
