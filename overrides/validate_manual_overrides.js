#!/usr/bin/env node
"use strict";

/**
 * Institutional validator for manual override layer:
 * 04_canonical -> 05_overrides -> 04_canonical_final
 *
 * Scope:
 * - Validates only manual override JSON files.
 * - Does NOT parse PDFs.
 * - Does NOT call Gemini.
 * - Does NOT modify parser/pipeline architecture.
 */

const fs = require("fs");
const path = require("path");
const minimist = require("minimist");

const START_MS = Date.now();

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["strict", "fail-on-warning", "quiet", "help"],
    string: ["canonical-dir", "overrides-dir", "manifest-dir", "logs-dir"],
    alias: {
      h: "help",
    },
    default: {
      strict: false,
      "fail-on-warning": false,
      quiet: false,
    },
  });
  return argv;
}

function printHelp() {
  console.log(`
Usage:
  node validate_manual_overrides.js [options]

Options:
  --strict                Escala ciertos warnings de coherencia a error.
  --canonical-dir <dir>   Directorio canonical (default: ./data/canonical)
  --overrides-dir <dir>   Directorio 05_overrides (default: ./overrides/05_overrides)
  --manifest-dir <dir>    Salida de manifiestos (default: ./data/work/manifests)
  --logs-dir <dir>        Salida de logs (default: ./data/work/logs)
  --fail-on-warning       Exit code 2 si no hay errores pero si warnings.
  --quiet                 Reduce salida por consola.
  --help, -h              Muestra esta ayuda.
`.trim());
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolvePreferredOrLegacy(preferredPath, legacyPath) {
  if (fs.existsSync(preferredPath)) return preferredPath;
  if (legacyPath && fs.existsSync(legacyPath)) return legacyPath;
  return preferredPath;
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return { ok: true, value: JSON.parse(normalized) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

function listJsonFiles(dirPath, { recursive = true, skipDirNames = [] } = {}) {
  if (!fs.existsSync(dirPath)) return { files: [], skippedDirs: [] };
  const files = [];
  const skippedDirs = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirNames.includes(entry.name)) {
          skippedDirs.push(full);
          continue;
        }
        if (recursive) walk(full);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        files.push(full);
      }
    }
  }

  walk(dirPath);
  files.sort((a, b) => a.localeCompare(b));
  return { files, skippedDirs };
}

function toRelative(filePath) {
  return path.relative(process.cwd(), filePath) || filePath;
}

function isoNow() {
  return new Date().toISOString();
}

function fileStamp(d = new Date()) {
  return d.toISOString().replace(/[:.]/g, "-");
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isNullableString(v) {
  return v === null || typeof v === "string";
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function inRange(v, min, max) {
  return isFiniteNumber(v) && v >= min && v <= max;
}

function approxEq(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

function deepEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function typeName(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function isIsoDateTimeString(v) {
  if (typeof v !== "string") return false;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(v);
}

function getByPath(obj, dotPath) {
  if (!dotPath) return { exists: true, value: obj };
  const parts = String(dotPath).split(".");
  let cur = obj;
  for (const part of parts) {
    if (!isPlainObject(cur) && !Array.isArray(cur)) {
      return { exists: false, value: undefined };
    }
    if (!(part in cur)) {
      return { exists: false, value: undefined };
    }
    cur = cur[part];
  }
  return { exists: true, value: cur };
}

function parentPath(dotPath) {
  const parts = String(dotPath).split(".");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join(".");
}

function formatIssue(issue) {
  const where = issue.operation_index !== undefined ? ` op#${issue.operation_index}` : "";
  return `[${issue.code}]${where} ${issue.message}`;
}

function makeIssueBag(strict) {
  const errors = [];
  const warnings = [];
  return {
    errors,
    warnings,
    error(code, message, extra = {}) {
      errors.push({ level: "error", code, message, ...extra });
    },
    warning(code, message, extra = {}) {
      const strictAsError = Boolean(extra.strictAsError);
      if (strict && strictAsError) {
        errors.push({ level: "error", code, message, escalated_from: "warning", ...extra });
        return;
      }
      warnings.push({ level: "warning", code, message, ...extra });
    },
  };
}

const TOP_LEVEL_REQUIRED = [
  "schema_version",
  "override_id",
  "isin",
  "status",
  "author",
  "created_at",
  "reason",
  "operations",
];

const TOP_LEVEL_ALLOWED = new Set([
  "schema_version",
  "override_id",
  "isin",
  "status",
  "author",
  "approved_by",
  "created_at",
  "approved_at",
  "reason",
  "notes",
  "operations",
]);

const OP_REQUIRED = ["op", "path", "reason"];
const OP_ALLOWED = new Set(["op", "path", "value", "reason"]);

const STATUS_ENUM = new Set(["draft", "approved", "rejected", "deprecated"]);
const ALLOWED_OPS = new Set(["set", "unset", "append_unique", "remove_values"]);

const ASSET_TYPE_ENUM = new Set([
  "equity",
  "fixed_income",
  "allocation",
  "money_market",
  "alternative",
  "real_asset",
  "other",
]);

const ASSET_SUBTYPE_ENUM = new Set([
  "GLOBAL_EQUITY",
  "US_EQUITY",
  "EUROPE_EQUITY",
  "EUROZONE_EQUITY",
  "JAPAN_EQUITY",
  "ASIA_PACIFIC_EQUITY",
  "EMERGING_MARKETS_EQUITY",
  "GLOBAL_SMALL_CAP_EQUITY",
  "GLOBAL_INCOME_EQUITY",
  "SECTOR_EQUITY_TECH",
  "SECTOR_EQUITY_HEALTHCARE",
  "THEMATIC_EQUITY",
  "GOVERNMENT_BOND",
  "CORPORATE_BOND",
  "HIGH_YIELD_BOND",
  "INFLATION_LINKED_BOND",
  "EMERGING_MARKETS_BOND",
  "CONVERTIBLE_BOND",
  "CONSERVATIVE_ALLOCATION",
  "MODERATE_ALLOCATION",
  "AGGRESSIVE_ALLOCATION",
  "FLEXIBLE_ALLOCATION",
  "MULTI_ASSET_INCOME",
  "TARGET_DATE",
  "UNKNOWN",
  "unknown",
]);

const VEHICLE_COMPLEXITY_ENUM = new Set(["plain_vanilla", "thematic", "sector", "active"]);
const PATH_SEGMENT_RE = /^[A-Za-z0-9_:-]+$/;
const STRATEGY_TAG_RE = /^(theme|sector|sector_concentrated):[A-Za-z0-9_:-]+$/;
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const OVR_ID_RE = /^OVR-\d{4}-\d{4,}$/;

const PROHIBITED_PATHS = [
  /^isin$/,
  /^name$/,
  /^currency$/,
  /^fileName$/,
  /^stableBaseName$/,
  /^report_date$/,
  /^generated_at$/,
  /^ms(\.|$)/,
  /^raw_text(\.|$)/,
  /^raw_llm(\.|$)/,
  /^parsed_ms(\.|$)/,
  /^parser_metadata(\.|$)/,
  /^source_pdf(\.|$)/,
  /^quality(\.|$)/,
  /^validation(\.|$)/,
  /^routing(\.|$)/,
  /^classification_v2\.version$/,
  /^portfolio_exposure_v2\.version$/,
];

function validateNumericMap(value, { allowNull = true, min = 0, max = 100, requireNonEmpty = false } = {}) {
  if (value === null && allowNull) return null;
  if (!isPlainObject(value)) return "debe ser objeto de pares clave:number";
  const keys = Object.keys(value);
  if (requireNonEmpty && keys.length === 0) return "no puede ser objeto vacio";
  for (const k of keys) {
    if (!PATH_SEGMENT_RE.test(k)) return `clave invalida '${k}'`;
    if (!inRange(value[k], min, max)) return `valor invalido en '${k}' (esperado ${min}..${max})`;
  }
  return null;
}

function validateArrayOfStrings(value, { allowNull = false, requireNonEmpty = false } = {}) {
  if (value === null && allowNull) return null;
  if (!Array.isArray(value)) return "debe ser un array de strings";
  if (requireNonEmpty && value.length === 0) return "no puede ser array vacio";
  for (const item of value) {
    if (!isNonEmptyString(item)) return "contiene elementos no string o vacios";
  }
  return null;
}

const PATH_RULES = [
  {
    pattern: /^classification_v2\.asset_type$/,
    validateValue: (v) => (typeof v === "string" && ASSET_TYPE_ENUM.has(v) ? null : "asset_type invalido"),
  },
  {
    pattern: /^classification_v2\.asset_subtype$/,
    validateValue: (v) => (typeof v === "string" && ASSET_SUBTYPE_ENUM.has(v) ? null : "asset_subtype invalido"),
  },
  {
    pattern: /^classification_v2\.commercial_type$/,
    validateValue: (v) => (isNullableString(v) ? null : "commercial_type debe ser string|null"),
  },
  {
    pattern: /^classification_v2\.region_primary$/,
    validateValue: (v) => (isNonEmptyString(v) ? null : "region_primary debe ser string no vacio"),
  },
  {
    pattern: /^classification_v2\.region_secondary$/,
    validateValue: (v) => (isNullableString(v) ? null : "region_secondary debe ser string|null"),
  },
  {
    pattern: /^classification_v2\.equity_style_box$/,
    validateValue: (v) => (isNullableString(v) ? null : "equity_style_box debe ser string|null"),
  },
  {
    pattern: /^classification_v2\.market_cap_bias$/,
    validateValue: (v) => (isNullableString(v) ? null : "market_cap_bias debe ser string|null"),
  },
  {
    pattern: /^classification_v2\.fixed_income_type$/,
    validateValue: (v) => (isNullableString(v) ? null : "fixed_income_type debe ser string|null"),
  },
  {
    pattern: /^classification_v2\.credit_bucket$/,
    validateValue: (v) => (isNullableString(v) ? null : "credit_bucket debe ser string|null"),
  },
  {
    pattern: /^classification_v2\.duration_bucket$/,
    validateValue: (v) => (isNullableString(v) ? null : "duration_bucket debe ser string|null"),
  },
  {
    pattern: /^classification_v2\.strategy_tags$/,
    validateValue: (v) => {
      const err = validateArrayOfStrings(v);
      if (err) return err;
      for (const tag of v) {
        if (!STRATEGY_TAG_RE.test(tag)) {
          return "strategy_tags contiene tags con formato no permitido";
        }
      }
      return null;
    },
  },
  {
    pattern: /^classification_v2\.vehicle_complexity$/,
    validateValue: (v) =>
      typeof v === "string" && VEHICLE_COMPLEXITY_ENUM.has(v) ? null : "vehicle_complexity invalido",
  },
  {
    pattern: /^classification_v2\.classification_confidence$/,
    validateValue: (v) => (inRange(v, 0, 1) ? null : "classification_confidence debe estar en 0..1"),
  },
  {
    pattern: /^classification_v2\.sources_used$/,
    validateValue: (v) => validateArrayOfStrings(v),
  },
  {
    pattern: /^classification_v2\.warnings$/,
    validateValue: (v) => validateArrayOfStrings(v),
  },
  {
    pattern: /^portfolio_exposure_v2\.asset_mix$/,
    validateValue: (v) => {
      if (!isPlainObject(v)) return "asset_mix debe ser objeto";
      const keys = ["equity", "bond", "cash", "other"];
      for (const k of keys) {
        if (!(k in v)) return `asset_mix requiere clave '${k}'`;
        if (!inRange(v[k], 0, 1)) return `asset_mix.${k} debe estar en 0..1`;
      }
      const sum = keys.reduce((acc, k) => acc + Number(v[k]), 0);
      if (!approxEq(sum, 1, 0.02)) return "asset_mix debe sumar aproximadamente 1.0 (+/-0.02)";
      return null;
    },
  },
  {
    pattern: /^portfolio_exposure_v2\.asset_mix\.(equity|bond|cash|other)$/,
    validateValue: (v) => (inRange(v, 0, 1) ? null : "asset_mix.* debe estar en 0..1"),
  },
  {
    pattern: /^portfolio_exposure_v2\.equity_regions$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 100 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.equity_regions\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 100) ? null : "equity_regions.* debe estar en 0..100"),
  },
  {
    pattern: /^portfolio_exposure_v2\.sectors$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 100 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.sectors\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 100) ? null : "sectors.* debe estar en 0..100"),
  },
  {
    pattern: /^portfolio_exposure_v2\.equity_styles$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 100 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.equity_styles\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 100) ? null : "equity_styles.* debe estar en 0..100"),
  },
  {
    pattern: /^portfolio_exposure_v2\.market_caps$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 100 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.market_caps\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 100) ? null : "market_caps.* debe estar en 0..100"),
  },
  {
    pattern: /^portfolio_exposure_v2\.bond_types$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 1 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.bond_types\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 1) ? null : "bond_types.* debe estar en 0..1"),
  },
  {
    pattern: /^portfolio_exposure_v2\.credit$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 1 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.credit\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 1) ? null : "credit.* debe estar en 0..1"),
  },
  {
    pattern: /^portfolio_exposure_v2\.duration$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 1 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.duration\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 1) ? null : "duration.* debe estar en 0..1"),
  },
  {
    pattern: /^portfolio_exposure_v2\.alternatives$/,
    validateValue: (v) => validateNumericMap(v, { min: 0, max: 1 }),
  },
  {
    pattern: /^portfolio_exposure_v2\.alternatives\.[A-Za-z0-9_:-]+$/,
    validateValue: (v) => (inRange(v, 0, 1) ? null : "alternatives.* debe estar en 0..1"),
  },
  {
    pattern: /^portfolio_exposure_v2\.exposure_confidence$/,
    validateValue: (v) => (inRange(v, 0, 1) ? null : "exposure_confidence debe estar en 0..1"),
  },
  {
    pattern: /^portfolio_exposure_v2\.warnings$/,
    validateValue: (v) => validateArrayOfStrings(v),
  },
  {
    pattern: /^eligibility\.[A-Za-z0-9_:-]+(\.[A-Za-z0-9_:-]+)*$/,
    validateValue: () => null,
  },
  {
    pattern: /^quality_flags\.[A-Za-z0-9_:-]+(\.[A-Za-z0-9_:-]+)*$/,
    validateValue: () => null,
  },
  {
    pattern: /^manual_notes\.[A-Za-z0-9_:-]+(\.[A-Za-z0-9_:-]+)*$/,
    validateValue: () => null,
  },
  {
    pattern: /^derived\.[A-Za-z0-9_:-]+(\.[A-Za-z0-9_:-]+)*$/,
    validateValue: () => null,
  },
];

function parseOverridePath(rawPath) {
  if (typeof rawPath !== "string") {
    return { ok: false, message: "path debe ser string" };
  }
  const pathTrimmed = rawPath.trim();
  if (!pathTrimmed) {
    return { ok: false, message: "path no puede ser vacio" };
  }
  const parts = pathTrimmed.split(".");
  if (parts.length < 2) {
    return { ok: false, message: "path debe tener al menos un nivel raiz y un campo" };
  }
  for (const part of parts) {
    if (!PATH_SEGMENT_RE.test(part)) {
      return { ok: false, message: `segmento invalido '${part}'` };
    }
    if (part === "__proto__" || part === "constructor" || part === "prototype") {
      return { ok: false, message: `segmento prohibido '${part}'` };
    }
  }
  return { ok: true, path: pathTrimmed, parts };
}

function isProhibitedPath(pathStr) {
  return PROHIBITED_PATHS.some((re) => re.test(pathStr));
}

function findPathRule(pathStr) {
  for (const rule of PATH_RULES) {
    if (rule.pattern.test(pathStr)) return rule;
  }
  return null;
}

function loadCanonicalIndex(canonicalDir, strict) {
  const issues = makeIssueBag(strict);
  const index = new Map();
  const scan = listJsonFiles(canonicalDir, { recursive: true, skipDirNames: [] });
  const files = scan.files;

  if (!fs.existsSync(canonicalDir)) {
    issues.warning(
      "canonical_dir_missing",
      `Directorio canonical no existe: ${canonicalDir}`,
      { strictAsError: false }
    );
    return { index, files_scanned: 0, issues };
  }

  for (const filePath of files) {
    const parsed = readJsonSafe(filePath);
    if (!parsed.ok) {
      issues.warning("canonical_json_parse_error", `No se pudo parsear canonical: ${toRelative(filePath)} (${parsed.error.message})`, {
        strictAsError: true,
      });
      continue;
    }
    const doc = parsed.value;
    if (!isPlainObject(doc)) {
      issues.warning("canonical_not_object", `Canonical no es objeto: ${toRelative(filePath)}`, {
        strictAsError: true,
      });
      continue;
    }
    const isinRaw = typeof doc.isin === "string" ? doc.isin.trim().toUpperCase() : "";
    if (!ISIN_RE.test(isinRaw)) {
      issues.warning("canonical_invalid_isin", `Canonical sin ISIN valido: ${toRelative(filePath)}`, {
        strictAsError: true,
      });
      continue;
    }
    if (index.has(isinRaw)) {
      const prev = index.get(isinRaw);
      issues.warning(
        "canonical_duplicate_isin",
        `ISIN duplicado en canonical (${isinRaw}): ${toRelative(prev.file)} y ${toRelative(filePath)}`,
        { strictAsError: true }
      );
      continue;
    }
    index.set(isinRaw, { file: filePath, doc });
  }

  return { index, files_scanned: files.length, issues };
}

function validateTopLevelSchemaLike(doc, bag) {
  if (!isPlainObject(doc)) {
    bag.error("override_not_object", "El JSON de override debe ser un objeto");
    return;
  }

  for (const req of TOP_LEVEL_REQUIRED) {
    if (!(req in doc)) {
      bag.error("missing_required_field", `Falta campo obligatorio '${req}'`);
    }
  }

  for (const key of Object.keys(doc)) {
    if (!TOP_LEVEL_ALLOWED.has(key)) {
      bag.error("unknown_top_level_field", `Campo no permitido '${key}'`);
    }
  }

  if (doc.schema_version !== "1.0") {
    bag.error("invalid_schema_version", "schema_version debe ser exactamente '1.0'");
  }

  if (!isNonEmptyString(doc.override_id) || !OVR_ID_RE.test(doc.override_id)) {
    bag.error("invalid_override_id", "override_id invalido (esperado formato OVR-YYYY-NNNN)");
  }

  if (!isNonEmptyString(doc.isin) || !ISIN_RE.test(doc.isin.trim().toUpperCase())) {
    bag.error("invalid_isin", "isin invalido (esperado formato ISIN estandar)");
  }

  if (!STATUS_ENUM.has(doc.status)) {
    bag.error("invalid_status", `status invalido '${doc.status}'. Permitidos: ${Array.from(STATUS_ENUM).join(", ")}`);
  }

  if (!isNonEmptyString(doc.author)) {
    bag.error("invalid_author", "author debe ser string no vacio");
  }

  if (!isIsoDateTimeString(doc.created_at)) {
    bag.error("invalid_created_at", "created_at debe ser fecha ISO 8601 valida");
  }

  if (!isNonEmptyString(doc.reason)) {
    bag.error("invalid_reason", "reason debe ser string no vacio");
  }

  if ("notes" in doc && !(doc.notes === null || typeof doc.notes === "string")) {
    bag.error("invalid_notes", "notes debe ser string|null");
  }

  if (doc.status === "approved") {
    if (!isNonEmptyString(doc.approved_by)) {
      bag.error("missing_approved_by", "status=approved requiere approved_by");
    }
    if (!isIsoDateTimeString(doc.approved_at)) {
      bag.error("missing_approved_at", "status=approved requiere approved_at ISO valido");
    }
    if (isIsoDateTimeString(doc.created_at) && isIsoDateTimeString(doc.approved_at)) {
      const created = new Date(doc.created_at).getTime();
      const approved = new Date(doc.approved_at).getTime();
      if (approved < created) {
        bag.warning("approved_before_created", "approved_at es anterior a created_at", { strictAsError: true });
      }
    }
  } else {
    if ("approved_by" in doc && !isNullableString(doc.approved_by)) {
      bag.error("invalid_approved_by", "approved_by debe ser string|null");
    }
    if ("approved_at" in doc && doc.approved_at !== null && !isIsoDateTimeString(doc.approved_at)) {
      bag.error("invalid_approved_at", "approved_at debe ser ISO 8601 o null");
    }
    bag.warning("status_not_approved", "El override no esta en estado 'approved'", { strictAsError: false });
  }

  if (!Array.isArray(doc.operations)) {
    bag.error("invalid_operations_type", "operations debe ser array");
    return;
  }

  if (doc.operations.length === 0) {
    bag.error("operations_empty", "operations no puede estar vacio");
  }
}

function validateOperation(op, opIndex, bag, canonicalDoc) {
  if (!isPlainObject(op)) {
    bag.error("operation_not_object", "Cada operacion debe ser un objeto", { operation_index: opIndex });
    return;
  }

  for (const req of OP_REQUIRED) {
    if (!(req in op)) {
      bag.error("operation_missing_field", `Operacion sin campo requerido '${req}'`, { operation_index: opIndex });
    }
  }

  for (const key of Object.keys(op)) {
    if (!OP_ALLOWED.has(key)) {
      bag.error("operation_unknown_field", `Campo no permitido en operacion '${key}'`, { operation_index: opIndex });
    }
  }

  if (!ALLOWED_OPS.has(op.op)) {
    bag.error("operation_not_allowed", `Operacion no permitida '${op.op}'. Permitidas: ${Array.from(ALLOWED_OPS).join(", ")}`, {
      operation_index: opIndex,
    });
    return;
  }

  if (!isNonEmptyString(op.reason)) {
    bag.error("operation_reason_invalid", "reason de operacion debe ser string no vacio", { operation_index: opIndex });
  }

  const pathInfo = parseOverridePath(op.path);
  if (!pathInfo.ok) {
    bag.error("invalid_operation_path", `Path invalido: ${pathInfo.message}`, { operation_index: opIndex });
    return;
  }

  if (isProhibitedPath(pathInfo.path)) {
    bag.error("prohibited_path", `Path prohibido '${pathInfo.path}'`, { operation_index: opIndex });
    return;
  }

  const rule = findPathRule(pathInfo.path);
  if (!rule) {
    bag.error("path_not_allowed", `Path no permitido '${pathInfo.path}'`, { operation_index: opIndex });
    return;
  }

  const hasValue = Object.prototype.hasOwnProperty.call(op, "value");
  const isArrayOp = op.op === "append_unique" || op.op === "remove_values";

  if (pathInfo.path.startsWith("derived.")) {
    bag.warning(
      "derived_path_compatibility",
      `Path '${pathInfo.path}' sobre derived.* admitido solo por compatibilidad temporal`,
      { operation_index: opIndex, strictAsError: false }
    );
  }

  if (op.op === "set") {
    if (!hasValue) {
      bag.error("missing_value_for_set", "op='set' requiere campo value", { operation_index: opIndex });
    }
  } else if (op.op === "unset") {
    if (hasValue) {
      bag.warning("unset_with_value", "op='unset' no requiere value; se ignorara", {
        operation_index: opIndex,
        strictAsError: false,
      });
    }
  } else if (isArrayOp) {
    if (!hasValue) {
      bag.error("missing_value_for_array_op", `op='${op.op}' requiere value array`, { operation_index: opIndex });
    } else if (!Array.isArray(op.value)) {
      bag.error("invalid_value_for_array_op", `op='${op.op}' requiere value array`, { operation_index: opIndex });
    } else if (op.value.length === 0) {
      bag.warning("empty_array_for_array_op", `op='${op.op}' recibe value array vacio`, {
        operation_index: opIndex,
        strictAsError: false,
      });
    }
  }

  const shouldValidateValue =
    (op.op === "set" && hasValue) || (isArrayOp && hasValue && Array.isArray(op.value));
  if (shouldValidateValue) {
    const valueErr = rule.validateValue(op.value);
    if (valueErr) {
      bag.error("invalid_value_for_path", `${pathInfo.path}: ${valueErr}`, { operation_index: opIndex });
    }
  }

  if (canonicalDoc) {
    const pPath = parentPath(pathInfo.path);
    const parentLookup = getByPath(canonicalDoc, pPath);
    if (!parentLookup.exists || parentLookup.value === null) {
      bag.warning(
        "canonical_parent_missing",
        `El path padre '${pPath}' no existe o es null en 04_canonical`,
        { operation_index: opIndex, strictAsError: true }
      );
      return;
    }

    if (!isPlainObject(parentLookup.value) && !Array.isArray(parentLookup.value)) {
      bag.warning(
        "canonical_parent_not_container",
        `El path padre '${pPath}' no es contenedor en 04_canonical`,
        { operation_index: opIndex, strictAsError: true }
      );
      return;
    }

    const currentLookup = getByPath(canonicalDoc, pathInfo.path);
    if (!currentLookup.exists) {
      bag.warning("canonical_path_not_found", `El path '${pathInfo.path}' no existe actualmente en 04_canonical`, {
        operation_index: opIndex,
        strictAsError: true,
      });
      return;
    }

    if (isArrayOp && currentLookup.value !== null && !Array.isArray(currentLookup.value)) {
      bag.error(
        "array_operation_target_not_array",
        `op='${op.op}' requiere que '${pathInfo.path}' sea array en canonical`,
        { operation_index: opIndex }
      );
      return;
    }

    if (op.op === "set" && hasValue && deepEqual(currentLookup.value, op.value)) {
      bag.warning("redundant_set", `La operacion no cambia valor en '${pathInfo.path}' (ya coincide con canonical)`, {
        operation_index: opIndex,
        strictAsError: false,
      });
    }

    if (op.op === "set" && hasValue && op.value !== null && currentLookup.value !== null) {
      const expectedType = typeName(currentLookup.value);
      const incomingType = typeName(op.value);
      if (expectedType !== incomingType) {
        bag.warning(
          "canonical_type_mismatch",
          `Tipo distinto en '${pathInfo.path}': canonical=${expectedType}, override=${incomingType}`,
          { operation_index: opIndex, strictAsError: true }
        );
      }
    }
  }
}

function validateSingleOverride({ filePath, doc, canonicalIndex, strict }) {
  const bag = makeIssueBag(strict);
  validateTopLevelSchemaLike(doc, bag);

  const meta = {
    file: filePath,
    override_id: isPlainObject(doc) ? doc.override_id || null : null,
    isin: isPlainObject(doc) ? doc.isin || null : null,
    status: isPlainObject(doc) ? doc.status || null : null,
    operations_count: Array.isArray(doc?.operations) ? doc.operations.length : 0,
  };

  if (!isPlainObject(doc)) {
    return { meta, errors: bag.errors, warnings: bag.warnings };
  }

  const normalizedIsin = typeof doc.isin === "string" ? doc.isin.trim().toUpperCase() : null;
  let canonicalDoc = null;
  if (normalizedIsin && ISIN_RE.test(normalizedIsin) && canonicalIndex.size > 0) {
    const canonicalHit = canonicalIndex.get(normalizedIsin);
    if (!canonicalHit) {
      bag.warning("isin_not_found_in_canonical", `ISIN '${normalizedIsin}' no existe en 04_canonical`, { strictAsError: true });
    } else {
      canonicalDoc = canonicalHit.doc;
      meta.canonical_file = canonicalHit.file;
    }
  }

  if (Array.isArray(doc.operations)) {
    const seenByPath = new Map();
    for (let i = 0; i < doc.operations.length; i++) {
      const op = doc.operations[i];
      validateOperation(op, i, bag, canonicalDoc);

      if (isPlainObject(op) && typeof op.path === "string") {
        const key = op.path.trim();
        if (key) {
          if (!seenByPath.has(key)) seenByPath.set(key, []);
          seenByPath.get(key).push(i);
        }
      }
    }

    for (const [p, indexes] of seenByPath.entries()) {
      if (indexes.length > 1) {
        bag.warning(
          "duplicate_path_operations",
          `Hay multiples operaciones sobre el mismo path '${p}' en indices [${indexes.join(", ")}]`,
          { strictAsError: true }
        );
      }
    }
  }

  return { meta, errors: bag.errors, warnings: bag.warnings };
}

function main() {
  const argv = parseArgs();
  if (argv.help) {
    printHelp();
    process.exit(0);
  }

  const strict = Boolean(argv.strict);
  const failOnWarning = Boolean(argv["fail-on-warning"]);
  const quiet = Boolean(argv.quiet);

  const rootDir = path.resolve(__dirname, "..");
  const dataRoot = path.join(rootDir, "data");
  const workRoot = path.join(dataRoot, "work");
  const legacyBackupRoot = path.join(rootDir, "BDB_PARSE_BACKUP");
  const overridesDir = path.resolve(
    argv["overrides-dir"] || resolvePreferredOrLegacy(path.join(rootDir, "overrides", "05_overrides"), path.join(legacyBackupRoot, "05_overrides"))
  );
  const canonicalDir = path.resolve(
    argv["canonical-dir"] || resolvePreferredOrLegacy(path.join(dataRoot, "canonical"), path.join(legacyBackupRoot, "04_canonical"))
  );
  const manifestDir = path.resolve(
    argv["manifest-dir"] || resolvePreferredOrLegacy(path.join(workRoot, "manifests"), path.join(legacyBackupRoot, "07_manifests"))
  );
  const logsDir = path.resolve(
    argv["logs-dir"] || resolvePreferredOrLegacy(path.join(workRoot, "logs"), path.join(legacyBackupRoot, "08_logs"))
  );
  const schemaPath = path.resolve(path.join(rootDir, "schemas", "manual_override.schema.json"));

  ensureDir(manifestDir);
  ensureDir(logsDir);

  const logLines = [];
  const print = (line, force = false) => {
    logLines.push(line);
    if (!quiet || force) console.log(line);
  };

  const runBag = makeIssueBag(strict);

  if (!fs.existsSync(schemaPath)) {
    runBag.warning("schema_file_missing", `No se encontro schema institucional en ${schemaPath}`, {
      strictAsError: false,
    });
  } else {
    const schemaParsed = readJsonSafe(schemaPath);
    if (!schemaParsed.ok) {
      runBag.warning("schema_file_invalid_json", `schema JSON invalido: ${schemaParsed.error.message}`, {
        strictAsError: true,
      });
    }
  }

  if (!fs.existsSync(overridesDir)) {
    runBag.error("overrides_dir_missing", `No existe overrides-dir: ${overridesDir}`);
  }

  const canonicalLoad = loadCanonicalIndex(canonicalDir, strict);
  runBag.errors.push(...canonicalLoad.issues.errors);
  runBag.warnings.push(...canonicalLoad.issues.warnings);

  const overrideScan = fs.existsSync(overridesDir)
    ? listJsonFiles(overridesDir, { recursive: true, skipDirNames: ["review_queue"] })
    : { files: [], skippedDirs: [] };
  const overrideFiles = overrideScan.files;
  if (overrideScan.skippedDirs.length > 0) {
    runBag.warning(
      "overrides_skipped_dirs",
      `Se omitieron directorios no manuales en overrides: ${overrideScan.skippedDirs.map((d) => toRelative(d)).join(", ")}`,
      { strictAsError: false }
    );
  }
  if (overrideFiles.length === 0) {
    runBag.warning("no_override_files", `No se encontraron .json en ${overridesDir}`, { strictAsError: false });
  }

  const overrideIdRegistry = new Map();
  const fileResults = [];

  for (const filePath of overrideFiles) {
    const parsed = readJsonSafe(filePath);
    if (!parsed.ok) {
      const issues = makeIssueBag(strict);
      issues.error("json_parse_error", `JSON invalido: ${parsed.error.message}`);
      fileResults.push({
        file: filePath,
        override_id: null,
        isin: null,
        status: null,
        operations_count: 0,
        errors: issues.errors,
        warnings: issues.warnings,
      });
      continue;
    }

    const result = validateSingleOverride({
      filePath,
      doc: parsed.value,
      canonicalIndex: canonicalLoad.index,
      strict,
    });

    if (result.meta.override_id && typeof result.meta.override_id === "string") {
      if (!overrideIdRegistry.has(result.meta.override_id)) {
        overrideIdRegistry.set(result.meta.override_id, []);
      }
      overrideIdRegistry.get(result.meta.override_id).push(filePath);
    }

    fileResults.push({
      ...result.meta,
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  for (const [overrideId, files] of overrideIdRegistry.entries()) {
    if (files.length > 1) {
      const msg = `override_id duplicado '${overrideId}' en ${files.map((f) => toRelative(f)).join(", ")}`;
      for (const filePath of files) {
        const hit = fileResults.find((r) => r.file === filePath);
        if (hit) {
          hit.errors.push({
            level: "error",
            code: "duplicate_override_id",
            message: msg,
          });
        }
      }
    }
  }

  const resultsWithStatus = fileResults.map((r) => {
    let status = "OK";
    if (r.errors.length > 0) status = "ERROR";
    else if (r.warnings.length > 0) status = "WARNING";
    return { ...r, result: status };
  });

  for (const res of resultsWithStatus) {
    const rel = toRelative(res.file);
    const headline = `[${res.result}] ${rel} | override_id=${res.override_id || "-"} | isin=${res.isin || "-"} | ops=${res.operations_count || 0}`;
    print(headline);
    for (const e of res.errors) {
      print(`  - ERROR ${formatIssue(e)}`);
    }
    for (const w of res.warnings) {
      print(`  - WARNING ${formatIssue(w)}`);
    }
  }

  if (runBag.errors.length > 0 || runBag.warnings.length > 0) {
    print("Run-level checks:");
    for (const e of runBag.errors) {
      print(`  - ERROR ${formatIssue(e)}`);
    }
    for (const w of runBag.warnings) {
      print(`  - WARNING ${formatIssue(w)}`);
    }
  }

  const filesTotal = resultsWithStatus.length;
  const filesOk = resultsWithStatus.filter((r) => r.result === "OK").length;
  const filesWarning = resultsWithStatus.filter((r) => r.result === "WARNING").length;
  const filesError = resultsWithStatus.filter((r) => r.result === "ERROR").length;

  const totalErrors =
    runBag.errors.length + resultsWithStatus.reduce((acc, r) => acc + r.errors.length, 0);
  const totalWarnings =
    runBag.warnings.length + resultsWithStatus.reduce((acc, r) => acc + r.warnings.length, 0);

  let exitCode = 0;
  if (totalErrors > 0) {
    exitCode = 1;
  } else if (failOnWarning && totalWarnings > 0) {
    exitCode = 2;
  }

  const durationMs = Date.now() - START_MS;
  const summaryLine = `Summary: files=${filesTotal}, ok=${filesOk}, warning=${filesWarning}, error=${filesError}, warnings=${totalWarnings}, errors=${totalErrors}, exit_code=${exitCode}`;
  print(summaryLine, true);

  const runAt = new Date();
  const stamp = fileStamp(runAt);
  const manifestPath = path.join(manifestDir, `manual_overrides_validation_manifest_${stamp}.json`);
  const logPath = path.join(logsDir, `manual_overrides_validation_${stamp}.log`);

  const manifest = {
    run_id: `manual_overrides_validation_${stamp}`,
    generated_at: runAt.toISOString(),
    schema_path: schemaPath,
    options: {
      strict,
      fail_on_warning: failOnWarning,
      quiet,
      canonical_dir: canonicalDir,
      overrides_dir: overridesDir,
      manifest_dir: manifestDir,
      logs_dir: logsDir,
    },
    canonical_index: {
      files_scanned: canonicalLoad.files_scanned,
      indexed_isins: canonicalLoad.index.size,
    },
    run_issues: {
      errors: runBag.errors,
      warnings: runBag.warnings,
    },
    summary: {
      total_files: filesTotal,
      ok_files: filesOk,
      warning_files: filesWarning,
      error_files: filesError,
      total_errors: totalErrors,
      total_warnings: totalWarnings,
      duration_ms: durationMs,
      exit_code: exitCode,
    },
    files: resultsWithStatus.map((r) => ({
      file: r.file,
      override_id: r.override_id || null,
      isin: r.isin || null,
      status: r.status || null,
      operations_count: r.operations_count || 0,
      result: r.result,
      errors: r.errors,
      warnings: r.warnings,
      canonical_file: r.canonical_file || null,
    })),
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  fs.writeFileSync(logPath, `${logLines.join("\n")}\n`, "utf-8");

  print(`Manifest: ${manifestPath}`, true);
  print(`Log: ${logPath}`, true);

  process.exitCode = exitCode;
}

main();
