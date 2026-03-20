/**
 * CENTRALIZED CANONICAL TAXONOMY FOR BDB-FONDOS
 *
 * Defines the unique criteria for Asset Class, subcategories and primary regions.
 */

export const CANONICAL_ASSET_CLASSES = [
  'EQUITY',
  'FIXED_INCOME',
  'MONETARY',
  'MIXED',
  'ALTERNATIVE',
  'COMMODITIES',
  'REAL_ESTATE',
  'UNKNOWN',
] as const;

export const CANONICAL_REGIONS = [
  'GLOBAL',
  'NORTH_AMERICA',
  'EUROPE',
  'ASIA_DEVELOPED',
  'EMERGING_MARKETS',
  'LATIN_AMERICA',
  'JAPAN',
  'AFRICA_MIDDLE_EAST',
  'UNKNOWN',
] as const;

// ==========================================
// ASSET CLASS
// ==========================================

/**
 * EXTRACTION: Canonical V2 (Source of Truth)
 * Future-proof getter for strictly V2 data.
 */
export function resolveCanonicalAssetClassV2(fund: any): string | null {
  return fund?.classification_v2?.asset_type || null;
}

/**
 * EXTRACTION: Legacy Fallbacks (Deprecated)
 * Reads from derived, root, or std_type. Will be removed when all funds are V2.
 */
export function resolveLegacyAssetClassFallback(fund: any): string | null {
  return fund?.derived?.asset_class || fund?.asset_class || fund?.std_type || null;
}

/**
 * MAPPING: normalizes a string into one of the CANONICAL_ASSET_CLASSES.
 */
function mapToCanonicalAssetClass(val: string): string {
  const upper = String(val).trim().toUpperCase();

  if (['RV', 'EQUITY', 'STOCK', 'RENTA VARIABLE', 'EQ'].includes(upper)) return 'EQUITY';
  if (['RF', 'FIXED_INCOME', 'BOND', 'RENTA FIJA', 'FI', 'DEUDA'].includes(upper)) return 'FIXED_INCOME';
  if (['MONETARIO', 'MONETARY', 'MONEY MARKET', 'CASH', 'LIQUIDEZ', 'MM'].includes(upper)) return 'MONETARY';
  if (['MIXTO', 'MIXED', 'BALANCED', 'ALLOCATION', 'MULTI-ASSET'].includes(upper)) return 'MIXED';
  if (['ALTERNATIVOS', 'ALTERNATIVE', 'RETORNO ABSOLUTO', 'ABSOLUTE RETURN', 'HEDGE'].includes(upper)) return 'ALTERNATIVE';
  if (['COMMODITIES', 'MATERIAS PRIMAS', 'COMMODITY'].includes(upper)) return 'COMMODITIES';
  if (['REAL_ESTATE', 'INMOBILIARIO', 'PROPERTY', 'REIT'].includes(upper)) return 'REAL_ESTATE';

  return CANONICAL_ASSET_CLASSES.includes(upper as any) ? upper : 'UNKNOWN';
}

/**
 * BOUNDARY/UI LAYER: Best-effort extraction prioritizing V2 over Legacy.
 * Maintains UI backward compatibility.
 */
export function getCanonicalAssetClass(fund: any): string {
  if (!fund) return 'UNKNOWN';

  const v2 = resolveCanonicalAssetClassV2(fund);
  if (v2) return mapToCanonicalAssetClass(v2);

  const legacy = resolveLegacyAssetClassFallback(fund);
  if (legacy) {
    console.warn(`[Taxonomy Telemetry] Fallback used for Asset Class. Fund ISIN: ${fund.isin || 'Unknown'}`);
    return mapToCanonicalAssetClass(legacy);
  }

  return 'UNKNOWN';
}

// ==========================================
// SUB-CATEGORY
// ==========================================

/**
 * EXTRACTION: Canonical V2 (Source of Truth)
 */
export function resolveCanonicalSubCategoryV2(fund: any): string | null {
  return fund?.classification_v2?.asset_subtype || null;
}

/**
 * EXTRACTION: Legacy Fallbacks (Deprecated)
 */
export function resolveLegacySubCategoryFallback(fund: any): string | null {
  return fund?.derived?.asset_subtype ||
         fund?.derived?.category ||
         fund?.ms?.category_morningstar ||
         fund?.category ||
         fund?.std_category ||
         null;
}

/**
 * BOUNDARY/UI LAYER: Best-effort extraction for Subcategory
 */
export function getCanonicalSubCategory(fund: any): string {
  if (!fund) return 'General';

  const val = resolveCanonicalSubCategoryV2(fund) || resolveLegacySubCategoryFallback(fund);
  if (!val) return 'General';

  const trimmed = String(val).trim();
  return trimmed === '' ? 'General' : trimmed;
}

// ==========================================
// REGION
// ==========================================

/**
 * EXTRACTION: Canonical V2 (Source of Truth)
 */
export function resolveCanonicalRegionV2(fund: any): string | null {
  return fund?.classification_v2?.region_primary || null;
}

/**
 * EXTRACTION: Legacy Fallbacks (Deprecated)
 */
export function resolveLegacyRegionFallback(fund: any): string | null {
  return fund?.derived?.primary_region ||
         fund?.primary_region ||
         fund?.std_region ||
         fund?.region ||
         null;
}

/**
 * MAPPING: normalizes a string into one of the CANONICAL_REGIONS.
 */
function mapToCanonicalRegion(val: string): string {
  const upper = String(val).trim().toUpperCase().replace(/\s+/g, '_');

  if (['GLOBAL', 'WORLD', 'MUNDIAL', 'ALL', 'INTERNATIONAL'].includes(upper)) return 'GLOBAL';
  if (['US', 'USA', 'UNITED_STATES', 'NORTH_AMERICA', 'AMERICAS', 'EE.UU.'].includes(upper)) return 'NORTH_AMERICA';
  if (['EUROPE', 'EUROPA', 'EUROZONE', 'ZONA_EURO', 'EUROPE_EX_EURO', 'UNITED_KINGDOM', 'UK'].includes(upper)) return 'EUROPE';
  if (['ASIA_DEVELOPED', 'ASIA_DEV', 'DEVELOPED_ASIA', 'PACIFIC', 'AUSTRALASIA'].includes(upper)) return 'ASIA_DEVELOPED';
  if (['EMERGING_MARKETS', 'EMERGING', 'EMERGENTES', 'BRIC', 'ASIA_EMERGING', 'EUROPE_EMERGING'].includes(upper)) return 'EMERGING_MARKETS';
  if (['LATIN_AMERICA', 'LATAM', 'AMERICA_LATINA'].includes(upper)) return 'LATIN_AMERICA';
  if (['JAPAN', 'JAPÓN'].includes(upper)) return 'JAPAN';
  if (['AFRICA_MIDDLE_EAST', 'MIDDLE_EAST', 'AFRICA'].includes(upper)) return 'AFRICA_MIDDLE_EAST';

  return CANONICAL_REGIONS.includes(upper as any) ? upper : 'UNKNOWN';
}

/**
 * BOUNDARY/UI LAYER: Best-effort extraction prioritizing V2 over Legacy.
 */
export function getCanonicalRegion(fund: any): string {
  if (!fund) return 'GLOBAL';

  const val = resolveCanonicalRegionV2(fund) || resolveLegacyRegionFallback(fund);
  if (!val) return 'GLOBAL';

  return mapToCanonicalRegion(val);
}

// ==========================================
// MATCHING HELPERS
// ==========================================

export function matchesSubCategory(
  fundSubCategory: string,
  selectedSubCategory: string
): boolean {
  if (!selectedSubCategory || selectedSubCategory === 'General' || selectedSubCategory === '') {
    return true;
  }

  if (!fundSubCategory || fundSubCategory === 'General') {
    return false;
  }

  const f = String(fundSubCategory).toUpperCase();
  const s = String(selectedSubCategory).toUpperCase();

  return f === s || f.includes(s);
}

// ==========================================
// TRANSLATION HELPERS (UI)
// ==========================================

export function translateAssetClass(assetClass: string): string {
  const map: Record<string, string> = {
    EQUITY: 'Renta variable',
    FIXED_INCOME: 'Renta fija',
    MIXED: 'Mixto',
    MONETARY: 'Monetario',
    ALTERNATIVE: 'Alternativos',
    COMMODITIES: 'Materias primas',
    REAL_ESTATE: 'Inmobiliario',
    UNKNOWN: 'Sin clasificar',
  };
  return map[assetClass] || assetClass;
}

export function translateRegion(region: string): string {
  const map: Record<string, string> = {
    GLOBAL: 'Global',
    NORTH_AMERICA: 'Norteamérica',
    EUROPE: 'Europa',
    ASIA_DEVELOPED: 'Asia (Desarrollada)',
    EMERGING_MARKETS: 'Mercados Emergentes',
    LATIN_AMERICA: 'América Latina',
    JAPAN: 'Japón',
    AFRICA_MIDDLE_EAST: 'África y Oriente Medio',
    UNKNOWN: 'Sin clasificar',
  };
  return map[region] || region;
}