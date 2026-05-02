#!/usr/bin/env node
"use strict";

/**
 * apply_manual_overrides.js
 *
 * Aplica overrides manuales institucionales sobre 04_canonical.
 *
 * Entrada:
 *   04_canonical/*.json
 *   05_overrides/*.override.json
 *
 * Salida:
 *   04_canonical_applied/*.json
 *   07_manifests/overrides_manifest.json
 *   08_logs/overrides_errors.ndjson
 *
 * Reglas:
 * - Solo aplica overrides con status=approved
 * - Un archivo override por ISIN
 * - No permite tocar ms.*, raw_*, parsed_ms, source_pdf, parser_metadata
 * - Mantiene trazabilidad en manual_overrides_applied[]
 */

const fs = require("fs");
const path = require("path");

function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

const ROOT = path.resolve(getArgValue("--root") || process.cwd());
const CANONICAL_DIR = path.resolve(getArgValue("--canonical") || path.join(ROOT, "04_canonical"));
const OVERRIDES_DIR = path.resolve(getArgValue("--overrides") || path.join(ROOT, "05_overrides"));
const OUTPUT_DIR = path.resolve(getArgValue("--output") || path.join(ROOT, "04_canonical_applied"));
const MANIFEST_DIR = path.resolve(getArgValue("--manifest-dir") || path.join(ROOT, "07_manifests"));
const LOGS_DIR = path.resolve(getArgValue("--logs-dir") || path.join(ROOT, "08_logs"));

const APPLY_DRAFTS = process.argv.includes("--apply-drafts");
const STRICT = process.argv.includes("--strict");

const VALID_STATUSES = new Set(["draft", "approved", "rejected", "deprecated"]);
const VALID_OPS = new Set(["set", "unset", "append_unique", "remove_values"]);

const FORBIDDEN_PREFIXES = [
  "ms.",
  "raw_text",
  "raw_llm",
  "parsed_ms",
  "source_pdf",
  "parser_metadata",
];

const ALLOWED_PREFIXES = [
  "classification_v2",
  "portfolio_exposure_v2",
  "eligibility",
  "quality_flags",
  "manual_notes",
  "derived",
  "quality",
  "validation",
  "routing",
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJsonPretty(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

function writeLines(filePath, lines) {
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
}

function listJsonFiles(dir, suffix = ".json") {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(suffix))
    .map((f) => path.join(dir, f));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isPlainObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function toIsoNow() {
  return new Date().toISOString();
}

function normalizeIsin(v) {
  return String(v || "").trim().toUpperCase();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isForbiddenPath(pathStr) {
  return FORBIDDEN_PREFIXES.some((prefix) => pathStr === prefix || pathStr.startsWith(prefix));
}

function isAllowedPath(pathStr) {
  return ALLOWED_PREFIXES.some((prefix) => pathStr === prefix || pathStr.startsWith(prefix + "."));
}

function splitPath(pathStr) {
  return String(pathStr)
    .split(".")
    .map((x) => x.trim())
    .filter(Boolean);
}

function getAtPath(obj, pathStr) {
  const parts = splitPath(pathStr);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setAtPath(obj, pathStr, value) {
  const parts = splitPath(pathStr);
  assert(parts.length > 0, "invalid_empty_path");

  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlainObject(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function unsetAtPath(obj, pathStr) {
  const parts = splitPath(pathStr);
  assert(parts.length > 0, "invalid_empty_path");

  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlainObject(cur[p])) return false;
    cur = cur[p];
  }
  const leaf = parts[parts.length - 1];
  if (leaf in cur) {
    delete cur[leaf];
    return true;
  }
  return false;
}

function appendUniqueAtPath(obj, pathStr, values) {
  assert(Array.isArray(values), "append_unique_requires_array");
  const current = getAtPath(obj, pathStr);
  const arr = Array.isArray(current) ? [...current] : [];
  const seen = new Set(arr.map((x) => JSON.stringify(x)));

  for (const v of values) {
    const key = JSON.stringify(v);
    if (!seen.has(key)) {
      arr.push(v);
      seen.add(key);
    }
  }
  setAtPath(obj, pathStr, arr);
  return arr;
}

function removeValuesAtPath(obj, pathStr, values) {
  assert(Array.isArray(values), "remove_values_requires_array");
  const current = getAtPath(obj, pathStr);
  if (!Array.isArray(current)) {
    setAtPath(obj, pathStr, []);
    return [];
  }
  const toRemove = new Set(values.map((x) => JSON.stringify(x)));
  const next = current.filter((x) => !toRemove.has(JSON.stringify(x)));
  setAtPath(obj, pathStr, next);
  return next;
}

function validateTopLevelExposure(exposure) {
  if (!isPlainObject(exposure)) return { ok: true, errors: [] };

  const keys = ["equity", "bond", "cash", "other"];
  const vals = keys
    .map((k) => exposure[k])
    .filter((v) => typeof v === "number" && Number.isFinite(v));

  if (!vals.length) return { ok: true, errors: [] };

  const bad = vals.some((v) => v < 0 || v > 1);
  if (bad) return { ok: false, errors: ["portfolio_exposure_v2_top_level_out_of_range"] };

  const sum = keys.reduce((acc, k) => acc + (typeof exposure[k] === "number" ? exposure[k] : 0), 0);
  if (Math.abs(sum - 1) > 0.03) {
    return {
      ok: false,
      errors: [`portfolio_exposure_v2_top_level_sum_not_1:${sum.toFixed(6)}`],
    };
  }

  return { ok: true, errors: [] };
}

function validateOverrideFile(overrideObj) {
  const errors = [];

  if (!isPlainObject(overrideObj)) {
    errors.push("override_not_object");
    return { ok: false, errors };
  }

  const required = [
    "schema_version",
    "override_id",
    "isin",
    "status",
    "author",
    "created_at",
    "reason",
    "operations",
  ];

  for (const k of required) {
    if (!(k in overrideObj)) errors.push(`missing_required:${k}`);
  }

  if (overrideObj.status && !VALID_STATUSES.has(overrideObj.status)) {
    errors.push(`invalid_status:${overrideObj.status}`);
  }

  if (overrideObj.isin && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(normalizeIsin(overrideObj.isin))) {
    errors.push(`invalid_isin:${overrideObj.isin}`);
  }

  if (!Array.isArray(overrideObj.operations) || overrideObj.operations.length === 0) {
    errors.push("operations_missing_or_empty");
  } else {
    overrideObj.operations.forEach((op, idx) => {
      if (!isPlainObject(op)) {
        errors.push(`operation_${idx}_not_object`);
        return;
      }

      if (!VALID_OPS.has(op.op)) errors.push(`operation_${idx}_invalid_op:${op.op}`);
      if (!op.path || typeof op.path !== "string") errors.push(`operation_${idx}_missing_path`);
      if (!op.reason || typeof op.reason !== "string") errors.push(`operation_${idx}_missing_reason`);

      if (op.path && isForbiddenPath(op.path)) {
        errors.push(`operation_${idx}_forbidden_path:${op.path}`);
      }

      if (op.path && !isAllowedPath(op.path)) {
        errors.push(`operation_${idx}_path_not_allowed:${op.path}`);
      }

      if ((op.op === "set" || op.op === "append_unique" || op.op === "remove_values") && !("value" in op)) {
        errors.push(`operation_${idx}_missing_value`);
      }

      if (op.op === "append_unique" && !Array.isArray(op.value)) {
        errors.push(`operation_${idx}_append_unique_requires_array`);
      }

      if (op.op === "remove_values" && !Array.isArray(op.value)) {
        errors.push(`operation_${idx}_remove_values_requires_array`);
      }

      if (op.path === "classification_v2.classification_confidence") {
        if (typeof op.value !== "number" || op.value < 0 || op.value > 1) {
          errors.push(`operation_${idx}_classification_confidence_out_of_range`);
        }
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function applyOneOperation(target, op) {
  if (op.op === "set") {
    setAtPath(target, op.path, op.value);
    return;
  }
  if (op.op === "unset") {
    unsetAtPath(target, op.path);
    return;
  }
  if (op.op === "append_unique") {
    appendUniqueAtPath(target, op.path, op.value);
    return;
  }
  if (op.op === "remove_values") {
    removeValuesAtPath(target, op.path, op.value);
    return;
  }
  throw new Error(`unsupported_op:${op.op}`);
}

function buildCanonicalIndex(canonicalFiles) {
  const byIsin = new Map();

  for (const filePath of canonicalFiles) {
    const obj = readJson(filePath);
    const isin = normalizeIsin(obj.isin);

    if (!isin) continue;
    if (!byIsin.has(isin)) byIsin.set(isin, []);
    byIsin.get(isin).push({
      filePath,
      fileName: path.basename(filePath),
      obj,
    });
  }

  return byIsin;
}

function chooseCanonicalDoc(entries, overrideObj) {
  if (!entries || entries.length === 0) return null;
  if (entries.length === 1) return entries[0];

  const approvedAt = overrideObj.approved_at || overrideObj.created_at || "";
  const targetDate = String(approvedAt).slice(0, 10);

  const exactDate = entries.find((e) => String(e.obj.report_date || "").slice(0, 10) === targetDate);
  if (exactDate) return exactDate;

  const withReportDate = entries
    .filter((e) => e.obj.report_date)
    .sort((a, b) => String(b.obj.report_date).localeCompare(String(a.obj.report_date)));

  return withReportDate[0] || entries[0];
}

(function main() {
  ensureDir(OUTPUT_DIR);
  ensureDir(MANIFEST_DIR);
  ensureDir(LOGS_DIR);

  const canonicalFiles = listJsonFiles(CANONICAL_DIR, ".json");
  const overrideFiles = listJsonFiles(OVERRIDES_DIR, ".override.json");

  const canonicalByIsin = buildCanonicalIndex(canonicalFiles);

  const manifest = {
    generated_at: toIsoNow(),
    root: ROOT,
    canonical_dir: CANONICAL_DIR,
    overrides_dir: OVERRIDES_DIR,
    output_dir: OUTPUT_DIR,
    total_canonical_files: canonicalFiles.length,
    total_override_files: overrideFiles.length,
    applied_count: 0,
    skipped_count: 0,
    error_count: 0,
    entries: [],
  };

  const errorLines = [];

  for (const overridePath of overrideFiles) {
    const overrideFileName = path.basename(overridePath);
    let overrideObj = null;

    try {
      overrideObj = readJson(overridePath);
      const validation = validateOverrideFile(overrideObj);

      if (!validation.ok) {
        throw new Error(`override_validation_failed:${validation.errors.join("|")}`);
      }

      const status = overrideObj.status;
      const isin = normalizeIsin(overrideObj.isin);

      if (status !== "approved" && !(APPLY_DRAFTS && status === "draft")) {
        manifest.skipped_count += 1;
        manifest.entries.push({
          override_file: overrideFileName,
          isin,
          status: "skipped",
          reason: `status_${status}_not_applied`,
        });
        continue;
      }

      const candidates = canonicalByIsin.get(isin) || [];
      const selected = chooseCanonicalDoc(candidates, overrideObj);

      if (!selected) {
        throw new Error(`canonical_not_found_for_isin:${isin}`);
      }

      const working = deepClone(selected.obj);
      const operationAudit = [];

      for (const op of overrideObj.operations) {
        const before = deepClone(getAtPath(working, op.path));
        applyOneOperation(working, op);
        const after = deepClone(getAtPath(working, op.path));

        operationAudit.push({
          op: op.op,
          path: op.path,
          reason: op.reason,
          before,
          after,
        });
      }

      const exposureCheck = validateTopLevelExposure(working.portfolio_exposure_v2);
      if (!exposureCheck.ok) {
        throw new Error(`post_apply_validation_failed:${exposureCheck.errors.join("|")}`);
      }

      if (!Array.isArray(working.manual_overrides_applied)) {
        working.manual_overrides_applied = [];
      }

      working.manual_overrides_applied.push({
        override_id: overrideObj.override_id,
        override_file: overrideFileName,
        schema_version: overrideObj.schema_version,
        status: overrideObj.status,
        author: overrideObj.author,
        approved_by: overrideObj.approved_by || null,
        created_at: overrideObj.created_at,
        approved_at: overrideObj.approved_at || null,
        reason: overrideObj.reason,
        notes: overrideObj.notes || null,
        applied_at: toIsoNow(),
        operations: operationAudit,
      });

      working.override_state = {
        has_manual_overrides: true,
        last_override_id: overrideObj.override_id,
        last_override_applied_at: toIsoNow(),
      };

      const outFileName = selected.fileName.replace(/__canonical\.json$/i, "__canonical_applied.json");
      const outPath = path.join(OUTPUT_DIR, outFileName);

      writeJsonPretty(outPath, working);

      manifest.applied_count += 1;
      manifest.entries.push({
        override_file: overrideFileName,
        canonical_source_file: selected.fileName,
        output_file: outFileName,
        isin,
        status: "applied",
        override_id: overrideObj.override_id,
        operations_count: overrideObj.operations.length,
      });
    } catch (err) {
      manifest.error_count += 1;

      const msg = err instanceof Error ? err.message : String(err);
      const entry = {
        override_file: overrideFileName,
        status: "error",
        message: msg,
        generated_at: toIsoNow(),
      };

      manifest.entries.push(entry);
      errorLines.push(JSON.stringify(entry));

      if (STRICT) {
        writeJsonPretty(path.join(MANIFEST_DIR, "overrides_manifest.json"), manifest);
        writeLines(path.join(LOGS_DIR, "overrides_errors.ndjson"), errorLines);
        throw err;
      }
    }
  }

  writeJsonPretty(path.join(MANIFEST_DIR, "overrides_manifest.json"), manifest);
  writeLines(path.join(LOGS_DIR, "overrides_errors.ndjson"), errorLines);

  console.log(
    `✅ Overrides FIN | applied=${manifest.applied_count} | skipped=${manifest.skipped_count} | errors=${manifest.error_count}`
  );
})();