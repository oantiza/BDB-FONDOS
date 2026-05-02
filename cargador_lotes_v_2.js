/**
 * Reparse Morningstar PDFs -> Firestore funds_v3 (Gemini 2.5 Flash por defecto)
 * - Escribe SOLO fuente (ms.*) + quality.* + identity
 * - Calcula derived.* (asset_class, asset_subtype, primary_region, subcategories por sectores+tokens)
 * - Añade classification_v2 + portfolio_exposure_v2 (modelo canónico V2)
 * - NO pisa manual.* (TER/retro etc.)
 * - Añade backup completo local + validación de schema + validación matemática
 *
 * Args:
 *   --dir <carpeta PDFs>        (default ./data/input_pdfs)
 *   --limit <n>                 (default sin límite)
 *   --batch <id>                (opcional)
 *   --concurrency <n>           (default 10)
 *   --model <gemini-model>      (default gemini-2.5-flash)
 *   --processed <dir>           (default ./data/canonical)
 *   --error <dir>               (default ./data/error)
 *   --processed-pdfs <dir>      (default ./data/processed_pdfs/ok)
 *   --review-pdfs <dir>         (default ./data/processed_pdfs/review)
 *   --error-pdfs <dir>          (default ./data/processed_pdfs/error)
 *   --backup-root <dir>         (default ./data)
 *   --write-review              (opcional) también escribe en Firestore fondos en review
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
const pLimitModule = require("p-limit");
const pLimit = pLimitModule.default || pLimitModule;
const { parse: csvParse } = require("csv-parse/sync");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ============================
// Args
// ============================
function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function resolvePreferredOrLegacy(preferredPath, legacyPath) {
  if (fs.existsSync(preferredPath)) return preferredPath;
  if (legacyPath && fs.existsSync(legacyPath)) return legacyPath;
  return preferredPath;
}

const DATA_ROOT = path.join(__dirname, "data");
const LEGACY_BACKUP_ROOT = path.join(__dirname, "BDB_PARSE_BACKUP");
const PREFERRED_INPUT_DIR = path.join(DATA_ROOT, "input_pdfs");
const PREFERRED_PROCESSED_PDF_ROOT = path.join(DATA_ROOT, "processed_pdfs");
const processedArg = getArgValue("--processed");
const errorArg = getArgValue("--error");
const backupRootArg = getArgValue("--backup-root");

const INPUT_DIR = path.resolve(
  getArgValue("--dir") || resolvePreferredOrLegacy(PREFERRED_INPUT_DIR, path.join(__dirname, "ENTRADA"))
);
const LIMIT = getArgValue("--limit") ? parseInt(getArgValue("--limit"), 10) : null;
const BATCH_ID = getArgValue("--batch") || null;
const RATE_LIMIT_DELAY_MS = 100;
const CONCURRENCY = parseInt(getArgValue("--concurrency") || "10", 10);
const MODEL_NAME = getArgValue("--model") || "gemini-2.5-flash";
const WRITE_REVIEW = process.argv.includes("--write-review");

const PROCESSED_DIR = path.resolve(
  processedArg || resolvePreferredOrLegacy(path.join(DATA_ROOT, "canonical"), path.join(__dirname, "PROCESADOS"))
);
const ERROR_DIR = path.resolve(
  errorArg || resolvePreferredOrLegacy(path.join(DATA_ROOT, "error"), path.join(__dirname, "ERRORES"))
);
const PROCESSED_PDF_ROOT = path.resolve(PREFERRED_PROCESSED_PDF_ROOT);
const PROCESSED_PDF_DIR = path.resolve(
  getArgValue("--processed-pdfs") || path.join(PROCESSED_PDF_ROOT, "ok")
);
const REVIEW_PDF_DIR = path.resolve(
  getArgValue("--review-pdfs") || path.join(PROCESSED_PDF_ROOT, "review")
);
const ERROR_PDF_DIR = path.resolve(
  getArgValue("--error-pdfs") || path.join(PROCESSED_PDF_ROOT, "error")
);

[INPUT_DIR, PROCESSED_DIR, ERROR_DIR, PROCESSED_PDF_ROOT, PROCESSED_PDF_DIR, REVIEW_PDF_DIR, ERROR_PDF_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================
// HARDENING PIPELINE
// ============================
const PIPELINE_STATUS = {
  OK: "ok",
  REVIEW: "review",
  ERROR_LLM_JSON: "error_llm_json",
  ERROR_SCHEMA_VALIDATION: "error_schema_validation",
  ERROR_MATH_VALIDATION: "error_math_validation",
  ERROR_PROCESSING: "error_processing",
};

function resolveBackupDir(newRelativePath, legacyRelativePath) {
  if (backupRootArg) {
    const base = path.resolve(backupRootArg);
    return path.resolve(
      resolvePreferredOrLegacy(
        path.join(base, newRelativePath),
        legacyRelativePath ? path.join(base, legacyRelativePath) : null
      )
    );
  }

  return path.resolve(
    resolvePreferredOrLegacy(
      path.join(DATA_ROOT, newRelativePath),
      legacyRelativePath ? path.join(LEGACY_BACKUP_ROOT, legacyRelativePath) : null
    )
  );
}

const BACKUP_ROOT = path.resolve(backupRootArg || DATA_ROOT);

const DIRS = {
  INPUT: resolveBackupDir("input_pdfs", "00_input_pdfs"),
  RAW_TEXT: resolveBackupDir(path.join("work", "raw_text"), "01_raw_text"),
  RAW_LLM: resolveBackupDir(path.join("work", "raw_llm"), "02_raw_llm"),
  PARSED: resolveBackupDir(path.join("work", "parsed_ms"), "03_parsed_ms"),
  CANONICAL: resolveBackupDir("canonical", "04_canonical"),
  REVIEW: resolveBackupDir("review", path.join("05_overrides", "review_queue")),
  EXPORTS: resolveBackupDir(path.join("work", "exports"), "06_exports"),
  MANIFESTS: resolveBackupDir(path.join("work", "manifests"), "07_manifests"),
  LOGS: resolveBackupDir(path.join("work", "logs"), "08_logs"),
  ERRORS: resolveBackupDir("error", path.join("08_logs", "errors")),
};

Object.values(DIRS).forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============================
// Gemini
// ============================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ Falta GEMINI_API_KEY en variables de entorno.");
  console.error('   Ej: set GEMINI_API_KEY="TU_KEY"');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// ============================
// Firebase Admin init (LOCAL)
// ============================
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

// ============================
// CSV mappings
// ============================
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
const tokenToTag = tokenMapRows
  .map((r) => ({
    token: normalizeTextForTokens((r.token_uppercase || "").trim()),
    tag: (r.subcategory_tag || "").trim(),
  }))
  .filter((x) => x.token && x.tag);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTokenRegex(token) {
  const core = escapeRegex(token).replace(/\s+/g, "\\s+");
  return new RegExp(`(?:^|[^A-Z0-9])${core}(?:$|[^A-Z0-9])`);
}

const tokenMatchers = tokenToTag.map((t) => ({
  tag: t.tag,
  regex: buildTokenRegex(t.token),
}));

// ============================
// Helpers
// ============================
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

function moveFileSafeIfNeeded(srcPath, destDir, filename) {
  if (!fs.existsSync(srcPath)) return null;
  if (path.resolve(path.dirname(srcPath)) === path.resolve(destDir)) {
    return srcPath;
  }
  return moveFileSafe(srcPath, destDir, filename);
}

function writeJsonPretty(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text || "", "utf-8");
}

function sha1Hex(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

function shortHash(buffer, len = 8) {
  return sha1Hex(buffer).slice(0, len);
}

function cleanString(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(/\s+/g, " ");
  return t.length ? t : null;
}

function buildStableBaseName({ isin, reportDate, pdfBuffer, originalFileName }) {
  const hash8 = shortHash(pdfBuffer, 8);
  const safeIsin = cleanString(isin) || path.basename(originalFileName, path.extname(originalFileName));
  const safeDate = reportDate || "unknown_date";
  return `${safeIsin}__${safeDate}__${hash8}`;
}

function isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
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

function approxEqual(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

function validateRawLlMSchema(msRaw) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(msRaw)) {
    errors.push("root_not_object");
    return { ok: false, errors, warnings };
  }

  const allowedTopLevel = new Set([
    "isin",
    "name",
    "currency",
    "report_date",
    "category_morningstar",
    "rating_stars",
    "medalist_rating",
    "sustainability_rating",
    "portfolio_as_of",
    "asset_allocation",
    "regions_macro",
    "regions_detail",
    "sectors",
    "equity_market_cap",
    "equity_style",
    "equity_style_box_cell",
    "fixed_income",
    "holdings_top10",
    "holdings_stats",
    "costs",
    "objective",
  ]);

  for (const k of Object.keys(msRaw)) {
    if (!allowedTopLevel.has(k)) {
      warnings.push(`unexpected_top_level_key:${k}`);
    }
  }

  const scalarOrNull = [
    "isin",
    "name",
    "currency",
    "report_date",
    "category_morningstar",
    "medalist_rating",
    "equity_style_box_cell",
    "objective",
    "portfolio_as_of",
  ];

  for (const k of scalarOrNull) {
    if (msRaw[k] !== undefined && msRaw[k] !== null && typeof msRaw[k] !== "string") {
      warnings.push(`invalid_type:${k}:expected_string_or_null`);
    }
  }

  const numOrNull = ["rating_stars", "sustainability_rating"];
  for (const k of numOrNull) {
    if (msRaw[k] !== undefined && msRaw[k] !== null && !Number.isFinite(parseNum(msRaw[k]))) {
      warnings.push(`invalid_type:${k}:expected_number_or_null`);
    }
  }

  const objOrNull = [
    "asset_allocation",
    "regions_macro",
    "regions_detail",
    "sectors",
    "equity_market_cap",
    "equity_style",
    "fixed_income",
    "holdings_stats",
    "costs",
  ];

  for (const k of objOrNull) {
    if (msRaw[k] !== undefined && msRaw[k] !== null && !isPlainObject(msRaw[k])) {
      warnings.push(`invalid_type:${k}:expected_object_or_null`);
    }
  }

  if (msRaw.holdings_top10 !== undefined && msRaw.holdings_top10 !== null && !Array.isArray(msRaw.holdings_top10)) {
    warnings.push("invalid_type:holdings_top10:expected_array_or_null");
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateAssetMix(assetMix) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(assetMix)) {
    return { ok: false, errors: ["asset_mix_missing_or_invalid"], warnings };
  }

  const equity = clamp01(assetMix.equity ?? 0);
  const bond = clamp01(assetMix.bond ?? 0);
  const cash = clamp01(assetMix.cash ?? 0);
  const other = clamp01(assetMix.other ?? 0);

  const values = { equity, bond, cash, other };

  for (const [k, v] of Object.entries(values)) {
    if (v === null) errors.push(`asset_mix_invalid_value:${k}`);
  }

  if (errors.length) return { ok: false, errors, warnings };

  const sum = equity + bond + cash + other;

  if (sum <= 0.000001) errors.push("asset_mix_sum_zero");
  if (!approxEqual(sum, 1.0, 0.01)) errors.push(`asset_mix_sum_not_1:${sum.toFixed(6)}`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized: {
      equity: +equity.toFixed(6),
      bond: +bond.toFixed(6),
      cash: +cash.toFixed(6),
      other: +other.toFixed(6),
      sum: +sum.toFixed(6),
    },
  };
}

function validateChildMapAgainstParent(mapObj, parentWeight, label, tolerance = 0.03) {
  const errors = [];
  const warnings = [];

  if (mapObj == null) return { ok: true, errors, warnings, sum: null };
  if (!isPlainObject(mapObj)) {
    errors.push(`${label}_not_object`);
    return { ok: false, errors, warnings, sum: null };
  }

  let sum = 0;
  for (const [k, v] of Object.entries(mapObj)) {
    const n0 = parseNum(v);
    if (!Number.isFinite(n0)) {
      errors.push(`${label}_invalid_value:${k}`);
      continue;
    }
    if (n0 < 0) {
      errors.push(`${label}_negative_value:${k}`);
      continue;
    }
    const n = n0 > 1 ? n0 / 100 : n0;
    sum += n;
  }

  if (parentWeight != null && parentWeight > 0) {
    if (sum > parentWeight + tolerance) {
      errors.push(`${label}_sum_gt_parent:${sum.toFixed(6)}>${parentWeight.toFixed(6)}`);
    } else if (sum < parentWeight - tolerance) {
      warnings.push(`${label}_sum_lt_parent:${sum.toFixed(6)}<${parentWeight.toFixed(6)}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, sum: +sum.toFixed(6) };
}

function validateCanonicalMath({ classification_v2, portfolio_exposure_v2 }) {
  const errors = [];
  const warnings = [];

  if (!portfolio_exposure_v2 || !isPlainObject(portfolio_exposure_v2)) {
    return { ok: false, errors: ["portfolio_exposure_v2_missing"], warnings };
  }

  const mixCheck = validateAssetMix(portfolio_exposure_v2.asset_mix);
  errors.push(...mixCheck.errors);
  warnings.push(...mixCheck.warnings);

  if (!mixCheck.ok) {
    return { ok: false, errors, warnings, diagnostics: { mixCheck } };
  }

  const eq = mixCheck.normalized.equity;
  const bond = mixCheck.normalized.bond;

  const eqRegions = validateChildMapAgainstParent(portfolio_exposure_v2.equity_regions, eq, "equity_regions");
  const sectors = validateChildMapAgainstParent(portfolio_exposure_v2.sectors, eq, "sectors");
  const eqStyles = validateChildMapAgainstParent(portfolio_exposure_v2.equity_styles, eq, "equity_styles");
  const marketCaps = validateChildMapAgainstParent(portfolio_exposure_v2.market_caps, eq, "market_caps");
  const bondTypes = validateChildMapAgainstParent(portfolio_exposure_v2.bond_types, bond, "bond_types");
  const credit = validateChildMapAgainstParent(portfolio_exposure_v2.credit, bond, "credit");
  const duration = validateChildMapAgainstParent(portfolio_exposure_v2.duration, bond, "duration");

  [eqRegions, sectors, eqStyles, marketCaps, bondTypes, credit, duration].forEach((r) => {
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  });

  if (classification_v2?.asset_type === "equity" && eq < 0.5) {
    warnings.push(`class_exposure_tension:equity_asset_type_with_equity_${eq.toFixed(4)}`);
  }

  if (classification_v2?.asset_type === "fixed_income" && bond < 0.2) {
    warnings.push(`class_exposure_tension:fixed_income_asset_type_with_bond_${bond.toFixed(4)}`);
  }

  if (classification_v2?.asset_type === "money_market" && mixCheck.normalized.cash + mixCheck.normalized.bond < 0.75) {
    warnings.push("class_exposure_tension:money_market_without_cash_bond_majority");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    diagnostics: {
      mixCheck,
      eqRegions,
      sectors,
      eqStyles,
      marketCaps,
      bondTypes,
      credit,
      duration,
    },
  };
}

const FIXED_INCOME_REGION_OPTIONAL_SUBTYPES = new Set([
  "CORPORATE_BOND",
  "HIGH_YIELD_BOND",
  "CONVERTIBLE_BOND",
  "INFLATION_LINKED_BOND",
]);

function hasCoherentFixedIncomeClassification(classification_v2, portfolio_exposure_v2, canonicalValidation) {
  if (classification_v2?.asset_type !== "fixed_income") return false;
  if (!canonicalValidation?.ok || !isPlainObject(portfolio_exposure_v2)) return false;

  const subtypeNormalization = normalizeSubtypeByAssetType(
    classification_v2.asset_type,
    classification_v2.asset_subtype,
    classification_v2.fixed_income_type
  );

  if (subtypeNormalization.incompatible) return false;
  if (subtypeNormalization.subtype !== classification_v2.asset_subtype) return false;
  return String(classification_v2.asset_subtype || "").endsWith("_BOND");
}

function isSoftFixedIncomeRoutingWarning(warning, classification_v2) {
  const w = String(warning || "");
  if (!w) return false;

  if (w.includes("fi_type_inference_weak")) return true;
  if (w.startsWith("asset_mix_guardrail:")) return true;

  if (w.includes("region_incomplete")) {
    return FIXED_INCOME_REGION_OPTIONAL_SUBTYPES.has(cleanString(classification_v2?.asset_subtype) || "");
  }

  return false;
}

function decidePipelineStatus({ schemaValidation, canonicalValidation, classification_v2, portfolio_exposure_v2 }) {
  if (!schemaValidation.ok) {
    return {
      status: PIPELINE_STATUS.ERROR_SCHEMA_VALIDATION,
      reason: schemaValidation.errors.join("|"),
    };
  }

  if (!canonicalValidation.ok) {
    return {
      status: PIPELINE_STATUS.ERROR_MATH_VALIDATION,
      reason: canonicalValidation.errors.join("|"),
    };
  }

  const warnings = canonicalValidation.warnings || [];
  const classWarnings = classification_v2?.warnings || [];
  const expWarnings = portfolio_exposure_v2?.warnings || [];
  const allWarnings = Array.from(new Set([...warnings, ...classWarnings, ...expWarnings]));

  const reviewTriggers = [
    "fund_of_funds",
    "lookthrough_partial",
    "credit_missing",
    "duration_missing",
    "style_missing",
    "region_incomplete",
    "class_exposure_tension",
  ];

  const allowSoftFixedIncomeWarnings =
    hasCoherentFixedIncomeClassification(classification_v2, portfolio_exposure_v2, canonicalValidation);
  const reviewWarnings = allWarnings.filter((w) => {
    const wStr = String(w);

    // 1. Ignorar warnings de RF en Equity
    if (classification_v2?.asset_type === "equity") {
      const rfWarnings = ["credit_missing", "duration_missing", "duration_inferred_weak", "fi_type_inference_weak"];
      if (rfWarnings.some(rfw => wStr.includes(rfw))) return false;
    }

    // 2. Relajar credit_missing en Renta Fija coherente
    if (wStr.includes("credit_missing") && classification_v2?.asset_type === "fixed_income") {
      if (allowSoftFixedIncomeWarnings && canonicalValidation.ok && portfolio_exposure_v2?.asset_mix?.bond > 0) {
        return false;
      }
    }

    // 3. Relajar region_incomplete para fixed_income
    if (wStr.includes("region_incomplete") && classification_v2?.asset_type === "fixed_income") {
      return false;
    }

    if (allowSoftFixedIncomeWarnings && isSoftFixedIncomeRoutingWarning(w, classification_v2)) {
      return false;
    }
    if (classification_v2?.asset_type === "money_market") {
      if (
        wStr.includes("credit_missing") ||
        wStr.includes("duration_missing") ||
        wStr.includes("region_incomplete")
      ) {
        return false;
      }
    }
    return reviewTriggers.some((t) => wStr.includes(t));
  });

  if (reviewWarnings.length) {
    return {
      status: PIPELINE_STATUS.REVIEW,
      reason: reviewWarnings.join("|"),
    };
  }

  return { status: PIPELINE_STATUS.OK, reason: null };
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

function pctFromAliases(obj, aliases = []) {
  if (!obj || typeof obj !== "object") return null;
  const entries = Object.entries(obj);
  for (const k of aliases) {
    let raw = null;
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      raw = obj[k];
    } else {
      const kNorm = cleanRegionKey(k);
      const found = entries.find(([rawK]) => cleanRegionKey(rawK) === kNorm);
      if (found) raw = found[1];
    }
    if (raw === null || raw === undefined) continue;
    const v = clampPct(raw);
    if (v !== null) return v;
  }
  return null;
}

function numFromAliases(obj, aliases = []) {
  if (!obj || typeof obj !== "object") return null;
  const entries = Object.entries(obj);
  for (const k of aliases) {
    let raw = null;
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      raw = obj[k];
    } else {
      const kNorm = cleanRegionKey(k);
      const found = entries.find(([rawK]) => cleanRegionKey(rawK) === kNorm);
      if (found) raw = found[1];
    }
    if (raw === null || raw === undefined) continue;
    const v = parseNum(raw);
    if (v !== null) return v;
  }
  return null;
}

function strFromAliases(obj, aliases = []) {
  if (!obj || typeof obj !== "object") return null;
  const entries = Object.entries(obj);
  for (const k of aliases) {
    let raw = null;
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      raw = obj[k];
    } else {
      const kNorm = cleanRegionKey(k);
      const found = entries.find(([rawK]) => cleanRegionKey(rawK) === kNorm);
      if (found) raw = found[1];
    }
    if (raw === null || raw === undefined) continue;
    const v = cleanString(raw);
    if (v) return v;
  }
  return null;
}

function normalizePctBucketObject(rawObj, aliasesByCanonical) {
  if (!rawObj || typeof rawObj !== "object") return null;
  const out = {};
  for (const [canonical, aliases] of Object.entries(aliasesByCanonical)) {
    const v = pctFromAliases(rawObj, aliases);
    if (v !== null) out[canonical] = v;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeFixedIncome(rawFi) {
  if (!rawFi || typeof rawFi !== "object") return null;

  const creditRaw =
    (rawFi.credit_quality && typeof rawFi.credit_quality === "object" && rawFi.credit_quality) ||
    (rawFi.credit && typeof rawFi.credit === "object" && rawFi.credit) ||
    (rawFi.credit_breakdown && typeof rawFi.credit_breakdown === "object" && rawFi.credit_breakdown) ||
    null;

  const maturityRaw =
    (rawFi.maturity_allocation && typeof rawFi.maturity_allocation === "object" && rawFi.maturity_allocation) ||
    (rawFi.maturity && typeof rawFi.maturity === "object" && rawFi.maturity) ||
    (rawFi.maturity_bucket && typeof rawFi.maturity_bucket === "object" && rawFi.maturity_bucket) ||
    null;

  const couponRaw =
    (rawFi.coupon_allocation && typeof rawFi.coupon_allocation === "object" && rawFi.coupon_allocation) ||
    (rawFi.coupon && typeof rawFi.coupon === "object" && rawFi.coupon) ||
    null;

  const normalized = {
    effective_duration: numFromAliases(rawFi, [
      "effective_duration",
      "duration",
      "duration_effective",
      "modified_duration",
      "duracion",
      "duracion_media",
    ]),
    effective_maturity: numFromAliases(rawFi, [
      "effective_maturity",
      "maturity",
      "maturity_effective",
      "maduracion",
      "maduracion_media",
    ]),
    avg_credit_quality: strFromAliases(rawFi, [
      "avg_credit_quality",
      "average_credit_quality",
      "credit_quality_average",
      "average_rating",
      "rating_average",
    ]),
    credit_quality: normalizePctBucketObject(creditRaw, {
      aaa: ["aaa"],
      aa: ["aa"],
      a: ["a"],
      bbb: ["bbb"],
      bb: ["bb"],
      b: ["b"],
      below_b: ["below_b", "below_bbb", "ccc_and_below", "ccc", "cc", "c"],
      not_rated: ["not_rated", "unrated"],
    }),
    maturity_allocation: normalizePctBucketObject(maturityRaw, {
      "1_3": ["1_3", "1-3", "under_3", "0_3", "short"],
      "3_5": ["3_5", "3-5", "3_to_5"],
      "5_7": ["5_7", "5-7", "5_to_7", "intermediate"],
      "7_10": ["7_10", "7-10", "7_to_10", "long"],
      over_10: ["over_10", "10_plus", "10+", "over10"],
    }),
    coupon_allocation: normalizePctBucketObject(couponRaw, {
      "0": ["0", "zero", "under_0"],
      "0_4": ["0_4", "0-4", "0_to_4"],
      "4_6": ["4_6", "4-6", "4_to_6"],
      over_6: ["over_6", "6_plus", "6+", "over6"],
    }),
  };

  const hasAny =
    normalized.effective_duration !== null ||
    normalized.effective_maturity !== null ||
    !!normalized.avg_credit_quality ||
    !!normalized.credit_quality ||
    !!normalized.maturity_allocation ||
    !!normalized.coupon_allocation;

  return hasAny ? normalized : null;
}

function sizeWeightsTotalFromMarketCap(marketCapObj, equityTotalPct) {
  if (!marketCapObj || typeof marketCapObj !== "object") return null;
  const eq = clampPct(equityTotalPct);
  if (eq === null) return null;

  const micro = pctFromAliases(marketCapObj, ["micro", "micro_cap"]);
  const small = pctFromAliases(marketCapObj, ["small", "small_cap"]);
  const mid = pctFromAliases(marketCapObj, ["mid", "middle", "medium", "mid_cap"]);
  const large = pctFromAliases(marketCapObj, ["large", "large_cap"]);
  const giant = pctFromAliases(marketCapObj, ["giant", "mega", "mega_cap"]);

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

function sanitizeAssetMixForExposureBuilder(allocationObj) {
  if (!allocationObj || typeof allocationObj !== "object") return null;

  const warnings = [];
  const keys = ["equity", "bond", "cash", "other"];
  const raw = {};

  for (const k of keys) {
    const parsed = parseNum(allocationObj[k]);
    if (!Number.isFinite(parsed)) {
      raw[k] = 0;
      warnings.push({ code: "missing_or_invalid_component", component: k });
      continue;
    }
    if (parsed < 0) {
      raw[k] = 0;
      warnings.push({ code: "negative_component_clamped_to_zero", component: k, value: +parsed.toFixed(6) });
      continue;
    }
    if (parsed > 100) {
      raw[k] = 100;
      warnings.push({ code: "component_gt_100_clamped", component: k, value: +parsed.toFixed(6) });
      continue;
    }
    raw[k] = +parsed.toFixed(6);
  }

  const values = Object.values(raw);
  const maxV = values.reduce((m, v) => Math.max(m, v), 0);
  const minPositive = values.filter((v) => v > 0).reduce((m, v) => Math.min(m, v), Infinity);

  const looksLikePercentScale = maxV > 1.000001;
  const mixedScaleSignal = looksLikePercentScale && Number.isFinite(minPositive) && minPositive > 0 && minPositive < 1;

  const decimals = {};
  for (const k of keys) {
    decimals[k] = looksLikePercentScale ? raw[k] / 100.0 : raw[k];
  }

  const sumBeforeRebase = keys.reduce((acc, k) => acc + decimals[k], 0);
  if (sumBeforeRebase <= 0.000001) return null;

  if (looksLikePercentScale) {
    warnings.push({ code: "detected_scale_0_100_divided_by_100", max_component: +maxV.toFixed(6) });
  }

  if (mixedScaleSignal) {
    warnings.push({
      code: "mixed_scale_signal_detected",
      min_positive_component: +minPositive.toFixed(6),
      max_component: +maxV.toFixed(6),
    });
  }

  const needRebase = !approxEqual(sumBeforeRebase, 1.0, 0.01);
  const denom = needRebase ? sumBeforeRebase : 1.0;

  const asset_mix = {
    equity: +(decimals.equity / denom).toFixed(6),
    bond: +(decimals.bond / denom).toFixed(6),
    cash: +(decimals.cash / denom).toFixed(6),
    other: +(decimals.other / denom).toFixed(6),
  };
  const sumAfterRebase = +(asset_mix.equity + asset_mix.bond + asset_mix.cash + asset_mix.other).toFixed(6);

  if (needRebase) {
    warnings.push({
      code: "asset_mix_rebased_to_sum_1",
      sum_before: +sumBeforeRebase.toFixed(6),
      sum_after: sumAfterRebase,
    });
  }

  return {
    asset_mix,
    warnings,
    diagnostics: {
      source_scale: looksLikePercentScale ? "0_100" : "0_1",
      sum_before: +sumBeforeRebase.toFixed(6),
      sum_after: sumAfterRebase,
    },
  };
}

function normalizeExposureMapToParent01(mapObj, parentWeight01) {
  const parent = clamp01(parentWeight01);
  if (parent === null || parent <= 0) return null;
  if (!mapObj || typeof mapObj !== "object") return null;

  const clean = {};
  let sum = 0;

  for (const [k, rawV] of Object.entries(mapObj)) {
    const n0 = parseNum(rawV);
    if (!Number.isFinite(n0) || n0 <= 0) continue;
    const n = n0 > 1 ? n0 / 100 : n0;
    if (n <= 0) continue;
    clean[k] = n;
    sum += n;
  }

  if (sum <= 0.000001) return null;

  const out = {};
  for (const [k, n] of Object.entries(clean)) {
    const w = (n / sum) * parent;
    if (w > 0) out[k] = +w.toFixed(6);
  }

  return Object.keys(out).length ? out : null;
}

function parseStyleBoxCell(cell) {
  const s = cleanString(cell);
  if (!s) return { size: null, style: null };
  const parts = s.split("-").map((p) => p.trim().toLowerCase());
  if (parts.length < 2) {
    const t = s.toLowerCase();
    const size =
      t.includes("large") || t.includes("gran") || t.includes("grande")
        ? "large"
        : t.includes("mid") || t.includes("med")
          ? "mid"
          : t.includes("small") || t.includes("peq")
            ? "small"
            : null;
    const style =
      t.includes("value") || t.includes("valor")
        ? "value"
        : t.includes("blend") || t.includes("core") || t.includes("mix") || t.includes("mixto")
          ? "blend"
          : t.includes("growth") || t.includes("crecimiento")
            ? "growth"
            : null;
    return { size, style };
  }

  const sizeRaw = parts[0];
  const styleRaw = parts.slice(1).join("-");

  const size =
    sizeRaw.includes("large") || sizeRaw.includes("gran") || sizeRaw.includes("grande")
      ? "large"
      : sizeRaw.includes("mid") || sizeRaw.includes("med")
        ? "mid"
        : sizeRaw.includes("small") || sizeRaw.includes("peq")
          ? "small"
          : null;

  const style =
    styleRaw.includes("value") || styleRaw.includes("valor")
      ? "value"
      : styleRaw.includes("blend") || styleRaw.includes("core") || styleRaw.includes("mix") || styleRaw.includes("mixto")
        ? "blend"
        : styleRaw.includes("growth") || styleRaw.includes("crecimiento")
          ? "growth"
          : null;

  return { size, style };
}

function deriveMarketCapBiasFromText(textUpper) {
  const t = textUpper || "";
  if (
    t.includes("SMALL CAP") ||
    t.includes("SMALL-CAP") ||
    t.includes("SMID") ||
    t.includes("PEQUENA CAP") ||
    t.includes("PEQUENO CAP") ||
    t.includes("PEQUENA COMPANIAS") ||
    t.includes("MICROCAP") ||
    t.includes("SMALLER COMPANIES") ||
    t.includes("MICRO CAP")
  ) return "small";
  if (
    t.includes("MID CAP") ||
    t.includes("MID-CAP") ||
    t.includes("MEDIANA CAP") ||
    t.includes("MEDIUM CAP")
  ) return "mid";
  if (
    t.includes("LARGE CAP") ||
    t.includes("LARGE-CAP") ||
    t.includes("MEGA CAP") ||
    t.includes("GRAN CAP") ||
    t.includes("GRANDE CAP") ||
    t.includes("BLUE CHIP")
  ) return "large";
  return null;
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
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function buscarISINRegex(txt) {
  let m = txt.match(/[A-Z]{2}[A-Z0-9]{9}[0-9]/);
  if (m) return m[0].toUpperCase();

  m = txt.match(/[A-Z]{2}[\s\-]?[A-Z0-9]{4}[\s\-]?[A-Z0-9]{4}[\s\-]?[0-9]/);
  if (m) return m[0].replace(/[\s\-]/g, "").toUpperCase();

  return null;
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

// ============================
// Regional normalization
// ============================
const REGION_MAPPINGS = {
  united_states: ["usa", "u.s.", "u.s.a", "eeuu", "estados_unidos", "united_states"],
  canada: ["canada", "canadá"],
  latin_america: ["latin_america", "latinoamerica", "latinoamérica", "america_latina", "américa_latina", "iberoamerica", "iberoamérica"],
  eurozone: ["eurozone", "euro_zone", "zona_euro", "zona_del_euro", "emu"],
  europe_ex_euro: [
    "europe_ex_euro",
    "europe_ex-euro",
    "europa_ex_euro",
    "europe_excluding_eurozone",
    "europe_ex_eurozone",
    "europa_sin_euro",
    "europa_ex_zona_euro",
    "europa - ex euro",
  ],
  europe: ["europe", "europa"],
  united_kingdom: ["uk", "u.k.", "united_kingdom", "reino_unido", "great_britain", "gran_bretaña", "gran_bretana"],
  europe_emerging: ["emerging_europe", "europa_emergente"],
  japan: ["japan", "japón", "japon"],
  developed_asia: ["developed_asia", "asia_desarrollada", "asia_developed"],
  china: ["china"],
  asia_emerging: ["asia_emerging", "emerging_asia", "asia_emergente", "asia - emergente"],
  middle_east: ["middle_east", "oriente_medio", "oriente_medio_africa", "oriente_medio_/_africa"],
  africa: ["africa", "áfrica"],
  australasia: ["australasia", "australia", "new_zealand", "nueva_zelanda"],
  americas: ["americas", "américas"],
  europe_me_africa: [
    "europe_me_africa",
    "emea",
    "europa_o_medio_africa",
    "europa_oriente_medio_africa",
    "europe_middle_east_africa",
    "europao._medioafrica",
    "europao_medioafrica",
    "europa/o_medio/africa",
    "europa/o.medio/africa",
  ],
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

const BENIGN_UNKNOWN_REGION_KEYS = new Set([
  "region",
  "regions",
  "world",
  "global",
  "n_a",
  "na",
]);

const REGION_LOOKUP = {};
for (const [canonical, aliases] of Object.entries(REGION_MAPPINGS)) {
  aliases.forEach((alias) => {
    REGION_LOOKUP[cleanRegionKey(alias)] = canonical;
  });
}

function cleanRegionKey(k) {
  if (!k) return "";
  return String(k)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/]/g, "_")
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

    if (canonical) {
      canonicalObj[canonical] = (canonicalObj[canonical] || 0) + val;
    } else {
      if (cleanK === "other" || cleanK === "others" || cleanK === "otros") {
        continue;
      } else {
        canonicalObj.other = (canonicalObj.other || 0) + val;
        if (
          warnings &&
          !BENIGN_UNKNOWN_REGION_KEYS.has(cleanK) &&
          !cleanK.endsWith("_region") &&
          !cleanK.includes("region_") &&
          !warnings.includes(`unknown_region_key:${rawK}`)
        ) {
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

// ============================
// Derived classification helpers
// ============================
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
  if (hasLatinAmericaIdentity(c)) return "Emergentes";
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

function deriveSubcategories(msSectors, name, category, objective = "") {
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

  const text = normalizeTextForTokens(`${name || ""} ${category || ""} ${objective || ""}`);
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

function hasLatinAmericaIdentity(text = "") {
  const c = String(text || "");
  return (
    c.includes("BRAZIL") ||
    c.includes("BRASIL") ||
    c.includes("LATIN AMERICA") ||
    c.includes("LATAM") ||
    c.includes("LATINOAMERICA") ||
    c.includes("IBEROAMERICA")
  );
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
  if (c.includes("JAPAN") || c.includes("JAPON") || c.includes("JAPÓN")) return "JAPAN_EQUITY";
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
  const topSector = parseNum(topSectorWeight);
  const isHighlyConcentratedSector =
    Number.isFinite(topSector) && topSector >= STRICT_SECTOR_FUND_MIN_WEIGHT;
  const hasTextBackedSectorConcentration =
    Number.isFinite(topSector) && topSector >= TEXT_BACKED_SECTOR_FUND_MIN_WEIGHT;
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
      !Number.isFinite(topSector) ||
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

function stripCodeFences(rawText) {
  return String(rawText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function extractFirstBalancedJsonObject(rawText) {
  const text = String(rawText || "");
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

function repairJsonCandidate(rawText) {
  return String(rawText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "")
    .replace(/^\s*json\s*[:=-]?\s*/i, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\bNaN\b/g, "null")
    .replace(/\bundefined\b/g, "null")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/;+\s*$/, "")
    .trim();
}

const CRITICAL_GEMINI_KEYS = [
  "category_morningstar",
  "asset_allocation",
  "regions_detail",
  "sectors",
  "equity_style",
  "fixed_income",
];

function hasAnyCriticalGeminiKey(obj) {
  if (!isPlainObject(obj)) return false;
  return CRITICAL_GEMINI_KEYS.some((k) => obj[k] !== undefined);
}

function unwrapGeminiRootObject(parsed) {
  if (!isPlainObject(parsed)) return parsed;
  if (hasAnyCriticalGeminiKey(parsed)) return parsed;

  for (const key of ["data", "result", "output", "payload", "json", "response", "content"]) {
    const candidate = parsed[key];
    if (isPlainObject(candidate) && hasAnyCriticalGeminiKey(candidate)) return candidate;
    if (
      Array.isArray(candidate) &&
      candidate.length === 1 &&
      isPlainObject(candidate[0]) &&
      hasAnyCriticalGeminiKey(candidate[0])
    ) {
      return candidate[0];
    }
  }

  return parsed;
}

function parseGeminiJsonResponse(rawText) {
  const candidates = [];
  const push = (x) => {
    const t = String(x || "").trim();
    if (!t) return;
    if (!candidates.includes(t)) candidates.push(t);
  };

  const stripped = stripCodeFences(rawText);
  push(rawText);
  push(stripped);
  push(extractFirstBalancedJsonObject(rawText));
  push(extractFirstBalancedJsonObject(stripped));

  for (const c of candidates) {
    const direct = repairJsonCandidate(c);
    try {
      const parsed = JSON.parse(direct);
      if (isPlainObject(parsed)) return unwrapGeminiRootObject(parsed);
      if (Array.isArray(parsed) && parsed.length === 1 && isPlainObject(parsed[0])) {
        return unwrapGeminiRootObject(parsed[0]);
      }
    } catch (_) {}
  }

  throw new Error("Gemini no devolvió un JSON objeto parseable");
}

// ============================
// Gemini extraction
// ============================
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
  "regions_detail": {},
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
- category_morningstar debe ser el texto de categoría Morningstar más exacto posible (sin traducir ni inventar).
- Todos los porcentajes deben ser numéricos en escala 0..100 (sin símbolo %).
- No inventes valores: si falta un dato, usa null.
- Evita campos agregados inventados: no añadas "total" en sectors o regions.
- En fixed_income prioriza: effective_duration, avg_credit_quality, credit_quality, maturity_allocation.
- Devuelve un único objeto JSON en la raíz (no array y sin wrappers tipo data/result/output).
- Incluye SIEMPRE en la raíz: category_morningstar, asset_allocation, regions_detail, sectors, equity_style y fixed_income.
- Si no puedes completar un bloque, usa {} para objetos de distribución y null para escalares; no inventes sumas.
- NO extraigas: TER, retrocesiones, comisión de entrada o salida.
- NO extraigas: fecha creación, gestor, fecha incorporación, VL/fecha VL, domicilio, UCITS.
- Si algo no está, pon null.

TEXTO:
"""${textoSeguro}"""
`.trim();

  const MAX_RETRIES = 6;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      if (RATE_LIMIT_DELAY_MS > 0) await sleep(RATE_LIMIT_DELAY_MS);

      let result;
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        });
      } catch (_) {
        result = await model.generateContent(prompt);
      }
      const response = await result.response;
      const text = response.text().trim();
      return parseGeminiJsonResponse(text);
    } catch (e) {
      if (i === MAX_RETRIES - 1) throw e;
      await sleep(1200 * (i + 1));
    }
  }

  throw new Error("Gemini no devolvió JSON válido.");
}

// ============================
// Globals for batch
// ============================
const manifestEntries = [];
const errorEntries = [];
const reviewEntries = [];

function isValidPdfText(text) {
  if (!text) return false;

  const cleaned = String(text).trim();

  // 1. Too short
  if (cleaned.length < 500) return false;

  // 2. No financial keywords
  const keywords = [
    "Morningstar",
    "Portfolio",
    "Asset",
    "Allocation",
    "Equity",
    "Bond"
  ];

  const hasKeyword = keywords.some(k => cleaned.includes(k));
  if (!hasKeyword) return false;

  // 3. Too many strange characters (OCR noise)
  const weirdRatio = cleaned.replace(/[a-zA-Z0-9\s]/g, "").length / cleaned.length;
  if (weirdRatio > 0.4) return false;

  return true;
}


// ============================
// Process one PDF
// ============================
async function processPdfFile(fileName, writer) {
  const fullPath = path.join(INPUT_DIR, fileName);
  const buffer = fs.readFileSync(fullPath);
  const pdf_md5 = crypto.createHash("md5").update(buffer).digest("hex");

  const pdfData = await pdfParse(buffer);
  const text = pdfData.text || "";

  if (!isValidPdfText(text)) {
    throw new Error("error_pdf_unreadable");
  }

  let msRaw = null;
  try {
    msRaw = await extraerMSConGemini(text);
  } catch (e) {
    const errPayload = {
      fileName,
      error: PIPELINE_STATUS.ERROR_LLM_JSON,
      message: e.message,
      generated_at: new Date().toISOString(),
    };
    writeJsonPretty(path.join(DIRS.ERRORS, `${path.basename(fileName, ".pdf")}__llm_error.json`), errPayload);
    errorEntries.push(errPayload);
    throw e;
  }

  const schemaValidation = validateRawLlMSchema(msRaw);

  const tentativeIsin = (msRaw.isin || buscarISINRegex(text) || "").toUpperCase();
  const tentativeReportDate =
    parseSpanishDateToISO(msRaw.report_date) ||
    reportDateFromFilename(fileName) ||
    null;

  const stableBaseName = buildStableBaseName({
    isin: tentativeIsin || null,
    reportDate: tentativeReportDate,
    pdfBuffer: buffer,
    originalFileName: fileName,
  });

  const rawTextPath = path.join(DIRS.RAW_TEXT, `${stableBaseName}__raw.txt`);
  const rawLlmPath = path.join(DIRS.RAW_LLM, `${stableBaseName}__raw_llm.json`);
  const parsedMsPath = path.join(DIRS.PARSED, `${stableBaseName}__parsed_ms.json`);
  const canonicalPath = path.join(DIRS.CANONICAL, `${stableBaseName}__canonical.json`);
  const reviewPath = path.join(DIRS.REVIEW, `${stableBaseName}__review.json`);
  const errorPath = path.join(DIRS.ERRORS, `${stableBaseName}__error.json`);

  writeText(rawTextPath, text);

  writeJsonPretty(rawLlmPath, {
    status: schemaValidation.ok ? "ok" : "invalid_schema",
    model: MODEL_NAME,
    generated_at: new Date().toISOString(),
    schema_validation: schemaValidation,
    raw_response: msRaw,
  });

  if (!schemaValidation.ok) {
    const payload = {
      fileName,
      stableBaseName,
      error: PIPELINE_STATUS.ERROR_SCHEMA_VALIDATION,
      schemaValidation,
      raw_response: msRaw,
      generated_at: new Date().toISOString(),
    };
    writeJsonPretty(errorPath, payload);
    errorEntries.push({
      isin: tentativeIsin || null,
      fileName,
      reason: schemaValidation.errors.join("|"),
    });
    manifestEntries.push({
      fileName,
      stableBaseName,
      isin: tentativeIsin || null,
      status: PIPELINE_STATUS.ERROR_SCHEMA_VALIDATION,
      reason: schemaValidation.errors.join("|"),
      report_date: tentativeReportDate,
      parser_version: `ms_pdf_v5_${MODEL_NAME}`,
      source_pdf_hash: sha1Hex(buffer),
    });
    throw new Error(`Schema validation failed: ${schemaValidation.errors.join(", ")}`);
  }

  const isin = tentativeIsin;
  if (!isin || isin.length < 10) throw new Error("ISIN no detectado.");

  const name = cleanString(msRaw.name) || null;
  const nameUpper = normalizeTextForTokens(name || "");
  const currency = cleanString(msRaw.currency) || null;

  const reportDateIso = tentativeReportDate;
  const portfolioAsOfIso = parseSpanishDateToISO(msRaw.portfolio_as_of) || null;

  const sectorWarnings = [];
  const regionWarnings = [];
  const rawAssetAllocation =
    (msRaw.asset_allocation && typeof msRaw.asset_allocation === "object" && msRaw.asset_allocation) ||
    (msRaw.assetAllocation && typeof msRaw.assetAllocation === "object" && msRaw.assetAllocation) ||
    (msRaw.portfolio && typeof msRaw.portfolio === "object" && msRaw.portfolio.asset_allocation && typeof msRaw.portfolio.asset_allocation === "object" && msRaw.portfolio.asset_allocation) ||
    (msRaw.portfolio && typeof msRaw.portfolio === "object" && msRaw.portfolio.allocation && typeof msRaw.portfolio.allocation === "object" && msRaw.portfolio.allocation) ||
    (msRaw.allocation && typeof msRaw.allocation === "object" && msRaw.allocation) ||
    null;
  const rawRegionsMacro =
    (msRaw.regions_macro && typeof msRaw.regions_macro === "object" && msRaw.regions_macro) ||
    (msRaw.regions && typeof msRaw.regions === "object" && msRaw.regions.macro && typeof msRaw.regions.macro === "object" && msRaw.regions.macro) ||
    (msRaw.regionsMacro && typeof msRaw.regionsMacro === "object" && msRaw.regionsMacro) ||
    null;
  const rawRegionsDetail =
    (msRaw.regions_detail && typeof msRaw.regions_detail === "object" && msRaw.regions_detail) ||
    (msRaw.regions && typeof msRaw.regions === "object" && msRaw.regions.detail && typeof msRaw.regions.detail === "object" && msRaw.regions.detail) ||
    (msRaw.regionsDetail && typeof msRaw.regionsDetail === "object" && msRaw.regionsDetail) ||
    (msRaw.world_regions && typeof msRaw.world_regions === "object" && msRaw.world_regions) ||
    null;
  const rawSectors =
    (msRaw.sectors && typeof msRaw.sectors === "object" && msRaw.sectors) ||
    (msRaw.equity_sectors && typeof msRaw.equity_sectors === "object" && msRaw.equity_sectors) ||
    (msRaw.equity && typeof msRaw.equity === "object" && msRaw.equity.sectors && typeof msRaw.equity.sectors === "object" && msRaw.equity.sectors) ||
    (msRaw.sector_weights && typeof msRaw.sector_weights === "object" && msRaw.sector_weights) ||
    null;
  const rawEquityMarketCap =
    (msRaw.equity_market_cap && typeof msRaw.equity_market_cap === "object" && msRaw.equity_market_cap) ||
    (msRaw.market_cap && typeof msRaw.market_cap === "object" && msRaw.market_cap) ||
    (msRaw.equity_marketcap && typeof msRaw.equity_marketcap === "object" && msRaw.equity_marketcap) ||
    null;
  const rawEquityStyle =
    (msRaw.equity_style && typeof msRaw.equity_style === "object" && msRaw.equity_style) ||
    (msRaw.style && typeof msRaw.style === "object" && msRaw.style) ||
    (msRaw.equity && typeof msRaw.equity === "object" && msRaw.equity.style && typeof msRaw.equity.style === "object" && msRaw.equity.style) ||
    (msRaw.style_breakdown && typeof msRaw.style_breakdown === "object" && msRaw.style_breakdown) ||
    null;
  const rawStyleBoxCell =
    cleanString(msRaw.equity_style_box_cell) ||
    cleanString(msRaw.style_box_cell) ||
    cleanString(msRaw.equity_style_cell) ||
    null;
  const rawFixedIncome =
    (msRaw.fixed_income && typeof msRaw.fixed_income === "object" && msRaw.fixed_income) ||
    (msRaw.fixedIncome && typeof msRaw.fixedIncome === "object" && msRaw.fixedIncome) ||
    (msRaw.bonds && typeof msRaw.bonds === "object" && msRaw.bonds) ||
    (msRaw.fixed_income_profile && typeof msRaw.fixed_income_profile === "object" && msRaw.fixed_income_profile) ||
    (msRaw.bond_profile && typeof msRaw.bond_profile === "object" && msRaw.bond_profile) ||
    null;

  const ms = {
    report_date: reportDateIso,
    category_morningstar:
      cleanString(msRaw.category_morningstar) ||
      cleanString(msRaw.morningstarCategory) ||
      cleanString(msRaw.category) ||
      cleanString(msRaw.morningstar_category),
    rating_stars: parseNum(msRaw.rating_stars),
    medalist_rating: cleanString(msRaw.medalist_rating),
    sustainability_rating: parseNum(msRaw.sustainability_rating),

    portfolio: {
      as_of: portfolioAsOfIso,
      asset_allocation: {
        equity: pctFromAliases(rawAssetAllocation, [
          "equity",
          "equities",
          "stocks",
          "renta_variable",
          "rv",
        ]),
        bond: pctFromAliases(rawAssetAllocation, [
          "bond",
          "bonds",
          "fixed_income",
          "renta_fija",
          "rf",
        ]),
        cash: pctFromAliases(rawAssetAllocation, [
          "cash",
          "liquidity",
          "money_market",
          "monetario",
        ]),
        other: pctFromAliases(rawAssetAllocation, [
          "other",
          "others",
          "alternative",
          "alternatives",
          "otros",
        ]),
      },
    },

    sectors: normalizeSectors(rawSectors, sectorWarnings),
    regions: {
      macro: normalizeRegions(rawRegionsMacro, regionWarnings),
      detail: normalizeRegions(rawRegionsDetail, regionWarnings),
    },

    equity_style: {
      market_cap: rawEquityMarketCap,
      style: rawEquityStyle,
      style_box_cell: rawStyleBoxCell,
    },

    fixed_income: normalizeFixedIncome(rawFixedIncome),

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

  writeJsonPretty(parsedMsPath, {
    isin,
    fileName,
    report_date: reportDateIso,
    model: MODEL_NAME,
    parsed_at: new Date().toISOString(),
    ms: msCleaned,
  });

  const catUpper = normalizeTextForTokens(ms.category_morningstar || "");
  let derived_asset_class = deriveAssetClassFromCategory(catUpper, nameUpper, ms.sectors || null);
  const derived_primary_region = derivePrimaryRegion(ms.regions || null, catUpper, nameUpper);

  const subcats = deriveSubcategories(
    ms.sectors || null,
    name,
    ms.category_morningstar || "",
    ms.objective || ""
  );
  const ts = topSector(ms.sectors || null);
  let assetSubtype = deriveAssetSubtype(
    catUpper,
    subcats,
    nameUpper,
    ts.top_sector_weight,
    derived_asset_class
  );

  if (assetSubtype === "UNKNOWN" && derived_asset_class === "RV") {
    assetSubtype = "GLOBAL_EQUITY";
  }
  const flags = deriveFlags(catUpper, subcats, nameUpper, ts.top_sector_weight, derived_asset_class);

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
    ruleset_version: "class_v1.4",
    reasons: [
      ms.category_morningstar ? "ms.category_morningstar" : null,
      ms.sectors ? "ms.sectors" : null,
      ms.regions?.detail || ms.regions?.macro ? "ms.regions" : null,
      "tokens+sectors_25_40+sector_gate_45_60",
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
    const v = pctFromAliases(styleDistObj, ["value", "val"]);
    const b = pctFromAliases(styleDistObj, ["blend", "core", "mix"]);
    const g = pctFromAliases(styleDistObj, ["growth", "grow"]);
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
      : deriveMarketCapBiasFromText(`${catUpper || ""} ${nameUpper || ""}`);

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

  let fixedIncomeType = null;
  let fixedIncomeTypeSource = null;
  let creditBucket = null;
  let creditBucketSource = null;
  let durationBucket = null;
  let durationBucketSource = null;

  const fi = ms.fixed_income || null;
  const fiText = `${catUpper || ""} ${normalizeTextForTokens(ms.objective || "")}`;

  if (fi) {
    const duration = parseNum(fi.effective_duration);
    const effectiveMaturity = parseNum(fi.effective_maturity);
    const avgCreditQuality = normalizeTextForTokens(fi.avg_credit_quality || "");
    const maturity = fi.maturity_allocation || null;
    const credit = fi.credit_quality || null;

    const aaa = parseNum(credit?.aaa) || 0;
    const aa = parseNum(credit?.aa) || 0;
    const a = parseNum(credit?.a) || 0;
    const bbb = parseNum(credit?.bbb) || 0;
    const bb = parseNum(credit?.bb) || 0;
    const b = parseNum(credit?.b) || 0;
    const belowB = parseNum(credit?.below_b) || 0;

    const ig = aaa + aa + a + bbb;
    const hy = bb + b + belowB;
    const m1_3 = parseNum(maturity?.["1_3"]) || 0;
    const m3_5 = parseNum(maturity?.["3_5"]) || 0;
    const m5_7 = parseNum(maturity?.["5_7"]) || 0;
    const m7_10 = parseNum(maturity?.["7_10"]) || 0;
    const mOver10 = parseNum(maturity?.over_10) || 0;

    const maturityTotal = m1_3 + m3_5 + m5_7 + m7_10 + mOver10;

    if (duration !== null) {
      if (duration < 1) durationBucket = "ultrashort";
      else if (duration < 3) durationBucket = "short";
      else if (duration < 7) durationBucket = "intermediate";
      else durationBucket = "long";
      durationBucketSource = "effective_duration";
    } else if (effectiveMaturity !== null) {
      if (effectiveMaturity < 2.5) durationBucket = "short";
      else if (effectiveMaturity < 7) durationBucket = "intermediate";
      else durationBucket = "long";
      durationBucketSource = "effective_maturity";
    } else if (maturity && maturityTotal > 0) {
      const shortShare = m1_3 + m3_5;
      const intermediateShare = m5_7;
      const longShare = m7_10 + mOver10;
      if (shortShare >= intermediateShare && shortShare >= longShare) durationBucket = "short";
      else if (longShare >= shortShare && longShare >= intermediateShare) durationBucket = "long";
      else durationBucket = "intermediate";
      durationBucketSource = "maturity_allocation";
    } else if (fiText.includes("ULTRASHORT") || fiText.includes("VERY SHORT")) {
      durationBucket = "ultrashort";
      durationBucketSource = "text";
    } else if (fiText.includes("SHORT DURATION") || fiText.includes("CORTO PLAZO")) {
      durationBucket = "short";
      durationBucketSource = "text";
    } else if (fiText.includes("INTERMEDIATE DURATION") || fiText.includes("MEDIO PLAZO")) {
      durationBucket = "intermediate";
      durationBucketSource = "text";
    } else if (fiText.includes("LONG DURATION") || fiText.includes("LARGO PLAZO")) {
      durationBucket = "long";
      durationBucketSource = "text";
    }

    if (ig > 60 && hy < 20) {
      creditBucket = "investment_grade";
      creditBucketSource = "credit_quality";
    } else if (hy > 35) {
      creditBucket = "high_yield";
      creditBucketSource = "credit_quality";
    } else if (ig > 20 || hy > 20) {
      creditBucket = "mixed_credit";
      creditBucketSource = "credit_quality";
    }

    if (!creditBucket && avgCreditQuality) {
      if (
        avgCreditQuality.includes("AAA") ||
        avgCreditQuality.includes("AA") ||
        avgCreditQuality.includes(" A ") ||
        avgCreditQuality.includes("BBB") ||
        avgCreditQuality.includes("INVESTMENT GRADE") ||
        avgCreditQuality.includes("GRADO DE INVERSION")
      ) {
        creditBucket = "investment_grade";
        creditBucketSource = "avg_credit_quality";
      } else if (
        avgCreditQuality.includes("BB") ||
        avgCreditQuality.includes(" B ") ||
        avgCreditQuality.includes("CCC") ||
        avgCreditQuality.includes("HIGH YIELD")
      ) {
        creditBucket = "high_yield";
        creditBucketSource = "avg_credit_quality";
      }
    }

    if (!creditBucket && (fiText.includes("HIGH YIELD") || fiText.includes("ALTO RENDIMIENTO"))) {
      creditBucket = "high_yield";
      creditBucketSource = "text";
    }
    if (!creditBucket && (fiText.includes("INVESTMENT GRADE") || fiText.includes("GRADO DE INVERSION"))) {
      creditBucket = "investment_grade";
      creditBucketSource = "text";
    }

    if (fiText.includes("CONVERTIBLE")) {
      fixedIncomeType = "convertible";
      fixedIncomeTypeSource = "text";
    } else if (fiText.includes("INFLATION") || fiText.includes("LINKED")) {
      fixedIncomeType = "inflation_linked";
      fixedIncomeTypeSource = "text";
    } else if (fiText.includes("EMERGING") && (fiText.includes("BOND") || fiText.includes("DEBT") || fiText.includes("RF"))) {
      fixedIncomeType = "emerging_debt";
      fixedIncomeTypeSource = "text";
    } else if (fiText.includes("HIGH YIELD") || fiText.includes("ALTO RENDIMIENTO")) {
      fixedIncomeType = "high_yield";
      fixedIncomeTypeSource = "text";
    } else if (creditBucket === "high_yield") {
      fixedIncomeType = "high_yield";
      fixedIncomeTypeSource = "credit_consistency";
    } else if (fiText.includes("GOVERNMENT") || fiText.includes("TREASURY") || fiText.includes("SOVEREIGN")) {
      fixedIncomeType = "government";
      fixedIncomeTypeSource = "text";
    } else if (fiText.includes("CORPORATE") || fiText.includes("CREDIT")) {
      fixedIncomeType = "corporate";
      fixedIncomeTypeSource = "text";
    } else if (fiText.includes("AGGREGATE") || fiText.includes("MULTI SECTOR") || fiText.includes("MULTISECTOR")) {
      fixedIncomeType = "flexible";
      fixedIncomeTypeSource = "text";
    } else if (fiText.includes("BOND") || fiText.includes("CREDIT") || fiText.includes("FIXED INCOME") || fiText.includes("RENTA FIJA")) {
      fixedIncomeType = "corporate";
      fixedIncomeTypeSource = "text";
    } else {
      fixedIncomeType = "flexible";
      fixedIncomeTypeSource = "weak_default";
    }

    if (!creditBucket && fixedIncomeType === "high_yield") {
      creditBucket = "high_yield";
      creditBucketSource = "type_consistency";
    } else if (!creditBucket && fixedIncomeType === "government") {
      creditBucket = "investment_grade";
      creditBucketSource = "type_consistency";
    }
  } else if (derived_asset_class === "RF") {
    if (fiText.includes("CONVERTIBLE")) {
      fixedIncomeType = "convertible";
      fixedIncomeTypeSource = "text";
    }
    else if (fiText.includes("HIGH YIELD") || fiText.includes("ALTO RENDIMIENTO")) {
      fixedIncomeType = "high_yield";
      fixedIncomeTypeSource = "text";
      creditBucket = "high_yield";
      creditBucketSource = "text";
    } else if (fiText.includes("GOVERNMENT") || fiText.includes("TREASURY") || fiText.includes("SOVEREIGN")) {
      fixedIncomeType = "government";
      fixedIncomeTypeSource = "text";
      creditBucket = "investment_grade";
      creditBucketSource = "text";
    } else if (fiText.includes("INFLATION") || fiText.includes("LINKED")) {
      fixedIncomeType = "inflation_linked";
      fixedIncomeTypeSource = "text";
    }
    else if (fiText.includes("EMERGING") && (fiText.includes("BOND") || fiText.includes("DEBT") || fiText.includes("RF"))) {
      fixedIncomeType = "emerging_debt";
      fixedIncomeTypeSource = "text";
    } else {
      fixedIncomeType = "corporate";
      fixedIncomeTypeSource = "weak_default";
    }

    if (fiText.includes("ULTRASHORT") || fiText.includes("VERY SHORT")) {
      durationBucket = "ultrashort";
      durationBucketSource = "text";
    } else if (fiText.includes("CORTO PLAZO") || fiText.includes("SHORT DURATION")) {
      durationBucket = "short";
      durationBucketSource = "text";
    } else if (fiText.includes("LARGO PLAZO") || fiText.includes("LONG DURATION")) {
      durationBucket = "long";
      durationBucketSource = "text";
    } else {
      durationBucket = "intermediate";
      durationBucketSource = "weak_default";
    }
  }

  const classification_v2 = {
    version: "v2",
    asset_type:
      derived_asset_class === "RV"
        ? "equity"
        : derived_asset_class === "RF"
          ? "fixed_income"
          : derived_asset_class === "Mixto"
            ? "allocation"
            : derived_asset_class === "Monetario"
              ? "money_market"
              : derived_asset_class === "Alternativos"
                ? "alternative"
                : derived_asset_class === "Inmobiliario"
                  ? "real_asset"
                  : derived_asset_class === "Commodities"
                    ? "alternative"
                    : "other",
    asset_subtype: assetSubtype || "UNKNOWN",
    commercial_type: ms.category_morningstar || null,
    region_primary: derived_primary_region || "Global",
    region_secondary: null,
    equity_style_box: styleBoxCell || null,
    market_cap_bias: size_bucket || null,
    fixed_income_type: fixedIncomeType,
    credit_bucket: creditBucket,
    duration_bucket: durationBucket,
    strategy_tags: subcats || [],
    vehicle_complexity: flags.is_index_like
      ? "plain_vanilla"
      : flags.is_thematic
        ? "thematic"
        : flags.is_sector_fund
          ? "sector"
          : "active",
    classification_confidence: confidence,
    sources_used: [
      ms.category_morningstar ? "ms.category_morningstar" : null,
      ms.sectors ? "ms.sectors" : null,
      ms.regions?.detail || ms.regions?.macro ? "ms.regions" : null,
      ms.equity_style?.style_box_cell || ms.equity_style?.market_cap || ms.equity_style?.style ? "ms.equity_style" : null,
      ms.fixed_income ? "ms.fixed_income" : null,
    ].filter(Boolean),
    warnings: [],
  };

  const subtypeNormalization = normalizeSubtypeByAssetType(
    classification_v2.asset_type,
    classification_v2.asset_subtype,
    fixedIncomeType
  );
  if (subtypeNormalization.incompatible) {
    classification_v2.warnings.push(
      `subtype_incompatible_with_asset_type:${classification_v2.asset_type}:${classification_v2.asset_subtype}`
    );
    classification_v2.asset_subtype = subtypeNormalization.subtype;
    classification_v2.warnings.push(
      `subtype_downgraded_to_safe_family:${classification_v2.asset_subtype}`
    );
  } else if (subtypeNormalization.defaulted) {
    classification_v2.asset_subtype = subtypeNormalization.subtype;
    classification_v2.warnings.push("money_market_subtype_defaulted");
  }

  let portfolio_exposure_v2 = null;
  const sanitizedMix = sanitizeAssetMixForExposureBuilder(ms.portfolio?.asset_allocation || null);

  if (sanitizedMix) {
    const equityMix01 = sanitizedMix.asset_mix.equity;
    const bondMix01 = sanitizedMix.asset_mix.bond;
    const otherMix01 = sanitizedMix.asset_mix.other;

    const equityRegionsV2 = normalizeExposureMapToParent01(equity_regions_total, equityMix01);
    const sectorsV2 = normalizeExposureMapToParent01(equity_sectors_total, equityMix01);
    const equityStylesV2 = normalizeExposureMapToParent01(style_weights_total, equityMix01);
    const marketCapsV2 = normalizeExposureMapToParent01(size_weights_total, equityMix01);
    const bondTypesV2 = fixedIncomeType && bondMix01 > 0 ? { [fixedIncomeType]: +bondMix01.toFixed(6) } : null;
    const creditV2 = creditBucket && bondMix01 > 0 ? { [creditBucket]: +bondMix01.toFixed(6) } : null;
    const durationV2 = durationBucket && bondMix01 > 0 ? { [durationBucket]: +bondMix01.toFixed(6) } : null;

    portfolio_exposure_v2 = {
      version: "v2",
      asset_mix: sanitizedMix.asset_mix,
      equity_regions: equityRegionsV2,
      sectors: sectorsV2,
      equity_styles: equityStylesV2,
      market_caps: marketCapsV2,
      bond_types: bondTypesV2,
      credit: creditV2,
      duration: durationV2,
      alternatives:
        classification_v2.asset_type === "alternative" && otherMix01 > 0
          ? { alternative: +otherMix01.toFixed(6) }
          : null,
      exposure_confidence: confidence,
      warnings: [],
    };

    for (const w of sanitizedMix.warnings || []) {
      const details = Object.entries(w)
        .filter(([k]) => k !== "code")
        .map(([k, v]) => `${k}=${v}`)
        .join(",");
      portfolio_exposure_v2.warnings.push(
        details ? `asset_mix_guardrail:${w.code}:${details}` : `asset_mix_guardrail:${w.code}`
      );
    }
  }

  const quality = {
    parsed_at: admin.firestore.FieldValue.serverTimestamp(),
    parser_version: `ms_pdf_v5_${MODEL_NAME}`,
    source_pdf_hash: pdf_md5,
    warnings: [],
    ok: true,
  };

  [...sectorWarnings, ...regionWarnings].forEach((w) => quality.warnings.push(w));

  const _eqT = clampPct(ms.portfolio?.asset_allocation?.equity);
  if (_eqT === null) {
    if (ms.sectors) quality.warnings.push("equity_total_missing_for_sectors");
    if (ms.regions?.detail || ms.regions?.macro) quality.warnings.push("equity_total_missing_for_regions");
    if (ms.equity_style?.market_cap || ms.equity_style?.style_box_cell || ms.equity_style?.style) {
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
      if (!creditBucket) {
        classification_v2.warnings.push("credit_missing");
        portfolio_exposure_v2?.warnings.push("credit_missing");
      }
    }

    if (!hasMaturityAllocation && !hasEffectiveDuration) {
      quality.warnings.push("fi_missing_duration_data");
      if (!durationBucket) {
        classification_v2.warnings.push("duration_missing");
        portfolio_exposure_v2?.warnings.push("duration_missing");
      }
    }

    if (
      !hasCreditQuality &&
      creditBucket &&
      (creditBucketSource === "text" || creditBucketSource === "type_consistency")
    ) {
      quality.warnings.push("fi_credit_inferred_weak");
      classification_v2.warnings.push("credit_inferred_weak");
      portfolio_exposure_v2?.warnings.push("credit_inferred_weak");
    }

    if (
      !hasMaturityAllocation &&
      !hasEffectiveDuration &&
      durationBucket &&
      (durationBucketSource === "text" || durationBucketSource === "weak_default")
    ) {
      quality.warnings.push("fi_duration_inferred_weak");
      classification_v2.warnings.push("duration_inferred_weak");
      portfolio_exposure_v2?.warnings.push("duration_inferred_weak");
    }

    if (fixedIncomeTypeSource === "weak_default") {
      quality.warnings.push("fi_type_inference_weak");
      classification_v2.warnings.push("fi_type_inference_weak");
    }
  } else if (classification_v2.asset_type === "fixed_income") {
    quality.warnings.push("fi_block_missing_used_text_fallback");
    classification_v2.warnings.push("fi_block_missing");
  }

  if (!ms.category_morningstar) quality.warnings.push("missing_category_morningstar");
  if (!Number.isFinite(ms.rating_stars)) quality.warnings.push("missing_rating_stars");

  if (!ms.portfolio?.asset_allocation) {
    quality.warnings.push("missing_asset_allocation");
    classification_v2.warnings.push("missing_asset_allocation");
  } else {
    const aa = ms.portfolio.asset_allocation;
    const totalAA = (aa.equity || 0) + (aa.bond || 0) + (aa.cash || 0) + (aa.other || 0);
    if (Math.abs(totalAA - 100) > 2.0) {
      quality.warnings.push(`asset_allocation_sum_mismatch:${totalAA.toFixed(2)}`);
      portfolio_exposure_v2?.warnings.push("asset_allocation_sum_mismatch");
    }
  }

  if (!ms.sectors) {
    quality.warnings.push("missing_sectors");
    if (classification_v2.asset_type === "equity") {
      classification_v2.warnings.push("style_or_sector_missing");
    }
  }

  if (!ms.regions?.detail && !ms.regions?.macro) {
    quality.warnings.push("missing_regions");
    classification_v2.warnings.push("region_incomplete");
    portfolio_exposure_v2?.warnings.push("region_incomplete");
  }

  quality.warnings = Array.from(new Set(quality.warnings));
  classification_v2.warnings = Array.from(new Set(classification_v2.warnings));
  if (portfolio_exposure_v2?.warnings) {
    portfolio_exposure_v2.warnings = Array.from(new Set(portfolio_exposure_v2.warnings));
  }

  const canonicalValidation = validateCanonicalMath({
    classification_v2,
    portfolio_exposure_v2,
  });

  const routing = decidePipelineStatus({
    schemaValidation,
    canonicalValidation,
    classification_v2,
    portfolio_exposure_v2,
  });


  const canonicalPayload = {
    isin,
    name,
    currency,
    fileName,
    stableBaseName,
    report_date: reportDateIso,
    ms: msCleaned,
    derived,
    classification_v2,
    portfolio_exposure_v2,
    quality,
    validation: canonicalValidation,
    routing,
    generated_at: new Date().toISOString(),
  };

  if (routing.status === PIPELINE_STATUS.OK) {
    writeJsonPretty(canonicalPath, canonicalPayload);
  } else if (routing.status === PIPELINE_STATUS.REVIEW) {
    writeJsonPretty(reviewPath, canonicalPayload);
    reviewEntries.push({
      isin,
      fileName,
      reason: routing.reason,
    });
  } else {
    writeJsonPretty(errorPath, canonicalPayload);
    errorEntries.push({
      isin,
      fileName,
      reason: routing.reason,
    });
    manifestEntries.push({
      fileName,
      stableBaseName,
      isin,
      status: routing.status,
      reason: routing.reason,
      report_date: reportDateIso,
      parser_version: `ms_pdf_v5_${MODEL_NAME}`,
      source_pdf_hash: sha1Hex(buffer),
    });
    return {
      isin,
      fileName,
      routingStatus: routing.status,
      routingReason: routing.reason,
      processedPdfFileName: `${stableBaseName}.pdf`,
    };
  }

  const doc = {
    isin,
    name,
    currency,
    ms: msCleaned,
    derived,
    classification_v2,
    portfolio_exposure_v2,
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

  if (routing.status === PIPELINE_STATUS.OK || (routing.status === PIPELINE_STATUS.REVIEW && WRITE_REVIEW)) {
    writer.set(ref, doc, { merge: true });
  }

  manifestEntries.push({
    fileName,
    stableBaseName,
    isin,
    status: routing.status,
    reason: routing.reason,
    report_date: reportDateIso,
    parser_version: `ms_pdf_v5_${MODEL_NAME}`,
    source_pdf_hash: sha1Hex(buffer),
  });

  const processedJsonPath = path.join(PROCESSED_DIR, `${isin}.json`);
  writeJsonPretty(processedJsonPath, canonicalPayload);

  return {
    isin,
    fileName,
    routingStatus: routing.status,
    routingReason: routing.reason,
    processedPdfFileName: `${stableBaseName}.pdf`,
  };
}

// ============================
// Main
// ============================
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
  let review = 0;

  const tasks = files.map((f) =>
    limit(async () => {
      try {
        const r = await processPdfFile(f, writer);
        if (r.routingStatus === PIPELINE_STATUS.REVIEW) {
          review++;
          console.log(`🟡 ${r.fileName} -> ${r.isin} [REVIEW]`);
          moveFileSafeIfNeeded(path.join(INPUT_DIR, f), REVIEW_PDF_DIR, r.processedPdfFileName || f);
        } else if (r.routingStatus === PIPELINE_STATUS.OK) {
          ok++;
          console.log(`✅ ${r.fileName} -> ${r.isin}`);
          moveFileSafeIfNeeded(path.join(INPUT_DIR, f), PROCESSED_PDF_DIR, r.processedPdfFileName || f);
        } else {
          fail++;
          console.error(`❌ ${r.fileName} -> ${r.isin} [${r.routingStatus}] ${r.routingReason || ""}`.trim());
          moveFileSafeIfNeeded(path.join(INPUT_DIR, f), ERROR_PDF_DIR, r.processedPdfFileName || f);
        }
      } catch (e) {
        fail++;
        console.error(`❌ ${f}: ${e.message}`);
        moveFileSafeIfNeeded(path.join(INPUT_DIR, f), ERROR_PDF_DIR, f);
      }
    })
  );

  await Promise.all(tasks);
  await writer.close();

  const batchManifest = {
    batch_id: BATCH_ID || new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"),
    parser_version: `ms_pdf_v5_${MODEL_NAME}`,
    generated_at: new Date().toISOString(),
    total_files: files.length,
    ok_count: ok,
    review_count: review,
    error_count: fail,
    write_review_to_firestore: WRITE_REVIEW,
    entries: manifestEntries,
  };

  writeJsonPretty(path.join(DIRS.MANIFESTS, "batch_manifest.json"), batchManifest);

  fs.writeFileSync(
    path.join(DIRS.LOGS, "parser_errors.ndjson"),
    errorEntries.map((x) => JSON.stringify(x)).join("\n"),
    "utf-8"
  );

  fs.writeFileSync(
    path.join(DIRS.REVIEW, "review_queue.ndjson"),
    reviewEntries.map((x) => JSON.stringify(x)).join("\n"),
    "utf-8"
  );

  console.log(`\n✅ FIN | OK=${ok} | REVIEW=${review} | ERROR=${fail}`);
  process.exit(fail ? 2 : 0);
})();
