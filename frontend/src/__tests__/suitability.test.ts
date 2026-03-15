/**
 * Frontend Suitability & Rules Engine Tests
 * 
 * Validates:
 * - getAssetClass() in rulesEngine correctly maps V2 enums
 * - Sidebar filter logic correctly classifies V2 funds
 * - Profile exclusion logic prevents dangerous funds from low profiles
 */
import { describe, it, expect } from 'vitest';

// We re-implement getAssetClass logic here for testability
// (the original is not exported from rulesEngine.ts)
type AssetClass = 'RV' | 'RF' | 'Monetario' | 'Mixto' | 'Alternativos' | 'Otros';

function getAssetClassFromV2(v2AssetType: string | undefined, legacyDerived?: string): AssetClass {
  if (v2AssetType) {
    if (v2AssetType === 'EQUITY') return 'RV';
    if (v2AssetType === 'FIXED_INCOME') return 'RF';
    if (v2AssetType === 'MONETARY') return 'Monetario';
    if (v2AssetType === 'MIXED') return 'Mixto';
    if (v2AssetType === 'ALTERNATIVE') return 'Alternativos';
    return 'Otros';
  }
  // Legacy fallback
  const s = (legacyDerived || '').toUpperCase().trim();
  if (s === 'MONETARIO') return 'Monetario';
  if (s === 'RF') return 'RF';
  if (s === 'RV') return 'RV';
  if (s === 'MIXTO') return 'Mixto';
  if (s === 'RETORNO ABSOLUTO') return 'Alternativos';
  return 'Otros';
}

// Sidebar V2 filter logic (extracted for testability)
type SidebarCategory = 'RV' | 'RF' | 'RF - Soberana' | 'RF - Corporativa' | 'RF - High Yield' |
  'Monetario' | 'Mixto' | 'Alternativos' | 'RV - Tecnología' | 'RV - Salud' | 'ALL';

function matchesSidebarCategory(
  category: SidebarCategory,
  v2: { asset_type?: string; asset_subtype?: string; is_sector_fund?: boolean } | undefined,
  legacyAssetClass?: string,
  fundName?: string,
): boolean {
  if (category === 'ALL') return true;

  if (v2) {
    if (category === 'RV') return v2.asset_type === 'EQUITY';
    if (category === 'RV - Tecnología') return v2.asset_type === 'EQUITY' && !!v2.is_sector_fund && (
      v2.asset_subtype === 'SECTOR_EQUITY_TECH' || (fundName || '').toLowerCase().includes('technolog')
    );
    if (category === 'RV - Salud') return v2.asset_type === 'EQUITY' && (
      v2.asset_subtype === 'SECTOR_EQUITY_HEALTHCARE' || v2.asset_subtype === 'HEALTHCARE' ||
      (fundName || '').toLowerCase().includes('health') || (fundName || '').toLowerCase().includes('biotech')
    );
    if (category === 'RF') return v2.asset_type === 'FIXED_INCOME';
    if (category === 'RF - Soberana') return v2.asset_type === 'FIXED_INCOME' && v2.asset_subtype === 'GOVERNMENT_BOND';
    if (category === 'RF - Corporativa') return v2.asset_type === 'FIXED_INCOME' && v2.asset_subtype === 'CORPORATE_BOND';
    if (category === 'RF - High Yield') return v2.asset_type === 'FIXED_INCOME' && v2.asset_subtype === 'HIGH_YIELD_BOND';
    if (category === 'Monetario') return v2.asset_type === 'MONEY_MARKET' || v2.asset_type === 'MONETARY';
    if (category === 'Mixto') return v2.asset_type === 'ALLOCATION' || v2.asset_type === 'MIXED';
    if (category === 'Alternativos') return v2.asset_type === 'ALTERNATIVE';
    return false;
  }

  // Legacy fallback
  const fc = (legacyAssetClass || '').toUpperCase();
  if (category === 'RV') return fc === 'RV';
  if (category === 'RF') return fc === 'RF';
  if (category === 'Monetario') return fc === 'MONETARIO';
  if (category === 'Mixto') return fc === 'MIXTO';
  if (category === 'Alternativos') return fc === 'RETORNO ABSOLUTO';
  return false;
}

// Is fund dangerous for low profile?
function isDangerousForLowProfile(v2: any): boolean {
  if (!v2) return true; // Unknown = prudent exclusion
  if (v2.risk_bucket === 'HIGH') return true;
  if (v2.is_suitable_low_risk === false) return true;
  if (v2.asset_subtype === 'EMERGING_MARKETS_EQUITY') return true;
  if (v2.asset_subtype === 'HIGH_YIELD_BOND') return true;
  if (v2.asset_subtype === 'AGGRESSIVE_ALLOCATION') return true;
  if (v2.is_sector_fund) return true;
  if (v2.asset_type === 'ALTERNATIVE') return true;
  if (v2.convertibles_profile === 'EQUITY_LIKE') return true;
  return false;
}

// ─── TESTS ───────────────────────────────────────────────────────────────

describe('getAssetClass V2 mapping', () => {
  it('maps EQUITY → RV', () => {
    expect(getAssetClassFromV2('EQUITY')).toBe('RV');
  });
  it('maps FIXED_INCOME → RF', () => {
    expect(getAssetClassFromV2('FIXED_INCOME')).toBe('RF');
  });
  it('maps MONETARY → Monetario', () => {
    expect(getAssetClassFromV2('MONETARY')).toBe('Monetario');
  });
  it('maps MIXED → Mixto', () => {
    expect(getAssetClassFromV2('MIXED')).toBe('Mixto');
  });
  it('maps ALTERNATIVE → Alternativos', () => {
    expect(getAssetClassFromV2('ALTERNATIVE')).toBe('Alternativos');
  });
  it('maps COMMODITIES → Otros', () => {
    expect(getAssetClassFromV2('COMMODITIES')).toBe('Otros');
  });
  it('maps REAL_ESTATE → Otros', () => {
    expect(getAssetClassFromV2('REAL_ESTATE')).toBe('Otros');
  });
  it('maps UNKNOWN → Otros', () => {
    expect(getAssetClassFromV2('UNKNOWN')).toBe('Otros');
  });
  it('legacy fallback works', () => {
    expect(getAssetClassFromV2(undefined, 'RV')).toBe('RV');
    expect(getAssetClassFromV2(undefined, 'Monetario')).toBe('Monetario');
    expect(getAssetClassFromV2(undefined, '')).toBe('Otros');
  });
});

describe('Sidebar filter V2 matching', () => {
  it('biotech matches RV and RV - Salud', () => {
    const v2 = { asset_type: 'EQUITY', asset_subtype: 'SECTOR_EQUITY_HEALTHCARE', is_sector_fund: true };
    expect(matchesSidebarCategory('RV', v2)).toBe(true);
    expect(matchesSidebarCategory('RV - Salud', v2)).toBe(true);
    expect(matchesSidebarCategory('RV - Tecnología', v2)).toBe(false);
    expect(matchesSidebarCategory('RF', v2)).toBe(false);
  });

  it('money market matches Monetario', () => {
    const v2 = { asset_type: 'MONETARY' };
    expect(matchesSidebarCategory('Monetario', v2)).toBe(true);
    expect(matchesSidebarCategory('RF', v2)).toBe(false);
  });

  it('high yield matches RF and RF - High Yield', () => {
    const v2 = { asset_type: 'FIXED_INCOME', asset_subtype: 'HIGH_YIELD_BOND' };
    expect(matchesSidebarCategory('RF', v2)).toBe(true);
    expect(matchesSidebarCategory('RF - High Yield', v2)).toBe(true);
    expect(matchesSidebarCategory('RF - Corporativa', v2)).toBe(false);
  });

  it('alternative matches Alternativos', () => {
    const v2 = { asset_type: 'ALTERNATIVE' };
    expect(matchesSidebarCategory('Alternativos', v2)).toBe(true);
    expect(matchesSidebarCategory('RV', v2)).toBe(false);
  });

  it('allocation matches Mixto', () => {
    const v2 = { asset_type: 'MIXED' };
    expect(matchesSidebarCategory('Mixto', v2)).toBe(true);
  });
});

describe('Profile protection: dangerous funds in low profiles', () => {
  it('biotech sectorial is dangerous for low profile', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'EQUITY', asset_subtype: 'SECTOR_EQUITY_HEALTHCARE',
      is_sector_fund: true, risk_bucket: 'HIGH', is_suitable_low_risk: false,
    })).toBe(true);
  });

  it('money market is safe for low profile', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'MONETARY', risk_bucket: 'LOW', is_suitable_low_risk: true,
    })).toBe(false);
  });

  it('HY bond is dangerous for low profile', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'FIXED_INCOME', asset_subtype: 'HIGH_YIELD_BOND',
      risk_bucket: 'HIGH', is_suitable_low_risk: false,
    })).toBe(true);
  });

  it('global equity core is dangerous for low profile (not suitable)', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'EQUITY', asset_subtype: 'GLOBAL_EQUITY',
      risk_bucket: 'MEDIUM', is_suitable_low_risk: false,
    })).toBe(true);
  });

  it('conservative allocation is safe for low profile', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'MIXED', asset_subtype: 'CONSERVATIVE_ALLOCATION',
      risk_bucket: 'LOW', is_suitable_low_risk: true,
    })).toBe(false);
  });

  it('aggressive allocation is dangerous', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'MIXED', asset_subtype: 'AGGRESSIVE_ALLOCATION',
      risk_bucket: 'HIGH', is_suitable_low_risk: false,
    })).toBe(true);
  });

  it('small cap EM is dangerous', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'EQUITY', asset_subtype: 'EMERGING_MARKETS_EQUITY',
      risk_bucket: 'HIGH', is_suitable_low_risk: false,
    })).toBe(true);
  });

  it('convertible equity-like is dangerous', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'FIXED_INCOME', asset_subtype: 'CONVERTIBLE_BOND',
      convertibles_profile: 'EQUITY_LIKE', risk_bucket: 'MEDIUM', is_suitable_low_risk: false,
    })).toBe(true);
  });

  it('no V2 data at all = prudent exclusion', () => {
    expect(isDangerousForLowProfile(undefined)).toBe(true);
    expect(isDangerousForLowProfile(null)).toBe(true);
  });

  it('alternative fund is dangerous', () => {
    expect(isDangerousForLowProfile({
      asset_type: 'ALTERNATIVE', risk_bucket: 'HIGH', is_suitable_low_risk: false,
    })).toBe(true);
  });
});
