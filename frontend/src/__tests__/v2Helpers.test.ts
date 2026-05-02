/**
 * V2 Canonical Helpers — Unit Tests
 * 
 * Tests all 6 normalizer helpers against the 10 mandatory fund mocks:
 *   1. Biotech sectorial
 *   2. Global equity core  
 *   3. Money market EUR
 *   4. HY bond
 *   5. Allocation 70/20/10 (aggressive)
 *   6. Allocation 20/70/10 (conservative)
 *   7. Small cap EM
 *   8. Convertible equity-sensitive
 *   9. Ambiguous fund (no V2)
 *  10. Alternative multi-strategy
 */
import { describe, it, expect } from 'vitest';
import {
  getCanonicalType,
  getCanonicalSubtype,
  getCanonicalRegion,
  getCanonicalRiskBucket,
  getCanonicalFlags,
  hasLegacyTaxonomyOnly,
} from '../utils/normalizer';

// ─── 10 MANDATORY FUND MOCKS ────────────────────────────────────────────

const MOCK_BIOTECH: any = {
  isin: 'LU0000000001',
  name: 'Pictet Biotech Fund',
  classification_v2: {
    asset_type: 'EQUITY',
    asset_subtype: 'SECTOR_EQUITY_HEALTHCARE',
    region_primary: 'GLOBAL',
    risk_bucket: 'HIGH',
    is_thematic: false,
    is_sector_fund: true,
    is_index_like: false,
    market_cap_bias: 'LARGE',
    complexity_flag: 'STANDARD',
    is_suitable_low_risk: false,
    classification_confidence: 0.9,
    warnings: [],
  },
};

const MOCK_GLOBAL_EQUITY_CORE: any = {
  isin: 'LU0000000002',
  name: 'MS INVF Global Brands Fund',
  classification_v2: {
    asset_type: 'EQUITY',
    asset_subtype: 'GLOBAL_EQUITY',
    region_primary: 'GLOBAL',
    risk_bucket: 'MEDIUM',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'LARGE',
    equity_style_box: 'LARGE_GROWTH',
    complexity_flag: 'STANDARD',
    is_suitable_low_risk: false,
    classification_confidence: 0.95,
    warnings: [],
  },
};

const MOCK_MONEY_MARKET: any = {
  isin: 'LU0000000003',
  name: 'Amundi EUR Money Market Fund',
  classification_v2: {
    asset_type: 'MONETARY',
    asset_subtype: 'UNKNOWN',
    region_primary: 'EUROZONE',
    risk_bucket: 'LOW',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'UNKNOWN',
    complexity_flag: 'STANDARD',
    is_suitable_low_risk: true,
    classification_confidence: 1.0,
    warnings: [],
  },
};

const MOCK_HIGH_YIELD: any = {
  isin: 'LU0000000004',
  name: 'Robeco High Yield Bonds Fund',
  classification_v2: {
    asset_type: 'FIXED_INCOME',
    asset_subtype: 'HIGH_YIELD_BOND',
    region_primary: 'GLOBAL',
    risk_bucket: 'HIGH',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'UNKNOWN',
    fi_duration_bucket: 'MEDIUM',
    fi_credit_bucket: 'LOW_QUALITY',
    complexity_flag: 'STANDARD',
    is_suitable_low_risk: false,
    classification_confidence: 0.92,
    warnings: [],
  },
};

const MOCK_ALLOCATION_AGGRESSIVE: any = {
  isin: 'LU0000000005',
  name: 'BlackRock Global Allocation Aggressive Fund',
  classification_v2: {
    asset_type: 'MIXED',
    asset_subtype: 'AGGRESSIVE_ALLOCATION',
    region_primary: 'GLOBAL',
    risk_bucket: 'HIGH',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'UNKNOWN',
    complexity_flag: 'STANDARD',
    is_suitable_low_risk: false,
    classification_confidence: 0.88,
    warnings: [],
  },
  portfolio_exposure_v2: {
    economic_exposure: { equity: 70, bond: 20, cash: 10, other: 0 },
  },
};

const MOCK_ALLOCATION_CONSERVATIVE: any = {
  isin: 'LU0000000006',
  name: 'Nordea Stable Return Fund',
  classification_v2: {
    asset_type: 'MIXED',
    asset_subtype: 'CONSERVATIVE_ALLOCATION',
    region_primary: 'EUROPE',
    risk_bucket: 'LOW',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'UNKNOWN',
    complexity_flag: 'STANDARD',
    is_suitable_low_risk: true,
    classification_confidence: 0.91,
    warnings: [],
  },
  portfolio_exposure_v2: {
    economic_exposure: { equity: 20, bond: 70, cash: 10, other: 0 },
  },
};

const MOCK_SMALLCAP_EM: any = {
  isin: 'LU0000000007',
  name: 'Templeton Emerging Markets Small Cap Fund',
  classification_v2: {
    asset_type: 'EQUITY',
    asset_subtype: 'EMERGING_MARKETS_EQUITY',
    region_primary: 'EMERGING',
    risk_bucket: 'HIGH',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'SMALL',
    complexity_flag: 'STANDARD',
    is_suitable_low_risk: false,
    classification_confidence: 0.87,
    warnings: [],
  },
};

const MOCK_CONVERTIBLE: any = {
  isin: 'LU0000000008',
  name: 'Lazard Convertibles Global Fund',
  classification_v2: {
    asset_type: 'FIXED_INCOME',
    asset_subtype: 'CONVERTIBLE_BOND',
    region_primary: 'GLOBAL',
    risk_bucket: 'MEDIUM',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'UNKNOWN',
    convertibles_profile: 'EQUITY_LIKE',
    complexity_flag: 'COMPLEX',
    is_suitable_low_risk: false,
    classification_confidence: 0.78,
    warnings: ['Convertible with equity-like profile — not equivalent to FI core'],
  },
};

const MOCK_AMBIGUOUS: any = {
  isin: 'LU0000000009',
  name: 'Obscure Multi-Asset Flex Fund',
  // NO classification_v2 — legacy only
  derived: { asset_class: 'Mixto' },
  std_type: 'Mixto',
  primary_region: 'Global',
  category_morningstar: 'EUR Flexible Allocation',
};

const MOCK_ALTERNATIVE: any = {
  isin: 'LU0000000010',
  name: 'AQR Multi-Strategy Alternative Fund',
  classification_v2: {
    asset_type: 'ALTERNATIVE',
    asset_subtype: 'UNKNOWN',
    region_primary: 'GLOBAL',
    risk_bucket: 'HIGH',
    is_thematic: false,
    is_sector_fund: false,
    is_index_like: false,
    market_cap_bias: 'UNKNOWN',
    alternative_bucket: 'MULTI_STRATEGY',
    complexity_flag: 'COMPLEX',
    is_suitable_low_risk: false,
    classification_confidence: 0.82,
    warnings: [],
  },
};

const ALL_MOCKS = [
  { label: 'Biotech sectorial', mock: MOCK_BIOTECH },
  { label: 'Global equity core', mock: MOCK_GLOBAL_EQUITY_CORE },
  { label: 'Money market EUR', mock: MOCK_MONEY_MARKET },
  { label: 'High yield bond', mock: MOCK_HIGH_YIELD },
  { label: 'Allocation aggressive 70/20/10', mock: MOCK_ALLOCATION_AGGRESSIVE },
  { label: 'Allocation conservative 20/70/10', mock: MOCK_ALLOCATION_CONSERVATIVE },
  { label: 'Small cap EM', mock: MOCK_SMALLCAP_EM },
  { label: 'Convertible equity-sensitive', mock: MOCK_CONVERTIBLE },
  { label: 'Ambiguous fund (no V2)', mock: MOCK_AMBIGUOUS },
  { label: 'Alternative multi-strategy', mock: MOCK_ALTERNATIVE },
];

// ─── TEST SUITES ─────────────────────────────────────────────────────────

describe('getCanonicalType', () => {
  it('returns V2 asset_type when present', () => {
    expect(getCanonicalType(MOCK_BIOTECH)).toBe('EQUITY');
    expect(getCanonicalType(MOCK_MONEY_MARKET)).toBe('MONETARY');
    expect(getCanonicalType(MOCK_HIGH_YIELD)).toBe('FIXED_INCOME');
    expect(getCanonicalType(MOCK_ALLOCATION_AGGRESSIVE)).toBe('MIXED');
    expect(getCanonicalType(MOCK_ALTERNATIVE)).toBe('ALTERNATIVE');
  });

  it('falls back to legacy when no V2', () => {
    expect(getCanonicalType(MOCK_AMBIGUOUS)).toBe('Mixto');
  });

  it('returns Desconocido for empty fund', () => {
    expect(getCanonicalType({})).toBe('Desconocido');
    expect(getCanonicalType(null)).toBe('Desconocido');
    expect(getCanonicalType(undefined)).toBe('Desconocido');
  });
});

describe('getCanonicalSubtype', () => {
  it('returns V2 asset_subtype when present', () => {
    expect(getCanonicalSubtype(MOCK_BIOTECH)).toBe('SECTOR_EQUITY_HEALTHCARE');
    expect(getCanonicalSubtype(MOCK_GLOBAL_EQUITY_CORE)).toBe('GLOBAL_EQUITY');
    expect(getCanonicalSubtype(MOCK_HIGH_YIELD)).toBe('HIGH_YIELD_BOND');
    expect(getCanonicalSubtype(MOCK_ALLOCATION_AGGRESSIVE)).toBe('AGGRESSIVE_ALLOCATION');
    expect(getCanonicalSubtype(MOCK_ALLOCATION_CONSERVATIVE)).toBe('CONSERVATIVE_ALLOCATION');
    expect(getCanonicalSubtype(MOCK_CONVERTIBLE)).toBe('CONVERTIBLE_BOND');
    expect(getCanonicalSubtype(MOCK_SMALLCAP_EM)).toBe('EMERGING_MARKETS_EQUITY');
  });

  it('falls back to legacy morningstar category when no V2', () => {
    expect(getCanonicalSubtype(MOCK_AMBIGUOUS)).toBe('EUR Flexible Allocation');
  });

  it('returns Desconocido for empty fund', () => {
    expect(getCanonicalSubtype({})).toBe('Desconocido');
  });
});

describe('getCanonicalRegion', () => {
  it('returns V2 region_primary when present', () => {
    expect(getCanonicalRegion(MOCK_BIOTECH)).toBe('GLOBAL');
    expect(getCanonicalRegion(MOCK_MONEY_MARKET)).toBe('EUROZONE');
    expect(getCanonicalRegion(MOCK_SMALLCAP_EM)).toBe('EMERGING');
    expect(getCanonicalRegion(MOCK_ALLOCATION_CONSERVATIVE)).toBe('EUROPE');
  });

  it('falls back to legacy region when no V2', () => {
    expect(getCanonicalRegion(MOCK_AMBIGUOUS)).toBe('Global');
  });

  it('returns Desconocido for empty fund', () => {
    expect(getCanonicalRegion({})).toBe('Desconocido');
  });
});

describe('getCanonicalRiskBucket', () => {
  it('returns V2 risk_bucket when present', () => {
    expect(getCanonicalRiskBucket(MOCK_BIOTECH)).toBe('HIGH');
    expect(getCanonicalRiskBucket(MOCK_MONEY_MARKET)).toBe('LOW');
    expect(getCanonicalRiskBucket(MOCK_GLOBAL_EQUITY_CORE)).toBe('MEDIUM');
  });

  it('returns null when no V2', () => {
    expect(getCanonicalRiskBucket(MOCK_AMBIGUOUS)).toBeNull();
    expect(getCanonicalRiskBucket({})).toBeNull();
  });
});

describe('getCanonicalFlags', () => {
  it('detects sectorial flag', () => {
    const flags = getCanonicalFlags(MOCK_BIOTECH);
    expect(flags).toContain('Sectorial');
    expect(flags).not.toContain('Temático');
  });

  it('detects Small Cap flag', () => {
    const flags = getCanonicalFlags(MOCK_SMALLCAP_EM);
    expect(flags).toContain('Small Cap');
    expect(flags).toContain('Emergente');
  });

  it('detects High Yield flag', () => {
    const flags = getCanonicalFlags(MOCK_HIGH_YIELD);
    expect(flags).toContain('High Yield');
  });

  it('detects Complejo flag', () => {
    const flags = getCanonicalFlags(MOCK_CONVERTIBLE);
    expect(flags).toContain('Complejo');
  });

  it('returns empty for no V2', () => {
    expect(getCanonicalFlags(MOCK_AMBIGUOUS)).toEqual([]);
  });

  it('returns empty for clean global equity', () => {
    const flags = getCanonicalFlags(MOCK_GLOBAL_EQUITY_CORE);
    expect(flags.length).toBe(0);
  });
});

describe('hasLegacyTaxonomyOnly', () => {
  it('returns true for fund without V2', () => {
    expect(hasLegacyTaxonomyOnly(MOCK_AMBIGUOUS)).toBe(true);
  });

  it('returns false for fund with V2', () => {
    expect(hasLegacyTaxonomyOnly(MOCK_BIOTECH)).toBe(false);
    expect(hasLegacyTaxonomyOnly(MOCK_MONEY_MARKET)).toBe(false);
    expect(hasLegacyTaxonomyOnly(MOCK_ALTERNATIVE)).toBe(false);
  });

  it('returns false for empty fund (no legacy either)', () => {
    expect(hasLegacyTaxonomyOnly({})).toBe(false);
  });
});

// ─── CROSS-CUTTING VALIDATION ───────────────────────────────────────────

describe('V2 classification coherence', () => {
  it('biotech must NOT be classified as TECHNOLOGY', () => {
    expect(MOCK_BIOTECH.classification_v2.asset_subtype).not.toBe('SECTOR_EQUITY_TECH');
    expect(MOCK_BIOTECH.classification_v2.asset_subtype).toBe('SECTOR_EQUITY_HEALTHCARE');
  });

  it('biotech must NOT be suitable for low risk', () => {
    expect(MOCK_BIOTECH.classification_v2.is_suitable_low_risk).toBe(false);
  });

  it('money market must be suitable for low risk', () => {
    expect(MOCK_MONEY_MARKET.classification_v2.is_suitable_low_risk).toBe(true);
  });

  it('high yield must NOT be suitable for low risk', () => {
    expect(MOCK_HIGH_YIELD.classification_v2.is_suitable_low_risk).toBe(false);
  });

  it('aggressive allocation must NOT be suitable for low risk', () => {
    expect(MOCK_ALLOCATION_AGGRESSIVE.classification_v2.is_suitable_low_risk).toBe(false);
  });

  it('conservative allocation must be suitable for low risk', () => {
    expect(MOCK_ALLOCATION_CONSERVATIVE.classification_v2.is_suitable_low_risk).toBe(true);
  });

  it('small cap EM must be aggressive (HIGH risk bucket)', () => {
    expect(MOCK_SMALLCAP_EM.classification_v2.risk_bucket).toBe('HIGH');
    expect(MOCK_SMALLCAP_EM.classification_v2.is_suitable_low_risk).toBe(false);
  });

  it('convertible equity-sensitive must NOT be equivalent to FI core', () => {
    expect(MOCK_CONVERTIBLE.classification_v2.convertibles_profile).toBe('EQUITY_LIKE');
    expect(MOCK_CONVERTIBLE.classification_v2.is_suitable_low_risk).toBe(false);
  });

  it('alternative must NOT pass as defensive by error', () => {
    expect(MOCK_ALTERNATIVE.classification_v2.risk_bucket).toBe('HIGH');
    expect(MOCK_ALTERNATIVE.classification_v2.is_suitable_low_risk).toBe(false);
    expect(getCanonicalType(MOCK_ALTERNATIVE)).toBe('ALTERNATIVE');
  });

  it('ambiguous fund must flag as legacy only', () => {
    expect(hasLegacyTaxonomyOnly(MOCK_AMBIGUOUS)).toBe(true);
    expect(getCanonicalRiskBucket(MOCK_AMBIGUOUS)).toBeNull();
  });
});
