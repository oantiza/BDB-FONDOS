# -*- coding: utf-8 -*-
"""
BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0
===================================================
Design contract tests for thematic equity commodities/gold/mining/precious-metals
suitability exclusion rule.

STRUCTURE:
  Class TestCurrentEngineGapDocumented — documents the actual gap (passes today).
  Class TestFutureContractThematicCommodities — xfail-strict: expected rule not yet implemented.
  Class TestOptionBClassificationFix — proves Option B (is_sector_fund=True) already works.

EXPECTED FUTURE CONTRACT:
  "Funds classified as THEMATIC_EQUITY with a commodities/precious-metals/gold/mining
  theme are concentrated, high-volatility sector assets. They must NOT be eligible
  for risk profiles below 5 (1-4), regardless of their economic equity exposure value.
  Compatible profiles must be [5,6,7,8,9,10]."

ROOT CAUSE OF GAP (as of commit a3ceb46):
  These 14 HOLD funds have:
    asset_subtype = THEMATIC_EQUITY
    is_sector_fund = False      (the gap — they should be treated as sector funds)
    economic_exposure.equity = 0.0  (gold/mining: Morningstar reports 0% equity)

  Engine check L61: `if is_sector_fund` → False (gap)
  Engine check L64: `asset_subtype in {"EMERGING_MARKETS_EQUITY", "HIGH_YIELD_BOND"}` → False (gap)
  Engine check L32: real_eq = 0.0 → no equity cap triggers

  Result: engine computes [3,4,5,6,7,8,9,10] for these funds — WRONG for gold/mining/metals.

ISINs affected (all 14 HOLD_DO_NOT_ADD_P3_P4):
  IE00BYVJR916  Jupiter Gold & Silver Fund L EUR Acc
  LU0090845842  BlackRock GF World Mining Fund E2
  LU0171306680  BlackRock GF World Gold Fund E2 EUR
  LU0172157280  BlackRock GF World Mining Fund A2 EUR
  LU0172157363  BlackRock GF World Mining Fund E2 EUR
  LU0273148055  DWS Invest Gold and Precious Metals Equities NC
  LU0273159177  DWS Invest Gold and Precious Metals Equities LC
  LU0326425351  BlackRock GF World Mining Fund E2 EUR Hdg
  LU0496368142  Franklin Gold & Precious Metals Fund A(acc) EUR
  LU0496369389  Franklin Gold & Precious Metals Fund N(acc) EUR
  LU0604766674  Allianz GIF Global Metals and Mining
  LU1223083087  Schroder ISF Global Gold A Acc EUR Hdg
  LU1223084051  Schroder ISF Global Gold A Acc PLN Hdg
  LU1578889864  Ninety One GSF Global Gold Fund A Acc EUR Hdg

References:
  BDB-SUITABILITY-THEMATIC-EQUITY-COMMODITIES-RULE-0
  Closeout commit: a3ceb46
  Artifact: artifacts/suitability/compatible_profiles_sector_equity_verify_0.json
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.portfolio.suitability_engine import is_fund_eligible_for_profile


# ─── FIXTURE HELPERS ──────────────────────────────────────────────────────────

def _make_thematic_equity_gold_fund_as_stored() -> dict:
    """
    Synthetic fixture mirroring the current Firestore state of the 14 HOLD funds:
      - asset_subtype = THEMATIC_EQUITY
      - is_sector_fund = False  (the gap)
      - economic_exposure: equity=0, bond=0, cash=0, other=100 (gold/physical)

    The portfolio_exposure_v2.economic_exposure structure is used because
    get_v2_asset_mix() reads mix from .asset_mix or .economic_exposure, not top-level.
    When equity=0 and other=100, total > 0 so has_v2_exposure = True.
    """
    return {
        "isin": "TEST_GOLD_STORED",
        "name": "Test Gold Mining Fund (as-stored state)",
        "classification_v2": {
            "asset_type": "equity",
            "asset_subtype": "THEMATIC_EQUITY",
            "risk_bucket": "HIGH",
            "is_sector_fund": False,   # gap: this should be True for gold/mining
            "sector_focus": None,
            "is_suitable_low_risk": False,
        },
        "portfolio_exposure_v2": {
            "economic_exposure": {
                "equity": 0.0,     # Morningstar: 0% equity (physical gold / mining instruments)
                "bond": 0.0,
                "cash": 0.0,
                "other": 100.0,    # reported as 100% "other"
            }
        },
    }


def _make_thematic_equity_gold_fund_option_b() -> dict:
    """
    Option B fix: is_sector_fund=True + sector_focus=COMMODITIES.
    No engine code change required — existing rule L61 handles it.
    """
    fund = _make_thematic_equity_gold_fund_as_stored()
    fund["isin"] = "TEST_GOLD_OPTIONB"
    fund["name"] = "Test Gold Mining Fund (Option B fixed)"
    fund["classification_v2"]["is_sector_fund"] = True
    fund["classification_v2"]["sector_focus"] = "COMMODITIES"
    return fund


def _make_thematic_equity_gold_fund_option_a(theme: str = "GOLD") -> dict:
    """
    Option A fixture: adds suitability_theme field.
    The engine does NOT yet read this field — tests using this fixture
    that expect exclusion must be marked xfail.
    """
    fund = _make_thematic_equity_gold_fund_as_stored()
    fund["isin"] = f"TEST_GOLD_OPTIONA_{theme}"
    fund["name"] = f"Test Gold Mining Fund (Option A, theme={theme})"
    fund["classification_v2"]["suitability_theme"] = theme
    return fund


# ─── CURRENT BEHAVIOR DOCUMENTATION (PASS today — document the gap) ───────────

class TestCurrentEngineGapDocumented:
    """
    Tests that PASS today but document an incorrect behavior (the gap).
    These confirm the gap is real, not theoretical.

    When the gap is fixed, these tests must be REMOVED or INVERTED.
    Do NOT xfail these — we want them to actively document current state.
    """

    def test_engine_sees_exposure_present_for_gold_fund(self):
        """
        Confirms that has_v2_exposure=True for the gold fund fixture.
        The "missing exposure" branch in the engine is NOT triggered.
        """
        from services.portfolio.utils import get_v2_asset_mix
        fund = _make_thematic_equity_gold_fund_as_stored()
        mix = get_v2_asset_mix(fund, as_percent=True)
        assert mix, (
            "Gold fund with other=100 must have usable v2 exposure. "
            f"Got empty mix: {mix}"
        )
        assert mix.get("equity", 0.0) == pytest.approx(0.0, abs=0.1), (
            f"Equity must be 0.0% for gold fund. Got: {mix}"
        )

    def test_thematic_equity_gold_currently_eligible_for_p3(self):
        """
        GAP DOCUMENTED: Engine incorrectly allows gold/mining THEMATIC_EQUITY for p3.
        is_sector_fund=False + real_eq=0.0 → no rule fires → eligible.
        Must become False once the fix is implemented.
        """
        fund = _make_thematic_equity_gold_fund_as_stored()
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=3)
        assert eligible is True, (
            f"GAP: THEMATIC_EQUITY gold fund is currently INCORRECTLY allowed for p3. "
            f"Engine says: {reason}. "
            "Fix via BDB-SUITABILITY-THEMATIC-COMMODITIES-IMPLEMENT-GATE-0."
        )

    def test_thematic_equity_gold_currently_eligible_for_p4(self):
        """
        GAP DOCUMENTED: Engine incorrectly allows gold/mining THEMATIC_EQUITY for p4.
        """
        fund = _make_thematic_equity_gold_fund_as_stored()
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=4)
        assert eligible is True, (
            f"GAP: THEMATIC_EQUITY gold fund INCORRECTLY allowed for p4. Got: {reason}"
        )

    def test_thematic_equity_gold_eligible_for_p5_to_p10(self):
        """
        Correct today and must remain correct after fix: p5-p10 must always be allowed.
        """
        fund = _make_thematic_equity_gold_fund_as_stored()
        for profile in range(5, 11):
            eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=profile)
            assert eligible is True, (
                f"THEMATIC_EQUITY gold fund must always be eligible for p{profile}. "
                f"Got: {reason}"
            )

    def test_current_computed_profiles_are_3_to_10(self):
        """
        Confirms that current engine computes [3..10] for these funds — the stale result.
        Stored value is [5..10]. Stored is correct; computed is the gap.
        """
        fund = _make_thematic_equity_gold_fund_as_stored()
        computed = [p for p in range(1, 11) if is_fund_eligible_for_profile(fund, p)[0]]
        assert computed == list(range(3, 11)), (
            f"Current gap: engine computes {computed} (should be [3..10] to confirm the gap). "
            "Stored policy value is [5..10]. Gap confirmed."
        )

    def test_stored_policy_profiles_should_be_5_to_10(self):
        """
        Documents what the correct profile set must be regardless of implementation path:
        [5, 6, 7, 8, 9, 10] — confirmed by human review of all 14 funds.
        """
        expected_policy_profiles = [5, 6, 7, 8, 9, 10]
        # Simulate what Option B produces (already correct):
        fund = _make_thematic_equity_gold_fund_option_b()
        option_b_result = [p for p in range(1, 11) if is_fund_eligible_for_profile(fund, p)[0]]
        assert option_b_result == expected_policy_profiles, (
            f"Option B must produce policy profiles {expected_policy_profiles}. "
            f"Got: {option_b_result}"
        )


# ─── OPTION B — CLASSIFICATION FIX (works TODAY with current engine) ──────────

class TestOptionBClassificationFix:
    """
    Proves that Option B (set is_sector_fund=True, sector_focus=COMMODITIES in Firestore)
    works immediately with the CURRENT engine via the existing sector fund rule (L61).

    Option B requires a Firestore write (a new write gate) but NO engine code change.
    These tests are NOT xfail because they pass today.
    """

    @pytest.mark.parametrize("profile", [3, 4])
    def test_option_b_blocks_conservative_profiles(self, profile):
        """
        is_sector_fund=True + sector_focus=COMMODITIES → existing rule L61 blocks p3/p4.
        """
        fund = _make_thematic_equity_gold_fund_option_b()
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=profile)
        assert eligible is False, (
            f"Option B: sector fund rule must block p{profile}. Got eligible=True"
        )
        assert "Sector funds" in reason or "sector" in reason.lower(), (
            f"Option B reason must mention sector exclusion. Got: {reason}"
        )

    @pytest.mark.parametrize("profile", [1, 2])
    def test_option_b_blocks_very_conservative_profiles(self, profile):
        """
        p1/p2 also blocked: risk_bucket=HIGH + is_suitable_low_risk=False.
        """
        fund = _make_thematic_equity_gold_fund_option_b()
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=profile)
        assert eligible is False, (
            f"Option B: p{profile} must be blocked for HIGH risk + is_suitable_low_risk=False. "
            f"Got: {reason}"
        )

    @pytest.mark.parametrize("profile", [5, 6, 7, 8, 9, 10])
    def test_option_b_allows_moderate_and_aggressive_profiles(self, profile):
        """
        After Option B fix, p5-p10 must remain accessible.
        """
        fund = _make_thematic_equity_gold_fund_option_b()
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=profile)
        assert eligible is True, (
            f"Option B: p{profile} must be allowed for gold/mining fund. Got: {reason}"
        )

    def test_option_b_produces_correct_policy_profiles(self):
        """
        Option B produces [5..10] — matching the stored policy value for all 14 HOLD funds.
        """
        fund = _make_thematic_equity_gold_fund_option_b()
        result = [p for p in range(1, 11) if is_fund_eligible_for_profile(fund, p)[0]]
        assert result == [5, 6, 7, 8, 9, 10], (
            f"Option B must produce [5..10]. Got: {result}"
        )

    def test_option_b_sector_focus_healthcare_profile_5_allowed(self):
        """
        Cross-check: COMMODITIES sector_focus must NOT trigger the healthcare
        rule (L69). Profile 5 must be allowed for COMMODITIES, not only for p>=6.
        """
        fund = _make_thematic_equity_gold_fund_option_b()
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=5)
        assert eligible is True, (
            f"COMMODITIES sector_focus must not trigger healthcare p5 exclusion. "
            f"Got: eligible={eligible}, reason={reason}"
        )


# ─── FUTURE CONTRACT — OPTION A (xfail-strict: engine rule not yet implemented) ─

class TestFutureContractOptionA:
    """
    EXPECTED FUTURE CONTRACT via Option A (add explicit engine rule for suitability_theme).

    These tests are marked xfail(strict=True) because the engine does NOT yet read
    the `suitability_theme` field from classification_v2.

    When the rule is implemented (BDB-SUITABILITY-THEMATIC-COMMODITIES-IMPLEMENT-GATE-0),
    remove @pytest.mark.xfail and the tests will become normal regression guards.

    The contract: if classification_v2.suitability_theme in
    {"COMMODITIES", "GOLD", "MINING", "PRECIOUS_METALS", "SILVER"}
    then profile <= 4 must return False.
    """

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "EXPECTED FUTURE CONTRACT — NOT YET IMPLEMENTED. "
            "suitability_engine.py has no rule for suitability_theme. "
            "Implement in BDB-SUITABILITY-THEMATIC-COMMODITIES-IMPLEMENT-GATE-0. "
            "Once implemented, remove this xfail decorator."
        ),
        raises=AssertionError,
    )
    def test_option_a_suitability_theme_gold_blocks_p3(self):
        """
        Future contract: classification_v2.suitability_theme = 'GOLD' must block p3.
        """
        fund = _make_thematic_equity_gold_fund_option_a("GOLD")
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=3)
        assert eligible is False, (
            f"FUTURE CONTRACT (Option A): suitability_theme=GOLD must block p3. "
            f"Got eligible={eligible}, reason={reason}"
        )

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "EXPECTED FUTURE CONTRACT — NOT YET IMPLEMENTED. "
            "Engine has no suitability_theme rule."
        ),
        raises=AssertionError,
    )
    def test_option_a_suitability_theme_mining_blocks_p4(self):
        """
        Future contract: suitability_theme = 'MINING' must block p4.
        """
        fund = _make_thematic_equity_gold_fund_option_a("MINING")
        eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=4)
        assert eligible is False, (
            f"FUTURE CONTRACT (Option A): suitability_theme=MINING must block p4. "
            f"Got: eligible={eligible}, reason={reason}"
        )

    @pytest.mark.xfail(
        strict=True,
        reason=(
            "EXPECTED FUTURE CONTRACT — NOT YET IMPLEMENTED. "
            "All profiles 1-4 must be excluded for PRECIOUS_METALS theme."
        ),
        raises=AssertionError,
    )
    def test_option_a_precious_metals_blocks_all_conservative_profiles(self):
        """
        Future contract: PRECIOUS_METALS theme must block profiles 1, 2, 3, 4.
        """
        fund = _make_thematic_equity_gold_fund_option_a("PRECIOUS_METALS")
        for profile in [1, 2, 3, 4]:
            eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=profile)
            assert eligible is False, (
                f"FUTURE CONTRACT: PRECIOUS_METALS must block p{profile}. "
                f"Got: eligible={eligible}, reason={reason}"
            )

    def test_option_a_p5_to_p10_must_still_be_allowed(self):
        """
        Current and future contract: p5-p10 must always be allowed.
        NOT xfail — must pass today and after fix.
        """
        for theme in ["GOLD", "MINING", "PRECIOUS_METALS", "COMMODITIES"]:
            fund = _make_thematic_equity_gold_fund_option_a(theme)
            for profile in range(5, 11):
                eligible, reason = is_fund_eligible_for_profile(fund, risk_profile=profile)
                assert eligible is True, (
                    f"Theme={theme}: p{profile} must be allowed. Got: {reason}"
                )
