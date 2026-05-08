/**
 * Asset subtype and strategy classification helpers.
 * REFACTOR-2.
 *
 * Pure functions only: no filesystem, no Gemini, no Firestore.
 */

"use strict";

const { cleanString, parseNum } = require("../utils/number_utils");
const { normalizeTextForTokens } = require("../normalize/text_normalizer");
const { hasLatinAmericaIdentity } = require("../normalize/region_normalizer");

const SECTOR_SUBTYPE_FROM_SECTOR_TAG = {
  technology: "SECTOR_EQUITY_TECH",
  healthcare: "SECTOR_EQUITY_HEALTHCARE",
  financials: "SECTOR_EQUITY_FINANCIALS",
  industrials: "SECTOR_EQUITY_INDUSTRIALS",
  consumer_cyclical: "SECTOR_EQUITY_CONSUMER_CYCLICAL",
  consumer_defensive: "SECTOR_EQUITY_CONSUMER_DEFENSIVE",
  real_estate: "SECTOR_EQUITY_REAL_ESTATE",
  utilities: "SECTOR_EQUITY_UTILITIES",
  energy: "SECTOR_EQUITY_ENERGY",
  communication_services: "SECTOR_EQUITY_COMMUNICATION",
  materials: "SECTOR_EQUITY_BASIC_MATERIALS",
};

const STRICT_SECTOR_FUND_MIN_WEIGHT = 60;
const TEXT_BACKED_SECTOR_FUND_MIN_WEIGHT = 45;

function deriveSubcategories(msSectors, name, category, objective = "", deps = {}) {
  const tags = new Set();
  const sectorKeyToTag = deps.sectorKeyToTag || new Map();
  const tokenMatchers = deps.tokenMatchers || [];
  const parseNumber = deps.parseNum || parseNum;
  const normalizeText = deps.normalizeTextForTokens || normalizeTextForTokens;

  if (msSectors && typeof msSectors === "object") {
    for (const [key, rawV] of Object.entries(msSectors)) {
      const w = parseNumber(rawV);
      if (w === null) continue;
      const baseTag = sectorKeyToTag.get(key);
      if (!baseTag) continue;

      if (w >= 25) tags.add(baseTag);
      if (w >= 40) {
        const sector = baseTag.split(":")[1];
        tags.add(`sector_concentrated:${sector}`);
      }
    }
  }

  const text = normalizeText(`${name || ""} ${category || ""} ${objective || ""}`);
  for (const t of tokenMatchers) {
    if (t.regex.test(text)) tags.add(t.tag);
  }

  const arr = Array.from(tags);
  arr.sort((a, b) => {
    const rank = (x) =>
      x.startsWith("sector_concentrated:")
        ? 0
        : x.startsWith("sector:")
          ? 1
          : x.startsWith("theme:")
            ? 2
            : 9;
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  return arr;
}

function deriveSectorEquitySubtypeFromTags(tags = []) {
  if (!Array.isArray(tags) || !tags.length) return null;
  for (const tag of tags) {
    if (!tag.startsWith("sector_concentrated:") && !tag.startsWith("sector:")) continue;
    const [, sectorTag] = tag.split(":");
    if (sectorTag && SECTOR_SUBTYPE_FROM_SECTOR_TAG[sectorTag]) {
      return SECTOR_SUBTYPE_FROM_SECTOR_TAG[sectorTag];
    }
  }
  return null;
}

function topSector(msSectors) {
  if (!msSectors || typeof msSectors !== "object") {
    return { top_sector: null, top_sector_weight: null };
  }
  let bestK = null;
  let bestV = -1;
  for (const [k, v] of Object.entries(msSectors)) {
    const n = parseNum(v);
    if (n === null) continue;
    if (n > bestV) {
      bestV = n;
      bestK = k;
    }
  }
  return { top_sector: bestK, top_sector_weight: bestV >= 0 ? bestV : null };
}

function deriveAssetSubtype(catUpper, subcats = [], nameUpper = "", topSectorWeight = null, derivedAssetClass = null) {
  const c = `${catUpper || ""} ${nameUpper || ""}`;
  const tags = Array.isArray(subcats) ? subcats : [];

  if (c.includes("CONVERTIBLE")) return "CONVERTIBLE_BOND";
  if (c.includes("HIGH YIELD") || c.includes("ALTO RENDIMIENTO")) return "HIGH_YIELD_BOND";
  if (c.includes("INFLATION") || c.includes("LINKED")) return "INFLATION_LINKED_BOND";

  if (c.includes("EMERGING") && (c.includes("BOND") || c.includes("DEBT") || c.includes("FIXED INCOME") || c.includes("RF"))) {
    return "EMERGING_MARKETS_BOND";
  }

  if (c.includes("GOVERNMENT") || c.includes("TREASURY") || c.includes("SOVEREIGN") || c.includes("PUBLICA")) {
    return "GOVERNMENT_BOND";
  }

  if (
    (catUpper || "").startsWith("RF") ||
    c.includes(" BOND") ||
    c.includes("BOND ") ||
    c.includes("CREDIT") ||
    c.includes("FIXED INCOME") ||
    c.includes("RENTA FIJA")
  ) {
    return "CORPORATE_BOND";
  }

  const flags = deriveFlags(catUpper, subcats, nameUpper, topSectorWeight, derivedAssetClass);
  if (flags.is_thematic === true) {
    return "THEMATIC_EQUITY";
  }

  const sectorSubtype = deriveSectorEquitySubtypeFromTags(tags);
  if (sectorSubtype && flags.is_sector_fund && (derivedAssetClass === null || derivedAssetClass === "RV")) {
    return sectorSubtype;
  }

  if (c.includes("MSCI")) {
    if (c.includes("WORLD")) return "GLOBAL_EQUITY";
    if (c.includes("EMERGING")) return "EMERGING_MARKETS_EQUITY";
    if (c.includes("EUROPE")) return "EUROPE_EQUITY";
    if (c.includes("USA") || c.includes("US")) return "US_EQUITY";
  }

  if (
    c.includes("ISHARES") ||
    c.includes("VANGUARD") ||
    c.includes("AMUNDI") ||
    c.includes("XTRACKERS") ||
    c.includes("SPDR") ||
    c.includes("LYXOR") ||
    c.includes("UBS ETF") ||
    c.includes("INDEX FUND")
  ) {
    if (c.includes("EMERGING")) return "EMERGING_MARKETS_EQUITY";
    if (c.includes("EUROPE")) return "EUROPE_EQUITY";
    if (c.includes("USA") || c.includes("US")) return "US_EQUITY";
    return "GLOBAL_EQUITY";
  }

  if (c.includes("WORLD") || c.includes("GLOBAL") || c.includes("ACWI") || c.includes("ALL WORLD") || c.includes("INTERNATIONAL")) {
    return "GLOBAL_EQUITY";
  }

  if (c.includes("USA") || c.includes("UNITED STATES") || c.includes("U.S.")) return "US_EQUITY";
  if (c.includes("EUROZONE") || c.includes("EUROLAND")) return "EUROZONE_EQUITY";
  if (c.includes("EUROPE") || c.includes("EUROPA")) return "EUROPE_EQUITY";
  if (hasLatinAmericaIdentity(c)) {
    return "EMERGING_MARKETS_EQUITY";
  }
  if (c.includes("JAPAN") || c.includes("JAPON") || c.includes("JAPÃƒâ€œN")) return "JAPAN_EQUITY";
  if (c.includes("ASIA PACIFIC") || c.includes("ASIA EX")) return "ASIA_PACIFIC_EQUITY";
  if (c.includes("EMERGING") || c.includes("EMERGENTE")) return "EMERGING_MARKETS_EQUITY";

  if (
    c.includes("SMALL CAP") ||
    c.includes("MID CAP") ||
    c.includes("SMID") ||
    c.includes("SMALLER COMPANIES")
  ) {
    return "GLOBAL_SMALL_CAP_EQUITY";
  }

  if (c.includes("DIVIDEND") || c.includes("INCOME")) return "GLOBAL_INCOME_EQUITY";

  if (c.includes("EQUITY") || c.includes("RENTA VARIABLE") || c.startsWith("RV") || c.includes("ACCIONES")) {
    return "GLOBAL_EQUITY";
  }

  if (
    c.includes("ALLOCATION") ||
    c.includes("MIXTO") ||
    c.includes("BALANCED") ||
    c.includes("MULTI ASSET") ||
    c.includes("MULTIASSET")
  ) {
    return "FLEXIBLE_ALLOCATION";
  }

  return "UNKNOWN";
}

function deriveFlags(catUpper, subcats = [], nameUpper = "", topSectorWeight = null, derivedAssetClass = null) {
  const c = `${catUpper || ""} ${nameUpper || ""}`;
  const tags = Array.isArray(subcats) ? subcats : [];
  const themeTags = tags.filter((x) => x.startsWith("theme:"));
  const hasSectorTag = tags.some((x) => x.startsWith("sector:"));
  const hasConcentratedSectorTag = tags.some((x) => x.startsWith("sector_concentrated:"));
  const topSectorWeightNumber = parseNum(topSectorWeight);
  const isHighlyConcentratedSector =
    Number.isFinite(topSectorWeightNumber) && topSectorWeightNumber >= STRICT_SECTOR_FUND_MIN_WEIGHT;
  const hasTextBackedSectorConcentration =
    Number.isFinite(topSectorWeightNumber) && topSectorWeightNumber >= TEXT_BACKED_SECTOR_FUND_MIN_WEIGHT;
  const hasExplicitSectorText =
    c.includes("SECTOR") ||
    c.includes("SECTORIAL") ||
    c.includes("INDUSTRY");
  const hasInfrastructureIdentity =
    c.includes("INFRASTRUCTURE") ||
    c.includes("INFRAESTRUCTURA");

  const isIndexLike =
    c.includes("INDEX") ||
    c.includes("MSCI") ||
    c.includes("ISHARES") ||
    c.includes("ETF") ||
    c.includes("VANGUARD INDEX");

  const isAllocationLikeByText =
    c.includes("ALLOCATION") ||
    c.includes("MIXTO") ||
    c.includes("BALANCED") ||
    c.includes("MULTI ASSET") ||
    c.includes("MULTIASSET");

  const isAllocationLike = derivedAssetClass === "Mixto" || isAllocationLikeByText;
  const sectorEligibleAssetClass =
    derivedAssetClass === null || derivedAssetClass === "RV";
  const hasTextBackedSectorEvidence =
    (hasExplicitSectorText || hasInfrastructureIdentity) &&
    (
      hasConcentratedSectorTag ||
      hasSectorTag ||
      !Number.isFinite(topSectorWeightNumber) ||
      hasTextBackedSectorConcentration
    );

  const isSectorFund =
    sectorEligibleAssetClass &&
    !isAllocationLike &&
    (
      isHighlyConcentratedSector ||
      hasTextBackedSectorEvidence
    );

  const broadSectorLikeThemes = new Set([
    "theme:technology",
    "theme:healthcare",
    "theme:financials",
    "theme:energy",
    "theme:real_estate",
    "theme:materials",
  ]);
  const hasDistinctThemeTag = themeTags.some((t) => !broadSectorLikeThemes.has(t));

  const hasHardThematicKeyword =
    c.includes("THEMATIC") ||
    c.includes("CLIMATE") ||
    c.includes("ENVIRONMENT") ||
    c.includes("ECOLOG") ||
    c.includes("MEDIO AMBIENTE") ||
    c.includes("AMBIENTAL") ||
    c.includes("TRANSICION ENERGETICA") ||
    c.includes("ENERGY TRANSITION") ||
    c.includes("CLEAN ENERGY") ||
    c.includes("WATER") ||
    c.includes("ROBOTICS") ||
    c.includes("BIG DATA");

  const isThematic =
    hasHardThematicKeyword ||
    hasDistinctThemeTag ||
    (themeTags.length > 0 && !isSectorFund);

  return {
    is_index_like: Boolean(isIndexLike),
    is_sector_fund: Boolean(isSectorFund),
    is_thematic: Boolean(isThematic),
  };
}

function normalizeSubtypeByAssetType(assetType, assetSubtype, fixedIncomeType = null) {
  const subtype = cleanString(assetSubtype) || "UNKNOWN";
  const isEquitySubtype =
    subtype === "THEMATIC_EQUITY" ||
    subtype.startsWith("SECTOR_EQUITY_") ||
    subtype.endsWith("_EQUITY");
  const isBondSubtype = subtype.endsWith("_BOND");

  if (assetType === "equity") {
    return { subtype, incompatible: false };
  }

  if (assetType === "fixed_income") {
    if (isBondSubtype) return { subtype, incompatible: false };
    const safeSubtypeByType = {
      convertible: "CONVERTIBLE_BOND",
      inflation_linked: "INFLATION_LINKED_BOND",
      high_yield: "HIGH_YIELD_BOND",
      government: "GOVERNMENT_BOND",
      emerging_debt: "EMERGING_MARKETS_BOND",
      corporate: "CORPORATE_BOND",
      flexible: "CORPORATE_BOND",
    };
    return {
      subtype: safeSubtypeByType[fixedIncomeType] || "CORPORATE_BOND",
      incompatible: true,
    };
  }

  if (assetType === "allocation") {
    if (subtype === "FLEXIBLE_ALLOCATION" || subtype === "UNKNOWN") return { subtype, incompatible: false };
    if (isEquitySubtype || isBondSubtype) return { subtype: "FLEXIBLE_ALLOCATION", incompatible: true };
    return { subtype: "FLEXIBLE_ALLOCATION", incompatible: true };
  }

  if (assetType === "money_market") {
    if (subtype === "MONEY_MARKET") return { subtype, incompatible: false };
    if (subtype === "UNKNOWN") return { subtype: "MONEY_MARKET", incompatible: false, defaulted: true };
    if (isEquitySubtype || isBondSubtype || subtype === "FLEXIBLE_ALLOCATION") {
      return { subtype: "MONEY_MARKET", incompatible: true };
    }
    return { subtype: "MONEY_MARKET", incompatible: true };
  }

  if (assetType === "alternative" || assetType === "real_asset" || assetType === "other") {
    if (subtype === "UNKNOWN") return { subtype, incompatible: false };
    if (isEquitySubtype || isBondSubtype || subtype === "FLEXIBLE_ALLOCATION") {
      return { subtype: "UNKNOWN", incompatible: true };
    }
    return { subtype: "UNKNOWN", incompatible: true };
  }

  return { subtype, incompatible: false };
}

module.exports = {
  SECTOR_SUBTYPE_FROM_SECTOR_TAG,
  STRICT_SECTOR_FUND_MIN_WEIGHT,
  TEXT_BACKED_SECTOR_FUND_MIN_WEIGHT,
  deriveSubcategories,
  deriveSectorEquitySubtypeFromTags,
  topSector,
  deriveAssetSubtype,
  deriveFlags,
  normalizeSubtypeByAssetType,
};
