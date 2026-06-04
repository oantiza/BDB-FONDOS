"""Regression contracts for thematic equity and commodities suitability.

The adopted runtime policy does not use the proposed ``suitability_theme``
field. Profiles 1-4 are excluded through one of the supported canonical paths:

* real equity exposure exceeds the conservative profile caps;
* the fund is classified as a sector fund; or
* the canonical asset type is commodities.

All three paths must produce compatible profiles [5, 6, 7, 8, 9, 10].
"""

import pytest

from services.portfolio.suitability_engine import is_fund_eligible_for_profile
from services.portfolio.utils import get_v2_asset_mix


def _make_thematic_equity_fund() -> dict:
    """Mirror the current high-equity gold/mining classification path."""
    return {
        "isin": "TEST_THEMATIC_EQUITY",
        "name": "Test Gold Mining Equity Fund",
        "classification_v2": {
            "asset_type": "equity",
            "asset_subtype": "THEMATIC_EQUITY",
            "risk_bucket": "HIGH",
            "is_sector_fund": False,
            "sector_focus": None,
            "is_suitable_low_risk": False,
        },
        "portfolio_exposure_v2": {
            "economic_exposure": {
                "equity": 0.97,
                "bond": 0.0,
                "cash": 0.01,
                "other": 0.02,
            }
        },
    }


def _make_sector_classified_commodity_fund() -> dict:
    """Mirror the adopted classification fallback for non-equity exposure."""
    fund = _make_thematic_equity_fund()
    fund["isin"] = "TEST_SECTOR_CLASSIFIED_COMMODITY"
    fund["classification_v2"]["is_sector_fund"] = True
    fund["classification_v2"]["sector_focus"] = "PRECIOUS_METALS"
    fund["portfolio_exposure_v2"]["economic_exposure"] = {
        "equity": 0.0,
        "bond": 0.0,
        "cash": 0.0,
        "other": 100.0,
    }
    return fund


def _make_canonical_commodity_fund() -> dict:
    """Mirror the canonical commodities asset-type path."""
    fund = _make_sector_classified_commodity_fund()
    fund["isin"] = "TEST_CANONICAL_COMMODITY"
    fund["classification_v2"]["asset_type"] = "commodities"
    fund["classification_v2"]["asset_subtype"] = "PRECIOUS_METALS"
    fund["classification_v2"]["is_sector_fund"] = False
    fund["classification_v2"]["sector_focus"] = None
    return fund


def _compatible_profiles(fund: dict) -> list[int]:
    return [
        profile
        for profile in range(1, 11)
        if is_fund_eligible_for_profile(fund, profile)[0]
    ]


class TestCurrentThematicEquityPolicy:
    def test_engine_reads_current_high_equity_exposure(self):
        mix = get_v2_asset_mix(_make_thematic_equity_fund(), as_percent=True)
        assert mix["equity"] == pytest.approx(97.0)

    @pytest.mark.parametrize("profile", [1, 2, 3, 4])
    def test_current_thematic_equity_blocks_profiles_1_to_4(self, profile):
        eligible, _ = is_fund_eligible_for_profile(
            _make_thematic_equity_fund(),
            risk_profile=profile,
        )
        assert eligible is False

    @pytest.mark.parametrize("profile", [5, 6, 7, 8, 9, 10])
    def test_current_thematic_equity_allows_profiles_5_to_10(self, profile):
        eligible, reason = is_fund_eligible_for_profile(
            _make_thematic_equity_fund(),
            risk_profile=profile,
        )
        assert eligible is True, reason

    def test_current_thematic_equity_produces_policy_profiles(self):
        assert _compatible_profiles(_make_thematic_equity_fund()) == [5, 6, 7, 8, 9, 10]

    def test_current_policy_does_not_require_unadopted_suitability_theme(self):
        fund = _make_thematic_equity_fund()
        assert "suitability_theme" not in fund["classification_v2"]
        assert _compatible_profiles(fund) == [5, 6, 7, 8, 9, 10]


class TestSupportedCommodityFallbacks:
    @pytest.mark.parametrize("profile", [3, 4])
    def test_sector_classification_blocks_low_moderate_profiles(self, profile):
        eligible, reason = is_fund_eligible_for_profile(
            _make_sector_classified_commodity_fund(),
            risk_profile=profile,
        )
        assert eligible is False
        assert "sector" in reason.lower()

    def test_sector_classification_produces_policy_profiles(self):
        assert _compatible_profiles(_make_sector_classified_commodity_fund()) == [
            5, 6, 7, 8, 9, 10,
        ]

    @pytest.mark.parametrize("profile", [3, 4])
    def test_canonical_commodity_type_blocks_low_moderate_profiles(self, profile):
        eligible, _ = is_fund_eligible_for_profile(
            _make_canonical_commodity_fund(),
            risk_profile=profile,
        )
        assert eligible is False

    def test_canonical_commodity_type_produces_policy_profiles(self):
        assert _compatible_profiles(_make_canonical_commodity_fund()) == [
            5, 6, 7, 8, 9, 10,
        ]
