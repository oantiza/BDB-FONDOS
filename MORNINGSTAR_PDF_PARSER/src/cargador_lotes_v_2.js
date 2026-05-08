/**
 * Reparse Morningstar PDFs -> Firestore funds_v3 (Gemini 2.5 Flash por defecto)
 * - Escribe SOLO fuente (ms.*) + quality.* + identity
 * - Calcula derived.* (asset_class, asset_subtype, primary_region, subcategories por sectores+tokens)
 * - AÃƒÂ±ade classification_v2 + portfolio_exposure_v2 (modelo canÃƒÂ³nico V2)
 * - NO pisa manual.* (TER/retro etc.)
 * - AÃƒÂ±ade backup completo local + validaciÃƒÂ³n de schema + validaciÃƒÂ³n matemÃƒÂ¡tica
 *
 * Args:
 *   --dir <carpeta PDFs>        (default MORNINGSTAR_PDF_PARSER/ENTRADA)
 *   --dry-run                   (default) procesa sin escribir en Firestore
 *   --write --confirm-write     habilita escritura futura con doble confirmacion
 *   --output-dir <dir>          artifacts dry-run (default MORNINGSTAR_PDF_PARSER/SALIDA)
 *   --only-isin <ISIN>          procesa solo PDFs cuyo nombre contenga el ISIN
 *   --config-dir <dir>          carpeta primaria para CSV/config
 *   --no-move-files             no mueve PDFs desde ENTRADA al finalizar
 *   --limit <n>                 (default sin lÃƒÂ­mite)
 *   --batch <id>                (opcional)
 *   --concurrency <n>           (default 10)
 *   --model <gemini-model>      (default gemini-2.5-flash)
 *   --processed <dir>           (default ./data/canonical)
 *   --error <dir>               (default ./data/error)
 *   --processed-pdfs <dir>      (default ./data/processed_pdfs/ok)
 *   --review-pdfs <dir>         (default ./data/processed_pdfs/review)
 *   --error-pdfs <dir>          (default ./data/processed_pdfs/error)
 *   --backup-root <dir>         (default ./data)
 *   --write-review              (opcional) tambiÃƒÂ©n escribe en Firestore fondos en review
 *
 * Reqs:
 *   npm i firebase-admin pdf-parse @google/generative-ai p-limit csv-parse dotenv
 */

require("dotenv").config({ quiet: true });
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
// REFACTOR-1: Extracted pure modules
// ============================
const _numberUtils = require("./utils/number_utils");
const _textNormalizer = require("./normalize/text_normalizer");
const _regionNormalizer = require("./normalize/region_normalizer");
const _assetMixNormalizer = require("./normalize/asset_mix_normalizer");
const _sectorNormalizer = require("./normalize/sector_normalizer");
const _assetTypeClassifier = require("./classify/asset_type_classifier");
const _subtypeClassifier = require("./classify/subtype_classifier");
const _classificationBuilder = require("./classify/classification_builder");
const _portfolioExposureBuilder = require("./exposure/portfolio_exposure_builder");
const _parseArgs = require("./cli/parse_args");
const _pathResolver = require("./io/path_resolver");
const _fileMover = require("./io/file_mover");
const _parserDryRunArtifact = require("./artifacts/parser_dry_run_artifact");
const _responseParser = require("./gemini/response_parser");

// REFACTOR-1: Function aliases from extracted modules (hoisted here for TDZ safety)
const cleanString = _numberUtils.cleanString;
const isPlainObject = _numberUtils.isPlainObject;
const parseNum = _numberUtils.parseNum;
const clampPct = _numberUtils.clampPct;
const clamp01 = _numberUtils.clamp01;
const approxEqual = _numberUtils.approxEqual;
const normalizeTextForTokens = _textNormalizer.normalizeTextForTokens;
const REGION_MAPPINGS = _regionNormalizer.REGION_MAPPINGS;
const REGION_LOOKUP = _regionNormalizer.REGION_LOOKUP;
const IGNORE_KEYS = _regionNormalizer.IGNORE_KEYS;
const BENIGN_UNKNOWN_REGION_KEYS = _regionNormalizer.BENIGN_UNKNOWN_REGION_KEYS;
const cleanRegionKey = _regionNormalizer.cleanRegionKey;
const normalizeRegions = _regionNormalizer.normalizeRegions;
const hasExcludedJapanRegionText = _regionNormalizer.hasExcludedJapanRegionText;
const hasJapanRegionText = _regionNormalizer.hasJapanRegionText;
const hasLatinAmericaIdentity = _regionNormalizer.hasLatinAmericaIdentity;
const derivePrimaryRegion = _regionNormalizer.derivePrimaryRegion;
const normalizeSectors = _sectorNormalizer.normalizeSectors;
const validateAssetMix = _assetMixNormalizer.validateAssetMix;
const validateChildMapAgainstParent = _assetMixNormalizer.validateChildMapAgainstParent;
const validateCanonicalMath = _assetMixNormalizer.validateCanonicalMath;
const sanitizeAssetMixForExposureBuilder = _assetMixNormalizer.sanitizeAssetMixForExposureBuilder;
const deriveAssetClassFromCategory = _assetTypeClassifier.deriveAssetClassFromCategory;
const deriveAssetSubtype = _subtypeClassifier.deriveAssetSubtype;
const deriveFlags = _subtypeClassifier.deriveFlags;
const normalizeSubtypeByAssetType = _subtypeClassifier.normalizeSubtypeByAssetType;
const topSector = _subtypeClassifier.topSector;
const assetTypeFromDerivedAssetClass = _classificationBuilder.assetTypeFromDerivedAssetClass;
const buildClassificationV2 = _classificationBuilder.buildClassificationV2;
const buildPortfolioExposureV2 = _portfolioExposureBuilder.buildPortfolioExposureV2;

const IS_MAIN = require.main === module;
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PARSER_ROOT = path.join(REPO_ROOT, "MORNINGSTAR_PDF_PARSER");

// ============================
// Args
// ============================
const getArgValueFromArgv = _parseArgs.getArgValueFromArgv;
const getArgValue = _parseArgs.getArgValue;
const hasArg = _parseArgs.hasArg;
const printHelp = _parseArgs.printHelp;
const buildRuntimeOptions = (argv = process.argv.slice(2)) =>
  _parseArgs.buildRuntimeOptions(argv, { parserRoot: PARSER_ROOT });
const validateWriteGates = _parseArgs.validateWriteGates;
const resolvePreferredOrLegacy = _pathResolver.resolvePreferredOrLegacy;

let RUNTIME_OPTIONS;
try {
  RUNTIME_OPTIONS = buildRuntimeOptions(process.argv.slice(2));
} catch (err) {
  if (IS_MAIN) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
  throw err;
}

if (IS_MAIN && process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

validateWriteGates(RUNTIME_OPTIONS);

const DATA_ROOT = path.join(REPO_ROOT, "data");
const LEGACY_BACKUP_ROOT = path.join(__dirname, "BDB_PARSE_BACKUP");
const PARSER_ARTIFACT_ROOT = path.join(PARSER_ROOT, "artifacts");
const PREFERRED_INPUT_DIR = path.join(PARSER_ROOT, "ENTRADA");
const DEFAULT_ARCHIVOS_PROCESADOS_DIR = path.join(PARSER_ROOT, "ARCHIVOS_PROCESADOS");
const DEFAULT_ARCHIVOS_CON_ERROR_DIR = path.join(PARSER_ROOT, "ARCHIVOS_CON_ERROR");
const PREFERRED_PROCESSED_PDF_ROOT = path.join(PARSER_ARTIFACT_ROOT, "processed_pdfs");
const processedArg = getArgValue("--processed");
const errorArg = getArgValue("--error");
const backupRootArg = getArgValue("--backup-root");

const INPUT_DIR = path.resolve(
  getArgValue("--dir") || resolvePreferredOrLegacy(PREFERRED_INPUT_DIR, path.join(REPO_ROOT, "data", "input_pdfs"))
);
const LIMIT = getArgValue("--limit") ? parseInt(getArgValue("--limit"), 10) : null;
const BATCH_ID = getArgValue("--batch") || null;
const RATE_LIMIT_DELAY_MS = 100;
const CONCURRENCY = parseInt(getArgValue("--concurrency") || "10", 10);
const MODEL_NAME = getArgValue("--model") || "gemini-2.5-flash";
const WRITE_REVIEW = RUNTIME_OPTIONS.writeReview;

const PROCESSED_DIR = path.resolve(
  processedArg || resolvePreferredOrLegacy(path.join(PARSER_ARTIFACT_ROOT, "canonical"), path.join(DATA_ROOT, "canonical"))
);
const ERROR_DIR = path.resolve(
  errorArg || resolvePreferredOrLegacy(path.join(PARSER_ARTIFACT_ROOT, "error"), path.join(DATA_ROOT, "error"))
);
const PROCESSED_PDF_ROOT = path.resolve(PREFERRED_PROCESSED_PDF_ROOT);
const PROCESSED_PDF_DIR = path.resolve(
  getArgValue("--processed-pdfs") || DEFAULT_ARCHIVOS_PROCESADOS_DIR
);
const REVIEW_PDF_DIR = path.resolve(
  getArgValue("--review-pdfs") || DEFAULT_ARCHIVOS_PROCESADOS_DIR
);
const ERROR_PDF_DIR = path.resolve(
  getArgValue("--error-pdfs") || DEFAULT_ARCHIVOS_CON_ERROR_DIR
);

[INPUT_DIR, PROCESSED_DIR, ERROR_DIR, PROCESSED_PDF_DIR, REVIEW_PDF_DIR, ERROR_PDF_DIR].forEach((dir) => {
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
  return _pathResolver.resolveBackupDir(newRelativePath, legacyRelativePath, {
    backupRootArg,
    parserArtifactRoot: PARSER_ARTIFACT_ROOT,
    legacyBackupRoot: LEGACY_BACKUP_ROOT,
  });
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
let model = null;

function getGeminiModel() {
  if (!GEMINI_API_KEY) {
    throw new Error("Falta GEMINI_API_KEY en variables de entorno.");
  }
  if (!model) {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: MODEL_NAME });
  }
  return model;
}


// Gemini client is initialized lazily by getGeminiModel() so tests and --help
// do not require credentials or make network/API calls.

// ============================
// Firebase Admin init (LOCAL)
// ============================
// Firebase Admin is initialized lazily with ADC / application default credentials.
// No local JSON key fallback is supported.

function getFirebaseInitOptions(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || undefined;
  const options = {};
  if (projectId) options.projectId = projectId;
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    options.credential = admin.credential.applicationDefault();
  }
  return options;
}

function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp(getFirebaseInitOptions());
    console.log("Firebase Admin initialized with ADC/application default credentials.");
  }
  return admin.app();
}

let db = null;

function getFirestoreDb() {
  if (!db) {
    initializeFirebaseAdmin();
    db = admin.firestore();
  }
  return db;
}

// ============================
// CSV mappings
// ============================
function loadCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return csvParse(raw, { columns: true, skip_empty_lines: true });
}

function getConfigSearchDirs(options = RUNTIME_OPTIONS) {
  return _pathResolver.getConfigSearchDirs(options, {
    repoRoot: REPO_ROOT,
    parserRoot: PARSER_ROOT,
  });
}

function resolveConfigPath(fileName, options = RUNTIME_OPTIONS) {
  return _pathResolver.resolveConfigPath(fileName, options, {
    repoRoot: REPO_ROOT,
    parserRoot: PARSER_ROOT,
  });
}

const configPathsResolved = {};
const SECTOR_MAP_PATH = resolveConfigPath("subcategory_sectors_mapping.csv");
const TOKEN_MAP_PATH = resolveConfigPath("subcategory_tokens_mapping.csv");
configPathsResolved.subcategory_sectors_mapping = SECTOR_MAP_PATH;
configPathsResolved.subcategory_tokens_mapping = TOKEN_MAP_PATH;


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

const ensureDir = _fileMover.ensureDir;
const uniqueDestPath = _fileMover.uniqueDestPath;
const moveFileSafe = _fileMover.moveFileSafe;
const moveFileSafeIfNeeded = _fileMover.moveFileSafeIfNeeded;
const timestampForFileName = _fileMover.timestampForFileName;
const sanitizePdfFileNamePart = _fileMover.sanitizePdfFileNamePart;
const isPathInside = _fileMover.isPathInside;
const uniquePdfPathForIsin = _fileMover.uniquePdfPathForIsin;
const uniqueErrorPdfPath = _fileMover.uniqueErrorPdfPath;
const safeMoveToExactPath = _fileMover.safeMoveToExactPath;

function buildFileMovePlan(args = {}) {
  return _fileMover.buildFileMovePlan({
    processedDir: PROCESSED_PDF_DIR,
    errorDir: ERROR_PDF_DIR,
    pipelineStatus: PIPELINE_STATUS,
    ...args,
  });
}

function moveProcessedPdfAfterRouting(args = {}) {
  return _fileMover.moveProcessedPdfAfterRouting({
    inputDir: INPUT_DIR,
    inputDirExplicit: RUNTIME_OPTIONS.inputDirExplicit,
    processedDir: PROCESSED_PDF_DIR,
    errorDir: ERROR_PDF_DIR,
    preferredInputDir: PREFERRED_INPUT_DIR,
    pipelineStatus: PIPELINE_STATUS,
    ...args,
  });
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


function buildStableBaseName({ isin, reportDate, pdfBuffer, originalFileName }) {
  const hash8 = shortHash(pdfBuffer, 8);
  const safeIsin = cleanString(isin) || path.basename(originalFileName, path.extname(originalFileName));
  const safeDate = reportDate || "unknown_date";
  return 
`${safeIsin}__${safeDate}__${hash8}`;
}


const validateRawLlMSchema = _responseParser.validateRawLlMSchema;


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

  m1 = s.match(/^(\d{1,2})\s+de\s+([a-zÃƒÂ¡ÃƒÂ©ÃƒÂ­ÃƒÂ³ÃƒÂº]+)\s+de\s+(\d{4})$/i);
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
// Derived classification helpers
// ============================
function deriveSubcategories(msSectors, name, category, objective = "") {
  return _subtypeClassifier.deriveSubcategories(msSectors, name, category, objective, {
    sectorKeyToTag,
    tokenMatchers,
    parseNum,
    normalizeTextForTokens,
  });
}

const stripCodeFences = _responseParser.stripCodeFences;
const extractFirstBalancedJsonObject = _responseParser.extractFirstBalancedJsonObject;
const repairJsonCandidate = _responseParser.repairJsonCandidate;
const CRITICAL_GEMINI_KEYS = _responseParser.CRITICAL_GEMINI_KEYS;
const hasAnyCriticalGeminiKey = _responseParser.hasAnyCriticalGeminiKey;
const unwrapGeminiRootObject = _responseParser.unwrapGeminiRootObject;
const parseGeminiJsonResponse = _responseParser.parseGeminiJsonResponse;

// ============================
// Gemini extraction
// ============================
async function extraerMSConGemini(textoPDF) {
  const geminiModel = getGeminiModel();
  const textoSeguro = (textoPDF || "").slice(0, 240000);

  const prompt = `
Devuelve SOLO JSON vÃƒÂ¡lido (sin markdown, sin comentarios).
El PDF es un informe Morningstar de 1 pÃƒÂ¡gina (ES). Extrae SOLO estos campos si existen:

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

- rating_stars es el "Rating MorningstarÃ¢â€žÂ¢" (estrellas 1..5).
- category_morningstar debe ser el texto de categorÃƒÂ­a Morningstar mÃƒÂ¡s exacto posible (sin traducir ni inventar).
- Todos los porcentajes deben ser numÃƒÂ©ricos en escala 0..100 (sin sÃƒÂ­mbolo %).
- No inventes valores: si falta un dato, usa null.
- Evita campos agregados inventados: no aÃƒÂ±adas "total" en sectors o regions.
- En fixed_income prioriza: effective_duration, avg_credit_quality, credit_quality, maturity_allocation.
- Devuelve un ÃƒÂºnico objeto JSON en la raÃƒÂ­z (no array y sin wrappers tipo data/result/output).
- Incluye SIEMPRE en la raÃƒÂ­z: category_morningstar, asset_allocation, regions_detail, sectors, equity_style y fixed_income.
- Si no puedes completar un bloque, usa {} para objetos de distribuciÃƒÂ³n y null para escalares; no inventes sumas.
- NO extraigas: TER, retrocesiones, comisiÃƒÂ³n de entrada o salida.
- NO extraigas: fecha creaciÃƒÂ³n, gestor, fecha incorporaciÃƒÂ³n, VL/fecha VL, domicilio, UCITS.
- Si algo no estÃƒÂ¡, pon null.

TEXTO:
"""${textoSeguro}"""
`.trim();

  const MAX_RETRIES = 6;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      if (RATE_LIMIT_DELAY_MS > 0) await sleep(RATE_LIMIT_DELAY_MS);

      let result;
      try {
        result = await geminiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        });
      } catch (_) {
        result = await geminiModel.generateContent(prompt);
      }
      const response = await result.response;
      const text = response.text().trim();
      return parseGeminiJsonResponse(text);
    } catch (e) {
      if (i === MAX_RETRIES - 1) throw e;
      await sleep(1200 * (i + 1));
    }
  }

  throw new Error("Gemini no devolviÃƒÂ³ JSON vÃƒÂ¡lido.");
}

// ============================
// Globals for batch
// ============================
const manifestEntries = [];
const errorEntries = [];
const reviewEntries = [];
const parserDryRunProposals = [];
const fileMoveEntries = [];

const serializeForArtifact = _parserDryRunArtifact.serializeForArtifact;
const hasManualField = _parserDryRunArtifact.hasManualField;
const assertNoManualFields = _parserDryRunArtifact.assertNoManualFields;

function recordDryRunProposal(args) {
  return _parserDryRunArtifact.recordDryRunProposal(args, parserDryRunProposals);
}

function recordFileMove(entry) {
  return _parserDryRunArtifact.recordFileMove(entry, fileMoveEntries);
}

function findLatestManifestEntryForFile(fileName) {
  return _parserDryRunArtifact.findLatestManifestEntryForFile(fileName, manifestEntries);
}

function buildParserDryRunArtifact({ files, ok, review, fail }) {
  return _parserDryRunArtifact.buildParserDryRunArtifact({
    files,
    ok,
    review,
    fail,
    parserDryRunProposals,
    fileMoveEntries,
    reviewEntries,
    errorEntries,
    configPathsResolved,
  });
}

function writeParserDryRunArtifact({ files, ok, review, fail }, outputDir = RUNTIME_OPTIONS.outputDir) {
  return _parserDryRunArtifact.writeParserDryRunArtifact({
    files,
    ok,
    review,
    fail,
    outputDir,
    parserDryRunProposals,
    fileMoveEntries,
    reviewEntries,
    errorEntries,
    configPathsResolved,
    ensureDir,
    writeJsonPretty,
  });
}

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
async function processPdfFile(fileName, writer, runtimeOptions = RUNTIME_OPTIONS) {
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

  const classification_v2 = buildClassificationV2({
    derivedAssetClass: derived_asset_class,
    assetSubtype,
    ms,
    derivedPrimaryRegion: derived_primary_region,
    styleBoxCell,
    sizeBucket: size_bucket,
    fixedIncomeType,
    creditBucket,
    durationBucket,
    subcats,
    flags,
    confidence,
  });

  const sanitizedMix = sanitizeAssetMixForExposureBuilder(ms.portfolio?.asset_allocation || null);

  const portfolio_exposure_v2 = buildPortfolioExposureV2({
    sanitizedMix,
    equityRegionsTotal: equity_regions_total,
    equitySectorsTotal: equity_sectors_total,
    styleWeightsTotal: style_weights_total,
    sizeWeightsTotal: size_weights_total,
    fixedIncomeType,
    creditBucket,
    durationBucket,
    classificationV2: classification_v2,
    confidence,
  });

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
      reportDate: reportDateIso,
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
  };

  assertNoManualFields(doc);
  recordDryRunProposal({ isin, fileName, doc, routing });

  if (
    runtimeOptions.writeEnabled &&
    (routing.status === PIPELINE_STATUS.OK ||
      (routing.status === PIPELINE_STATUS.REVIEW && WRITE_REVIEW))
  ) {
    if (!writer) throw new Error("WRITE_BLOCKED: Firestore writer unavailable.");
    const ref = getFirestoreDb().collection("funds_v3").doc(isin);
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
    reportDate: reportDateIso,
    processedPdfFileName: `${stableBaseName}.pdf`,
  };
}

// ============================
// Main
// ============================
async function main() {
  console.log(
    RUNTIME_OPTIONS.dryRun
      ? "DRY_RUN_ONLY: Firestore writes are disabled. Use --write --confirm-write for future writes."
      : "WRITE_MODE_CONFIRMED: Firestore writes enabled by explicit flags."
  );

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Ã¢ÂÅ’ No existe carpeta: ${INPUT_DIR}`);
    process.exit(1);
  }

  let files = fs.readdirSync(INPUT_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (RUNTIME_OPTIONS.onlyIsin) {
    files = files.filter((f) => f.toUpperCase().includes(RUNTIME_OPTIONS.onlyIsin));
  }
  if (LIMIT && Number.isFinite(LIMIT)) files = files.slice(0, LIMIT);

  if (!files.length) {
    console.log("Ã¢â€žÂ¹Ã¯Â¸Â No hay PDFs para procesar.");
    if (RUNTIME_OPTIONS.dryRun) {
      const { artifactPath } = writeParserDryRunArtifact({ files, ok: 0, review: 0, fail: 0 });
      console.log(`Dry-run artifact: ${artifactPath}`);
    }
    return 0;
  }

  console.log(`Ã°Å¸â€œÂ¦ PDFs: ${files.length} | concurrency=${CONCURRENCY}${BATCH_ID ? ` | batch=${BATCH_ID}` : ""}`);
  console.log(`Ã°Å¸Â¤â€“ Gemini model: ${MODEL_NAME}`);

  let writer = null;
  if (RUNTIME_OPTIONS.writeEnabled) {
    writer = getFirestoreDb().bulkWriter();
  writer.onWriteError((err) => {
    if (err.failedAttempts < 3) return true;
    console.error("Ã¢ÂÅ’ BulkWriter error:", err);
    return false;
  });
  }

  const limit = pLimit(CONCURRENCY);
  let ok = 0;
  let fail = 0;
  let review = 0;

  const tasks = files.map((f) =>
    limit(async () => {
      try {
        const r = await processPdfFile(f, writer, RUNTIME_OPTIONS);
        if (r.routingStatus === PIPELINE_STATUS.REVIEW) {
          review++;
          console.log(`Ã°Å¸Å¸Â¡ ${r.fileName} -> ${r.isin} [REVIEW]`);
          recordFileMove(
            moveProcessedPdfAfterRouting({
              fileName: f,
              originalPdfPath: path.join(INPUT_DIR, f),
              routingStatus: r.routingStatus,
              detectedIsin: r.isin,
              reportDate: r.reportDate,
              moveFiles: RUNTIME_OPTIONS.moveFiles,
              inputDir: INPUT_DIR,
              inputDirExplicit: RUNTIME_OPTIONS.inputDirExplicit,
              processedDir: REVIEW_PDF_DIR,
              errorDir: ERROR_PDF_DIR,
            })
          );
        } else if (r.routingStatus === PIPELINE_STATUS.OK) {
          ok++;
          console.log(`Ã¢Å“â€¦ ${r.fileName} -> ${r.isin}`);
          recordFileMove(
            moveProcessedPdfAfterRouting({
              fileName: f,
              originalPdfPath: path.join(INPUT_DIR, f),
              routingStatus: r.routingStatus,
              detectedIsin: r.isin,
              reportDate: r.reportDate,
              moveFiles: RUNTIME_OPTIONS.moveFiles,
              inputDir: INPUT_DIR,
              inputDirExplicit: RUNTIME_OPTIONS.inputDirExplicit,
              processedDir: PROCESSED_PDF_DIR,
              errorDir: ERROR_PDF_DIR,
            })
          );
        } else {
          fail++;
          console.error(`Ã¢ÂÅ’ ${r.fileName} -> ${r.isin} [${r.routingStatus}] ${r.routingReason || ""}`.trim());
          recordFileMove(
            moveProcessedPdfAfterRouting({
              fileName: f,
              originalPdfPath: path.join(INPUT_DIR, f),
              routingStatus: r.routingStatus,
              detectedIsin: r.isin,
              reportDate: r.reportDate,
              moveFiles: RUNTIME_OPTIONS.moveFiles,
              inputDir: INPUT_DIR,
              inputDirExplicit: RUNTIME_OPTIONS.inputDirExplicit,
              processedDir: PROCESSED_PDF_DIR,
              errorDir: ERROR_PDF_DIR,
            })
          );
        }
      } catch (e) {
        fail++;
        console.error(`Ã¢ÂÅ’ ${f}: ${e.message}`);
        const manifestEntry = findLatestManifestEntryForFile(f);
        recordFileMove(
          moveProcessedPdfAfterRouting({
            fileName: f,
            originalPdfPath: path.join(INPUT_DIR, f),
            routingStatus: manifestEntry?.status || PIPELINE_STATUS.ERROR_PROCESSING,
            detectedIsin: manifestEntry?.isin || null,
            reportDate: manifestEntry?.report_date || null,
            moveFiles: RUNTIME_OPTIONS.moveFiles,
            inputDir: INPUT_DIR,
            inputDirExplicit: RUNTIME_OPTIONS.inputDirExplicit,
            processedDir: PROCESSED_PDF_DIR,
            errorDir: ERROR_PDF_DIR,
          })
        );
      }
    })
  );

  await Promise.all(tasks);
  if (writer) await writer.close();

  const batchManifest = {
    batch_id: BATCH_ID || new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"),
    parser_version: `ms_pdf_v5_${MODEL_NAME}`,
    generated_at: new Date().toISOString(),
    total_files: files.length,
    ok_count: ok,
    review_count: review,
    error_count: fail,
    dry_run: RUNTIME_OPTIONS.dryRun,
    would_write: RUNTIME_OPTIONS.writeEnabled,
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

  console.log(`\nÃ¢Å“â€¦ FIN | OK=${ok} | REVIEW=${review} | ERROR=${fail}`);
  if (RUNTIME_OPTIONS.dryRun) {
    const { artifactPath } = writeParserDryRunArtifact({ files, ok, review, fail });
    console.log(`Dry-run artifact: ${artifactPath}`);
  }
  return fail ? 2 : 0;
}

module.exports = {
  buildRuntimeOptions,
  validateWriteGates,
  getConfigSearchDirs,
  resolveConfigPath,
  getFirebaseInitOptions,
  assertNoManualFields,
  hasManualField,
  serializeForArtifact,
  normalizeTextForTokens,
  hasExcludedJapanRegionText,
  derivePrimaryRegion,
  buildParserDryRunArtifact,
  writeParserDryRunArtifact,
  recordDryRunProposal,
  recordFileMove,
  buildFileMovePlan,
  moveProcessedPdfAfterRouting,
  uniquePdfPathForIsin,
  uniqueErrorPdfPath,
  configPathsResolved,
  RUNTIME_OPTIONS,

  // --- Temporary exports for REFACTOR-0 golden tests (pure functions) ---
  // Will be removed once modules are extracted in REFACTOR-1.
  deriveAssetClassFromCategory,
  deriveAssetSubtype,
  deriveSubcategories,
  deriveFlags,
  normalizeSubtypeByAssetType,
  assetTypeFromDerivedAssetClass,
  buildClassificationV2,
  buildPortfolioExposureV2,
  normalizeRegions,
  normalizeSectors,
  normalizeFixedIncome,
  sanitizeAssetMixForExposureBuilder,
  validateAssetMix,
  validateCanonicalMath,
  decidePipelineStatus,
  validateRawLlMSchema,
  parseGeminiJsonResponse,
  parseStyleBoxCell,
  cleanString,
  parseNum,
  clampPct,
  clamp01,
  approxEqual,
};

if (IS_MAIN) {
  main()
    .then((code) => process.exit(code || 0))
    .catch((err) => {
      console.error(`ERROR: ${err.message}`);
      process.exit(1);
    });
}
