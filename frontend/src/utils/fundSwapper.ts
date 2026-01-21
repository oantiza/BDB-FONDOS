// frontend/src/utils/fundSwapper.ts
import { calculateScore } from './rulesEngine';

export interface Alternative {
  fund: any;
  reason: string;
  badgeColor: string; // 'green', 'purple', 'blue'
  // deltaFee is expressed in TER points (e.g. -0.20 means 0.20pp cheaper)
  deltaFee: number;
}

// ---------- Helpers (defensive + schema-aware) ----------
const canon = (s: any) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const safeNum = (v: any, def = 0) => {
  if (v === null || v === undefined) return def;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').replace('%', ''));
    return Number.isFinite(n) ? n : def;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// Try to identify the "base fund" (to avoid offering another share class of the same fund).
// If you ever add a real master/base id (recommended), plug it into baseIdCandidates.
const stripShareClassTokens = (name: string) => {
  let out = canon(name);

  const patterns: RegExp[] = [
    /\bclass\b\s*[a-z0-9]+\b/g,
    /\bclase\b\s*[a-z0-9]+\b/g,
    /\bshares?\b/g,
    /\b(acc|accumulation|inc|income|dist|distribution|acumulacion|acumulaci[oó]n|distribucion|distribuci[oó]n)\b/g,
    /\b(hedged|hgd|unhedged|cobertura|cubierto|cubierta)\b/g,
    /\b(eur|usd|gbp|chf|jpy|sek|nok|dkk)\b/g,
    /\b(ucits)\b/g,
    /\b(i+|ii+|iii+|iv+|v+|vi+)\b/g, // roman numerals sometimes used in share class naming
  ];

  for (const re of patterns) out = out.replace(re, ' ');
  return out.replace(/\s+/g, ' ').trim();
};

const getCompany = (f: any) => canon(f?.fund_company || f?.company || f?.std_extra?.company || '');
const getName = (f: any) => String(f?.name || f?.nombre || f?.fund_name || '');

const getBaseKey = (f: any) => {
  if (!f) return '';
  // If later you store something like f.base_fund_id or ms_fundId, prefer it here.
  const baseIdCandidates = [
    f?.base_fund_id,
    f?.master_id,
    f?.master_isin,
    f?.std_extra?.base_isin,
    f?.std_extra?.master_isin,
    f?.ms_fundId,
    f?.globalFundId,
  ].filter(Boolean);

  if (baseIdCandidates.length > 0) return String(baseIdCandidates[0]);

  // Heuristic: company + name without share-class tokens
  const company = getCompany(f);
  const baseName = stripShareClassTokens(getName(f));
  return company && baseName ? `${company}::${baseName}` : '';
};

// Matching keys (category + geography) with fallback across schema versions
const getCategoryKey = (f: any) =>
  String(
    f?.category_morningstar ||
    f?.std_type ||
    f?.manual_type ||
    f?.asset_class ||
    ''
  ).trim();

const getRegionKey = (f: any) =>
  String(
    f?.manual_region ||
    f?.primary_region ||
    f?.std_region ||
    ''
  ).trim();

// [NEW] Asset Class Key for Tier 2/3 Search
const getAssetClassKey = (f: any) =>
  String(f?.asset_class || f?.std_type || '').trim().toUpperCase();

// Costs (prefer costs.ter in your schema v3)
const getTER = (f: any) => safeNum(f?.costs?.ter ?? f?.ter ?? f?.std_extra?.ter, 0);
const getRetro = (f: any) => safeNum(f?.manual?.costs?.retrocession ?? f?.costs?.retrocession ?? f?.retrocession ?? f?.costs?.retrocesion ?? 0, 0);

// ---------- Main API ----------
export function findAlternatives(
  originalFund: any,
  allFunds: any[],
  riskLevel: number,
  portfolio: any[] = []
): Alternative[] {
  if (!originalFund || !Array.isArray(allFunds)) return [];

  const targetCategory = getCategoryKey(originalFund);
  const targetRegion = getRegionKey(originalFund);
  const targetAssetClass = getAssetClassKey(originalFund);

  const portfolioIsins = new Set(
    (portfolio || []).map(p => String(p?.isin || '').trim()).filter(Boolean)
  );

  const originalBase = getBaseKey(originalFund);
  const portfolioBaseKeys = new Set(
    (portfolio || []).map(p => getBaseKey(p)).filter(Boolean)
  );

  // Common Validity Check
  const isValidCandidate = (f: any) => {
    const isin = String(f?.isin || '').trim();
    if (!isin) return false;
    if (isin === String(originalFund?.isin || '').trim()) return false;
    if (portfolioIsins.has(isin)) return false;

    const bk = getBaseKey(f);
    if (!bk) return false;
    if (originalBase && bk === originalBase) return false;
    if (portfolioBaseKeys.has(bk)) return false;

    // Optional: basic quality guardrails
    // if (f?.data_quality?.history_ok === false) return false;
    // if (f?.data_quality?.std_perf_ok === false) return false;

    return true;
  };

  // --- TIERED SEARCH STRATEGY ---

  // 1. Strict Match (Category + Region)
  let candidates = allFunds.filter(f => {
    if (!isValidCandidate(f)) return false;
    return getCategoryKey(f) === targetCategory && getRegionKey(f) === targetRegion;
  });

  // 2. Relaxed Match (Asset Class + Region) - If we have few candidates
  if (candidates.length < 5) {
    const tier2 = allFunds.filter(f => {
      if (!isValidCandidate(f)) return false;
      // Avoid duplicates
      if (getCategoryKey(f) === targetCategory) return false;

      return getAssetClassKey(f) === targetAssetClass && getRegionKey(f) === targetRegion;
    });
    candidates = [...candidates, ...tier2];
  }

  // 3. Broad Match (Asset Class Only) - Last Resort
  if (candidates.length < 5) {
    const tier3 = allFunds.filter(f => {
      if (!isValidCandidate(f)) return false;
      // Avoid duplicates from T1/T2
      if (getAssetClassKey(f) === targetAssetClass && getRegionKey(f) === targetRegion) return false;
      // Check Asset Class Match
      return getAssetClassKey(f) === targetAssetClass;
    });
    candidates = [...candidates, ...tier3];
  }

  // 4. Universal Fallback (Desperation) - Show anything valid if we have nothing
  if (candidates.length < 5) {
    const tier4 = allFunds.filter(f => {
      if (!isValidCandidate(f)) return false;
      // Avoid duplicates already in candidates
      const isin = String(f?.isin || '').trim();
      if (candidates.some(c => String(c.isin) === isin)) return false;
      return true;
    });
    candidates = [...candidates, ...tier4];
  }

  // 2) Score candidates (quant + commercial)
  const scored = candidates.map(f => ({
    fund: f,
    score: safeNum(calculateScore(f, riskLevel), 0),
    commercialScore: getRetro(f),
    fee: getTER(f),
    isDifferentCompany: getCompany(f) !== getCompany(originalFund),
  }));

  if (scored.length === 0) return [];

  const results: Alternative[] = [];
  const currentFee = getTER(originalFund);

  // OPTION A: Best quantitative score (true)
  const bestQuant = [...scored].sort((a, b) => b.score - a.score)[0];
  if (bestQuant) {
    results.push({
      fund: bestQuant.fund,
      reason: '⭐ Más Eficiente',
      badgeColor: 'green',
      deltaFee: bestQuant.fee - currentFee,
    });
  }

  // OPTION B: Commercial/diversification, but with a quality floor.
  // Choose within the top 20% by score (min 5) to avoid "random" picks.
  const sortedByScore = [...scored].sort((a, b) => b.score - a.score);
  const floorN = Math.max(5, Math.ceil(sortedByScore.length * 0.2));
  const qualityFloor = sortedByScore.slice(0, floorN);

  const remaining = qualityFloor.filter(x => x.fund.isin !== bestQuant?.fund.isin);

  const bestCommercial = remaining
    .sort((a, b) => {
      // Prefer different company first, then by commercialScore (retrocession)
      if (a.isDifferentCompany && !b.isDifferentCompany) return -1;
      if (!a.isDifferentCompany && b.isDifferentCompany) return 1;
      return b.commercialScore - a.commercialScore;
    })[0];

  if (bestCommercial) {
    results.push({
      fund: bestCommercial.fund,
      reason: bestCommercial.isDifferentCompany
        ? '🔄 Diversificación Gestora'
        : '💎 Alternativa Premium',
      badgeColor: 'purple',
      deltaFee: bestCommercial.fee - currentFee,
    });
  }

  // Guarantee uniqueness by ISIN
  const seen = new Set<string>();
  return results.filter(r => {
    const isin = String(r?.fund?.isin || '');
    if (!isin) return false;
    if (seen.has(isin)) return false;
    seen.add(isin);
    return true;
  });
}

// Keep legacy function, but update internals if needed (unused in Dashboard)
export function findHomogeneousAlternatives(
  originalFund: any,
  allFunds: any[],
  portfolio: any[] = []
): any[] {
  // Just wrap new logic for simplicity, returning raw funds
  const alts = findAlternatives(originalFund, allFunds, 5, portfolio); // Risk 5 default
  return alts.map(a => a.fund).slice(0, 3);
}
