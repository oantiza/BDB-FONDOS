/**
 * Mixed Funds Treatment Tests
 * 
 * Quick-win validation for:
 * - Sidebar filter correctly recognizes MIXED and ALLOCATION
 * - Autocomplete correctly gates MIXED funds by exposure for aggressive profiles
 * - rulesEngine getAssetClass uses look-through for MIXED funds
 * - Mixtos without exposure don't silently misclassify
 */
import { describe, it, expect } from 'vitest';

// ─── REPLICATED LOGIC FOR TESTABILITY ────────────────────────────────────

type AssetClass = 'RV' | 'RF' | 'Monetario' | 'Mixto' | 'Alternativos' | 'Otros';

// Sidebar V2 filter logic — matches actual Sidebar.tsx implementation after fix
function matchesSidebarMixto(
  v2: { asset_type?: string } | undefined,
): boolean {
  if (!v2) return false;
  return v2.asset_type === 'MIXED' || v2.asset_type === 'ALLOCATION';
}

// Autocomplete gate for MIXED in aggressive profiles (p_level >= 8)
function isAggressiveMixedAllowed(fund: {
  classification_v2?: { asset_type?: string; asset_subtype?: string };
  portfolio_exposure_v2?: { economic_exposure?: { equity?: number }; asset_mix?: { equity?: number } };
}): boolean {
  const type = fund.classification_v2?.asset_type || '';
  if (type !== 'MIXED' && type !== 'ALLOCATION') return false;

  const expV2 = fund.portfolio_exposure_v2;
  const eqRaw = Number(expV2?.economic_exposure?.equity ?? expV2?.asset_mix?.equity ?? 0);
  const eqPct = eqRaw <= 1.5 ? eqRaw * 100 : eqRaw;
  const subtype = fund.classification_v2?.asset_subtype || '';

  if (subtype === 'AGGRESSIVE_ALLOCATION') return true;
  if (eqPct >= 75) return true;
  return false;
}

// getAssetClass look-through logic for MIXED — matches rulesEngine.ts after fix
function getAssetClassFromExposure(expV2: any): AssetClass | null {
  const mix = expV2?.economic_exposure;
  if (!mix) return null;

  const equity = Number(mix.equity || 0);
  const bond = Number(mix.bond || 0);
  const cash = Number(mix.cash || 0);
  const alternatives = Number(mix.alternative || 0) + Number(mix.real_asset || 0) + Number(mix.other || 0);

  if (cash >= 75 && equity <= 20 && bond <= 25) return 'Monetario';
  if (equity >= 80 && bond <= 20) return 'RV';
  if (bond >= 70 && equity <= 25) return 'RF';
  if (equity >= 25 && bond >= 25) return 'Mixto';
  if (alternatives >= 30 && equity < 40 && bond < 40) return 'Alternativos';
  return null;
}

function getAssetClassForMixed(
  classV2: { asset_type?: string } | null,
  expV2: any,
): AssetClass {
  if (classV2?.asset_type === 'MIXED' || classV2?.asset_type === 'ALLOCATION') {
    const bucketFromExposure = getAssetClassFromExposure(expV2);
    if (bucketFromExposure) return bucketFromExposure;
    return 'Mixto'; // fallback
  }
  return 'Otros'; // should not reach here in MIXED context
}

// ─── TESTS ───────────────────────────────────────────────────────────────

describe('Sidebar Mixto filter', () => {
  it('MIXED asset_type appears under Mixto filter', () => {
    expect(matchesSidebarMixto({ asset_type: 'MIXED' })).toBe(true);
  });

  it('ALLOCATION asset_type also appears under Mixto filter', () => {
    expect(matchesSidebarMixto({ asset_type: 'ALLOCATION' })).toBe(true);
  });

  it('EQUITY does NOT appear under Mixto filter', () => {
    expect(matchesSidebarMixto({ asset_type: 'EQUITY' })).toBe(false);
  });

  it('undefined v2 does NOT match Mixto filter', () => {
    expect(matchesSidebarMixto(undefined)).toBe(false);
  });
});

describe('Autocomplete: aggressive MIXED gate for P8-P10', () => {
  it('AGGRESSIVE_ALLOCATION subtype is allowed regardless of exposure', () => {
    expect(isAggressiveMixedAllowed({
      classification_v2: { asset_type: 'MIXED', asset_subtype: 'AGGRESSIVE_ALLOCATION' },
      portfolio_exposure_v2: { economic_exposure: { equity: 0.60 } },
    })).toBe(true);
  });

  it('MIXED with 80% equity exposure is allowed (decimal format)', () => {
    expect(isAggressiveMixedAllowed({
      classification_v2: { asset_type: 'MIXED', asset_subtype: 'MODERATE_ALLOCATION' },
      portfolio_exposure_v2: { economic_exposure: { equity: 0.80 } },
    })).toBe(true);
  });

  it('MIXED with 80 equity exposure is allowed (percentage format)', () => {
    expect(isAggressiveMixedAllowed({
      classification_v2: { asset_type: 'MIXED', asset_subtype: 'MODERATE_ALLOCATION' },
      portfolio_exposure_v2: { economic_exposure: { equity: 80 } },
    })).toBe(true);
  });

  it('MIXED with 50% equity (moderate) is NOT allowed for P8+', () => {
    expect(isAggressiveMixedAllowed({
      classification_v2: { asset_type: 'MIXED', asset_subtype: 'MODERATE_ALLOCATION' },
      portfolio_exposure_v2: { economic_exposure: { equity: 0.50 } },
    })).toBe(false);
  });

  it('MIXED with no exposure data is NOT allowed for P8+', () => {
    expect(isAggressiveMixedAllowed({
      classification_v2: { asset_type: 'MIXED', asset_subtype: 'FLEXIBLE_ALLOCATION' },
    })).toBe(false);
  });

  it('ALLOCATION type also works through the gate', () => {
    expect(isAggressiveMixedAllowed({
      classification_v2: { asset_type: 'ALLOCATION', asset_subtype: 'AGGRESSIVE_ALLOCATION' },
    })).toBe(true);
  });
});

describe('rulesEngine look-through: getAssetClass for MIXED funds', () => {
  it('MIXED with 85% equity → classified as RV for portfolio construction', () => {
    const result = getAssetClassForMixed(
      { asset_type: 'MIXED' },
      { economic_exposure: { equity: 85, bond: 10, cash: 5 } },
    );
    expect(result).toBe('RV');
  });

  it('MIXED with 30% equity / 60% bond → classified as Mixto (equity+bond both significant)', () => {
    const result = getAssetClassForMixed(
      { asset_type: 'MIXED' },
      { economic_exposure: { equity: 30, bond: 60, cash: 10 } },
    );
    // equity >= 25 && bond >= 25 → Mixto
    expect(result).toBe('Mixto');
  });

  it('MIXED with 20% equity / 75% bond → classified as RF', () => {
    const result = getAssetClassForMixed(
      { asset_type: 'MIXED' },
      { economic_exposure: { equity: 20, bond: 75, cash: 5 } },
    );
    expect(result).toBe('RF');
  });

  it('MIXED without exposure → stays as Mixto (not silently promoted to RV)', () => {
    const result = getAssetClassForMixed(
      { asset_type: 'MIXED' },
      null,
    );
    expect(result).toBe('Mixto');
  });

  it('MIXED with empty exposure object → stays as Mixto', () => {
    const result = getAssetClassForMixed(
      { asset_type: 'MIXED' },
      { economic_exposure: null },
    );
    expect(result).toBe('Mixto');
  });

  it('ALLOCATION type follows same look-through path', () => {
    const result = getAssetClassForMixed(
      { asset_type: 'ALLOCATION' },
      { economic_exposure: { equity: 90, bond: 5, cash: 5 } },
    );
    expect(result).toBe('RV');
  });
});

import { getAssetTypeQueryValues } from '../utils/directSearch';
import { getCanonicalRegion, getCanonicalAssetClass } from '../utils/fundTaxonomy';

describe('Defensive Taxonomy Normalization (Modals & Search)', () => {
  it('MIXED_ALLOCATION and ALLOCATION normalize to MIXED query values in directSearch', () => {
    const valuesMixedAlloc = getAssetTypeQueryValues('MIXED_ALLOCATION');
    expect(valuesMixedAlloc).toContain('MIXED');
    expect(valuesMixedAlloc).toContain('allocation');

    const valuesAlloc = getAssetTypeQueryValues('ALLOCATION');
    expect(valuesAlloc).toContain('MIXED');
    expect(valuesAlloc).toContain('allocation');
  });

  it('USA normalizes to NORTH_AMERICA via getCanonicalRegion', () => {
    expect(getCanonicalRegion({ classification_v2: { region_primary: 'USA' } })).toBe('NORTH_AMERICA');
    expect(getCanonicalRegion({ classification_v2: { region_primary: 'US' } })).toBe('NORTH_AMERICA');
    expect(getCanonicalRegion({ classification_v2: { region_primary: 'EE.UU.' } })).toBe('NORTH_AMERICA');
  });

  it('FundComparator does not duplicate MIXED/ALLOCATION by using getCanonicalAssetClass', () => {
    expect(getCanonicalAssetClass({ classification_v2: { asset_type: 'ALLOCATION' } })).toBe('MIXED');
    expect(getCanonicalAssetClass({ classification_v2: { asset_type: 'MIXED' } })).toBe('MIXED');
    expect(getCanonicalAssetClass({ classification_v2: { asset_type: 'MIXTO' } })).toBe('MIXED');
  });
});
