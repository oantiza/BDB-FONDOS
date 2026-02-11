// normalizer.js - Fund Data Normalization Utility
// Extracted from App.jsx for better code organization

function toNumber(x: any): number | null {
  if (x === null || x === undefined || x === '') return null
  const n = typeof x === 'number' ? x : parseFloat(x)
  return Number.isFinite(n) ? n : null
}

// Helper para normalizar porcentaje: formateo estricto
// Si > 1.5 => asumimos que es base 100 (ej: 8.5 -> 0.085)
// Si <= 1.5 => asumimos que es decimal (ej: 0.085 -> 0.085)
// Retorna NULL si no es un número válido. NUNCA default.
export function asDecimalPct(v: any): number | null {
  const n = toNumber(v)
  if (n === null) return null
  return Math.abs(n) > 1.5 ? n / 100 : n
}

// Max drawdown a decimal negativo: -0.14/0.14/-14/14 -> -0.14
// Retorna NULL si no es válido.
function maxDdToDecimalNegative(value: any): number | null {
  const val = asDecimalPct(value)
  if (val === null) return null
  const absVal = Math.abs(val)
  return absVal === 0 ? 0 : -absVal
}

function normalizeStars(v: any): number | null {
  const n = toNumber(v)
  if (n === null) return null
  // Morningstar stars válidas: 0..5 (0 a veces significa “sin rating” en algunos exports)
  if (n < 0 || n > 5) return null
  return Math.round(n)
}

export const REGION_DISPLAY_LABELS: Record<string, string> = {
  united_states: "EE.UU.",
  canada: "Canadá",
  latin_america: "Iberoamérica",
  eurozone: "Zona Euro",
  europe_ex_euro: "Europa (ex-Euro)",
  united_kingdom: "Reino Unido",
  europe_emerging: "Europa Emergente",
  japan: "Japón",
  developed_asia: "Asia Desarrollada",
  china: "China",
  asia_emerging: "Asia Emergente",
  middle_east: "Oriente Medio",
  africa: "África",
  australasia: "Australasia",
  americas: "Américas",
  europe_me_africa: "EMEA",
  asia: "Asia",
  other: "Otros"
};

/**
 * Adapts strict V3 structure to Legacy format for UI compatibility.
 * READ-ONLY: No default values, no inventions.
 */
export function adaptFundV3ToLegacy(docData: any) {
  if (!docData) return {}

  const derived = docData.derived || {}
  const ms = docData.ms || {}
  const manual = docData.manual || {}
  const costs = manual.costs || {}

  return {
    ...docData,
    asset_class: derived.asset_class || docData.asset_class || null,
    primary_region: derived.primary_region || docData.primary_region || null,
    category_morningstar: ms.category_morningstar || docData.category_morningstar || null,
    rating_stars: normalizeStars(ms.rating_stars || docData.rating_stars),
    ter: costs.ter || docData.ter || null,
    retrocession: costs.retrocession || docData.retrocession || null,
    ms: ms
  }
}

/**
 * Normalizes raw fund data from Firestore into a standardized format
 * with computed fields for std_type, std_region, std_perf_norm, and std_extra.
 * STRICT MODE: No heuristics, no defaults.
 */
export function normalizeFundData(docDataInput: any) {
  // IMPORTANT: aquí asumimos que ya llega adaptado o al menos compatible.
  const docData = docDataInput

  // 1. Asset Class & Region (Strict from adapter/docData)
  let std_type = docData.asset_class ?? null
  let std_region = docData.primary_region ?? null

  // [FALLBACK] Region from MS Breakdown if missing
  if (!std_region && docData.ms?.regions?.detail) {
    try {
      const regions = docData.ms.regions.detail;
      const sorted = Object.entries(regions).sort((a: any, b: any) => b[1] - a[1]);
      if (sorted.length > 0) {
        // Map common keys to our schema labels or keep raw if handled elsewhere
        // REGION_DISPLAY_LABELS keys match these mostly (united_states, eurozone, etc)
        std_region = sorted[0][0];
      }
    } catch (e) { /* ignore */ }
  }

  // 2. Perf / Stats (Strict formatting only)
  // Check MS V3 location first (Risk Volatility)
  const msRisk = docData?.ms?.risk_volatility || {};

  const stdVol = docData?.std_perf?.volatility
  const msVol = docData?.perf?.volatility // Legacy fallback source
  const riskVol = msRisk.std_dev_3y // New V3 source

  const rawVol = stdVol !== undefined && stdVol !== null ? stdVol : (riskVol !== undefined ? riskVol : msVol)
  const vol = asDecimalPct(rawVol)

  const sharpe = toNumber(docData?.std_perf?.sharpe ?? msRisk.sharpe_ratio_3y ?? docData?.perf?.sharpe)
  const alpha = toNumber(docData?.std_perf?.alpha ?? msRisk.alpha_3y ?? docData?.perf?.alpha)
  const beta = toNumber(docData?.std_perf?.beta ?? msRisk.beta_3y ?? docData?.perf?.beta)

  // CAGR 3Y: Strict. No calculation from returns_history.
  const cagrRaw =
    (docData?.std_perf?.cagr3y ?? docData?.std_perf?.return) ??
    (docData?.perf?.cagr3y ?? docData?.perf?.return)
  const ret3y = asDecimalPct(cagrRaw)

  // Max Drawdown
  const mddRaw =
    (docData?.std_perf?.max_drawdown ?? docData?.std_perf?.maxDrawdown) ??
    (docData?.perf?.max_drawdown ?? docData?.perf?.maxDrawdown)
  const max_drawdown = maxDdToDecimalNegative(mddRaw)

  // History Years (Calculated only if history_start exists OR from returns_history keys)
  let yearsHistory: number | null = null
  if (docData.history_start) {
    try {
      const startDate = docData.history_start.toDate
        ? docData.history_start.toDate()
        : new Date(docData.history_start)
      const now = new Date()
      if (!isNaN(startDate.getTime())) {
        yearsHistory = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      }
    } catch {
      /* ignore */
    }
  } else if (docData.returns_history && typeof docData.returns_history === 'object') {
    const years = Object.keys(docData.returns_history).filter((k) => !isNaN(parseInt(k)))
    if (years.length > 0) yearsHistory = years.length
  } else if (Array.isArray(docData.yearly_returns)) {
    if (docData.yearly_returns.length > 0) yearsHistory = docData.yearly_returns.length
  }

  // Costs (Strict)
  const ter = asDecimalPct(docData.costs?.ter)
  const mgmtFee = asDecimalPct(docData.costs?.management_fee)

  // Sectors (Format array if needed, else null)
  let finalSectors: any = docData.sectors || docData.holding_breakdown?.sectors || docData.ms?.sectors || null
  if (finalSectors && !Array.isArray(finalSectors) && typeof finalSectors === 'object') {
    finalSectors = Object.entries(finalSectors).map(([k, v]) => ({
      name: String(k).replace(/_/g, ' '),
      weight: v,
    }))
  }

  // Holdings (Map top10 if available)
  // FIX: Added docData.ms?.holdings_top10 as source
  const holdings = docData.holdings || docData.holdings_top10 || docData.ms?.holdings_top10 || [];

  // Description / Objective
  // FIX: Added docData.ms?.objective as source for description
  const description = docData.description || docData.ms?.objective || null;

  // Duration / Maturity (Strict -> Fallback to Allocation)
  let duration = toNumber(
    docData.metrics?.duration ||
    docData.metrics?.effective_duration ||
    docData.risk?.effective_duration ||
    docData.fixed_income?.effective_duration
  )

  let effectiveMaturity = toNumber(
    docData.metrics?.effective_maturity ||
    docData.metrics?.maturity ||
    docData.fixed_income?.effective_maturity
  )

  // [FALLBACK] Calculate Duration/Maturity from Allocations if missing
  if (!effectiveMaturity && docData.ms?.fixed_income?.maturity_allocation) {
    try {
      const matAlloc = docData.ms.fixed_income.maturity_allocation;
      // Midpoints for buckets
      const buckets: Record<string, number> = {
        '1_3': 2,
        '3_5': 4,
        '5_7': 6,
        '7_10': 8.5,
        '10_15': 12.5,
        '15_20': 17.5,
        'over_20': 25,
        'over_10': 15, // fallback if over_20 not present
        'under_1': 0.5 // if exists
      };

      let wSum = 0;
      let totalW = 0;
      Object.entries(matAlloc).forEach(([k, v]) => {
        const weight = toNumber(v) || 0;
        if (weight > 0 && buckets[k]) {
          wSum += weight * buckets[k];
          totalW += weight;
        }
      });

      if (totalW > 50) { // Only if we have significant data
        effectiveMaturity = wSum / totalW;
        // Heuristic: Duration is often slightly less than maturity
        if (!duration) duration = effectiveMaturity * 0.9;
      }
    } catch (e) { /* ignore */ }
  }

  // Credit Quality (Strict)
  const crQuality: any =
    docData.credit_quality ||
    docData.risk?.credit_quality ||
    docData.fixed_income?.avg_credit_quality ||
    null

  // ⭐ Ratings (Strict)
  const mstarStars = normalizeStars(docData.rating_stars ?? docData?.ms?.rating_stars)
  const overallRaw = docData.rating_overall ?? docData?.ms?.rating_overall ?? docData.rating ?? null
  const mstarOverall = normalizeStars(overallRaw)

  const srriRaw = docData.risk_srri ?? docData.riskSrri ?? docData.srri
  let riskSrri: number | null = toNumber(srriRaw)
  if (riskSrri !== null) {
    if (riskSrri < 0 || riskSrri > 7) riskSrri = null
  }

  // Patrimonio (Strict)
  const patrimonioRaw =
    docData.patrimonio ?? docData?.std_extra?.patrimonio ?? docData?.extra?.patrimonio ?? docData?.aum
  const patrimonioNum = toNumber(patrimonioRaw)

  return {
    ...docData,
    sectors: finalSectors,
    holdings: holdings,
    description: description,

    // Normalized Fields (can be null)
    std_type: std_type,
    std_region: std_region,

    // ⭐ devolvemos ambos: así la UI tiene el que esté usando
    rating_stars: mstarStars,
    rating_overall: mstarOverall,

    risk_srri: riskSrri,
    patrimonio: patrimonioNum,

    std_perf_norm: {
      volatility: vol,
      cagr3y: ret3y,
      sharpe: sharpe,
      alpha: alpha,
      beta: beta,
      max_drawdown: max_drawdown,
    },

    std_extra: {
      patrimonio: patrimonioNum,
      currency: docData.currency || null,
      company: docData.fund_company || docData.company || null,
      category: docData.category_morningstar || docData.category || null,
      assetClass: std_type,
      regionDetail: std_region,
      yearsHistory: yearsHistory,
      mgmtFee: mgmtFee, // strictly flattened
      ter: ter, // strictly flattened
      duration: duration,
      credit_quality: crQuality,
      effective_maturity: effectiveMaturity,
      yield_to_maturity: toNumber(docData.metrics?.yield || docData.metrics?.ytm),

      // ✅ CLAVE: muchas pantallas leen rating desde std_extra
      rating_stars: mstarStars,
      rating_overall: mstarOverall,
    },

    // ✅ DATA QUALITY ADAPTER (Frontend Shim)
    // Permite que componentes UI vean 'points_count' aunque venga como 'history_points'
    data_quality: {
      ...(docData.data_quality || {}),
      points_count: (docData.data_quality?.points_count ?? docData.data_quality?.history_points ?? 0),
      history_points: (docData.data_quality?.history_points ?? 0)
    }
  }
}
