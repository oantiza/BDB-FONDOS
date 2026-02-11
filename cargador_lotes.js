/**
 * Reparse Morningstar PDFs -> Firestore funds_v3 (Gemini 2.5)
 * - Escribe SOLO fuente (ms.*) + quality.* + identity
 * - Calcula derived.* (asset_class, primary_region, subcategories por sectores+tokens)
 * - NO pisa manual.* (TER/retro etc.)
 *
 * Args:
 *   --dir <carpeta PDFs>        (default ./ENTRADA)
 *   --limit <n>                (default sin límite)
 *   --batch <id>               (opcional)
 *   --concurrency <n>          (default 4)
 *   --model <gemini-model>     (default gemini-2.5-flash)
 *
 * Reqs:
 *   npm i firebase-admin pdf-parse @google/generative-ai p-limit csv-parse
 */

require('dotenv').config();
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
// Configuration for Performance (Paid Tier - Very Cheap)
const RATE_LIMIT_DELAY_MS = 100; // Minimal delay
const CONCURRENCY = 10; // Parallel processing (Fast!)

const MODEL_NAME = getArgValue("--model") || "gemini-2.5-flash";

const PROCESSED_DIR = path.resolve(getArgValue("--processed") || path.join(__dirname, "PROCESADOS"));
const ERROR_DIR = path.resolve(getArgValue("--error") || path.join(__dirname, "ERRORES"));

// Ensure dirs existence
[INPUT_DIR, PROCESSED_DIR, ERROR_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// -----------------------------
// Gemini (sí, para ti, pero no invento keys)
// -----------------------------
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Falta GEMINI_API_KEY en variables de entorno.");
  console.error('   Ej: set GEMINI_API_KEY="TU_KEY"  (Windows)  |  export GEMINI_API_KEY="TU_KEY" (Mac/Linux)');
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
// CSV mappings (sectors + tokens)
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

const sectorKeyToTag = new Map(sectorMapRows.map(r => [r.ms_sector_key, r.subcategory_tag]));
const tokenToTag = tokenMapRows.map(r => ({
  token: (r.token_uppercase || "").trim(),
  tag: (r.subcategory_tag || "").trim(),
}));

// -----------------------------
// Helpers
// -----------------------------
// -----------------------------
// Helpers
// -----------------------------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

/**
 * Escala un mapa de % (0..100) por un porcentaje total (0..100) para obtener
 * exposición sobre el TOTAL del fondo (look-through).
 * Ej: equity_total=20 y sectors(%RV) => sectors_total(%fondo) = 0.20 * sectors
 */
function scalePctMap(mapObj, totalPct) {
  const t = clampPct(totalPct);
  if (t === null) return null;
  if (!mapObj || typeof mapObj !== "object") return null;

  const factor = t / 100.0;
  const out = {};
  for (const [k, v] of Object.entries(mapObj)) {
    const n = clampPct(v);
    if (n === null) continue;
    const scaled = n * factor;
    if (scaled > 0) out[k] = +scaled.toFixed(4);
  }
  return Object.keys(out).length ? out : null;
}

function hasAnyFiniteNumber(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some(v => Number.isFinite(parseNum(v)));
}

/**
 * Convierte market-cap Morningstar (micro/small/mid/large/giant) en buckets
 * small/mid/large (en % sobre TOTAL fondo).
 */
function sizeWeightsTotalFromMarketCap(marketCapObj, equityTotalPct) {
  if (!marketCapObj || typeof marketCapObj !== "object") return null;
  const eq = clampPct(equityTotalPct);
  if (eq === null) return null;

  const micro = clampPct(marketCapObj.micro);
  const small = clampPct(marketCapObj.small);
  const mid = clampPct(marketCapObj.mid);
  const large = clampPct(marketCapObj.large);
  const giant = clampPct(marketCapObj.giant);

  // Si todo es null/0, no sirve
  const vals = [micro, small, mid, large, giant].filter(v => v !== null);
  if (!vals.length) return null;

  // Normalización suave por si suma != 100 (export/parse imperfecto)
  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum <= 0.0001) return null;

  const microN = (micro ?? 0) * 100.0 / sum;
  const smallN = (small ?? 0) * 100.0 / sum;
  const midN = (mid ?? 0) * 100.0 / sum;
  const largeN = (large ?? 0) * 100.0 / sum;
  const giantN = (giant ?? 0) * 100.0 / sum;

  const bucketMap = {
    small: microN + smallN,
    mid: midN,
    large: largeN + giantN,
  };
  return scalePctMap(bucketMap, eq);
}

/**
 * Fallback cuando NO hay market-cap: derivar size/style desde la celda del style box
 * Ej: "Large-Blend" -> { size: "large", style: "blend" }
 */
function parseStyleBoxCell(cell) {
  const s = cleanString(cell);
  if (!s) return { size: null, style: null };
  const parts = s.split("-").map(p => p.trim().toLowerCase());
  if (parts.length < 2) return { size: null, style: null };

  const sizeRaw = parts[0];
  const styleRaw = parts.slice(1).join("-"); // por si viene raro

  const size = (sizeRaw.includes("large") ? "large"
    : sizeRaw.includes("mid") ? "mid"
      : sizeRaw.includes("small") ? "small"
        : null);

  const style = (styleRaw.includes("value") ? "value"
    : styleRaw.includes("blend") ? "blend"
      : styleRaw.includes("growth") ? "growth"
        : null);

  return { size, style };
}

function argmaxKey(obj) {
  if (!obj || typeof obj !== "object") return null;
  let bestK = null;
  let bestV = -Infinity;
  for (const [k, v] of Object.entries(obj)) {
    const n = parseNum(v);
    if (!Number.isFinite(n)) continue;
    if (n > bestV) { bestV = n; bestK = k; }
  }
  return bestK;
}

function normalizeTextForTokens(s) {
  if (!s) return "";
  // quitar acentos y pasar a upper
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function buscarISINRegex(txt) {
  const m = txt.match(/([A-Z]{2}[\s\-]?[A-Z0-9]{9}[\s\-]?[0-9])/);
  return m ? m[0].replace(/[\s\-]/g, "").toUpperCase() : null;
}

// filename: morningstarreportYYYYMMDD...
function reportDateFromFilename(filename) {
  const m = filename.match(/morningstarreport(\d{8})/i);
  if (!m) return null;
  const y = m[1].slice(0, 4);
  const mo = m[1].slice(4, 6);
  const d = m[1].slice(6, 8);
  return `${y}-${mo}-${d}`;
}

// Parseo flexible de fechas en español/varias -> devuelve YYYY-MM-DD o null
function parseSpanishDateToISO(value) {
  if (!value) return null;

  // ya ISO
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

// -----------------------------
// Regional Normalization (Canonical)
// -----------------------------
const REGION_MAPPINGS = {
  "united_states": ["usa", "u.s.", "u.s.a", "eeuu", "estados_unidos", "united_states"],
  "canada": ["canada", "canadá"],
  "latin_america": ["latin_america", "latinoamerica", "latinoamérica", "america_latina", "américa_latina", "iberoamerica", "iberoamérica"],
  "eurozone": ["eurozone", "euro_zone", "zona_euro", "zona_del_euro", "emu"],
  "europe_ex_euro": ["europe_ex_euro", "europe_ex-euro", "europa_ex_euro", "europe_excluding_eurozone", "europa_sin_euro", "europa/o_medio/africa", "europa/o.medio/africa"],
  "united_kingdom": ["uk", "u.k.", "united_kingdom", "reino_unido", "great_britain", "gran_bretaña", "gran_bretana"],
  "europe_emerging": ["emerging_europe", "europa_emergente"],
  "japan": ["japan", "japón", "japon"],
  "developed_asia": ["developed_asia", "asia_desarrollada", "asia_developed"],
  "china": ["china"],
  "asia_emerging": ["asia_emerging", "emerging_asia", "asia_emergente"],
  "middle_east": ["middle_east", "oriente_medio", "oriente_medio_africa", "oriente_medio_/_africa"],
  "africa": ["africa", "áfrica"],
  "australasia": ["australasia", "australia", "new_zealand", "nueva_zelanda"],
  "americas": ["americas", "américas"],
  "europe_me_africa": ["europe_me_africa", "europa_o_medio_africa", "europao._medioafrica", "europao_medioafrica"],
  "asia": ["asia"]
};

// 🛑 CLAVES A IGNORAR (Totales que inflan "Other")
const IGNORE_KEYS = [
  "total",
  "equity_region_total",
  "fixed_income_region_total",
  "world_regions_total",
  "bond_region_total",
  "cash_region_total",
  "not_classified" // A veces es ruido puro
];

// Mapa inverso para búsqueda rápida
const REGION_LOOKUP = {};
for (const [canonical, aliases] of Object.entries(REGION_MAPPINGS)) {
  aliases.forEach(alias => {
    REGION_LOOKUP[alias] = canonical;
  });
}

function cleanRegionKey(k) {
  if (!k) return "";
  return String(k)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[\s-]/g, "_")          // espacios/guiones a _
    .replace(/[^a-z0-9_.]/g, "");     // solo letras, números, _ y .
}

/**
 * Normaliza un objeto de regiones (macro o detail) al set canónico
 */
function normalizeRegions(rawObj, warnings = []) {
  if (!rawObj || typeof rawObj !== "object") return null;

  const canonicalObj = {};
  const rawKeys = Object.keys(rawObj);

  // Regla especial de Europa: Si hay Eurozone o EuropeExEuro, ignoramos "europe" genérico
  const hasSpecificEurope = rawKeys.some(k => {
    const cleanK = cleanRegionKey(k);
    const can = REGION_LOOKUP[cleanK];
    return can === "eurozone" || can === "europe_ex_euro";
  });

  for (const [rawK, rawV] of Object.entries(rawObj)) {
    const val = clampPct(rawV);
    if (val === null || val === 0) continue;

    const cleanK = cleanRegionKey(rawK);

    // 🛑 BLACKLIST: Ignorar claves de totales para evitar doble conteo
    if (IGNORE_KEYS.includes(cleanK) || cleanK.includes("_total")) {
      continue;
    }

    // Regla Europa genérica
    if (hasSpecificEurope && (cleanK === "europe" || cleanK === "europa")) {
      continue;
    }

    let canonical = REGION_LOOKUP[cleanK];

    // Fallback Europa genérica -> europe_ex_euro
    if (!canonical && (cleanK === "europe" || cleanK === "europa")) {
      canonical = "europe_ex_euro";
    }

    if (canonical) {
      canonicalObj[canonical] = (canonicalObj[canonical] || 0) + val;
    } else {
      // ⚠️ FIX: "Other" explícito.
      // ESTRATEGIA: Si es "other", lo guardamos aparte y NO lo sumamos todavía.
      // Queremos que "other" sea SOLO el remanente si hay otras regiones.
      if (cleanK === "other" || cleanK === "others" || cleanK === "otros") {
        // Ignoramos el valor explícito de 'other' si hay riesgo de que sea 100%
        // Lo recalcularemos al final como (100 - suma_otras_regiones)
        continue;
      } else {
        // Desconocido real -> other + warning
        // Este sí lo sumamos porque es data real no identificada
        canonicalObj["other"] = (canonicalObj["other"] || 0) + val;
        if (warnings && !warnings.includes(`unknown_region_key:${rawK}`)) {
          warnings.push(`unknown_region_key:${rawK}`);
        }
      }
    }
  }

  // 🛡️ DEFENSA FINAL CONTRA "OTHER=100"
  // Calculamos la suma de regiones CANÓNICAS (excluyendo el 'other' que acabamos de meter por keys desconocidas, si las hay)
  let currentSum = 0;
  for (const k in canonicalObj) {
    currentSum += canonicalObj[k];
  }

  // Si tenemmos regiones reconocidas (suma > 0), el "Other" debe ser EXCLUSIVAMENTE el remanente.
  // Nunca inventamos "Other=100" si no reconocemos nada.

  if (currentSum > 0.0) {
    const remainder = 100.0 - currentSum;
    // Tolerancia: si falta más de 0.25%, lo asignamos a Other.
    if (remainder > 0.25) {
      canonicalObj["other"] = (canonicalObj["other"] || 0) + remainder;
      canonicalObj["other"] = +canonicalObj["other"].toFixed(4); // clean decimals
    }

    // Warning si nos pasamos de 100 significativamente
    if (currentSum > 101.0) {
      if (warnings) warnings.push(`regions_sum_overflow:${currentSum.toFixed(2)}`);
    }
  } else {
    // Suma es 0. No reconocimos ninguna región.
    // NO inventamos Other=100. Dejamos el objeto vacío (salvo keys desconocidas que hayan entrado en other arriba).
    if (warnings && Object.keys(rawObj).length > 0) {
      warnings.push("regions_all_unrecognized");
    }
  }

  // Renormalizar si la suma supera 100 por solapes (clamp final)
  for (const k in canonicalObj) {
    if (canonicalObj[k] > 100) canonicalObj[k] = 100;
  }

  return Object.keys(canonicalObj).length > 0 ? canonicalObj : null;
}

/**
 * Normaliza sectores asegurando tipos numéricos y eliminando basura
 */
function normalizeSectors(rawObj, warnings = []) {
  if (!rawObj || typeof rawObj !== "object") return null;

  const cleanObj = {};
  for (const [rawK, rawV] of Object.entries(rawObj)) {
    const val = clampPct(rawV);
    // Solo guardamos si es un número válido > 0
    if (val !== null && val > 0) {
      const cleanK = cleanRegionKey(rawK); // Reutilizamos limpieza de keys (snake_case)
      cleanObj[cleanK] = val;
    } else if (rawV !== null && rawV !== 0 && rawV !== "") {
      // Si Gemini envió algo que no es número pero tenía contenido, avisar
      if (warnings && !warnings.includes(`invalid_sector_value:${rawK}`)) {
        warnings.push(`invalid_sector_value:${rawK}`);
      }
    }
  }

  return Object.keys(cleanObj).length > 0 ? cleanObj : null;
}

// -----------------------------
// Derived classification
// -----------------------------
function deriveAssetClassFromCategory(catUpper) {
  // principal por categoría Morningstar (texto)
  const c = catUpper;

  // monetario
  if (c.includes("MONETARIO") || c.includes("MONEY MARKET") || c.includes("LIQUIDEZ")) return "Monetario";

  // retorno absoluto
  if (c.includes("RETORNO ABSOLUTO") || c.includes("ABSOLUTE RETURN") || c.includes("MARKET NEUTRAL") || c.includes("LONG/SHORT") || c.includes("LONG SHORT")) return "RetornoAbsoluto";

  // inmobiliario
  if (c.includes("INMOBILIAR") || c.includes("REAL ESTATE") || c.includes("REIT") || c.includes("PROPERTY")) return "Inmobiliario";

  // commodities
  if (c.includes("COMMODIT") || c.includes("MATERIAS PRIMAS") || c.includes("GOLD") || c.includes("ORO")) return "Commodities";

  // alternativos (genérico)
  if (c.includes("ALTERNATIV") || c.includes("HEDGE") || c.includes("MANAGED FUTURES") || c.includes("EVENT DRIVEN") || c.includes("ARBITRAGE") || c.includes("VOLATILITY")) return "Alternativos";

  // mixto
  if (c.includes("MIXTO") || c.includes("ALLOCATION") || c.includes("BALANCED") || c.includes("MULTI")) return "Mixto";

  // RF
  if (c.startsWith("RF") || c.includes("RENTA FIJA") || c.includes("BOND") || c.includes("CREDIT") || c.includes("FIXED INCOME") || c.includes("DEUDA")) return "RF";

  // RV
  if (c.startsWith("RV") || c.includes("RENTA VARIABLE") || c.includes("EQUITY") || c.includes("ACCIONES")) return "RV";

  return "Otros";
}

function derivePrimaryRegion(msRegions, catUpper) {
  // Lógica de cálculo sobre un objeto de regiones flat
  const computeFromObj = (obj) => {
    if (!obj) return null;
    const flat = [];
    for (const [k, v] of Object.entries(obj)) {
      const n = parseNum(v);
      if (n !== null) flat.push({ k, v: n });
    }
    if (!flat.length) return null;

    // Ordenar por peso descendente
    flat.sort((a, b) => b.v - a.v);

    // Tomar el top
    const top = flat[0];
    const k = top.k.toLowerCase();

    // 1. Mapeo Canónico Directo (Prioritario)
    if (k === "eurozone" || k === "europe_ex_euro" || k === "united_kingdom" || k === "europe" || k === "europa") return "Europa";
    if (k === "united_states" || k === "canada" || k === "americas" || k === "north_america") return "USA";
    if (k === "japan" || k === "japón") return "Japón";
    if (k === "asia_emerging" || k === "europe_emerging" || k === "latin_america" || k === "europe_me_africa") return "Emergentes";
    if (k === "developed_asia" || k === "china" || k === "asia" || k === "australasia") return "Asia"; // Australasia a Asia por simplificación

    return null; // Si el top es "other" o desconocido, fallamos al siguiente método
  };

  if (msRegions && typeof msRegions === "object") {
    // 🛑 PRIORIDAD: Detail > Macro
    // Si tenemos detail y hay un ganador claro, lo usamos.
    if (msRegions.detail && hasAnyFiniteNumber(msRegions.detail)) {
      const res = computeFromObj(msRegions.detail);
      if (res) return res;
    }

    // Si no, probamos con macro
    if (msRegions.macro && hasAnyFiniteNumber(msRegions.macro)) {
      const res = computeFromObj(msRegions.macro);
      if (res) return res;
    }
  }

  // fallback tokens en categoría
  const c = catUpper;
  if (c.includes("EURO") || c.includes("EUROPE") || c.includes("ZONA EURO") || c.includes("EURO ZONE")) return "Europa";
  if (c.includes("USA") || c.includes("UNITED STATES")) return "USA";
  if (c.includes("JAP")) return "Japón";
  if (c.includes("EMERG") || c.includes("EMERGING")) return "Emergentes";
  if (c.includes("ASIA")) return "Asia";
  return "Global";
}

function deriveSubcategories(msSectors, name, category) {
  const tags = new Set();

  // 1) por sectores (25/40)
  if (msSectors && typeof msSectors === "object") {
    for (const [key, rawV] of Object.entries(msSectors)) {
      const w = parseNum(rawV);
      if (w === null) continue;
      const baseTag = sectorKeyToTag.get(key);
      if (!baseTag) continue;

      if (w >= 25) tags.add(baseTag);
      if (w >= 40) {
        // sector_concentrated:<sector>
        const sector = baseTag.split(":")[1];
        tags.add(`sector_concentrated:${sector}`);
      }
    }
  }

  // 2) tokens por texto (nombre + categoría)
  const text = normalizeTextForTokens(`${name || ""} ${category || ""}`);
  for (const t of tokenToTag) {
    if (!t.token) continue;
    if (text.includes(t.token)) tags.add(t.tag);
  }

  // ordenar: concentrated primero, luego sector, luego theme
  const arr = Array.from(tags);
  arr.sort((a, b) => {
    const rank = (x) => (x.startsWith("sector_concentrated:") ? 0 : x.startsWith("sector:") ? 1 : x.startsWith("theme:") ? 2 : 9);
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
  return arr;
}

function topSector(msSectors) {
  if (!msSectors || typeof msSectors !== "object") return { top_sector: null, top_sector_weight: null };
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

// -----------------------------
// Gemini extraction
// -----------------------------
async function extraerMSConGemini(textoPDF) {
  const textoSeguro = (textoPDF || "").slice(0, 240000);

  // IMPORTANTE: pedimos SOLO lo que has decidido guardar (y “cartera” RV/RF)
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
      // Throttle real para asegurar estabilidad bajo concurrencia
      if (RATE_LIMIT_DELAY_MS > 0) await sleep(RATE_LIMIT_DELAY_MS);

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();
      text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
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
  const currency = cleanString(msRaw.currency) || null;

  // fechas
  const reportDateIso = parseSpanishDateToISO(msRaw.report_date) || reportDateFromFilename(fileName) || null;
  const portfolioAsOfIso = parseSpanishDateToISO(msRaw.portfolio_as_of) || null;

  // ms.* canonical
  const ms = {
    report_date: reportDateIso,
    category_morningstar: cleanString(msRaw.category_morningstar),
    rating_stars: parseNum(msRaw.rating_stars),
    medalist_rating: cleanString(msRaw.medalist_rating),

    portfolio: {
      as_of: portfolioAsOfIso,
      asset_allocation: {
        equity: clampPct(msRaw.asset_allocation?.equity),
        bond: clampPct(msRaw.asset_allocation?.bond),
        cash: clampPct(msRaw.asset_allocation?.cash),
        other: clampPct(msRaw.asset_allocation?.other),
      },
    },

    sectors: normalizeSectors(msRaw.sectors, []),
    regions: {
      macro: normalizeRegions(msRaw.regions_macro, []),
      detail: normalizeRegions(msRaw.regions_detail, []),
    },

    equity_style: {
      market_cap: msRaw.equity_market_cap && typeof msRaw.equity_market_cap === "object" ? msRaw.equity_market_cap : null,
      style: msRaw.equity_style && typeof msRaw.equity_style === "object" ? msRaw.equity_style : null,
      style_box_cell: cleanString(msRaw.equity_style_box_cell),
    },

    fixed_income: msRaw.fixed_income && typeof msRaw.fixed_income === "object" ? msRaw.fixed_income : null,

    holdings_top10: Array.isArray(msRaw.holdings_top10) ? msRaw.holdings_top10.map(h => ({
      name: cleanString(h.name),
      weight: clampPct(h.weight),
      sector: cleanString(h.sector),
    })).filter(x => x.name && x.weight !== null) : null,

    holdings_stats: msRaw.holdings_stats && typeof msRaw.holdings_stats === "object" ? {
      holdings_count_equity: parseNum(msRaw.holdings_stats.holdings_count_equity),
      holdings_count_bond: parseNum(msRaw.holdings_stats.holdings_count_bond),
      top10_weight: clampPct(msRaw.holdings_stats.top10_weight),
    } : null,

    costs: (msRaw.costs && typeof msRaw.costs === "object" && parseNum(msRaw.costs.management_fee) !== null) ? {
      management_fee: parseNum(msRaw.costs.management_fee)
    } : null,

    objective: cleanString(msRaw.objective),
  };

  // ---------------------------------------------------------
  // DEEP CLEAN: Eliminar nulos y estructuras vacías antes de persistir
  // ---------------------------------------------------------
  const deepClean = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      const cleanedArr = obj.map(deepClean).filter(v => v !== null && v !== undefined);
      return cleanedArr.length > 0 ? cleanedArr : null;
    }
    const cleanedObj = {};
    let hasProperKey = false;
    for (const [k, v] of Object.entries(obj)) {
      const inner = deepClean(v);
      if (inner !== null && inner !== undefined) {
        cleanedObj[k] = inner;
        hasProperKey = true;
      }
    }
    return hasProperKey ? cleanedObj : null;
  };

  const msCleaned = deepClean(ms) || {};

  // derived.*
  const catUpper = normalizeTextForTokens(ms.category_morningstar || "");
  const derived_asset_class = deriveAssetClassFromCategory(catUpper);
  const derived_primary_region = derivePrimaryRegion(ms.regions || null, catUpper);

  const msSectors = ms.sectors || null;
  const subcats = deriveSubcategories(msSectors, name, ms.category_morningstar || "");
  const ts = topSector(msSectors);

  // confianza simple (puedes afinar después)
  let confidence = 0.65;
  if (ms.category_morningstar) confidence += 0.2;
  if (ms.portfolio?.asset_allocation?.equity !== null) confidence += 0.1;
  if (ms.regions) confidence += 0.05;
  confidence = Math.min(0.99, confidence);

  const derived = {
    asset_class: derived_asset_class,
    primary_region: derived_primary_region,
    subcategories: subcats,
    top_sector: ts.top_sector,
    top_sector_weight: ts.top_sector_weight,
    confidence,
    ruleset_version: "class_v1.0",
    reasons: [
      ms.category_morningstar ? "ms.category_morningstar" : null,
      msSectors ? "ms.sectors" : null,
      ms.regions ? "ms.regions" : null,
      "tokens+sectors_25_40"
    ].filter(Boolean),
  };

  // -------------------------------------------------------
  // derived.portfolio_exposure (look-through) + style_bias
  // -------------------------------------------------------
  const equityTotal = clampPct(ms.portfolio?.asset_allocation?.equity);

  // 1) Look-through de sectores/regiones (sobre TOTAL fondo)
  const equity_sectors_total = equityTotal !== null ? scalePctMap(ms.sectors || null, equityTotal) : null;

  // Preferimos detail si existe; si no, macro
  const regionsDetail = ms.regions?.detail || null;
  const regionsMacro = ms.regions?.macro || null;
  const equity_regions_total = equityTotal !== null
    ? (scalePctMap(regionsDetail, equityTotal) || scalePctMap(regionsMacro, equityTotal))
    : null;

  // 2) Style bias (size + value/growth/blend)
  const styleBoxCell = ms.equity_style?.style_box_cell || null;
  const marketCapObj = ms.equity_style?.market_cap || null;
  const styleDistObj = ms.equity_style?.style || null; // si viene como mapa value/blend/growth

  let size_weights_total = null;
  if (equityTotal !== null && marketCapObj && hasAnyFiniteNumber(marketCapObj)) {
    size_weights_total = sizeWeightsTotalFromMarketCap(marketCapObj, equityTotal);
  } else if (equityTotal !== null && styleBoxCell) {
    const parsed = parseStyleBoxCell(styleBoxCell);
    if (parsed.size) {
      // Asumimos sesgo dominante: toda la parte equity cae en ese bucket
      size_weights_total = { [parsed.size]: +equityTotal.toFixed(4) };
    }
  }

  // Style (value/blend/growth): si hay distribución, la escalamos; si no, usamos celda
  let style_weights_total = null;
  if (equityTotal !== null && styleDistObj && typeof styleDistObj === "object" && hasAnyFiniteNumber(styleDistObj)) {
    // Normalizamos por si suma != 100
    const v = clampPct(styleDistObj.value);
    const b = clampPct(styleDistObj.blend);
    const g = clampPct(styleDistObj.growth);
    const vals = [v, b, g].filter(x => x !== null);
    const sum = vals.reduce((a, b) => a + b, 0);
    if (sum > 0.0001) {
      style_weights_total = scalePctMap({
        value: ((v ?? 0) * 100.0 / sum),
        blend: ((b ?? 0) * 100.0 / sum),
        growth: ((g ?? 0) * 100.0 / sum),
      }, equityTotal);
    }
  } else if (equityTotal !== null && styleBoxCell) {
    const parsed = parseStyleBoxCell(styleBoxCell);
    if (parsed.style) {
      style_weights_total = { [parsed.style]: +equityTotal.toFixed(4) };
    }
  }

  const size_bucket = size_weights_total ? argmaxKey(size_weights_total) : (styleBoxCell ? parseStyleBoxCell(styleBoxCell).size : null);
  const style_bucket = style_weights_total ? argmaxKey(style_weights_total) : (styleBoxCell ? parseStyleBoxCell(styleBoxCell).style : null);

  const hasAnyExposure = Boolean(equity_sectors_total || equity_regions_total || size_weights_total || style_weights_total || styleBoxCell);

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
      }
    };
  }



  // quality.*
  const quality = {
    parsed_at: admin.firestore.FieldValue.serverTimestamp(),
    parser_version: `ms_pdf_v3_${MODEL_NAME}`,
    source_pdf_hash: pdf_md5,
    warnings: [],
    ok: true,
  };

  // Recolectar warnings de regiones y sectores
  const stabilityWarnings = [];
  normalizeRegions(msRaw.regions_macro, stabilityWarnings);
  normalizeRegions(msRaw.regions_detail, stabilityWarnings);
  normalizeSectors(msRaw.sectors, stabilityWarnings);
  stabilityWarnings.forEach(w => quality.warnings.push(w));

  // Warnings adicionales: style_bias / exposure requieren equityTotal
  const _eqT = clampPct(ms.portfolio?.asset_allocation?.equity);
  if (_eqT === null) {
    if (ms.sectors) quality.warnings.push("equity_total_missing_for_sectors");
    if (ms.regions?.detail || ms.regions?.macro) quality.warnings.push("equity_total_missing_for_regions");
    if (ms.equity_style?.market_cap || ms.equity_style?.style_box_cell || ms.equity_style?.style) {
      quality.warnings.push("equity_total_missing_for_style_bias");
    }
  }

  // WARNINGS básicos
  if (!ms.category_morningstar) quality.warnings.push("missing_category_morningstar");
  if (!Number.isFinite(ms.rating_stars)) quality.warnings.push("missing_rating_stars");
  if (!ms.portfolio?.asset_allocation) {
    quality.warnings.push("missing_asset_allocation");
  } else {
    // 🛑 SANITY CHECK: Asset Allocation Suma ~100
    const aa = ms.portfolio.asset_allocation;
    const totalAA = (aa.equity || 0) + (aa.bond || 0) + (aa.cash || 0) + (aa.other || 0);
    if (Math.abs(totalAA - 100) > 1.0) {
      quality.warnings.push(`asset_allocation_sum_mismatch:${totalAA.toFixed(2)}`);
    }
  }

  if (!ms.sectors) quality.warnings.push("missing_sectors");
  if (!ms.regions) quality.warnings.push("missing_regions");

  // Documento final: NO toca manual.*
  const doc = {
    isin,
    name,
    currency,
    ms: msCleaned,
    derived,
    quality,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = db.collection("funds_v3").doc(isin);
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

  let files = fs.readdirSync(INPUT_DIR).filter(f => f.toLowerCase().endsWith(".pdf"));
  if (LIMIT && Number.isFinite(LIMIT)) files = files.slice(0, LIMIT);

  if (!files.length) {
    console.log("ℹ️ No hay PDFs para procesar.");
    process.exit(0);
  }

  console.log(`📦 PDFs: ${files.length} | concurrency=${CONCURRENCY}${BATCH_ID ? ` | batch=${BATCH_ID}` : ""}`);
  console.log(`🤖 Gemini model: ${MODEL_NAME}`);

  const writer = db.bulkWriter();
  writer.onWriteError((err) => {
    // reintento automático en errores transitorios
    if (err.failedAttempts < 3) return true;
    console.error("❌ BulkWriter error:", err);
    return false;
  });

  const limit = pLimit(CONCURRENCY);
  let ok = 0, fail = 0;

  // Parallel processing (Fast)
  const tasks = files.map(f => limit(async () => {
    try {
      const r = await processPdfFile(f, writer);
      ok++;
      console.log(`✅ ${r.fileName} -> ${r.isin}`);
      // Move to PROCESSED
      moveFileSafe(path.join(INPUT_DIR, f), PROCESSED_DIR, f);
    } catch (e) {
      fail++;
      console.error(`❌ ${f}: ${e.message}`);
      // Move to ERROR
      moveFileSafe(path.join(INPUT_DIR, f), ERROR_DIR, f);
    }
  }));

  await Promise.all(tasks);
  await writer.close();

  console.log(`\n✅ FIN | OK=${ok} | ERROR=${fail}`);
  process.exit(fail ? 2 : 0);
})();
