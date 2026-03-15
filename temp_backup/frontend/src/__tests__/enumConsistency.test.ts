/**
 * Enum Consistency Tests
 * 
 * Validates that frontend TypeScript enums in canonical.ts match 
 * backend Python enums in canonical_types.py exactly 1:1.
 * 
 * If a test fails here, it means someone added/removed an enum value
 * in one codebase but not the other — a critical coherence break.
 */
import { describe, it, expect } from 'vitest';
import {
  AssetClassV2,
  AssetSubtypeV2,
  StrategyTypeV2,
  RiskBucketV2,
  RegionV2,
  EquityStyleBoxV2,
  MarketCapBiasV2,
  SectorFocusV2,
  FIDurationBucketV2,
  FICreditBucketV2,
  AlternativeBucketV2,
  ComplexityFlagV2,
  LiquidityProfileV2,
  FITypeV2,
  ConvertiblesProfileV2,
  ConcentrationLevelV2,
} from '../types/canonical';

/**
 * These arrays are the CANONICAL source of truth, mirrored from
 * functions_python/models/canonical_types.py.
 * If the backend changes, update these arrays AND the corresponding
 * TypeScript enum.
 */

const BACKEND_ASSET_CLASS_V2 = [
  'EQUITY', 'FIXED_INCOME', 'MIXED', 'MONETARY',
  'ALTERNATIVE', 'REAL_ESTATE', 'COMMODITIES', 'OTHER', 'UNKNOWN',
];

const BACKEND_ASSET_SUBTYPE_V2 = [
  'GLOBAL_EQUITY', 'US_EQUITY', 'EUROPE_EQUITY', 'EUROZONE_EQUITY',
  'JAPAN_EQUITY', 'ASIA_PACIFIC_EQUITY', 'EMERGING_MARKETS_EQUITY',
  'GLOBAL_SMALL_CAP_EQUITY', 'GLOBAL_INCOME_EQUITY',
  'SECTOR_EQUITY_TECH', 'SECTOR_EQUITY_HEALTHCARE', 'THEMATIC_EQUITY',
  'GOVERNMENT_BOND', 'CORPORATE_BOND', 'HIGH_YIELD_BOND',
  'INFLATION_LINKED_BOND', 'EMERGING_MARKETS_BOND', 'CONVERTIBLE_BOND',
  'CONSERVATIVE_ALLOCATION', 'MODERATE_ALLOCATION', 'AGGRESSIVE_ALLOCATION',
  'FLEXIBLE_ALLOCATION', 'MULTI_ASSET_INCOME', 'TARGET_DATE',
  'UNKNOWN',
];

const BACKEND_STRATEGY_TYPE_V2 = ['ACTIVE', 'PASSIVE', 'SMART_BETA', 'UNKNOWN'];

const BACKEND_RISK_BUCKET_V2 = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'];

const BACKEND_REGION_V2 = ['GLOBAL', 'US', 'EUROPE', 'EUROZONE', 'ASIA_DEV', 'EMERGING', 'JAPAN', 'UNKNOWN'];

const BACKEND_EQUITY_STYLE_BOX_V2 = [
  'LARGE_VALUE', 'LARGE_CORE', 'LARGE_GROWTH',
  'MID_VALUE', 'MID_CORE', 'MID_GROWTH',
  'SMALL_VALUE', 'SMALL_CORE', 'SMALL_GROWTH',
  'UNKNOWN',
];

const BACKEND_MARKET_CAP_BIAS_V2 = ['LARGE', 'MID', 'SMALL', 'MULTI', 'UNKNOWN'];

const BACKEND_SECTOR_FOCUS_V2 = [
  'TECHNOLOGY', 'HEALTHCARE', 'FINANCIALS', 'REAL_ESTATE',
  'UTILITIES', 'ENERGY', 'INDUSTRIALS', 'CONSUMER_CYCLICAL',
  'CONSUMER_DEFENSIVE', 'COMMUNICATION', 'BASIC_MATERIALS',
  'DIVERSIFIED', 'UNKNOWN',
];

const BACKEND_FI_DURATION_BUCKET_V2 = ['SHORT', 'MEDIUM', 'LONG', 'FLEXIBLE', 'UNKNOWN'];

const BACKEND_FI_CREDIT_BUCKET_V2 = ['HIGH_QUALITY', 'MEDIUM_QUALITY', 'LOW_QUALITY', 'UNKNOWN'];

const BACKEND_ALTERNATIVE_BUCKET_V2 = [
  'LONG_SHORT_EQUITY', 'MARKET_NEUTRAL', 'GLOBAL_MACRO',
  'MANAGED_FUTURES', 'MULTI_STRATEGY', 'COMMODITIES',
  'CURRENCY', 'NONE', 'UNKNOWN',
];

const BACKEND_COMPLEXITY_FLAG_V2 = ['STANDARD', 'COMPLEX', 'HIGHLY_COMPLEX'];

const BACKEND_LIQUIDITY_PROFILE_V2 = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ILLIQUID'];

const BACKEND_FI_TYPE_V2 = ['CORPORATE', 'GOVERNMENT', 'MUNICIPAL', 'MORTGAGE', 'MIXED', 'UNKNOWN'];

const BACKEND_CONVERTIBLES_PROFILE_V2 = ['BOND_LIKE', 'EQUITY_LIKE', 'BALANCED', 'NONE', 'UNKNOWN'];

const BACKEND_CONCENTRATION_LEVEL_V2 = ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'];

// ─── HELPER ──────────────────────────────────────────────────────────────

function getEnumValues(enumObj: Record<string, string>): string[] {
  return Object.values(enumObj).sort();
}

// ─── TESTS ───────────────────────────────────────────────────────────────

describe('Enum Consistency: Frontend ↔ Backend', () => {
  it('AssetClassV2 must match backend', () => {
    expect(getEnumValues(AssetClassV2)).toEqual([...BACKEND_ASSET_CLASS_V2].sort());
  });

  it('AssetSubtypeV2 must match backend', () => {
    expect(getEnumValues(AssetSubtypeV2)).toEqual([...BACKEND_ASSET_SUBTYPE_V2].sort());
  });

  it('StrategyTypeV2 must match backend', () => {
    expect(getEnumValues(StrategyTypeV2)).toEqual([...BACKEND_STRATEGY_TYPE_V2].sort());
  });

  it('RiskBucketV2 must match backend', () => {
    expect(getEnumValues(RiskBucketV2)).toEqual([...BACKEND_RISK_BUCKET_V2].sort());
  });

  it('RegionV2 must match backend', () => {
    expect(getEnumValues(RegionV2)).toEqual([...BACKEND_REGION_V2].sort());
  });

  it('EquityStyleBoxV2 must match backend', () => {
    expect(getEnumValues(EquityStyleBoxV2)).toEqual([...BACKEND_EQUITY_STYLE_BOX_V2].sort());
  });

  it('MarketCapBiasV2 must match backend', () => {
    expect(getEnumValues(MarketCapBiasV2)).toEqual([...BACKEND_MARKET_CAP_BIAS_V2].sort());
  });

  it('SectorFocusV2 must match backend', () => {
    expect(getEnumValues(SectorFocusV2)).toEqual([...BACKEND_SECTOR_FOCUS_V2].sort());
  });

  it('FIDurationBucketV2 must match backend', () => {
    expect(getEnumValues(FIDurationBucketV2)).toEqual([...BACKEND_FI_DURATION_BUCKET_V2].sort());
  });

  it('FICreditBucketV2 must match backend', () => {
    expect(getEnumValues(FICreditBucketV2)).toEqual([...BACKEND_FI_CREDIT_BUCKET_V2].sort());
  });

  it('AlternativeBucketV2 must match backend', () => {
    expect(getEnumValues(AlternativeBucketV2)).toEqual([...BACKEND_ALTERNATIVE_BUCKET_V2].sort());
  });

  it('ComplexityFlagV2 must match backend', () => {
    expect(getEnumValues(ComplexityFlagV2)).toEqual([...BACKEND_COMPLEXITY_FLAG_V2].sort());
  });

  it('LiquidityProfileV2 must match backend', () => {
    expect(getEnumValues(LiquidityProfileV2)).toEqual([...BACKEND_LIQUIDITY_PROFILE_V2].sort());
  });

  it('FITypeV2 must match backend', () => {
    expect(getEnumValues(FITypeV2)).toEqual([...BACKEND_FI_TYPE_V2].sort());
  });

  it('ConvertiblesProfileV2 must match backend', () => {
    expect(getEnumValues(ConvertiblesProfileV2)).toEqual([...BACKEND_CONVERTIBLES_PROFILE_V2].sort());
  });

  it('ConcentrationLevelV2 must match backend', () => {
    expect(getEnumValues(ConcentrationLevelV2)).toEqual([...BACKEND_CONCENTRATION_LEVEL_V2].sort());
  });
});
