/**
 * Reparse Morningstar PDFs -> Firestore funds_v3 (Gemini 2.5)
 * - Escribe SOLO fuente (ms.*) + quality.* + identity
 * - Calcula derived.* (asset_class, asset_subtype, primary_region, subcategories por sectores+tokens)
 * - NO pisa manual.* (TER/retro etc.)
 *
 * Args:
 *   --dir <carpeta PDFs>        (default ./ENTRADA)
 *   --limit <n>                 (default sin límite)
 *   --batch <id>                (opcional)
 *   --concurrency <n>           (default 4)
 *   --model <gemini-model>      (default gemini-2.5-flash)
 *
 * Reqs:
 *   npm i firebase-admin pdf-parse @google/generative-ai p-limit csv-parse dotenv
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pdfParse = require("pdf-parse");
const admin = require("firebase-admin");
const pLimit = require("p-limit");
const { parse: csvParse } = require("csv-parse/sync");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// -----------------------------
// Args
// -----------------------------
function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

const INPUT_DIR = path.resolve(getArgValue("--dir") || path.join(__dirname, "ENTRADA"));
const LIMIT = getArgValue("--limit") ? parseInt(getArgValue("--limit"), 10) : null;
const BATCH_ID = getArgValue("--batch") || null;
const RATE_LIMIT_DELAY_MS = 100;
const CONCURRENCY = parseInt(getArgValue("--concurrency") || "10", 10);
const MODEL_NAME = getArgValue("--model") || "gemini-2.5-flash";

const PROCESSED_DIR = path.resolve(getArgValue("--processed") || path.join(__dirname, "PROCESADOS"));
const ERROR_DIR = path.resolve(getArgValue("--error") || path.join(__dirname, "ERRORES"));

[INPUT_DIR, PROCESSED_DIR, ERROR_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// -----------------------------
// Gemini
// -----------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Falta GEMINI_API_KEY en variables de entorno.");
  console.error('   Ej: set GEMINI_API_KEY="TU_KEY"');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// -----------------------------
// Firebase Admin init (LOCAL)
// -----------------------------
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");

if (!admin.apps.length) {
  if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
    process.exit(1);
  }

  const serviceAccount = require(SERVICE_ACCOUNT_FILE);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  console.log(`🔑 Firebase Admin OK: ${serviceAccount.project_id}`);
}

const db = admin.firestore();

// -----------------------------
// CSV mappings
// -----------------------------
function loadCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return csvParse(raw, { columns: true, skip_empty_lines: true });
}

const SECTOR_MAP_PATH = path.join(__dirname, "subcategory_sectors_mapping.csv");
const TOKEN_MAP_PATH = path.join(__dirname, "subcategory_tokens_mapping.csv");

if (!fs.existsSync(SECTOR_MAP_PATH) || !fs.existsSync(TOKEN_MAP_PATH)) {
  console.error("❌ Faltan CSV de subcategorías en la carpeta del script:");
  console.error("   - subcategory_sectors_mapping.csv");
  console.error("   - subcategory_tokens_mapping.csv");
  process.exit(1);
}

const sectorMapRows = loadCsv(SECTOR_MAP_PATH);
const tokenMapRows = loadCsv(TOKEN_MAP_PATH);

const sectorKeyToTag = new Map(sectorMapRows.map((r) => [r.ms_sector_key, r.subcategory_tag]));
const tokenToTag = tokenMapRows.map((r) => ({
  token: (r.token_uppercase || "").trim(),
  tag: (r.subcategory_tag || "").trim(),
}));

// -----------------------------
// Helpers
// -----------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function uniqueDestPath(destDir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = path.join(destDir, filename);

  if (!fs.existsSync(candidate)) return candidate;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let i = 1;
  while (true) {
    const alt = path.join(destDir, `${base}__${stamp}__${i}${ext}`);
    if (!fs.existsSync(alt)) return alt;
    i++;
  }
}

function moveFileSafe(srcPath, destDir, filename) {
  ensureDir(destDir);
  const destPath = uniqueDestPath(destDir, filename);
  try {
    fs.renameSync(srcPath, destPath);
    return destPath;
  } catch (e) {
    try {
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
      return destPath;
    } catch (e2) {
      console.error(`⚠️ Error moviendo fichero: ${e2.message}`);
      return null;
    }
  }
}

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

function clamp01(n) {
  const v = parseNum(n);
  if (v === null) return null;
  if (v < 0) return 0;
  if (v > 1) return 1;
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

function buscarISINRegex(txt) {
  // formato normal
  let m = txt.match(/[A-Z]{2}[A-Z0-9]{9}[0-9]/);
  if (m) return m[0].toUpperCase();

  // formato con espacios o guiones
  m = txt.match(/[A-Z]{2}[\s\-]?[A-Z0-9]{4}[\s\-]?[A-Z0-9]{4}[\s\-]?[0-9]/);
  if (m) return m[0].replace(/[\s\-]/g, "").toUpperCase();

  return null;
}

  return m ? m[0].replace(/[\s\-]/g, "").toUpperCase() : null;
}

function reportDateFromFilename(filename) {
  const m = filename.match(/morningstarreport(\d{8})/i);
  if (!m) return null;
  const y = m[1].slice(0, 4);
  const mo = m[1].slice(4, 6);
  const d = m[1].slice(6, 8);
  return `${y}-${mo}-${d}`;
}

function parseSpanishDateToISO(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    const y = direct.getUTCFullYear();
    const m = String(direct.getUTCMonth() + 1).padStart(2, "0");
    const d = String(direct.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(value).toLowerCase().trim();

  const monthsShort = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
  };

  let m1 = s.match(/^(\d{1,2})\s+([a-z]{3})\.?\s+(\d{4})$/i);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const mon = monthsShort[m1[2].slice(0, 3)];
    const year = parseInt(m1[3], 10);
    if (mon) return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const monthsLong = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
    noviembre: 11, diciembre: 12,
  };

  m1 = s.match(/^(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})$/i);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const mon = monthsLong[m1[2]];
    const year = parseInt(m1[3], 10);
    if (mon) return `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function deleteUndefinedDeep(obj) {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (Array.isArray(obj)) {
    const arr = obj
      .map(deleteUndefinedDeep)
      .filter((v) => v !== undefined);
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
// Regional normalization
// -----------------------------
const REGION_MAPPINGS = {
  united_states: ["usa", "u.s.", "u.s.a", "eeuu", "estados_unidos", "united_states"],
  canada: ["canada", "canadá"],
  latin_america: ["latin_america", "latinoamerica", "latinoamérica", "america_latina", "américa_latina", "iberoamerica", "iberoamérica"],
  eurozone: ["eurozone", "euro_zone", "zona_euro", "zona_del_euro", "emu"],
  europe_ex_euro: ["europe_ex_euro", "europe_ex-euro", "europa_ex_euro", "europe_excluding_eurozone", "europa_sin_euro", "europa/o_medio/africa", "europa/o.medio/africa", "europe"],
  united_kingdom: ["uk", "u.k.", "united_kingdom", "reino_unido", "great_britain", "gran_bretaña", "gran_bretana"],
  europe_emerging: ["emerging_europe", "europa_emergente"],
  japan: ["japan", "japón", "japon"],
  developed_asia: ["developed_asia", "asia_desarrollada", "asia_developed"],
  china: ["china"],
  asia_emerging: ["asia_emerging", "emerging_asia", "asia_emergente"],
  middle_east: ["middle_east", "oriente_medio", "oriente_medio_africa", "oriente_medio_/_africa"],
  africa: ["africa", "áfrica"],
  australasia: ["australasia", "australia", "new_zealand", "nueva_zelanda"],
  americas: ["americas", "américas"],
  europe_me_africa: ["europe_me_africa", "europa_o_medio_africa", "europao._medioafrica", "europao_medioafrica"],
  asia: ["asia"],
};

const IGNORE_KEYS = [
  "total",
  "equity_region_total",
  "fixed_income_region_total",
  "world_regions_total",
  "bond_region_total",
  "cash_region_total",
  "not_classified",
];

const REGION_LOOKUP = {};
for (const [canonical, aliases] of Object.entries(REGION_MAPPINGS)) {
  aliases.forEach((alias) => {
    REGION_LOOKUP[alias] = canonical;
  });
}

function cleanRegionKey(k) {
  if (!k) return "";
  return String(k)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]/g, "_")
    .replace(/[^a-z0-9_.]/g, "");
}

function normalizeRegions(rawObj, warnings = []) {

  if (Array.isArray(rawObj)) return null;
  if (!rawObj || typeof rawObj !== "object") return null;

  const canonicalObj = {};
  const rawKeys = Object.keys(rawObj);

  const hasSpecificEurope = rawKeys.some((k) => {
    const cleanK = cleanRegionKey(k);
    const can = REGION_LOOKUP[cleanK];
    return can === "eurozone" || can === "europe_ex_euro";
  });

  for (const [rawK, rawV] of Object.entries(rawObj)) {
    const val = clampPct(rawV);
    if (val === null || val === 0) continue;

    const cleanK = cleanRegionKey(rawK);

    if (IGNORE_KEYS.includes(cleanK) || cleanK.includes("_total")) continue;
    if (hasSpecificEurope && (cleanK === "europe" || cleanK === "europa")) continue;

    let canonical = REGION_LOOKUP[cleanK];

    if (!canonical && (cleanK === "europe" || cleanK === "europa")) {
      canonical = "europe_ex_euro";
    }

    if (canonical) {
      canonicalObj[canonical] = (canonicalObj[canonical] || 0) + val;
    } else {
      if (cleanK === "other" || cleanK === "others" || cleanK === "otros") {
        continue;
      } else {
        canonicalObj.other = (canonicalObj.other || 0) + val;
        if (warnings && !warnings.includes(`unknown_region_key:${rawK}`)) {
          warnings.push(`unknown_region_key:${rawK}`);
        }
      }
    }
  }

  let currentSum = 0;
  for (const k in canonicalObj) currentSum += canonicalObj[k];

  if (currentSum > 0.0) {
    const remainder = 100.0 - currentSum;
    if (remainder > 0.25) {
      canonicalObj.other = (canonicalObj.other || 0) + remainder;
      canonicalObj.other = +canonicalObj.other.toFixed(4);
    }

    if (currentSum > 101.0 && warnings) {
      warnings.push(`regions_sum_overflow:${currentSum.toFixed(2)}`);
    }
  } else {
    if (warnings && Object.keys(rawObj).length > 0) {
      warnings.push("regions_all_unrecognized");
    }
  }

  for (const k in canonicalObj) {
    if (canonicalObj[k] > 100) canonicalObj[k] = 100;
  }

  return Object.keys(canonicalObj).length > 0 ? canonicalObj : null;
}

function normalizeSectors(rawObj, warnings = []) {
  if (!rawObj || typeof rawObj !== "object") return null;

  const cleanObj = {};
  for (const [rawK, rawV] of Object.entries(rawObj)) {
    const val = clampPct(rawV);
    if (val !== null && val > 0) {
      const cleanK = cleanRegionKey(rawK);
      cleanObj[cleanK] = val;
    } else if (rawV !== null && rawV !== 0 && rawV !== "") {
      if (warnings && !warnings.includes(`invalid_sector_value:${rawK}`)) {
        warnings.push(`invalid_sector_value:${rawK}`);
      }
    }
  }

  return Object.keys(cleanObj).length > 0 ? cleanObj : null;
}

// -----------------------------
// Derived classification helpers
// -----------------------------
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
      us =
        (parseNum(detail.united_states) || 0) +
        (parseNum(detail.canada) || 0);

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

  if (first.value >= 30 && second && second.value >= 25) {
    return "Global";
  }

  if (first.value >= 35) return first.name;

  return "Global";
}

function deriveSubcategories(msSectors, name, category) {
  const tags = new Set();

  if (msSectors && typeof msSectors === "object") {
    for (const [key, rawV] of Object.entries(msSectors)) {
      const w = parseNum(rawV);
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

  const text = normalizeTextForTokens(`${name || ""} ${category || ""}`);
  for (const t of tokenToTag) {
    if (!t.token) continue;
    if (text.includes(t.token)) tags.add(t.tag);
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

  if (c.includes("CONVERTIBLE")) return "CONVERTIBLE_BOND";
  if (c.includes("HIGH YIELD") || c.includes("ALTO RENDIMIENTO")) return "HIGH_YIELD_BOND";
  if (c.includes("INFLATION") || c.includes("LINKED")) return "INFLATION_LINKED_BOND";
  if (
    c.includes("EMERGING") &&
    (c.includes("BOND") || c.includes("DEBT") || c.includes("FIXED INCOME") || c.includes("RF"))
  ) {
    return "EMERGING_MARKETS_BOND";
  }
  if (
    c.includes("GOVERNMENT") ||
    c.includes("TREASURY") ||
    c.includes("SOVEREIGN") ||
    c.includes("PUBLICA")
  ) {
    return "GOVERNMENT_BOND";
  }
  if (
    c.includes("BOND") ||
    c.includes("CREDIT") ||
    c.includes("FIXED INCOME") ||
    c.includes("RENTA FIJA")
  ) {
    return "CORPORATE_BOND";
  }

  if (tags.some((x) => x.includes("healthcare"))) return "SECTOR_EQUITY_HEALTHCARE";
  if (tags.some((x) => x.includes("technology"))) return "SECTOR_EQUITY_TECH";

  if (
    tags.some((x) => x.includes("infrastructure")) ||
    c.includes("INFRASTRUCTURE") ||
    c.includes("INFRAESTRUCTURA")
  ) {
    return "THEMATIC_EQUITY";
  }

  if (
    c.includes("WATER") ||
    c.includes("CLIMATE") ||
    c.includes("ENERGY TRANSITION") ||
    c.includes("SMART ENERGY") ||
    c.includes("CLEAN ENERGY") ||
    c.includes("ECOLOGY") ||
    c.includes("BIG DATA") ||
    c.includes("ROBOTICS") ||
    c.includes("AI") ||
    c.includes("ARTIFICIAL INTELLIGENCE")
  ) {
    return "THEMATIC_EQUITY";
  }

  if (c.includes("US ") || c.includes("USA") || c.includes("UNITED STATES")) return "US_EQUITY";
  if (c.includes("EUROZONE") || c.includes("EUROLAND")) return "EUROZONE_EQUITY";
  if (c.includes("EUROPE") || c.includes("EUROPA")) return "EUROPE_EQUITY";
  if (c.includes("JAPAN")) return "JAPAN_EQUITY";
  if (c.includes("ASIA PACIFIC") || c.includes("ASIA EX")) return "ASIA_PACIFIC_EQUITY";
  if (c.includes("EMERGING")) return "EMERGING_MARKETS_EQUITY";
  if (c.includes("SMALL CAP") || c.includes("MID CAP") || c.includes("SMID") || c.includes("SMALLER COMPANIES")) {
    return "GLOBAL_SMALL_CAP_EQUITY";
  }
  if (c.includes("DIVIDEND") || c.includes("INCOME")) return "GLOBAL_INCOME_EQUITY";
  if (c.includes("EQUITY") || c.includes("RENTA VARIABLE") || c.startsWith("RV")) return "GLOBAL_EQUITY";

  if (
    c.includes("ALLOCATION") ||
    c.includes("MIXTO") ||
    c.includes("BALANCED") ||
    c.includes("MULTI ASSET")
  ) {
    return "FLEXIBLE_ALLOCATION";
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
    c.includes("INFRASTRUCTURE") ||
    c.includes("INFRAESTRUCTURA");

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
// Gemini extraction
// -----------------------------
async function extraerMSConGemini(textoPDF) {
  const textoSeguro = (textoPDF || "").slice(0, 240000);

  const prompt = `
Devuelve SOLO JSON válido (sin markdown, sin comentarios).
El PDF es un informe Morningstar de 1 página (ES). Extrae SOLO estos campos si existen:

{
  "isin": "LU0000000000",
  "name": "Nombre del fondo",
  "currency": "EUR",

  "report_date": "YYYY-MM-DD o texto si no puedes",
  "category_morningstar": "texto exacto",
  "rating_stars": 0,
  "medalist_rating": "Gold/Silver/Bronze/Neutral/Negative o null",
  "sustainability_rating": 0,

  "portfolio_as_of": "texto fecha cartera",
  "asset_allocation": { "equity": 0, "bond": 0, "cash": 0, "other": 0 },

  "regions_macro": { "americas": 0, "europe_me_africa": 0, "asia": 0 },
  "regions_detail": { },

  "sectors": { "technology": 0, "financial_services": 0, "industrials": 0, "healthcare": 0, "consumer_cyclical": 0, "consumer_defensive": 0, "utilities": 0, "energy": 0, "communication_services": 0, "real_estate": 0, "basic_materials": 0 },

  "equity_market_cap": { "giant": 0, "large": 0, "mid": 0, "small": 0, "micro": 0 },
  "equity_style": { "value": 0, "blend": 0, "growth": 0 },
  "equity_style_box_cell": "Small-Blend o null",

  "fixed_income": {
    "effective_duration": 0,
    "effective_maturity": 0,
    "avg_credit_quality": null,
    "credit_quality": { "aaa":0,"aa":0,"a":0,"bbb":0,"bb":0,"b":0,"below_b":0,"not_rated":0 },
    "maturity_allocation": { "1_3":0,"3_5":0,"5_7":0,"7_10":0,"over_10":0 },
    "coupon_allocation": { "0":0,"0_4":0,"4_6":0,"over_6":0 }
  },

  "holdings_top10": [ { "name":"", "weight":0, "sector": null } ],
  "holdings_stats": { "holdings_count_equity": 0, "holdings_count_bond": 0, "top10_weight": 0 },

  "costs": { "management_fee": null },
  "objective": null
}

- rating_stars es el "Rating Morningstar™" (estrellas 1..5).
- NO extraigas: TER, retrocesiones, comisión de entrada o salida.
- NO extraigas: fecha creación, gestor, fecha incorporación, VL/fecha VL, domicilio, UCITS.
- Si algo no está, pon null o no incluyas el campo.

TEXTO:
"""${textoSeguro}"""
`.trim();

  const MAX_RETRIES = 6;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      if (RATE_LIMIT_DELAY_MS > 0) await sleep(RATE_LIMIT_DELAY_MS);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      text = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^.*?\{/, "{")
      .replace(/\}[^}]*$/, "}")
      .trim();
      return JSON.parse(text);
    } catch (e) {
      if (i === MAX_RETRIES - 1) throw e;
      await sleep(1200 * (i + 1));
    }
  }

  throw new Error("Gemini no devolvió JSON válido.");
}

// -----------------------------
// Process one PDF
// -----------------------------
async function processPdfFile(fileName, writer) {
  const fullPath = path.join(INPUT_DIR, fileName);
  const buffer = fs.readFileSync(fullPath);
  const pdf_md5 = crypto.createHash("md5").update(buffer).digest("hex");

  const pdfData = await pdfParse(buffer);
  const text = pdfData.text || "";

  const msRaw = await extraerMSConGemini(text);

  const isin = (msRaw.isin || buscarISINRegex(text) || "").toUpperCase();
  if (!isin || isin.length < 10) throw new Error("ISIN no detectado.");

  const name = cleanString(msRaw.name) || null;
  const nameUpper = normalizeTextForTokens(name || "");
  const currency = cleanString(msRaw.currency) || null;

  const reportDateIso =
    parseSpanishDateToISO(msRaw.report_date) ||
    reportDateFromFilename(fileName) ||
    null;

  const portfolioAsOfIso = parseSpanishDateToISO(msRaw.portfolio_as_of) || null;

  const sectorWarnings = [];
  const regionWarnings = [];

  const ms = {
    report_date: reportDateIso,
    category_morningstar: cleanString(msRaw.category_morningstar),
    rating_stars: parseNum(msRaw.rating_stars),
    medalist_rating: cleanString(msRaw.medalist_rating),
    sustainability_rating: parseNum(msRaw.sustainability_rating),

    portfolio: {
      as_of: portfolioAsOfIso,
      asset_allocation: {
        equity: clampPct(msRaw.asset_allocation?.equity),
        bond: clampPct(msRaw.asset_allocation?.bond),
        cash: clampPct(msRaw.asset_allocation?.cash),
        other: clampPct(msRaw.asset_allocation?.other),
      },
    },

    sectors: normalizeSectors(msRaw.sectors, sectorWarnings),
    regions: {
      macro: normalizeRegions(msRaw.regions_macro, regionWarnings),
      detail: normalizeRegions(msRaw.regions_detail, regionWarnings),
    },

    equity_style: {
      market_cap:
        msRaw.equity_market_cap && typeof msRaw.equity_market_cap === "object"
          ? msRaw.equity_market_cap
          : null,
      style:
        msRaw.equity_style && typeof msRaw.equity_style === "object"
          ? msRaw.equity_style
          : null,
      style_box_cell: cleanString(msRaw.equity_style_box_cell),
    },

    fixed_income:
      msRaw.fixed_income && typeof msRaw.fixed_income === "object"
        ? msRaw.fixed_income
        : null,

    holdings_top10: Array.isArray(msRaw.holdings_top10)
      ? msRaw.holdings_top10
          .map((h) => ({
            name: cleanString(h.name),
            weight: clampPct(h.weight),
            sector: cleanString(h.sector),
          }))
          .filter((x) => x.name && x.weight !== null)
      : null,

    holdings_stats:
      msRaw.holdings_stats && typeof msRaw.holdings_stats === "object"
        ? {
            holdings_count_equity: parseNum(msRaw.holdings_stats.holdings_count_equity),
            holdings_count_bond: parseNum(msRaw.holdings_stats.holdings_count_bond),
            top10_weight: clampPct(msRaw.holdings_stats.top10_weight),
          }
        : null,

    costs:
      msRaw.costs &&
      typeof msRaw.costs === "object" &&
      parseNum(msRaw.costs.management_fee) !== null
        ? { management_fee: parseNum(msRaw.costs.management_fee) }
        : null,

    objective: cleanString(msRaw.objective),
  };

  const msCleaned = deleteUndefinedDeep(ms) || {};

  const catUpper = normalizeTextForTokens(ms.category_morningstar || "");
  let derived_asset_class = deriveAssetClassFromCategory(catUpper, nameUpper, ms.sectors || null);
  const derived_primary_region = derivePrimaryRegion(ms.regions || null, catUpper, nameUpper);

  const subcats = deriveSubcategories(ms.sectors || null, name, ms.category_morningstar || "");
  const ts = topSector(ms.sectors || null);
  const assetSubtype = deriveAssetSubtype(catUpper, subcats, nameUpper);
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

  let confidence = 0.65;
  if (ms.category_morningstar) confidence += 0.15;
  if (ms.portfolio?.asset_allocation?.equity !== null) confidence += 0.05;
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
    ruleset_version: "class_v1.3",
    reasons: [
      ms.category_morningstar ? "ms.category_morningstar" : null,
      ms.sectors ? "ms.sectors" : null,
      ms.regions?.detail || ms.regions?.macro ? "ms.regions" : null,
      "tokens+sectors_25_40",
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
    if (parsed.size) {
      size_weights_total = { [parsed.size]: +equityTotal.toFixed(4) };
    }
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
    if (parsed.style) {
      style_weights_total = { [parsed.style]: +equityTotal.toFixed(4) };
    }
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

  const quality = {
    parsed_at: admin.firestore.FieldValue.serverTimestamp(),
    parser_version: `ms_pdf_v4_${MODEL_NAME}`,
    source_pdf_hash: pdf_md5,
    warnings: [],
    ok: true,
  };

  [...sectorWarnings, ...regionWarnings].forEach((w) => quality.warnings.push(w));

  const _eqT = clampPct(ms.portfolio?.asset_allocation?.equity);
  if (_eqT === null) {
    if (ms.sectors) quality.warnings.push("equity_total_missing_for_sectors");
    if (ms.regions?.detail || ms.regions?.macro) {
      quality.warnings.push("equity_total_missing_for_regions");
    }
    if (
      ms.equity_style?.market_cap ||
      ms.equity_style?.style_box_cell ||
      ms.equity_style?.style
    ) {
      quality.warnings.push("equity_total_missing_for_style_bias");
    }
  }

  if (ms.fixed_income) {
    const hasCreditQuality =
      ms.fixed_income.credit_quality &&
      typeof ms.fixed_income.credit_quality === "object" &&
      Object.values(ms.fixed_income.credit_quality).some((v) => parseNum(v) !== null && parseNum(v) > 0);

    const hasMaturityAllocation =
      ms.fixed_income.maturity_allocation &&
      typeof ms.fixed_income.maturity_allocation === "object" &&
      Object.values(ms.fixed_income.maturity_allocation).some((v) => parseNum(v) !== null && parseNum(v) > 0);

    const hasEffectiveDuration = Number.isFinite(parseNum(ms.fixed_income.effective_duration));

    if (!hasCreditQuality) {
      quality.warnings.push("fi_missing_credit_data");
    }

    if (!hasMaturityAllocation && !hasEffectiveDuration) {
      quality.warnings.push("fi_missing_duration_data");
    }
  }

  if (!ms.category_morningstar) quality.warnings.push("missing_category_morningstar");
  if (!Number.isFinite(ms.rating_stars)) quality.warnings.push("missing_rating_stars");

  if (!ms.portfolio?.asset_allocation) {
    quality.warnings.push("missing_asset_allocation");
  } else {
    const aa = ms.portfolio.asset_allocation;
    const totalAA =
      (aa.equity || 0) +
      (aa.bond || 0) +
      (aa.cash || 0) +
      (aa.other || 0);

    if (Math.abs(totalAA - 100) > 1.0) {
      quality.warnings.push(`asset_allocation_sum_mismatch:${totalAA.toFixed(2)}`);
    }
  }

  if (!ms.sectors) quality.warnings.push("missing_sectors");
  if (!ms.regions?.detail && !ms.regions?.macro) quality.warnings.push("missing_regions");

  const doc = {
    isin,
    name,
    currency,
    ms: msCleaned,
    derived,
    quality,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),

    asset_class: admin.firestore.FieldValue.delete(),
    std_type: admin.firestore.FieldValue.delete(),
    std_region: admin.firestore.FieldValue.delete(),
    primary_region: admin.firestore.FieldValue.delete(),
    category_morningstar: admin.firestore.FieldValue.delete(),
    sectors: admin.firestore.FieldValue.delete(),
  };

  const ref = db.collection("funds_v3").doc(isin);

  const snap = await ref.get();
  if (!snap.exists) {
    doc.manual = { costs: { retrocession: 0 } };
  } else {
    const existingData = snap.data();
    const existingRetro =
      existingData.manual?.costs?.retrocession ??
      existingData["manual.costs.retrocession"];

    if (existingRetro === undefined || existingRetro === null) {
      doc["manual.costs.retrocession"] = 0;
    }
  }

  writer.set(ref, doc, { merge: true });
  return { isin, fileName };
}

// -----------------------------
// Main
// -----------------------------
(async () => {
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ No existe carpeta: ${INPUT_DIR}`);
    process.exit(1);
  }

  let files = fs.readdirSync(INPUT_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (LIMIT && Number.isFinite(LIMIT)) files = files.slice(0, LIMIT);

  if (!files.length) {
    console.log("ℹ️ No hay PDFs para procesar.");
    process.exit(0);
  }

  console.log(`📦 PDFs: ${files.length} | concurrency=${CONCURRENCY}${BATCH_ID ? ` | batch=${BATCH_ID}` : ""}`);
  console.log(`🤖 Gemini model: ${MODEL_NAME}`);

  const writer = db.bulkWriter();
  writer.onWriteError((err) => {
    if (err.failedAttempts < 3) return true;
    console.error("❌ BulkWriter error:", err);
    return false;
  });

  const limit = pLimit(CONCURRENCY);
  let ok = 0;
  let fail = 0;

  const tasks = files.map((f) =>
    limit(async () => {
      try {
        const r = await processPdfFile(f, writer);
        ok++;
        console.log(`✅ ${r.fileName} -> ${r.isin}`);
        moveFileSafe(path.join(INPUT_DIR, f), PROCESSED_DIR, f);
      } catch (e) {
        fail++;
        console.error(`❌ ${f}: ${e.message}`);
        moveFileSafe(path.join(INPUT_DIR, f), ERROR_DIR, f);
      }
    })
  );

  await Promise.all(tasks);
  await writer.close();

  console.log(`\n✅ FIN | OK=${ok} | ERROR=${fail}`);
  process.exit(fail ? 2 : 0);
})();