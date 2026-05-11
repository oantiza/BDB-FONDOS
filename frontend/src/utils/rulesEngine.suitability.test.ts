/**
 * BDB-SUITABILITY-CONTRACT-TESTS-0
 * =================================
 * Suitability contract tests for the frontend replica of isFundSuitableForProfile().
 *
 * Purpose:
 *   - Document and protect each suitability rule implemented in the frontend.
 *   - Explicitly mark the KNOWN_DIVERGENCE_FRONTEND_ONLY for FE-9 (lowQualityCredit).
 *   - Test that compatible_profiles takes precedence when populated.
 *   - Test the stale-compatible_profiles risk scenario (documentation test).
 *
 * Architecture note:
 *   Frontend suitability (this file) = PRESENTATION ONLY.
 *   Backend suitability (is_fund_eligible_for_profile) = AUTHORITATIVE.
 *   The canonical source is the backend; the frontend replica is a UX pre-filter.
 *
 * Known divergences (do NOT fix in this block):
 *   FE-9: lowQualityCredit >= 35% check exists in frontend, NOT in backend.
 *         Decision needed: BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0
 *
 * Reference:
 *   docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md
 *   docs/BDB_SUITABILITY_CONTRACT_TESTS_0.md
 */
import { describe, it, expect } from "vitest";
import { isFundSuitableForProfile } from "./rulesEngine";

// ─── FUND FACTORY ──────────────────────────────────────────────────────────

/** Creates a minimal V2-compliant fund for suitability testing. */
function makeFund(opts: {
  assetType?: string;
  assetSubtype?: string;
  riskBucket?: string;
  isSectorFund?: boolean;
  sectorFocus?: string;
  isSuitableLowRisk?: boolean;
  realEq?: number;
  realBond?: number;
  lowQualityCredit?: number;
  compatibleProfiles?: number[];
}): any {
  const {
    assetType = "EQUITY",
    assetSubtype = "GLOBAL_EQUITY",
    riskBucket = "MEDIUM",
    isSectorFund = false,
    sectorFocus,
    isSuitableLowRisk,
    realEq = 50,
    realBond = 50,
    lowQualityCredit,
    compatibleProfiles,
  } = opts;

  const classV2: Record<string, any> = {
    asset_type: assetType,
    asset_subtype: assetSubtype,
    risk_bucket: riskBucket,
    is_sector_fund: isSectorFund,
  };
  if (sectorFocus !== undefined) classV2.sector_focus = sectorFocus;
  if (isSuitableLowRisk !== undefined) classV2.is_suitable_low_risk = isSuitableLowRisk;
  if (compatibleProfiles !== undefined) classV2.compatible_profiles = compatibleProfiles;

  const fiCredit: Record<string, any> = {};
  if (lowQualityCredit !== undefined) fiCredit.low_quality = lowQualityCredit;

  return {
    isin: "TEST_ISIN",
    name: "Test Fund",
    classification_v2: classV2,
    portfolio_exposure_v2: {
      economic_exposure: { equity: realEq, bond: realBond, cash: 0, other: 0 },
      fi_credit: lowQualityCredit !== undefined ? fiCredit : undefined,
    },
    derived: { asset_class: assetType === "MONETARY" ? "Monetario" : "RV" },
  };
}

// ─── compatible_profiles PRECEDENCE ────────────────────────────────────────

describe("isFundSuitableForProfile — compatible_profiles precedence", () => {
  it("uses compatible_profiles when populated (canonical delegation)", () => {
    // Fund would normally be blocked by every rule (HIGH risk, sector, 98% equity)
    // but compatible_profiles explicitly includes profile 1 → frontend must ACCEPT.
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_HEALTHCARE",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "HEALTHCARE",
      isSuitableLowRisk: false,
      realEq: 98,
      compatibleProfiles: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    expect(isFundSuitableForProfile(fund, 1)).toBe(true);
  });

  it("rejects a profile NOT in compatible_profiles even if rules would allow it", () => {
    // Fund is conservative (low equity), rules would pass profile 1,
    // but compatible_profiles only lists [5, 6, 7, 8, 9, 10].
    const fund = makeFund({
      assetType: "MONETARY",
      assetSubtype: "MONEY_MARKET",
      riskBucket: "LOW",
      isSuitableLowRisk: true,
      realEq: 0,
      realBond: 5,
      compatibleProfiles: [5, 6, 7, 8, 9, 10],
    });
    expect(isFundSuitableForProfile(fund, 1)).toBe(false);
    expect(isFundSuitableForProfile(fund, 5)).toBe(true);
  });

  it("falls through to rule-based check when compatible_profiles is empty array", () => {
    // Empty array → falls through to fallback rules
    const fund = makeFund({
      assetType: "MONETARY",
      assetSubtype: "MONEY_MARKET",
      riskBucket: "LOW",
      isSuitableLowRisk: true,
      realEq: 0,
      realBond: 5,
      compatibleProfiles: [], // Empty: should fall through
    });
    // Falls through to rule-based check; monetary / low risk / 0% equity → allowed p1
    expect(isFundSuitableForProfile(fund, 1)).toBe(true);
  });

  /**
   * STALE RISK DOCUMENTATION TEST
   *
   * If compatible_profiles was populated BEFORE the MIXED exposure remediation
   * (commit 2db5a24, May 2026), the stored values are incorrect for 59 MIXED funds.
   *
   * Example: Carmignac Patrimoine had 50% real_eq (fallback) → blocked for p3.
   * Post-remediation real_eq = 32% → should be ALLOWED for p3.
   * If compatible_profiles still stores the old value ([4,5,6,...]) and frontend
   * uses it directly, the fund will appear blocked for p3 in the UI.
   *
   * Resolution: BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0
   */
  it("[STALE RISK] stale compatible_profiles overrides correct rule-based result", () => {
    // Post-remediation: real_eq = 32% → rules say p3 is OK.
    // But stale compatible_profiles only lists [4,5,6,7,8,9,10] (computed at 50%).
    const fundWithStaleProfiles = makeFund({
      assetType: "MIXED",
      assetSubtype: "FLEXIBLE_ALLOCATION",
      riskBucket: "MEDIUM",
      isSuitableLowRisk: false,
      realEq: 32,
      realBond: 60,
      compatibleProfiles: [4, 5, 6, 7, 8, 9, 10], // STALE: excludes profile 3
    });

    // Frontend says NOT suitable for p3 because of stale compatible_profiles.
    // Backend would say SUITABLE (32% equity < 45% cap).
    // This test documents the DIVERGENCE introduced by stale data.
    const frontendSaysOk = isFundSuitableForProfile(fundWithStaleProfiles, 3);
    expect(frontendSaysOk).toBe(false); // Stale cache wins in frontend → wrong answer

    // The CORRECT answer from rules-only evaluation would be true,
    // but we cannot test that here without bypassing compatible_profiles.
    // See: BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0
  });
});

// ─── RULES 3-4: Very conservative profiles 1-2 ─────────────────────────────

describe("isFundSuitableForProfile — profiles 1-2 (very conservative)", () => {
  it("blocks funds with is_suitable_low_risk=false for profile 1", () => {
    const fund = makeFund({ riskBucket: "MEDIUM", isSuitableLowRisk: false, realEq: 5 });
    expect(isFundSuitableForProfile(fund, 1)).toBe(false);
  });

  it("blocks HIGH risk bucket for profile 2", () => {
    const fund = makeFund({ riskBucket: "HIGH", isSuitableLowRisk: true, realEq: 5 });
    expect(isFundSuitableForProfile(fund, 2)).toBe(false);
  });

  it("blocks real_eq > 30% for profile 1", () => {
    const fund = makeFund({ riskBucket: "LOW", isSuitableLowRisk: true, realEq: 31 });
    expect(isFundSuitableForProfile(fund, 1)).toBe(false);
  });

  it("allows real_eq exactly 30% for profile 1 (boundary: rule is > 30, not >= 30)", () => {
    const fund = makeFund({
      assetType: "MIXED",
      riskBucket: "LOW",
      isSuitableLowRisk: true,
      realEq: 30,
      realBond: 70,
    });
    expect(isFundSuitableForProfile(fund, 1)).toBe(true);
  });

  it("allows monetary fund (low risk, 0% equity) for profile 1", () => {
    const fund = makeFund({
      assetType: "MONETARY",
      assetSubtype: "MONEY_MARKET",
      riskBucket: "LOW",
      isSuitableLowRisk: true,
      realEq: 0,
      realBond: 5,
    });
    expect(isFundSuitableForProfile(fund, 1)).toBe(true);
  });
});

// ─── RULES 7-8: real_eq caps profiles 3 and 4 ──────────────────────────────

describe("isFundSuitableForProfile — real_eq caps for profiles 3 and 4", () => {
  it("blocks real_eq > 45% for profile 3", () => {
    const fund = makeFund({ assetType: "MIXED", riskBucket: "MEDIUM", realEq: 46, realBond: 54 });
    expect(isFundSuitableForProfile(fund, 3)).toBe(false);
  });

  it("allows real_eq exactly 45% for profile 3 (boundary)", () => {
    const fund = makeFund({
      assetType: "MIXED",
      assetSubtype: "CONSERVATIVE_ALLOCATION",
      riskBucket: "LOW",
      realEq: 45,
      realBond: 55,
    });
    expect(isFundSuitableForProfile(fund, 3)).toBe(true);
  });

  it("allows real_eq 32% for profile 3 (Carmignac post-remediation style)", () => {
    const fund = makeFund({
      assetType: "MIXED",
      assetSubtype: "FLEXIBLE_ALLOCATION",
      riskBucket: "MEDIUM",
      realEq: 32,
      realBond: 60,
    });
    expect(isFundSuitableForProfile(fund, 3)).toBe(true);
  });

  it("blocks real_eq > 60% for profile 4", () => {
    const fund = makeFund({ assetType: "MIXED", riskBucket: "MEDIUM", realEq: 61, realBond: 39 });
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
  });

  it("allows real_eq exactly 60% for profile 4 (boundary)", () => {
    const fund = makeFund({
      assetType: "MIXED",
      assetSubtype: "MODERATE_ALLOCATION",
      riskBucket: "MEDIUM",
      realEq: 60,
      realBond: 40,
    });
    expect(isFundSuitableForProfile(fund, 4)).toBe(true);
  });

  it("allows real_eq 61% for profile 5 (no cap above p4)", () => {
    const fund = makeFund({ assetType: "MIXED", riskBucket: "MEDIUM", realEq: 61, realBond: 39 });
    expect(isFundSuitableForProfile(fund, 5)).toBe(true);
  });
});

// ─── RULE 9: Sector funds excluded for profiles <= 4 ────────────────────────

describe("isFundSuitableForProfile — sector funds excluded for profiles <= 4", () => {
  it("blocks tech sector fund for profile 1", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_TECH",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "TECHNOLOGY",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 1)).toBe(false);
  });

  it("blocks tech sector fund for profile 4", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_TECH",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "TECHNOLOGY",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
  });

  it("allows tech sector fund for profile 5", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_TECH",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "TECHNOLOGY",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 5)).toBe(true);
  });
});

// ─── RULE 11: Healthcare minimum profile 6 ──────────────────────────────────

describe("isFundSuitableForProfile — healthcare minimum profile 6", () => {
  it("blocks healthcare sector fund for profile 5 (< 6)", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_HEALTHCARE",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "HEALTHCARE",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 5)).toBe(false);
  });

  it("allows healthcare sector fund for profile 6", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_HEALTHCARE",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "HEALTHCARE",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 6)).toBe(true);
  });

  it("allows healthcare sector fund for profile 7", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_HEALTHCARE",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "HEALTHCARE",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 7)).toBe(true);
  });

  it("tech sector fund (non-healthcare) is allowed for profile 5", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_TECH",
      riskBucket: "HIGH",
      isSectorFund: true,
      sectorFocus: "TECHNOLOGY",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 5)).toBe(true);
  });
});

// ─── FE-9: KNOWN DIVERGENCE — lowQualityCredit rule ────────────────────────

/**
 * KNOWN_DIVERGENCE_FRONTEND_ONLY — FE-9
 * ======================================
 * The frontend blocks funds with lowQualityCredit >= 35% for profiles <= 4.
 * The backend (is_fund_eligible_for_profile) has NO equivalent rule.
 *
 * This test suite:
 *   1. Documents that the FE-9 rule EXISTS in the frontend.
 *   2. Marks it explicitly as KNOWN DIVERGENCE from the backend.
 *   3. Does NOT fix it (resolution requires BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0).
 *
 * Resolution options:
 *   A) Add lowQualityCredit rule to backend → parity, but adds complexity.
 *   B) Remove lowQualityCredit from frontend → frontend is simpler, may miss edge cases.
 *   C) Accept as intentional UX pre-filter with documentation → current state.
 */
describe("isFundSuitableForProfile — FE-9 KNOWN_DIVERGENCE_FRONTEND_ONLY (lowQualityCredit)", () => {
  it("[FE-9] blocks corporate bond fund with lowQualityCredit >= 35% for profile 4", () => {
    // KNOWN_DIVERGENCE: This fund would be ACCEPTED by the backend (no such rule there).
    // Frontend blocks it via lowQualityCredit >= 35%.
    const fund = makeFund({
      assetType: "FIXED_INCOME",
      assetSubtype: "CORPORATE_BOND",
      riskBucket: "MEDIUM",
      isSectorFund: false,
      realEq: 0,
      realBond: 95,
      lowQualityCredit: 40, // >= 35 → frontend blocks
    });
    // Frontend: should be false (FE-9 fires)
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
    // NOTE: Backend would return TRUE for the same fund.
    // This is KNOWN_DIVERGENCE_FRONTEND_ONLY until FE-9 decision is made.
  });

  it("[FE-9] allows same corporate bond fund with lowQualityCredit < 35% for profile 4", () => {
    // Below threshold → FE-9 does not fire; fund is accepted by both frontend and backend.
    const fund = makeFund({
      assetType: "FIXED_INCOME",
      assetSubtype: "CORPORATE_BOND",
      riskBucket: "MEDIUM",
      isSectorFund: false,
      realEq: 0,
      realBond: 95,
      lowQualityCredit: 30, // < 35 → does not trigger FE-9
    });
    expect(isFundSuitableForProfile(fund, 4)).toBe(true);
  });

  it("[FE-9] blocks at exactly 35% (boundary: rule is >= 35)", () => {
    const fund = makeFund({
      assetType: "FIXED_INCOME",
      assetSubtype: "CORPORATE_BOND",
      riskBucket: "MEDIUM",
      isSectorFund: false,
      realEq: 0,
      realBond: 95,
      lowQualityCredit: 35, // Exactly at threshold → blocks
    });
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
  });

  it("[FE-9] does NOT apply for profile 5 (only affects profiles <= 4)", () => {
    const fund = makeFund({
      assetType: "FIXED_INCOME",
      assetSubtype: "CORPORATE_BOND",
      riskBucket: "MEDIUM",
      isSectorFund: false,
      realEq: 0,
      realBond: 95,
      lowQualityCredit: 60, // Very high, but profile 5 is outside the rule's range
    });
    expect(isFundSuitableForProfile(fund, 5)).toBe(true);
  });

  it("[FE-9] HIGH_YIELD_BOND is blocked for profile 4 — but by subtype rule, not FE-9", () => {
    // This fund is blocked by the EMERGING_MARKETS_EQUITY / HIGH_YIELD_BOND subtype check,
    // NOT by lowQualityCredit. Both frontend and backend agree on this block.
    // This test clarifies the two rules are independent.
    const fund = makeFund({
      assetType: "FIXED_INCOME",
      assetSubtype: "HIGH_YIELD_BOND",
      riskBucket: "HIGH",
      isSectorFund: false,
      realEq: 0,
      realBond: 95,
      lowQualityCredit: 20, // Below FE-9 threshold, but HY_BOND subtype blocks independently
    });
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
  });
});

// ─── PARITY SUMMARY (documentation tests) ───────────────────────────────────

describe("Frontend/Backend parity — rules alignment summary", () => {
  /**
   * These tests document which rules are ALIGNED and which DIVERGE.
   * They serve as a machine-readable specification of the contract.
   * Each aligned rule should produce the same result in both engines.
   */

  it("[PARITY-OK] Rule 3: is_suitable_low_risk=false → block p1-2 (aligned)", () => {
    const fund = makeFund({ riskBucket: "MEDIUM", isSuitableLowRisk: false, realEq: 5 });
    expect(isFundSuitableForProfile(fund, 1)).toBe(false);
    expect(isFundSuitableForProfile(fund, 2)).toBe(false);
    // Backend test: TestContractRules3_4_VeryConservative::test_not_suitable_low_risk_blocked_p1
  });

  it("[PARITY-OK] Rule 5: real_eq > 30% → block p1-2 (aligned)", () => {
    const fund = makeFund({ riskBucket: "LOW", isSuitableLowRisk: true, realEq: 31 });
    expect(isFundSuitableForProfile(fund, 1)).toBe(false);
    expect(isFundSuitableForProfile(fund, 2)).toBe(false);
    // Backend test: TestContractRule5_RealEqCap_P1_P2
  });

  it("[PARITY-OK] Rule 7: real_eq > 45% → block p3 (aligned)", () => {
    const fund = makeFund({ assetType: "MIXED", riskBucket: "MEDIUM", realEq: 46, realBond: 54 });
    expect(isFundSuitableForProfile(fund, 3)).toBe(false);
    // Backend test: TestContractRules7_8_RealEqCap_P3_P4::test_p3_46_blocked
  });

  it("[PARITY-OK] Rule 8: real_eq > 60% → block p4 (aligned)", () => {
    const fund = makeFund({ assetType: "MIXED", riskBucket: "MEDIUM", realEq: 61, realBond: 39 });
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
    // Backend test: TestContractRules7_8_RealEqCap_P3_P4::test_p4_61_blocked
  });

  it("[PARITY-OK] Rule 9: sector fund → block p1-4 (aligned)", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      assetSubtype: "SECTOR_EQUITY_TECH",
      riskBucket: "HIGH",
      isSectorFund: true,
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
    expect(isFundSuitableForProfile(fund, 5)).toBe(true);
    // Backend test: TestContractRule9_SectorFundsConservative
  });

  it("[PARITY-OK] Rule 11: healthcare → min profile 6 (aligned)", () => {
    const fund = makeFund({
      assetType: "EQUITY",
      isSectorFund: true,
      sectorFocus: "HEALTHCARE",
      riskBucket: "HIGH",
      realEq: 98,
    });
    expect(isFundSuitableForProfile(fund, 5)).toBe(false);
    expect(isFundSuitableForProfile(fund, 6)).toBe(true);
    // Backend test: TestContractRule11_HealthcareMinProfile6
  });

  it("[PARITY-DIVERGE] FE-9: lowQualityCredit >= 35% blocks p<=4 in frontend only", () => {
    const fund = makeFund({
      assetType: "FIXED_INCOME",
      assetSubtype: "CORPORATE_BOND",
      riskBucket: "MEDIUM",
      realEq: 0,
      realBond: 95,
      lowQualityCredit: 40,
    });
    // Frontend says false (FE-9 fires)
    expect(isFundSuitableForProfile(fund, 4)).toBe(false);
    // Backend would say true (no lowQualityCredit rule).
    // This is KNOWN_DIVERGENCE_FRONTEND_ONLY.
    // See: TestContractFE9BackendBaseline in test_suitability_contract_parity.py
  });
});
