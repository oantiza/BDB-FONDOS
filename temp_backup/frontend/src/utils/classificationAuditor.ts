/**
 * Classification Auditor — Explainable Audit Trail for V2 Classification
 *
 * Provides:
 * - auditFundClassification(fund) → detailed audit trail per fund
 * - auditPortfolioProtection(portfolio, riskLevel) → dangerous funds for profile
 * - detectAmbiguousFunds(funds) → funds with low confidence, missing V2, conflicts
 */
import type { Fund, PortfolioItem } from '../types/index';

// ─── TYPES ───────────────────────────────────────────────────────────────

export interface AuditSignal {
  source: string;
  field: string;
  value: string | number | boolean | null;
  weight: 'primary' | 'secondary' | 'fallback';
}

export interface ProfileEligibility {
  profile: number;
  eligible: boolean;
  reason: string;
}

export interface FundAuditTrail {
  isin: string;
  name: string;
  hasV2: boolean;
  hasExposureV2: boolean;

  // Classification result
  canonicalType: string;
  canonicalSubtype: string;
  canonicalRegion: string;
  riskBucket: string | null;
  isSuitableLowRisk: boolean | null;

  // Audit data
  signals: AuditSignal[];
  sourceWinner: string;
  confidence: number;
  warnings: string[];

  // Profile eligibility
  profileEligibility: ProfileEligibility[];

  // Edge case flags
  edgeCaseFlags: string[];
}

export interface PortfolioProtectionReport {
  riskLevel: number;
  totalFunds: number;
  dangerousFunds: { isin: string; name: string; reason: string }[];
  warningFunds: { isin: string; name: string; reason: string }[];
  safeFunds: number;
}

export interface AmbiguityReport {
  totalFunds: number;
  ambiguousFunds: {
    isin: string;
    name: string;
    reasons: string[];
  }[];
}

// ─── MAIN FUNCTIONS ──────────────────────────────────────────────────────

export function auditFundClassification(fund: Fund): FundAuditTrail {
  const v2 = fund.classification_v2;
  const expV2 = fund.portfolio_exposure_v2;
  const signals: AuditSignal[] = [];
  const edgeCaseFlags: string[] = [];

  // Collect all signals
  if (v2?.asset_type) {
    signals.push({ source: 'classification_v2', field: 'asset_type', value: v2.asset_type, weight: 'primary' });
  }
  if (v2?.asset_subtype) {
    signals.push({ source: 'classification_v2', field: 'asset_subtype', value: v2.asset_subtype, weight: 'primary' });
  }
  if (v2?.region_primary) {
    signals.push({ source: 'classification_v2', field: 'region_primary', value: v2.region_primary, weight: 'primary' });
  }
  if (v2?.risk_bucket) {
    signals.push({ source: 'classification_v2', field: 'risk_bucket', value: v2.risk_bucket, weight: 'primary' });
  }
  if (v2?.equity_style_box) {
    signals.push({ source: 'classification_v2', field: 'equity_style_box', value: v2.equity_style_box, weight: 'secondary' });
  }
  if (v2?.fi_duration_bucket) {
    signals.push({ source: 'classification_v2', field: 'fi_duration_bucket', value: String(v2.fi_duration_bucket), weight: 'secondary' });
  }
  if (v2?.fi_credit_bucket) {
    signals.push({ source: 'classification_v2', field: 'fi_credit_bucket', value: String(v2.fi_credit_bucket), weight: 'secondary' });
  }
  if (v2?.convertibles_profile) {
    signals.push({ source: 'classification_v2', field: 'convertibles_profile', value: String(v2.convertibles_profile), weight: 'secondary' });
  }
  if (expV2?.economic_exposure) {
    const ee = expV2.economic_exposure;
    signals.push({ source: 'portfolio_exposure_v2', field: 'equity_pct', value: ee.equity, weight: 'primary' });
    signals.push({ source: 'portfolio_exposure_v2', field: 'bond_pct', value: ee.bond, weight: 'primary' });
    signals.push({ source: 'portfolio_exposure_v2', field: 'cash_pct', value: ee.cash, weight: 'primary' });
  }

  // Legacy signals
  if (fund.derived?.asset_class) {
    signals.push({ source: 'derived', field: 'asset_class', value: fund.derived.asset_class, weight: 'fallback' });
  }
  if (fund.std_type) {
    signals.push({ source: 'legacy', field: 'std_type', value: fund.std_type, weight: 'fallback' });
  }
  if (fund.category_morningstar) {
    signals.push({ source: 'legacy', field: 'category_morningstar', value: fund.category_morningstar, weight: 'fallback' });
  }
  if (fund.risk_srri != null) {
    signals.push({ source: 'legacy', field: 'risk_srri', value: fund.risk_srri, weight: 'fallback' });
  }
  if (fund.metrics) {
    signals.push({ source: 'legacy', field: 'metrics.equity', value: fund.metrics.equity ?? 0, weight: 'fallback' });
  }

  // Detect edge cases
  if (!v2) {
    edgeCaseFlags.push('NO_V2_CLASSIFICATION');
  }
  if (!expV2) {
    edgeCaseFlags.push('NO_EXPOSURE_V2');
  }
  if (!fund.metrics && !expV2) {
    edgeCaseFlags.push('NO_METRICS_AND_NO_EXPOSURE');
  }
  if (v2 && !v2.equity_style_box && v2.asset_type === 'EQUITY') {
    edgeCaseFlags.push('EQUITY_WITHOUT_STYLE_BOX');
  }
  if (v2?.asset_type === 'FIXED_INCOME' && !v2.fi_duration_bucket) {
    edgeCaseFlags.push('FI_WITHOUT_DURATION');
  }
  if (v2?.asset_type === 'FIXED_INCOME' && !v2.fi_credit_bucket) {
    edgeCaseFlags.push('FI_WITHOUT_CREDIT');
  }
  if (v2?.asset_type === 'MIXED' && !expV2?.economic_exposure) {
    edgeCaseFlags.push('ALLOCATION_WITHOUT_EXPOSURE');
  }
  if (v2 && v2.classification_confidence < 0.5) {
    edgeCaseFlags.push('LOW_CONFIDENCE');
  }

  // Check for conflicts: V2 says one thing, legacy says another
  if (v2 && fund.derived?.asset_class) {
    const v2IsEquity = v2.asset_type === 'EQUITY';
    const legacyIsEquity = fund.derived.asset_class.toUpperCase().includes('RV');
    const v2IsFI = v2.asset_type === 'FIXED_INCOME';
    const legacyIsFI = fund.derived.asset_class.toUpperCase().includes('RF');
    if ((v2IsEquity && legacyIsFI) || (v2IsFI && legacyIsEquity)) {
      edgeCaseFlags.push('V2_LEGACY_TYPE_CONFLICT');
    }
  }

  // Profile eligibility assessment
  const profileEligibility: ProfileEligibility[] = [];
  for (let p = 1; p <= 10; p++) {
    const { eligible, reason } = assessProfileEligibility(fund, p);
    profileEligibility.push({ profile: p, eligible, reason });
  }

  // Determine source winner
  let sourceWinner = 'none';
  if (v2) sourceWinner = 'classification_v2';
  else if (fund.derived?.asset_class) sourceWinner = 'derived';
  else if (fund.std_type) sourceWinner = 'std_type';
  else sourceWinner = 'unknown';

  return {
    isin: fund.isin,
    name: fund.name,
    hasV2: !!v2,
    hasExposureV2: !!expV2,
    canonicalType: v2?.asset_type || fund.derived?.asset_class || fund.std_type || 'UNKNOWN',
    canonicalSubtype: v2?.asset_subtype || fund.category_morningstar || 'UNKNOWN',
    canonicalRegion: v2?.region_primary || fund.primary_region || fund.std_region || 'UNKNOWN',
    riskBucket: v2?.risk_bucket || null,
    isSuitableLowRisk: v2?.is_suitable_low_risk ?? null,
    signals,
    sourceWinner,
    confidence: v2?.classification_confidence ?? 0,
    warnings: v2?.warnings || [],
    profileEligibility,
    edgeCaseFlags,
  };
}

function assessProfileEligibility(fund: Fund, profile: number): { eligible: boolean; reason: string } {
  const v2 = fund.classification_v2;

  // No V2 = prudent exclusion for low profiles
  if (!v2) {
    if (profile <= 3) {
      return { eligible: false, reason: 'No V2 classification — prudent exclusion for low profile' };
    }
    return { eligible: true, reason: 'Legacy allowed for profile > 3 (with warning)' };
  }

  // Profile 1-2: very conservative
  if (profile <= 2) {
    if (!v2.is_suitable_low_risk) {
      return { eligible: false, reason: `Not suitable for low risk (asset_type=${v2.asset_type}, subtype=${v2.asset_subtype})` };
    }
    if (v2.risk_bucket === 'HIGH') {
      return { eligible: false, reason: 'HIGH risk bucket' };
    }
    const exp = fund.portfolio_exposure_v2;
    if (exp?.economic_exposure && exp.economic_exposure.equity > 30) {
      return { eligible: false, reason: `Real equity exposure ${exp.economic_exposure.equity}% > 30%` };
    }
  }

  // Profile 3-4: conservative
  if (profile <= 4) {
    if (v2.risk_bucket === 'HIGH' && v2.asset_type !== 'EQUITY') {
      return { eligible: false, reason: 'HIGH risk non-equity in conservative profile' };
    }
    if (v2.is_sector_fund) {
      return { eligible: false, reason: `Sector fund (${v2.sector_focus}) excluded for profile ≤4` };
    }
    const subtypesBlocked = ['EMERGING_MARKETS_EQUITY', 'HIGH_YIELD_BOND', 'COMMODITIES_BROAD'];
    if (subtypesBlocked.includes(v2.asset_subtype as string)) {
      return { eligible: false, reason: `Subtype ${v2.asset_subtype} excluded for profile ≤4` };
    }
    const exp = fund.portfolio_exposure_v2;
    if (exp?.economic_exposure) {
      if (profile === 3 && exp.economic_exposure.equity > 45) {
        return { eligible: false, reason: `Real equity ${exp.economic_exposure.equity}% > 45% for profile 3` };
      }
      if (profile === 4 && exp.economic_exposure.equity > 60) {
        return { eligible: false, reason: `Real equity ${exp.economic_exposure.equity}% > 60% for profile 4` };
      }
    }
  }

  // Profile 5-7: moderate
  if (profile <= 7) {
    if (v2.is_sector_fund && v2.sector_focus === 'HEALTHCARE' && profile < 6) {
      return { eligible: false, reason: 'Healthcare sector too volatile for profile < 6' };
    }
  }

  return { eligible: true, reason: 'Eligible' };
}

export function auditPortfolioProtection(
  portfolio: PortfolioItem[],
  riskLevel: number,
): PortfolioProtectionReport {
  const dangerousFunds: { isin: string; name: string; reason: string }[] = [];
  const warningFunds: { isin: string; name: string; reason: string }[] = [];

  for (const fund of portfolio) {
    const audit = auditFundClassification(fund);
    const eligForProfile = audit.profileEligibility.find(e => e.profile === riskLevel);

    if (eligForProfile && !eligForProfile.eligible) {
      dangerousFunds.push({
        isin: fund.isin,
        name: fund.name,
        reason: eligForProfile.reason,
      });
    } else if (audit.edgeCaseFlags.length > 0) {
      warningFunds.push({
        isin: fund.isin,
        name: fund.name,
        reason: `Edge cases: ${audit.edgeCaseFlags.join(', ')}`,
      });
    }
  }

  return {
    riskLevel,
    totalFunds: portfolio.length,
    dangerousFunds,
    warningFunds,
    safeFunds: portfolio.length - dangerousFunds.length - warningFunds.length,
  };
}

export function detectAmbiguousFunds(funds: Fund[]): AmbiguityReport {
  const ambiguousFunds: { isin: string; name: string; reasons: string[] }[] = [];

  for (const fund of funds) {
    const reasons: string[] = [];
    const v2 = fund.classification_v2;

    if (!v2) {
      reasons.push('No classification_v2 — legacy only');
    } else {
      if (v2.classification_confidence < 0.5) {
        reasons.push(`Low confidence: ${v2.classification_confidence}`);
      }
      if (v2.warnings && v2.warnings.length > 0) {
        reasons.push(`V2 warnings: ${v2.warnings.join('; ')}`);
      }
      if (v2.asset_type === 'UNKNOWN') {
        reasons.push('asset_type is UNKNOWN');
      }
      if (v2.asset_subtype === 'UNKNOWN' && v2.asset_type !== 'MONETARY' && v2.asset_type !== 'ALTERNATIVE') {
        reasons.push('asset_subtype is UNKNOWN for non-trivial type');
      }
      if (v2.risk_bucket === 'UNKNOWN') {
        reasons.push('risk_bucket is UNKNOWN');
      }
    }

    if (!fund.portfolio_exposure_v2) {
      reasons.push('No portfolio_exposure_v2');
    } else {
      if (fund.portfolio_exposure_v2.exposure_confidence < 0.5) {
        reasons.push(`Low exposure confidence: ${fund.portfolio_exposure_v2.exposure_confidence}`);
      }
    }

    if (!fund.metrics && !fund.portfolio_exposure_v2) {
      reasons.push('No metrics AND no exposure_v2 — economic composition unknown');
    }

    // Check for legacy/V2 conflict
    if (v2 && fund.derived?.asset_class) {
      const v2Type = v2.asset_type;
      const legacyType = fund.derived.asset_class.toUpperCase();
      if (
        (v2Type === 'EQUITY' && (legacyType.includes('RF') || legacyType.includes('MONETARIO'))) ||
        (v2Type === 'FIXED_INCOME' && legacyType.includes('RV')) ||
        (v2Type === 'MONETARY' && (legacyType.includes('RV') || legacyType.includes('MIXTO')))
      ) {
        reasons.push(`V2/Legacy type conflict: V2=${v2Type}, legacy=${fund.derived.asset_class}`);
      }
    }

    if (reasons.length > 0) {
      ambiguousFunds.push({ isin: fund.isin, name: fund.name, reasons });
    }
  }

  return {
    totalFunds: funds.length,
    ambiguousFunds,
  };
}
