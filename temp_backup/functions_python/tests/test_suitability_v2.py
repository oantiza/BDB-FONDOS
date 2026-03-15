"""
Backend Suitability V2 Tests

Tests:
- is_fund_eligible_for_profile() across 10 mandatory fund mocks × profiles 1-10
- get_economic_bucket() for all fund types
- Edge cases: missing V2, partial V2, conflicting data
"""
import sys
import os
import pytest

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.portfolio.suitability_engine import (
    is_fund_eligible_for_profile,
    get_economic_bucket,
)

# ─── 10 MANDATORY FUND MOCKS ────────────────────────────────────────────

MOCK_BIOTECH = {
    "isin": "LU0000000001",
    "name": "Pictet Biotech Fund",
    "classification_v2": {
        "asset_type": "EQUITY",
        "asset_subtype": "SECTOR_EQUITY_HEALTHCARE",
        "region_primary": "GLOBAL",
        "risk_bucket": "HIGH",
        "is_thematic": False,
        "is_sector_fund": True,
        "sector_focus": "HEALTHCARE",
        "is_suitable_low_risk": False,
        "classification_confidence": 0.9,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 98, "bond": 0, "cash": 2, "other": 0},
    },
}

MOCK_GLOBAL_EQUITY = {
    "isin": "LU0000000002",
    "name": "MS INVF Global Brands Fund",
    "classification_v2": {
        "asset_type": "EQUITY",
        "asset_subtype": "GLOBAL_EQUITY",
        "region_primary": "GLOBAL",
        "risk_bucket": "MEDIUM",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": False,
        "classification_confidence": 0.95,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 95, "bond": 0, "cash": 5, "other": 0},
    },
}

MOCK_MONEY_MARKET = {
    "isin": "LU0000000003",
    "name": "Amundi EUR Money Market",
    "classification_v2": {
        "asset_type": "MONETARY",
        "asset_subtype": "UNKNOWN",
        "region_primary": "EUROZONE",
        "risk_bucket": "LOW",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": True,
        "classification_confidence": 1.0,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 0, "bond": 10, "cash": 90, "other": 0},
    },
}

MOCK_HIGH_YIELD = {
    "isin": "LU0000000004",
    "name": "Robeco High Yield Bonds",
    "classification_v2": {
        "asset_type": "FIXED_INCOME",
        "asset_subtype": "HIGH_YIELD_BOND",
        "region_primary": "GLOBAL",
        "risk_bucket": "HIGH",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": False,
        "fi_credit_bucket": "LOW_QUALITY",
        "classification_confidence": 0.92,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 0, "bond": 95, "cash": 5, "other": 0},
    },
}

MOCK_ALLOCATION_AGGRESSIVE = {
    "isin": "LU0000000005",
    "name": "BlackRock Global Allocation Aggressive",
    "classification_v2": {
        "asset_type": "MIXED",
        "asset_subtype": "AGGRESSIVE_ALLOCATION",
        "region_primary": "GLOBAL",
        "risk_bucket": "HIGH",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": False,
        "classification_confidence": 0.88,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 70, "bond": 20, "cash": 10, "other": 0},
    },
}

MOCK_ALLOCATION_CONSERVATIVE = {
    "isin": "LU0000000006",
    "name": "Nordea Stable Return",
    "classification_v2": {
        "asset_type": "MIXED",
        "asset_subtype": "CONSERVATIVE_ALLOCATION",
        "region_primary": "EUROPE",
        "risk_bucket": "LOW",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": True,
        "classification_confidence": 0.91,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 20, "bond": 70, "cash": 10, "other": 0},
    },
}

MOCK_SMALLCAP_EM = {
    "isin": "LU0000000007",
    "name": "Templeton EM Small Cap",
    "classification_v2": {
        "asset_type": "EQUITY",
        "asset_subtype": "EMERGING_MARKETS_EQUITY",
        "region_primary": "EMERGING",
        "risk_bucket": "HIGH",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": False,
        "classification_confidence": 0.87,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 97, "bond": 0, "cash": 3, "other": 0},
    },
}

MOCK_CONVERTIBLE = {
    "isin": "LU0000000008",
    "name": "Lazard Convertibles Global",
    "classification_v2": {
        "asset_type": "FIXED_INCOME",
        "asset_subtype": "CONVERTIBLE_BOND",
        "region_primary": "GLOBAL",
        "risk_bucket": "MEDIUM",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": False,
        "convertibles_profile": "EQUITY_LIKE",
        "classification_confidence": 0.78,
    },
    "portfolio_exposure_v2": {
        "economic_exposure": {"equity": 60, "bond": 30, "cash": 10, "other": 0},
    },
}

MOCK_AMBIGUOUS = {
    "isin": "LU0000000009",
    "name": "Obscure Multi-Asset Flex",
    # NO classification_v2
    "metrics": {"equity": 45, "bond": 30, "cash": 15, "other": 10},
}

MOCK_ALTERNATIVE = {
    "isin": "LU0000000010",
    "name": "AQR Multi-Strategy Alternative",
    "classification_v2": {
        "asset_type": "ALTERNATIVE",
        "asset_subtype": "UNKNOWN",
        "region_primary": "GLOBAL",
        "risk_bucket": "HIGH",
        "is_thematic": False,
        "is_sector_fund": False,
        "is_suitable_low_risk": False,
        "classification_confidence": 0.82,
    },
}


# ─── SUITABILITY TESTS ──────────────────────────────────────────────────


class TestBiotechSectorial:
    def test_blocked_profile_1(self):
        eligible, reason = is_fund_eligible_for_profile(MOCK_BIOTECH, 1)
        assert eligible is False
        assert "not suitable" in reason.lower() or "sector" in reason.lower()

    def test_blocked_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_BIOTECH, 2)
        assert eligible is False

    def test_blocked_profile_3(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_BIOTECH, 3)
        assert eligible is False, "Biotech sector fund should be blocked for profile 3"

    def test_blocked_profile_4(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_BIOTECH, 4)
        assert eligible is False, "Biotech sector fund should be blocked for profile ≤ 4"

    def test_allowed_profile_7(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_BIOTECH, 7)
        assert eligible is True


class TestGlobalEquityCore:
    def test_blocked_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_GLOBAL_EQUITY, 1)
        assert eligible is False

    def test_blocked_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_GLOBAL_EQUITY, 2)
        assert eligible is False

    def test_allowed_profile_5(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_GLOBAL_EQUITY, 5)
        assert eligible is True

    def test_allowed_profile_8(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_GLOBAL_EQUITY, 8)
        assert eligible is True


class TestMoneyMarket:
    def test_allowed_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_MONEY_MARKET, 1)
        assert eligible is True

    def test_allowed_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_MONEY_MARKET, 2)
        assert eligible is True

    def test_allowed_profile_10(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_MONEY_MARKET, 10)
        assert eligible is True


class TestHighYield:
    def test_blocked_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_HIGH_YIELD, 1)
        assert eligible is False

    def test_blocked_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_HIGH_YIELD, 2)
        assert eligible is False

    def test_blocked_profile_4(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_HIGH_YIELD, 4)
        assert eligible is False, "HY bond excluded for profile ≤ 4"

    def test_allowed_profile_5(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_HIGH_YIELD, 5)
        assert eligible is True


class TestAllocationAggressive:
    def test_blocked_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALLOCATION_AGGRESSIVE, 1)
        assert eligible is False

    def test_blocked_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALLOCATION_AGGRESSIVE, 2)
        assert eligible is False

    def test_blocked_profile_3(self):
        """70% equity exceeds profile 3 limit (45%)"""
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALLOCATION_AGGRESSIVE, 3)
        assert eligible is False

    def test_blocked_profile_4(self):
        """70% equity exceeds profile 4 limit (60%)"""
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALLOCATION_AGGRESSIVE, 4)
        assert eligible is False

    def test_allowed_profile_6(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALLOCATION_AGGRESSIVE, 6)
        assert eligible is True


class TestAllocationConservative:
    def test_allowed_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALLOCATION_CONSERVATIVE, 1)
        assert eligible is True, "Conservative allocation (20% eq) should be allowed for profile 1"

    def test_allowed_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALLOCATION_CONSERVATIVE, 2)
        assert eligible is True


class TestSmallCapEM:
    def test_blocked_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_SMALLCAP_EM, 1)
        assert eligible is False

    def test_blocked_profile_4(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_SMALLCAP_EM, 4)
        assert eligible is False, "EM equity excluded for profile ≤ 4"

    def test_allowed_profile_5(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_SMALLCAP_EM, 5)
        assert eligible is True


class TestConvertible:
    def test_blocked_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_CONVERTIBLE, 1)
        assert eligible is False

    def test_blocked_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_CONVERTIBLE, 2)
        assert eligible is False

    def test_blocked_profile_3(self):
        """Convertible with 60% real equity exceeds profile 3 limit"""
        eligible, _ = is_fund_eligible_for_profile(MOCK_CONVERTIBLE, 3)
        assert eligible is False

    def test_allowed_profile_5(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_CONVERTIBLE, 5)
        assert eligible is True


class TestAmbiguousNoV2:
    def test_blocked_profile_1_legacy_45pct(self):
        """45% equity in legacy metrics blocks profile 1-2"""
        eligible, reason = is_fund_eligible_for_profile(MOCK_AMBIGUOUS, 1)
        assert eligible is False
        assert "legacy" in reason.lower() or "Legacy" in reason

    def test_blocked_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_AMBIGUOUS, 2)
        assert eligible is False

    def test_allowed_profile_5(self):
        """Legacy with 45% equity allowed from profile 5"""
        eligible, _ = is_fund_eligible_for_profile(MOCK_AMBIGUOUS, 5)
        assert eligible is True


class TestAlternative:
    def test_blocked_profile_1(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALTERNATIVE, 1)
        assert eligible is False

    def test_blocked_profile_2(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALTERNATIVE, 2)
        assert eligible is False

    def test_allowed_profile_5(self):
        eligible, _ = is_fund_eligible_for_profile(MOCK_ALTERNATIVE, 5)
        assert eligible is True


# ─── ECONOMIC BUCKET TESTS ──────────────────────────────────────────────


class TestEconomicBucket:
    def test_biotech_is_satellite_sector(self):
        assert get_economic_bucket(MOCK_BIOTECH) == "satellite_sector_equity"

    def test_global_equity_is_core_dm(self):
        assert get_economic_bucket(MOCK_GLOBAL_EQUITY) == "core_equity_dm"

    def test_money_market_is_defensive_cash(self):
        assert get_economic_bucket(MOCK_MONEY_MARKET) == "defensive_cash"

    def test_high_yield_is_hy_or_em(self):
        assert get_economic_bucket(MOCK_HIGH_YIELD) == "high_yield_or_em_bond"

    def test_allocation_aggressive_is_aggressive(self):
        assert get_economic_bucket(MOCK_ALLOCATION_AGGRESSIVE) == "aggressive_allocation"

    def test_allocation_conservative_is_prudent(self):
        assert get_economic_bucket(MOCK_ALLOCATION_CONSERVATIVE) == "prudent_allocation"

    def test_em_is_satellite_em(self):
        assert get_economic_bucket(MOCK_SMALLCAP_EM) == "satellite_em_equity"

    def test_convertible_is_hy_or_em(self):
        assert get_economic_bucket(MOCK_CONVERTIBLE) == "high_yield_or_em_bond"

    def test_ambiguous_is_legacy(self):
        bucket = get_economic_bucket(MOCK_AMBIGUOUS)
        assert bucket.startswith("legacy_")

    def test_alternative_is_alternatives(self):
        assert get_economic_bucket(MOCK_ALTERNATIVE) == "alternatives_limited"


# ─── EDGE CASE TESTS ────────────────────────────────────────────────────


class TestEdgeCases:
    def test_empty_fund(self):
        """Completely empty fund should use legacy fallback"""
        eligible, reason = is_fund_eligible_for_profile({}, 1)
        assert eligible is True  # No metrics = 0 equity => passes legacy check

    def test_fund_with_only_metrics_high_equity(self):
        """Fund with only metrics and high equity blocked for low profiles"""
        fund = {"metrics": {"equity": 80, "bond": 10, "cash": 10}}
        eligible, _ = is_fund_eligible_for_profile(fund, 1)
        assert eligible is False

    def test_fund_with_v2_but_no_exposure(self):
        """V2 classification but no exposure — should still work"""
        fund = {
            "classification_v2": {
                "asset_type": "MONETARY",
                "is_suitable_low_risk": True,
                "risk_bucket": "LOW",
            }
        }
        eligible, _ = is_fund_eligible_for_profile(fund, 1)
        assert eligible is True

    def test_mixed_v2_unknown_subtype(self):
        """Mixed fund with UNKNOWN subtype — still evaluable"""
        fund = {
            "classification_v2": {
                "asset_type": "MIXED",
                "asset_subtype": "UNKNOWN",
                "is_suitable_low_risk": False,
                "risk_bucket": "MEDIUM",
            }
        }
        eligible, _ = is_fund_eligible_for_profile(fund, 1)
        assert eligible is False  # Not suitable for low risk
