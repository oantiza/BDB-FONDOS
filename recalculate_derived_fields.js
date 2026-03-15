/**
 * Recalcula SOLO derived.* en funds_v3
 * - NO toca manual.*
 * - NO toca ms.*
 * - NO necesita PDFs
 *
 * Uso:
 *   node recalculate_derived_fields.js
 *   node recalculate_derived_fields.js --limit 100
 *   node recalculate_derived_fields.js --startAfter ISIN123
 *   node recalculate_derived_fields.js --dry-run
 *
 * Requisitos:
 *   npm i firebase-admin dotenv
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// -----------------------------
// Args
// -----------------------------
function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const LIMIT = getArgValue("--limit") ? parseInt(getArgValue("--limit"), 10) : null;
const START_AFTER = getArgValue("--startAfter") || null;
const DRY_RUN = hasFlag("--dry-run");

// -----------------------------
// Firebase Admin init
// -----------------------------
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
  console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = require(SERVICE_ACCOUNT_FILE);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  console.log(`🔑 Firebase Admin OK: ${serviceAccount.project_id}`);
}

const db = admin.firestore();

// -----------------------------
// Helpers
// -----------------------------
function cleanString(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(/\s+/g, " ");
  return t.length ? t : null;
}

function parseNum(x) {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).replace("%", "").replace(",", ".").trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function clampPct(n) {
  const v = parseNum(n);
  if (v === null) return null;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function scalePctMap(mapObj, totalPct) {
  const t = clampPct(totalPct);
  if (t === null) return null;
  if (!mapObj || typeof mapObj !== "object") return null;

  const out = {};
  for (const [k, v] of Object.entries(mapObj)) {
    const n = clampPct(v);
    if (n === null) continue;
    const scaled = n * (t / 100.0);
    if (scaled > 0) out[k] = +scaled.toFixed(4);
  }
  return Object.keys(out).length ? out : null;
}

function hasAnyFiniteNumber(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some((v) => Number.isFinite(parseNum(v)));
}

function sizeWeightsTotalFromMarketCap(marketCapObj, equityTotalPct) {
  if (!marketCapObj || typeof marketCapObj !== "object") return null;
  const eq = clampPct(equityTotalPct);
  if (eq === null) return null;

  const micro = clampPct(marketCapObj.micro);
  const small = clampPct(marketCapObj.small);
  const mid = clampPct(marketCapObj.mid);
  const large = clampPct(marketCapObj.large);
  const giant = clampPct(marketCapObj.giant);

  const vals = [micro, small, mid, large, giant].filter((v) => v !== null);
  if (!vals.length) return null;

  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum <= 0.0001) return null;

  const microN = ((micro ?? 0) * 100.0) / sum;
  const smallN = ((small ?? 0) * 100.0) / sum;
  const midN = ((mid ?? 0) * 100.0) / sum;
  const largeN = ((large ?? 0) * 100.0) / sum;
  const giantN = ((giant ?? 0) * 100.0) / sum;

  const bucketMap = {
    small: microN + smallN,
    mid: midN,
    large: largeN + giantN,
  };
  return scalePctMap(bucketMap, eq);
}

function parseStyleBoxCell(cell) {
  const s = cleanString(cell);
  if (!s) return { size: null, style: null };
  const parts = s.split("-").map((p) => p.trim().toLowerCase());
  if (parts.length < 2) return { size: null, style: null };

  const sizeRaw = parts[0];
  const styleRaw = parts.slice(1).join("-");

  const size = sizeRaw.includes("large")
    ? "large"
    : sizeRaw.includes("mid")
      ? "mid"
      : sizeRaw.includes("small")
        ? "small"
        : null;

  const style = styleRaw.includes("value")
    ? "value"
    : styleRaw.includes("blend")
      ? "blend"
      : styleRaw.includes("growth")
        ? "growth"
        : null;

  return { size, style };
}

function argmaxKey(obj) {
  if (!obj || typeof obj !== "object") return null;
  let bestK = null;
  let bestV = -Infinity;
  for (const [k, v] of Object.entries(obj)) {
    const n = parseNum(v);
    if (!Number.isFinite(n)) continue;
    if (n > bestV) {
      bestV = n;
      bestK = k;
    }
  }
  return bestK;
}

function normalizeTextForTokens(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function deleteUndefinedDeep(obj) {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    const arr = obj.map(deleteUndefinedDeep).filter((v) => v !== undefined);
    return arr.length ? arr : null;
  }
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = deleteUndefinedDeep(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length ? out : null;
  }
  return obj;
}

// -----------------------------
// Minimal token maps
// -----------------------------
const tokenToTag = [
  { token: "TECHNOLOGY", tag: "sector:technology" },
  { token: "HEALTHCARE", tag: "sector:healthcare" },
  { token: "INFRASTRUCTURE", tag: "theme:infrastructure" },
  { token: "WATER", tag: "theme:water" },
  { token: "CLIMATE", tag: "theme:climate" },
  { token: "ROBOTICS", tag: "theme:robotics" },
  { token: "AI", tag: "theme:ai" },
  { token: "ARTIFICIAL INTELLIGENCE", tag: "theme:ai" },
  { token: "BIG DATA", tag: "theme:big_data" },
  { token: "ENERGY TRANSITION", tag: "theme:energy_transition" },
];

function deriveAssetClassFromCategory(catUpper, nameUpper = "", sectors = null) {
  const c = `${catUpper || ""} ${nameUpper || ""}`;

  if (
    c.includes("MONETARIO") ||
    c.includes("MONEY MARKET") ||
    c.includes("LIQUIDEZ") ||
    c.includes("LIQUIDITY") ||
    c.includes("TREASURY") ||
    c.includes("TRÉSORERIE") ||
    c.includes("TRESORERIE") ||
    c.includes("VNAV") ||
    c.includes("LVNAV")
  ) return "Monetario";

  if (
    c.includes("CONVERTIBLE") ||
    c.startsWith("RF") ||
    c.includes("RENTA FIJA") ||
    c.includes("BOND") ||
    c.includes("CREDIT") ||
    c.includes("FIXED INCOME") ||
    c.includes("DEUDA")
  ) return "RF";

  if (
    c.includes("RETORNO ABSOLUTO") ||
    c.includes("ABSOLUTE RETURN") ||
    c.includes("MARKET NEUTRAL") ||
    c.includes("LONG/SHORT") ||
    c.includes("LONG SHORT") ||
    c.includes("MULTISTRATEGY") ||
    c.includes("MULTI-STRATEGY") ||
    c.includes("SYSTEMATIC FUTURES") ||
    c.includes("MANAGED FUTURES") ||
    c.includes("GLOBAL MACRO")
  ) return "Alternativos";

  if (
    c.includes("INMOBILIAR") ||
    c.includes("REAL ESTATE") ||
    c.includes("REIT") ||
    c.includes("PROPERTY") ||
    c.includes("IMMOBILIER")
  ) return "Inmobiliario";

  const hardCommodities = [
    "COMMODIT",
    "MATERIAS PRIMAS",
    "PRECIOUS METALS",
    "WORLD GOLD",
    "GLOBAL GOLD",
    "GOLD FUND",
    "GOLD & SILVER",
    "GOLD AND PRECIOUS METALS",
    "METALS & MINING",
    "METALS AND MINING",
    "WORLD MINING",
    "MINING FUND",
    "PRECIOUS METALS FUND",
  ];

  if (hardCommodities.some((x) => c.includes(x))) return "Commodities";

  if (
    c.includes("ALLOCATION") ||
    c.includes("MIXTO") ||
    c.includes("BALANCED") ||
    c.includes("MULTI ASSET") ||
    c.includes("MULTIASSET")
  ) return "Mixto";

  if (
    c.startsWith("RV") ||
    c.includes("RENTA VARIABLE") ||
    c.includes("EQUITY") ||
    c.includes("ACCIONES")
  ) return "RV";

  if (sectors && typeof sectors === "object") {
    const hasRealEquitySector = Object.keys(sectors).some((k) =>
      [
        "technology",
        "financial_services",
        "financials",
        "industrials",
        "healthcare",
        "utilities",
        "energy",
        "communication_services",
        "consumer_cyclical",
        "consumer_defensive",
        "real_estate",
        "basic_materials",
      ].includes(k)
    );
    if (hasRealEquitySector) return "RV";
  }

  return "Otros";
}

function derivePrimaryRegion(msRegions, catUpper, nameUpper = "") {
  const c = `${catUpper || ""} ${nameUpper || ""}`;

  if (
    c.includes("EUROPE") ||
    c.includes("EUROPA") ||
    c.includes("EUROZONE") ||
    c.includes("EMU") ||
    c.includes("EUROLAND")
  ) return "Europa";

  if (
    c.includes("USA") ||
    c.includes("UNITED STATES") ||
    c.includes("US ") ||
    c.includes(" U.S.") ||
    c.includes("NORTH AMERICA")
  ) return "USA";

  if (c.includes("JAPAN") || c.includes("JAPÓN") || c.includes("JAPON")) return "Japón";
  if (c.includes("EMERGING") || c.includes("EMERGENTE")) return "Emergentes";
  if (c.includes("ASIA")) return "Asia";
  if (c.includes("GLOBAL") || c.includes("WORLD") || c.includes("INTERNATIONAL")) return "Global";

  let us = 0;
  let europe = 0;
  let asia = 0;
  let emerging = 0;
  let japan = 0;

  if (msRegions && typeof msRegions === "object") {
    const detail = msRegions.detail || null;
    const macro = msRegions.macro || null;

    if (detail && typeof detail === "object") {
      us = (parseNum(detail.united_states) || 0) + (parseNum(detail.canada) || 0);

      europe =
        (parseNum(detail.eurozone) || 0) +
        (parseNum(detail.united_kingdom) || 0) +
        (parseNum(detail.europe_ex_euro) || 0) +
        (parseNum(detail.europe) || 0);

      emerging =
        (parseNum(detail.latin_america) || 0) +
        (parseNum(detail.asia_emerging) || 0) +
        (parseNum(detail.europe_emerging) || 0) +
        (parseNum(detail.africa) || 0) +
        (parseNum(detail.middle_east) || 0) +
        (parseNum(detail.emerging) || 0);

      japan = parseNum(detail.japan) || 0;

      asia =
        (parseNum(detail.developed_asia) || 0) +
        (parseNum(detail.australasia) || 0) +
        (parseNum(detail.china) || 0);
    }

    if (macro && typeof macro === "object") {
      if (us === 0) us = parseNum(macro.americas) || 0;
      if (asia === 0) asia = parseNum(macro.asia) || 0;
      if (europe === 0) europe = parseNum(macro.europe_me_africa) || 0;
    }
  }

  const buckets = [
    { name: "USA", value: us },
    { name: "Europa", value: europe },
    { name: "Asia", value: asia },
    { name: "Emergentes", value: emerging },
    { name: "Japón", value: japan },
  ].sort((a, b) => b.value - a.value);

  const first = buckets[0];
  const second = buckets[1];

  if (!first || first.value <= 0) return "Global";
  if (first.value >= 30 && second && second.value >= 25) return "Global";
  if (first.value >= 35) return first.name;

  return "Global";
}

function deriveSubcategories(msSectors, name, category) {
  const tags = new Set();

  if (msSectors && typeof msSectors === "object") {
    for (const [key, rawV] of Object.entries(msSectors)) {
      const w = parseNum(rawV);
      if (w === null) continue;

      if (w >= 25) tags.add(`sector:${key}`);
      if (w >= 40) tags.add(`sector_concentrated:${key}`);
    }
  }

  const text = normalizeTextForTokens(`${name || ""} ${category || ""}`);
  for (const t of tokenToTag) {
    if (t.token && text.includes(t.token)) tags.add(t.tag);
  }

  return Array.from(tags).sort();
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

function deriveAssetSubtype(catUpper, subcats = [], nameUpper = "") {
  const c = `${catUpper || ""} ${nameUpper || ""}`;
  const tags = Array.isArray(subcats) ? subcats : [];

  // -------------------------
  // MONETARIO
  // -------------------------
  if (
    catUpper.includes("MONETARIO") ||
    catUpper.includes("MONEY MARKET") ||
    catUpper.includes("MERCADO MONETARIO") ||
    catUpper.includes("TRESORERIE")
  ) {
    return "MONEY_MARKET";
  }

  // -------------------------
  // ALTERNATIVOS / MULTISTRATEGY
  // -------------------------
  if (catUpper.includes("MULTISTRATEGY")) {
    if (
      nameUpper.includes("ALPHA") ||
      nameUpper.includes("SYSTEMATIC") ||
      nameUpper.includes("ABSOLUTE RETURN") ||
      nameUpper.includes("ALTERNATIVE BETA") ||
      nameUpper.includes("STYLE FACTOR") ||
      nameUpper.includes("TRACKER")
    ) {
      return "SYSTEMATIC_ALTERNATIVE";
    }
    return "ALTERNATIVE_MULTI_STRATEGY";
  }

  // -------------------------
  // COMMODITIES / PRECIOUS METALS
  // -------------------------
  if (
    catUpper.includes("METALES PRECIOSOS") ||
    catUpper.includes("PRECIOUS METALS") ||
    nameUpper.includes("PRECIOUS METALS") ||
    nameUpper.includes("GOLD")
  ) {
    return "PRECIOUS_METALS";
  }

  // -------------------------
  // VERY SHORT / SHORT DURATION BONDS
  // -------------------------
  if (
    c.includes("CORTO PLAZO") ||
    c.includes("SHORT TERM") ||
    c.includes("SHORT DURATION") ||
    c.includes("ULTRA SHORT") ||
    c.includes("0-2") ||
    c.includes("1-3") ||
    c.includes("LOW DURATION") ||
    c.includes("DURACION CORTA") ||
    c.includes("DURACION 0-2") ||
    c.includes("DURATION 0-2")
  ) {
    return "GOVERNMENT_BOND";
  }

  // -------------------------
  // BOND TYPES
  // -------------------------
  if (c.includes("CONVERTIBLE")) return "CONVERTIBLE_BOND";

  if (c.includes("HIGH YIELD") || c.includes("ALTO RENDIMIENTO"))
    return "HIGH_YIELD_BOND";

  if (c.includes("INFLATION") || c.includes("LINKED"))
    return "INFLATION_LINKED_BOND";

  if (
    c.includes("EMERGING") &&
    (c.includes("BOND") || c.includes("DEBT") || c.includes("FIXED INCOME"))
  ) {
    return "EMERGING_MARKETS_BOND";
  }

  if (
    c.includes("GOVERNMENT") ||
    c.includes("TREASURY") ||
    c.includes("SOVEREIGN") ||
    c.includes("PUBLICA") ||
    c.includes("PÚBLICA")
  ) {
    return "GOVERNMENT_BOND";
  }

  if (
    c.includes("BOND") ||
    c.includes("CREDIT") ||
    c.includes("FIXED INCOME") ||
    c.includes("RENTA FIJA") ||
    c.includes("OBLIGACIONES") ||
    c.includes("OBLIGACION")
  ) {
    return "CORPORATE_BOND";
  }

  // -------------------------
  // SECTOR EQUITY
  // -------------------------
  if (tags.some((x) => x.includes("healthcare")))
    return "SECTOR_EQUITY_HEALTHCARE";

  if (tags.some((x) => x.includes("technology")))
    return "SECTOR_EQUITY_TECH";

  // -------------------------
  // THEMATIC
  // -------------------------
  if (
    tags.some((x) => x.includes("infrastructure")) ||
    c.includes("INFRASTRUCTURE") ||
    c.includes("CLIMATE") ||
    c.includes("WATER") ||
    c.includes("ROBOTICS") ||
    c.includes("AI") ||
    c.includes("ARTIFICIAL INTELLIGENCE") ||
    c.includes("ENERGY TRANSITION") ||
    c.includes("BIG DATA")
  ) {
    return "THEMATIC_EQUITY";
  }

  // -------------------------
  // MSCI / INDEX FUNDS
  // -------------------------
  if (c.includes("MSCI")) {
    if (c.includes("WORLD")) return "GLOBAL_EQUITY";
    if (c.includes("EMERGING")) return "EMERGING_MARKETS_EQUITY";
    if (c.includes("EUROPE")) return "EUROPE_EQUITY";
    if (c.includes("USA") || c.includes("US")) return "US_EQUITY";
  }

  // -------------------------
  // ETF PROVIDERS
  // -------------------------
  if (
    c.includes("ISHARES") ||
    c.includes("VANGUARD") ||
    c.includes("AMUNDI") ||
    c.includes("XTRACKERS") ||
    c.includes("SPDR") ||
    c.includes("LYXOR") ||
    c.includes("INVESCO")
  ) {
    if (c.includes("EMERGING")) return "EMERGING_MARKETS_EQUITY";
    if (c.includes("EUROPE")) return "EUROPE_EQUITY";
    if (c.includes("USA") || c.includes("US")) return "US_EQUITY";
    return "GLOBAL_EQUITY";
  }

  // -------------------------
  // GLOBAL / WORLD
  // -------------------------
  if (
    c.includes("WORLD") ||
    c.includes("GLOBAL") ||
    c.includes("ACWI") ||
    c.includes("ALL WORLD") ||
    c.includes("INTERNATIONAL")
  ) {
    return "GLOBAL_EQUITY";
  }

  // -------------------------
  // REGIONAL EQUITY
  // -------------------------
  if (c.includes("USA") || c.includes("UNITED STATES")) return "US_EQUITY";
  if (c.includes("EUROPE") || c.includes("EUROPA")) return "EUROPE_EQUITY";
  if (c.includes("EUROZONE") || c.includes("EUROLAND")) return "EUROZONE_EQUITY";
  if (c.includes("JAPAN") || c.includes("JAPON") || c.includes("JAPÓN")) return "JAPAN_EQUITY";
  if (c.includes("ASIA PACIFIC") || c.includes("ASIA EX")) return "ASIA_PACIFIC_EQUITY";
  if (c.includes("EMERGING") || c.includes("EMERGENTE")) return "EMERGING_MARKETS_EQUITY";

  // -------------------------
  // STYLE
  // -------------------------
  if (
    c.includes("SMALL CAP") ||
    c.includes("MID CAP") ||
    c.includes("SMID") ||
    c.includes("SMALLER COMPANIES")
  ) {
    return "GLOBAL_SMALL_CAP_EQUITY";
  }

  if (c.includes("DIVIDEND") || c.includes("INCOME"))
    return "GLOBAL_INCOME_EQUITY";

  // -------------------------
  // GENERIC EQUITY
  // -------------------------
  if (
    c.includes("EQUITY") ||
    c.includes("RENTA VARIABLE") ||
    c.includes("ACCIONES") ||
    c.includes("BOLSA") ||
    c.startsWith("RV")
  ) {
    return "GLOBAL_EQUITY";
  }

  // -------------------------
  // MIXED
  // -------------------------
  if (
    c.includes("ALLOCATION") ||
    c.includes("MIXTO") ||
    c.includes("BALANCED") ||
    c.includes("MULTI ASSET") ||
    c.includes("MULTIASSET")
  ) {
    return "FLEXIBLE_ALLOCATION";
  }

  // -------------------------
  // SAFE FALLBACKS
  // -------------------------
  if (
    c.includes("RF") ||
    c.includes("RENTA FIJA") ||
    c.includes("BOND") ||
    c.includes("OBLIGACIONES") ||
    c.includes("FIXED INCOME")
  ) {
    return "CORPORATE_BOND";
  }

  if (
    c.includes("EQUITY") ||
    c.includes("ACCIONES") ||
    c.includes("BOLSA")
  ) {
    return "GLOBAL_EQUITY";
  }

  return "UNKNOWN";
}

function deriveFlags(catUpper, subcats = [], nameUpper = "") {
  const c = `${catUpper || ""} ${nameUpper || ""}`;
  const tags = Array.isArray(subcats) ? subcats : [];

  const isIndexLike =
    c.includes("INDEX") ||
    c.includes("MSCI") ||
    c.includes("ISHARES") ||
    c.includes("ETF") ||
    c.includes("VANGUARD INDEX");

  const isSectorFund =
    c.includes("SECTOR") ||
    tags.some((x) => x.startsWith("sector:")) ||
    tags.some((x) => x.startsWith("sector_concentrated:")) ||
    c.includes("INFRASTRUCTURE");

  const isThematic =
    c.includes("THEMATIC") ||
    tags.some((x) => x.startsWith("theme:")) ||
    c.includes("CLIMATE") ||
    c.includes("WATER") ||
    c.includes("ENERGY") ||
    c.includes("INFRASTRUCTURE") ||
    c.includes("BIG DATA") ||
    c.includes("ROBOTICS");

  return {
    is_index_like: Boolean(isIndexLike),
    is_sector_fund: Boolean(isSectorFund),
    is_thematic: Boolean(isThematic),
  };
}

// -----------------------------
// Core recalculation
// -----------------------------
function buildDerivedFromDoc(docData) {
  const ms = docData.ms || {};
  const name = cleanString(docData.name || ms.name || "");
  const nameUpper = normalizeTextForTokens(name || "");
  const catUpper = normalizeTextForTokens(ms.category_morningstar || "");

  const subcats = deriveSubcategories(ms.sectors || null, name, ms.category_morningstar || "");
  const ts = topSector(ms.sectors || null);

  let derived_asset_class = deriveAssetClassFromCategory(catUpper, nameUpper, ms.sectors || null);
const derived_primary_region = derivePrimaryRegion(ms.regions || null, catUpper, nameUpper);
let assetSubtype = deriveAssetSubtype(catUpper, subcats, nameUpper);
const flags = deriveFlags(catUpper, subcats, nameUpper);

if (
  derived_asset_class === "Commodities" &&
  !catUpper.includes("COMMODIT") &&
  !catUpper.includes("PRECIOUS METALS") &&
  !catUpper.includes("WORLD GOLD") &&
  !catUpper.includes("GLOBAL GOLD") &&
  !catUpper.includes("METALS & MINING") &&
  !catUpper.includes("METALS AND MINING")
) {
  if (
    subcats.some((x) => x.startsWith("sector:")) ||
    subcats.some((x) => x.startsWith("theme:")) ||
    flags.is_sector_fund ||
    flags.is_thematic
  ) {
    derived_asset_class = "RV";
  }
}

// -----------------------------
// Consistencia clase / subtipo
// -----------------------------
if (derived_asset_class === "Mixto") {
  assetSubtype = "FLEXIBLE_ALLOCATION";
}

if (derived_asset_class === "Monetario") {
  assetSubtype = "MONEY_MARKET";
}

if (derived_asset_class === "Alternativos") {
  if (assetSubtype === "UNKNOWN" || assetSubtype.includes("EQUITY")) {
    assetSubtype = "ALTERNATIVE_MULTI_STRATEGY";
  }
}

if (derived_asset_class === "Commodities") {
  if (assetSubtype === "UNKNOWN") {
    assetSubtype = "PRECIOUS_METALS";
  }
}

if (assetSubtype === "UNKNOWN" && derived_asset_class === "RV") {
  assetSubtype = "GLOBAL_EQUITY";
}

  let confidence = 0.65;
  if (ms.category_morningstar) confidence += 0.15;
  if (ms.portfolio?.asset_allocation?.equity !== null && ms.portfolio?.asset_allocation?.equity !== undefined) confidence += 0.05;
  if (ms.regions?.detail || ms.regions?.macro) confidence += 0.05;
  if (ms.sectors) confidence += 0.04;
  if (ms.equity_style?.style_box_cell) confidence += 0.03;
  if (assetSubtype !== "UNKNOWN") confidence += 0.05;
  if (derived_primary_region && derived_primary_region !== "Global") confidence += 0.03;
  confidence = Math.min(0.99, confidence);

  const derived = {
    asset_class: derived_asset_class,
    asset_subtype: assetSubtype,
    primary_region: derived_primary_region,
    subcategories: subcats,
    top_sector: ts.top_sector,
    top_sector_weight: ts.top_sector_weight,
    is_sector_fund: flags.is_sector_fund,
    is_thematic: flags.is_thematic,
    is_index_like: flags.is_index_like,
    confidence,
    ruleset_version: "class_v1.5_recalc",
    reasons: [
      ms.category_morningstar ? "ms.category_morningstar" : null,
      ms.sectors ? "ms.sectors" : null,
      ms.regions?.detail || ms.regions?.macro ? "ms.regions" : null,
      "recalc_without_pdf",
    ].filter(Boolean),
  };

  const equityTotal = clampPct(ms.portfolio?.asset_allocation?.equity);

  const equity_sectors_total =
    equityTotal !== null ? scalePctMap(ms.sectors || null, equityTotal) : null;

  const regionsDetail = ms.regions?.detail || null;
  const regionsMacro = ms.regions?.macro || null;
  const equity_regions_total =
    equityTotal !== null
      ? scalePctMap(regionsDetail, equityTotal) ||
        scalePctMap(regionsMacro, equityTotal)
      : null;

  const styleBoxCell = ms.equity_style?.style_box_cell || null;
  const marketCapObj = ms.equity_style?.market_cap || null;
  const styleDistObj = ms.equity_style?.style || null;

  let size_weights_total = null;
  if (equityTotal !== null && marketCapObj && hasAnyFiniteNumber(marketCapObj)) {
    size_weights_total = sizeWeightsTotalFromMarketCap(marketCapObj, equityTotal);
  } else if (equityTotal !== null && styleBoxCell) {
    const parsed = parseStyleBoxCell(styleBoxCell);
    if (parsed.size) size_weights_total = { [parsed.size]: +equityTotal.toFixed(4) };
  }

  let style_weights_total = null;
  if (
    equityTotal !== null &&
    styleDistObj &&
    typeof styleDistObj === "object" &&
    hasAnyFiniteNumber(styleDistObj)
  ) {
    const v = clampPct(styleDistObj.value);
    const b = clampPct(styleDistObj.blend);
    const g = clampPct(styleDistObj.growth);
    const vals = [v, b, g].filter((x) => x !== null);
    const sum = vals.reduce((a, b) => a + b, 0);
    if (sum > 0.0001) {
      style_weights_total = scalePctMap(
        {
          value: ((v ?? 0) * 100.0) / sum,
          blend: ((b ?? 0) * 100.0) / sum,
          growth: ((g ?? 0) * 100.0) / sum,
        },
        equityTotal
      );
    }
  } else if (equityTotal !== null && styleBoxCell) {
    const parsed = parseStyleBoxCell(styleBoxCell);
    if (parsed.style) style_weights_total = { [parsed.style]: +equityTotal.toFixed(4) };
  }

  const size_bucket = size_weights_total
    ? argmaxKey(size_weights_total)
    : styleBoxCell
      ? parseStyleBoxCell(styleBoxCell).size
      : null;

  const style_bucket = style_weights_total
    ? argmaxKey(style_weights_total)
    : styleBoxCell
      ? parseStyleBoxCell(styleBoxCell).style
      : null;

  const hasAnyExposure = Boolean(
    equity_sectors_total ||
    equity_regions_total ||
    size_weights_total ||
    style_weights_total ||
    styleBoxCell
  );

  if (hasAnyExposure) {
    derived.portfolio_exposure = {
      asset_allocation_total: ms.portfolio?.asset_allocation || null,
      equity_sectors_total,
      equity_regions_total,
    };

    derived.style_bias = {
      equity: {
        style_box_cell: styleBoxCell,
        weight_total: equityTotal,
        size_bucket: size_bucket || null,
        style: style_bucket || null,
        size_weights_total: size_weights_total || null,
        style_weights_total: style_weights_total || null,
      },
    };
  }

  return deleteUndefinedDeep(derived) || {};
}

// -----------------------------
// Main
// -----------------------------
(async () => {
  console.log(`🚀 Recalculando derived.* en funds_v3${DRY_RUN ? " [DRY-RUN]" : ""}...`);

  let query = db.collection("funds_v3").orderBy(admin.firestore.FieldPath.documentId());

  if (START_AFTER) {
    query = query.startAfter(START_AFTER);
  }

  if (LIMIT && Number.isFinite(LIMIT)) {
    query = query.limit(LIMIT);
  }

  const snap = await query.get();

  if (snap.empty) {
    console.log("ℹ️ No hay documentos que procesar.");
    process.exit(0);
  }

  const writer = db.bulkWriter();
  writer.onWriteError((err) => {
    if (err.failedAttempts < 3) return true;
    console.error("❌ BulkWriter error:", err);
    return false;
  });

  let ok = 0;
  let skipped = 0;
  let unknownCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const isin = docSnap.id;

    if (!data.ms || typeof data.ms !== "object") {
      console.log(`⏭️  ${isin} sin ms.* -> skip`);
      skipped++;
      continue;
    }

    const derived = buildDerivedFromDoc(data);

    if ((derived.asset_subtype || "UNKNOWN") === "UNKNOWN") {
      unknownCount++;
    }

    if (DRY_RUN) {
      console.log(`🧪 ${isin} -> ${derived.asset_class || "?"} / ${derived.asset_subtype || "?"} / ${derived.primary_region || "?"}`);
      ok++;
      continue;
    }

    writer.set(
      docSnap.ref,
      {
        derived,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`✅ ${isin} -> ${derived.asset_class || "?"} / ${derived.asset_subtype || "?"} / ${derived.primary_region || "?"}`);
    ok++;
  }

  if (!DRY_RUN) {
    await writer.close();
  }

  console.log("");
  console.log(`✅ FIN | updated=${ok} | skipped=${skipped} | subtype_UNKNOWN=${unknownCount}`);
  process.exit(0);
})().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});