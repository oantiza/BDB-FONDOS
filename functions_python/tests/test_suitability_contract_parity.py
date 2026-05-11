"""
BDB-SUITABILITY-CONTRACT-TESTS-0
=================================
Contract and parity tests for is_fund_eligible_for_profile().

Purpose:
  - Explicitly document every hardcoded suitability rule as a named contract test.
  - Cover gaps identified in BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0:
      * real_eq cap boundary conditions for profiles 3 and 4.
      * Healthcare minimum profile threshold (rule 11).
      * MIXED fund evaluation by economic exposure (not commercial label).
      * Locked-asset bypass (documented as current contract, not tested here — runtime only).
      * Absence of lowQualityCredit rule in backend (FE-9 divergence baseline).
  - Serve as the backend side of the frontend/backend parity contract.

Divergences documented here (do not fix in this block):
  FE-9: Frontend excludes funds with lowQualityCredit >= 35% for profiles <= 4.
        Backend has NO such rule. This is a KNOWN_DIVERGENCE_FRONTEND_ONLY.
        See: docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md §C.1 FE-9

Reference:
  docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md
  docs/BDB_SUITABILITY_CONTRACT_TESTS_0.md
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.portfolio.suitability_engine import is_fund_eligible_for_profile


# ─── SHARED FIXTURES ────────────────────────────────────────────────────────

def make_fund(
    asset_type="EQUITY",
    asset_subtype="GLOBAL_EQUITY",
    risk_bucket="MEDIUM",
    is_sector_fund=False,
    sector_focus=None,
    is_suitable_low_risk=None,
    real_eq=50.0,
    real_bond=50.0,
    real_cash=0.0,
):
    """Factory for minimal V2-compliant fund mocks."""
    class_v2 = {
        "asset_type": asset_type,
        "asset_subtype": asset_subtype,
        "risk_bucket": risk_bucket,
        "is_sector_fund": is_sector_fund,
    }
    if sector_focus:
        class_v2["sector_focus"] = sector_focus
    if is_suitable_low_risk is not None:
        class_v2["is_suitable_low_risk"] = is_suitable_low_risk

    return {
        "classification_v2": class_v2,
        "portfolio_exposure_v2": {
            "economic_exposure": {
                "equity": real_eq,
                "bond": real_bond,
                "cash": real_cash,
                "other": 0.0,
            }
        },
    }


# ─── RULE 1: Strict V2 requirement ──────────────────────────────────────────

class TestContractRule1_StrictV2:
    """CONTRACT: Any fund without classification_v2 is blocked for ALL profiles."""

    def test_no_v2_blocked_conservative(self):
        fund = {"portfolio_exposure_v2": {"economic_exposure": {"equity": 10}}}
        eligible, reason = is_fund_eligible_for_profile(fund, 2)
        assert eligible is False
        assert "Strict V2" in reason

    def test_no_v2_blocked_aggressive(self):
        fund = {"portfolio_exposure_v2": {"economic_exposure": {"equity": 90}}}
        eligible, reason = is_fund_eligible_for_profile(fund, 10)
        assert eligible is False
        assert "Strict V2" in reason

    def test_empty_fund_blocked(self):
        eligible, reason = is_fund_eligible_for_profile({}, 5)
        assert eligible is False
        assert "Strict V2" in reason


# ─── RULE 2: Missing exposure → block conservative profiles ──────────────────

class TestContractRule2_MissingExposure:
    """CONTRACT: Fund with V2 but no portfolio_exposure_v2 is blocked for profiles <= 4."""

    def test_no_exposure_blocked_p1(self):
        fund = {
            "classification_v2": {
                "asset_type": "MONETARY",
                "is_suitable_low_risk": True,
                "risk_bucket": "LOW",
            }
        }
        eligible, reason = is_fund_eligible_for_profile(fund, 1)
        assert eligible is False
        assert "Missing portfolio_exposure_v2" in reason

    def test_no_exposure_blocked_p4(self):
        fund = {
            "classification_v2": {
                "asset_type": "FIXED_INCOME",
                "is_suitable_low_risk": True,
                "risk_bucket": "LOW",
            }
        }
        eligible, reason = is_fund_eligible_for_profile(fund, 4)
        assert eligible is False
        assert "Missing portfolio_exposure_v2" in reason

    def test_no_exposure_warning_but_not_blocked_p5(self):
        """Profile >= 5: missing exposure produces warning but NOT a hard block."""
        fund = {
            "classification_v2": {
                "asset_type": "EQUITY",
                "asset_subtype": "GLOBAL_EQUITY",
                "risk_bucket": "MEDIUM",
                "is_sector_fund": False,
            }
        }
        # No portfolio_exposure_v2 → warning, but profile 5 is not blocked by this rule alone.
        eligible, _ = is_fund_eligible_for_profile(fund, 5)
        assert eligible is True  # Passes — no other rule fires


# ─── RULES 3-4: Very conservative profiles (1-2) ─────────────────────────────

class TestContractRules3_4_VeryConservative:
    """CONTRACT: Profiles 1-2 block is_suitable_low_risk=False and risk_bucket=HIGH."""

    def test_not_suitable_low_risk_blocked_p1(self):
        fund = make_fund(risk_bucket="MEDIUM", is_suitable_low_risk=False, real_eq=5.0)
        eligible, reason = is_fund_eligible_for_profile(fund, 1)
        assert eligible is False
        assert "not suitable" in reason.lower()

    def test_not_suitable_low_risk_blocked_p2(self):
        fund = make_fund(risk_bucket="MEDIUM", is_suitable_low_risk=False, real_eq=5.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 2)
        assert eligible is False

    def test_high_risk_bucket_blocked_p1(self):
        fund = make_fund(risk_bucket="HIGH", is_suitable_low_risk=True, real_eq=5.0)
        eligible, reason = is_fund_eligible_for_profile(fund, 1)
        assert eligible is False
        assert "HIGH" in reason

    def test_high_risk_bucket_blocked_p2(self):
        fund = make_fund(risk_bucket="HIGH", is_suitable_low_risk=True, real_eq=5.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 2)
        assert eligible is False

    def test_low_risk_fund_allowed_p1(self):
        fund = make_fund(risk_bucket="LOW", is_suitable_low_risk=True, real_eq=5.0,
                         asset_type="MONETARY", asset_subtype="UNKNOWN")
        eligible, _ = is_fund_eligible_for_profile(fund, 1)
        assert eligible is True


# ─── RULE 5: real_eq > 30% cap for profiles 1-2 ─────────────────────────────

class TestContractRule5_RealEqCap_P1_P2:
    """CONTRACT: real_eq > 30% is a hard block for profiles 1 and 2."""

    def test_exactly_30_pct_passes_p1(self):
        fund = make_fund(risk_bucket="LOW", is_suitable_low_risk=True, real_eq=30.0,
                         asset_type="MIXED", real_bond=70.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 1)
        assert eligible is True, "Exactly 30% equity should NOT be blocked (rule is > 30)"

    def test_31_pct_blocked_p1(self):
        fund = make_fund(risk_bucket="LOW", is_suitable_low_risk=True, real_eq=31.0,
                         asset_type="MIXED", real_bond=69.0)
        eligible, reason = is_fund_eligible_for_profile(fund, 1)
        assert eligible is False
        assert "30%" in reason or "equity exposure" in reason.lower() or "Real economic equity" in reason

    def test_31_pct_blocked_p2(self):
        fund = make_fund(risk_bucket="LOW", is_suitable_low_risk=True, real_eq=31.0,
                         asset_type="MIXED", real_bond=69.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 2)
        assert eligible is False

    def test_31_pct_allowed_p3(self):
        """31% equity must NOT be blocked by the >30% rule in profile 3 (that rule only applies to p1-2)."""
        fund = make_fund(risk_bucket="LOW", is_suitable_low_risk=True, real_eq=31.0,
                         asset_type="MIXED", real_bond=69.0, is_sector_fund=False)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is True, "31% equity is fine for profile 3 (limit is 45%)"


# ─── RULES 7-8: real_eq caps for profiles 3 and 4 ───────────────────────────

class TestContractRules7_8_RealEqCap_P3_P4:
    """
    CONTRACT: Explicit boundary conditions for real_eq caps.
      - Profile 3: hard block if real_eq > 45%.
      - Profile 4: hard block if real_eq > 60%.
    These are the most sensitive rules post-MIXED remediation, because
    correcting economic_exposure for MIXED funds directly changed real_eq.
    """

    # Profile 3 boundaries
    def test_p3_exactly_45_passes(self):
        fund = make_fund(risk_bucket="LOW", real_eq=45.0, real_bond=55.0,
                         asset_type="MIXED", asset_subtype="CONSERVATIVE_ALLOCATION",
                         is_sector_fund=False)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is True, "Exactly 45% equity should NOT be blocked (rule is > 45)"

    def test_p3_46_blocked(self):
        fund = make_fund(risk_bucket="LOW", real_eq=46.0, real_bond=54.0,
                         asset_type="MIXED", asset_subtype="CONSERVATIVE_ALLOCATION",
                         is_sector_fund=False)
        eligible, reason = is_fund_eligible_for_profile(fund, 3)
        assert eligible is False
        assert "profile 3" in reason.lower() or "45" in reason

    def test_p3_carmignac_patrimoine_style(self):
        """
        Post-MIXED: Carmignac Patrimoine real_eq corrected from 50% (fallback)
        to ~32% (Morningstar). With corrected data it must be ELIGIBLE for p3.
        """
        fund = make_fund(risk_bucket="MEDIUM", real_eq=32.0, real_bond=60.0,
                         asset_type="MIXED", asset_subtype="FLEXIBLE_ALLOCATION",
                         is_sector_fund=False)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is True, (
            "Post-MIXED: Carmignac-style fund (32% real_eq) must be eligible for p3. "
            "If this fails, economic_exposure is still using stale fallback values."
        )

    def test_p3_dma_sri_75_style(self):
        """
        Post-MIXED: Allianz Dynamic MA SRI 75 real_eq corrected to ~75%.
        Must remain INELIGIBLE for p3 (correct exclusion).
        """
        fund = make_fund(risk_bucket="HIGH", real_eq=75.0, real_bond=20.0,
                         asset_type="MIXED", asset_subtype="AGGRESSIVE_ALLOCATION",
                         is_sector_fund=False)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is False, "75% equity Allianz-style fund must be excluded from p3."

    # Profile 4 boundaries
    def test_p4_exactly_60_passes(self):
        fund = make_fund(risk_bucket="MEDIUM", real_eq=60.0, real_bond=40.0,
                         asset_type="MIXED", asset_subtype="MODERATE_ALLOCATION",
                         is_sector_fund=False)
        eligible, _ = is_fund_eligible_for_profile(fund, 4)
        assert eligible is True, "Exactly 60% equity should NOT be blocked (rule is > 60)"

    def test_p4_61_blocked(self):
        fund = make_fund(risk_bucket="MEDIUM", real_eq=61.0, real_bond=39.0,
                         asset_type="MIXED", asset_subtype="MODERATE_ALLOCATION",
                         is_sector_fund=False)
        eligible, reason = is_fund_eligible_for_profile(fund, 4)
        assert eligible is False
        assert "profile 4" in reason.lower() or "60" in reason

    def test_p4_61_allowed_p5(self):
        """61% equity is fine for profile 5 — no real_eq cap above p4."""
        fund = make_fund(risk_bucket="MEDIUM", real_eq=61.0, real_bond=39.0,
                         asset_type="MIXED", asset_subtype="MODERATE_ALLOCATION",
                         is_sector_fund=False)
        eligible, _ = is_fund_eligible_for_profile(fund, 5)
        assert eligible is True, "61% equity must be allowed for profile 5 (no cap above p4)"


# ─── RULE 9: Sector funds excluded for profiles <= 4 ─────────────────────────

class TestContractRule9_SectorFundsConservative:
    """CONTRACT: Any sector fund is excluded for profiles <= 4, regardless of real_eq."""

    def test_sector_fund_low_eq_still_blocked_p4(self):
        """Even if real_eq is low, a sector fund is always blocked for p <= 4."""
        # Use a sector fund with equity within the p4 cap (< 60%) to ensure
        # the block comes from the sector rule, not the real_eq cap.
        fund = make_fund(asset_type="EQUITY", asset_subtype="SECTOR_EQUITY_TECH",
                         risk_bucket="MEDIUM", is_sector_fund=True, real_eq=40.0, real_bond=60.0)
        eligible, reason = is_fund_eligible_for_profile(fund, 4)
        assert eligible is False
        # The sector rule blocks regardless of real_eq level.
        assert "sector" in reason.lower() or "Sector" in reason

    def test_sector_fund_blocked_p3(self):
        fund = make_fund(asset_type="EQUITY", asset_subtype="SECTOR_EQUITY_HEALTHCARE",
                         risk_bucket="HIGH", is_sector_fund=True,
                         sector_focus="HEALTHCARE", real_eq=98.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is False

    def test_sector_fund_allowed_p5_non_healthcare(self):
        """Non-healthcare sector fund is allowed for p >= 5."""
        fund = make_fund(asset_type="EQUITY", asset_subtype="SECTOR_EQUITY_TECH",
                         risk_bucket="HIGH", is_sector_fund=True,
                         sector_focus="TECHNOLOGY", real_eq=98.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 5)
        assert eligible is True


# ─── RULE 11: Healthcare minimum profile 6 ───────────────────────────────────

class TestContractRule11_HealthcareMinProfile6:
    """CONTRACT: Healthcare/Biotech sector funds are blocked for profiles < 6 (even 5)."""

    def test_healthcare_blocked_p5(self):
        """Profile 5 is in range <= 7 AND sector is HEALTHCARE AND profile < 6 → block."""
        fund = make_fund(asset_type="EQUITY", asset_subtype="SECTOR_EQUITY_HEALTHCARE",
                         risk_bucket="HIGH", is_sector_fund=True,
                         sector_focus="HEALTHCARE", real_eq=98.0)
        eligible, reason = is_fund_eligible_for_profile(fund, 5)
        assert eligible is False
        assert "healthcare" in reason.lower() or "volatile" in reason.lower()

    def test_healthcare_allowed_p6(self):
        fund = make_fund(asset_type="EQUITY", asset_subtype="SECTOR_EQUITY_HEALTHCARE",
                         risk_bucket="HIGH", is_sector_fund=True,
                         sector_focus="HEALTHCARE", real_eq=98.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 6)
        assert eligible is True

    def test_healthcare_allowed_p7(self):
        fund = make_fund(asset_type="EQUITY", asset_subtype="SECTOR_EQUITY_HEALTHCARE",
                         risk_bucket="HIGH", is_sector_fund=True,
                         sector_focus="HEALTHCARE", real_eq=98.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 7)
        assert eligible is True

    def test_tech_sector_allowed_p5(self):
        """Technology sector fund (not healthcare) has no extra restriction beyond p > 4."""
        fund = make_fund(asset_type="EQUITY", asset_subtype="SECTOR_EQUITY_TECH",
                         risk_bucket="HIGH", is_sector_fund=True,
                         sector_focus="TECHNOLOGY", real_eq=98.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 5)
        assert eligible is True


# ─── MIXED FUNDS: economic exposure takes precedence ─────────────────────────

class TestContractMixedFundLookthrough:
    """
    CONTRACT: MIXED funds are evaluated by portfolio_exposure_v2.economic_exposure,
    NOT by the commercial 'MIXED' asset_type label.
    This is essential for post-MIXED remediation correctness.
    """

    def test_mixed_with_high_eq_blocked_p3(self):
        """Commercial label: MIXED. Economic reality: 75% equity → blocked p3."""
        fund = make_fund(asset_type="MIXED", asset_subtype="AGGRESSIVE_ALLOCATION",
                         risk_bucket="HIGH", real_eq=75.0, real_bond=20.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is False, (
            "MIXED fund with 75% real equity must be blocked for p3 via lookthrough."
        )

    def test_mixed_with_low_eq_allowed_p3(self):
        """Commercial label: MIXED. Economic reality: 25% equity → allowed p3."""
        fund = make_fund(asset_type="MIXED", asset_subtype="CONSERVATIVE_ALLOCATION",
                         risk_bucket="LOW", is_suitable_low_risk=True,
                         real_eq=25.0, real_bond=70.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is True, (
            "MIXED fund with 25% real equity must be allowed for p3 via lookthrough."
        )

    def test_mixed_exactly_45_boundary_p3(self):
        """Boundary: 45% real equity for profile 3 must pass (rule is > 45)."""
        fund = make_fund(asset_type="MIXED", asset_subtype="FLEXIBLE_ALLOCATION",
                         risk_bucket="MEDIUM", real_eq=45.0, real_bond=55.0)
        eligible, _ = is_fund_eligible_for_profile(fund, 3)
        assert eligible is True

    def test_mixed_pre_remediation_50_50_would_have_been_blocked_p3(self):
        """
        REGRESSION GUARD: Simulates the pre-remediation 50/50 fallback for a MIXED fund.
        At 50% equity this must be BLOCKED for p3 (> 45% rule).
        Documents why 59 MIXED funds changed eligibility after remediation.
        """
        fund = make_fund(asset_type="MIXED", asset_subtype="FLEXIBLE_ALLOCATION",
                         risk_bucket="MEDIUM", real_eq=50.0, real_bond=50.0)
        eligible, reason = is_fund_eligible_for_profile(fund, 3)
        assert eligible is False, (
            "50% real_eq (pre-remediation fallback) correctly blocks p3. "
            "Post-remediation, real values differ per fund — this test validates the rule."
        )
        assert "45" in reason or "profile 3" in reason.lower()


# ─── FE-9 BASELINE: Backend does NOT have lowQualityCredit rule ───────────────

class TestContractFE9BackendBaseline:
    """
    KNOWN_DIVERGENCE_FRONTEND_ONLY — FE-9
    ======================================
    The frontend (rulesEngine.ts) excludes funds with lowQualityCredit >= 35%
    for profiles <= 4. The backend has NO such rule.

    These tests document and protect this KNOWN DIVERGENCE.
    Do NOT add the lowQualityCredit rule to the backend without a formal decision.

    Reference: docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md §C.1 FE-9
    Decision needed: BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0
    """

    def test_high_yield_bond_still_blocked_by_subtype(self):
        """
        High-yield bond is blocked for p <= 4 by asset_subtype rule (Rule 10),
        NOT by lowQualityCredit. The block is correct but via a different mechanism.
        """
        fund = make_fund(
            asset_type="FIXED_INCOME",
            asset_subtype="HIGH_YIELD_BOND",
            risk_bucket="HIGH",
            real_eq=0.0,
            real_bond=95.0,
        )
        eligible, reason = is_fund_eligible_for_profile(fund, 4)
        assert eligible is False
        # The engine may fire the risk_bucket=HIGH rule or the HY_BOND subtype rule.
        # Either way, the block is correct — and neither uses lowQualityCredit.
        assert (
            "HIGH_YIELD_BOND" in reason
            or "Subtype" in reason
            or "excluded" in reason.lower()
            or "high risk" in reason.lower()
        )

    def test_backend_accepts_low_quality_credit_rf_fund_p4(self):
        """
        KNOWN_DIVERGENCE_FRONTEND_ONLY (FE-9):
        A fixed-income fund with risk_bucket=MEDIUM and subtype=CORPORATE_BOND
        that theoretically has high low-quality credit concentration is ACCEPTED
        by the backend for profile 4 — because the backend has no lowQualityCredit rule.
        The frontend would block this fund if lowQualityCredit >= 35%.

        This test DOCUMENTS the divergence, not a bug.
        """
        fund = make_fund(
            asset_type="FIXED_INCOME",
            asset_subtype="CORPORATE_BOND",
            risk_bucket="MEDIUM",
            real_eq=0.0,
            real_bond=95.0,
        )
        # Backend: no lowQualityCredit rule → eligible
        eligible, _ = is_fund_eligible_for_profile(fund, 4)
        assert eligible is True, (
            "KNOWN_DIVERGENCE_FRONTEND_ONLY (FE-9): Backend correctly accepts this fund. "
            "Frontend would block it if lowQualityCredit >= 35%. "
            "Resolution requires BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0."
        )

    def test_backend_no_lowqualitycredit_attribute_used(self):
        """
        Confirms backend function signature does not use any lowQualityCredit attribute.
        If this test breaks, the backend added a new rule that must be documented.
        """
        import inspect
        from services.portfolio.suitability_engine import is_fund_eligible_for_profile as fn
        source = inspect.getsource(fn)
        assert "lowQualityCredit" not in source, (
            "Backend unexpectedly added lowQualityCredit logic. "
            "Update FE-9 divergence documentation if this was intentional."
        )
        assert "low_quality_credit" not in source.lower() or "low_quality" not in source, (
            "Backend unexpectedly added low_quality_credit logic. "
            "Update FE-9 divergence documentation if this was intentional."
        )


# ─── compatible_profiles: field contract ─────────────────────────────────────

class TestContractCompatibleProfiles:
    """
    CONTRACT: compatible_profiles field behavior.
    The backend runtime (is_fund_eligible_for_profile) does NOT read compatible_profiles.
    It always computes eligibility in real-time from classification_v2 + economic_exposure.
    compatible_profiles is a DERIVED CACHE field — frontend reads it, backend ignores it.
    """

    def test_backend_ignores_compatible_profiles_field(self):
        """
        A fund with compatible_profiles=[1,2,3] but classification_v2 that would
        normally block profile 1 (HIGH risk bucket, is_suitable_low_risk=False)
        must STILL be blocked by the backend runtime.
        """
        fund = {
            "classification_v2": {
                "asset_type": "EQUITY",
                "asset_subtype": "SECTOR_EQUITY_HEALTHCARE",
                "risk_bucket": "HIGH",
                "is_sector_fund": True,
                "sector_focus": "HEALTHCARE",
                "is_suitable_low_risk": False,
                "compatible_profiles": [1, 2, 3],  # Would override in frontend
            },
            "portfolio_exposure_v2": {
                "economic_exposure": {"equity": 98, "bond": 0, "cash": 2, "other": 0}
            },
        }
        eligible, _ = is_fund_eligible_for_profile(fund, 1)
        assert eligible is False, (
            "Backend must NOT use compatible_profiles as a shortcut. "
            "It always re-evaluates from classification_v2 + economic_exposure."
        )

    def test_backend_ignores_compatible_profiles_positive_case(self):
        """
        A fund missing compatible_profiles is still evaluated correctly by the backend.
        """
        fund = make_fund(
            asset_type="MONETARY",
            asset_subtype="MONEY_MARKET",
            risk_bucket="LOW",
            is_suitable_low_risk=True,
            real_eq=0.0,
            real_bond=5.0,
            real_cash=95.0,
        )
        # No compatible_profiles field in classification_v2
        assert "compatible_profiles" not in fund.get("classification_v2", {})
        eligible, _ = is_fund_eligible_for_profile(fund, 1)
        assert eligible is True, "Backend evaluates correctly without compatible_profiles."
