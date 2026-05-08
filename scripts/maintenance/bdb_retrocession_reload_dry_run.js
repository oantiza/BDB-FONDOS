#!/usr/bin/env node
"use strict";

/**
 * BDB-RETRO-IMPORT-0
 *
 * Dry-run only reload planner for funds_v3 manual.costs.retrocession.
 * Canonical scale is direct percentage points:
 *   1.41 = 1.41%, 0.80 = 0.80%, 0.0155 = 0.0155%
 *
 * This script never writes to Firestore. --apply/--write are rejected.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const minimist = require("minimist");
const { parse: parseCsvSync } = require("csv-parse/sync");

const DEFAULT_COLLECTION = "funds_v3";
const DEFAULT_OUTPUT_DIR = path.join("artifacts", "bdb_data_audit");
const DEFAULT_JSON_OUT = "retrocession_reload_dry_run.json";
const DEFAULT_CSV_OUT = "retrocession_reload_dry_run.csv";
const LARGE_ABS_THRESHOLD = 0.50;
const LARGE_REL_THRESHOLD = 0.50;
const HIGH_REVIEW_THRESHOLD = 5;
const SAME_TOLERANCE = 1e-9;

const REQUIRED_COLUMNS = ["isin", "retrocession_percent"];
const OPTIONAL_COLUMNS = ["source", "as_of_date", "notes"];

function usage() {
  return [
    "Usage:",
    "  node scripts/maintenance/bdb_retrocession_reload_dry_run.js --input path/to/file.csv",
    "",
    "Options:",
    "  --input <path>          CSV/XLSX input file. Required.",
    "  --delimiter <auto|;|,>  CSV delimiter. Default: auto.",
    "  --encoding <utf8|latin1> CSV encoding. Default: utf8.",
    "  --output-dir <path>     Default: artifacts/bdb_data_audit.",
    "  --project <id>          Firebase project id override.",
    "  --collection <name>     Default: funds_v3.",
    "",
    "Safety:",
    "  This script is dry-run/read-only. --apply and --write are rejected.",
  ].join("\n");
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeIsin(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidIsin(isin) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);
}

function roundMaybe(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(10));
}

function retrocessionPercentPoints(value) {
  if (value === null || value === undefined) {
    return { status: "MISSING", value: null, reason: "empty value" };
  }

  let parsed;
  if (typeof value === "number") {
    parsed = value;
  } else {
    let raw = String(value).trim();
    if (raw === "") {
      return { status: "MISSING", value: null, reason: "empty value" };
    }

    raw = raw.replace(/\s+/g, "").replace(/%/g, "");
    const hasComma = raw.includes(",");
    const hasDot = raw.includes(".");

    if (hasComma && hasDot) {
      const lastComma = raw.lastIndexOf(",");
      const lastDot = raw.lastIndexOf(".");
      if (lastComma > lastDot) {
        raw = raw.replace(/\./g, "").replace(",", ".");
      } else {
        raw = raw.replace(/,/g, "");
      }
    } else if (hasComma) {
      raw = raw.replace(",", ".");
    }

    parsed = Number(raw);
  }

  if (!Number.isFinite(parsed)) {
    return { status: "INVALID", value: null, reason: "not a finite number" };
  }

  if (parsed < 0) {
    return { status: "INVALID", value: null, reason: "negative value" };
  }

  const normalized = roundMaybe(parsed);
  if (normalized > HIGH_REVIEW_THRESHOLD) {
    return {
      status: "HIGH_REVIEW",
      value: normalized,
      reason: `value above ${HIGH_REVIEW_THRESHOLD} percentage points`,
    };
  }

  return { status: "OK", value: normalized, reason: "" };
}

function detectDelimiter(content) {
  const firstDataLine = content
    .split(/\r?\n/)
    .find((line) => line.trim() && !line.trim().startsWith("#"));
  if (!firstDataLine) return ";";

  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  for (const delimiter of candidates) {
    const count = (firstDataLine.match(new RegExp(escapeRegExp(delimiter), "g")) || [])
      .length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCsvRows(inputPath, options = {}) {
  const encoding = options.encoding || "utf8";
  const delimiterOpt = options.delimiter || "auto";
  const content = fs.readFileSync(inputPath, encoding);
  const delimiter = delimiterOpt === "auto" ? detectDelimiter(content) : delimiterOpt;

  return parseCsvSync(content, {
    columns: true,
    delimiter,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

function readExcelRowsWithXlsx(inputPath) {
  // Optional dependency. If present, it is the most direct path.
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  const XLSX = require("xlsx");
  const workbook = XLSX.readFile(inputPath, { cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
}

function readExcelRowsWithPython(inputPath) {
  const root = path.resolve(__dirname, "..", "..");
  const candidates = [
    process.env.PYTHON,
    path.join(root, "functions_python", "venv", "Scripts", "python.exe"),
    path.join(root, "functions_python", "venv", "bin", "python"),
    "python",
  ].filter(Boolean);

  const code = [
    "import json, sys",
    "from openpyxl import load_workbook",
    "path = sys.argv[1]",
    "wb = load_workbook(path, read_only=True, data_only=True)",
    "ws = wb[wb.sheetnames[0]]",
    "rows = list(ws.iter_rows(values_only=True))",
    "if not rows:",
    "    print('[]')",
    "    sys.exit(0)",
    "headers = [str(h).strip() if h is not None else '' for h in rows[0]]",
    "out = []",
    "for row in rows[1:]:",
    "    item = {}",
    "    empty = True",
    "    for i, header in enumerate(headers):",
    "        if not header:",
    "            continue",
    "        value = row[i] if i < len(row) else None",
    "        if value is not None and str(value).strip() != '':",
    "            empty = False",
    "        item[header] = value",
    "    if not empty:",
    "        out.append(item)",
    "print(json.dumps(out, ensure_ascii=False, default=str))",
  ].join("\n");

  const errors = [];
  for (const python of candidates) {
    const result = spawnSync(python, ["-c", code, inputPath], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.status === 0) {
      return JSON.parse(result.stdout || "[]");
    }
    errors.push(`${python}: ${(result.stderr || result.error || "").toString().trim()}`);
  }

  throw new Error(
    "Excel input requires the optional xlsx npm package or Python openpyxl. " +
      `Attempts failed: ${errors.join(" | ")}`
  );
}

function readExcelRows(inputPath) {
  try {
    return readExcelRowsWithXlsx(inputPath);
  } catch (error) {
    if (error && error.code !== "MODULE_NOT_FOUND") throw error;
    return readExcelRowsWithPython(inputPath);
  }
}

function readInputRows(inputPath, options = {}) {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === ".csv" || ext === ".txt" || ext === ".tsv") {
    return readCsvRows(inputPath, options);
  }
  if (ext === ".xlsx" || ext === ".xlsm" || ext === ".xls") {
    return readExcelRows(inputPath);
  }
  throw new Error(`Unsupported input extension: ${ext || "(none)"}`);
}

function normalizeSourceRows(rows) {
  return rows.map((row, index) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeHeader(key)] = value;
    }

    const isin = normalizeIsin(normalized.isin);
    const parsed = retrocessionPercentPoints(normalized.retrocession_percent);

    return {
      row_number: index + 2,
      isin,
      isin_valid: isValidIsin(isin),
      raw_retrocession: normalized.retrocession_percent,
      parsed_retrocession: parsed,
      source: normalized.source ?? "",
      as_of_date: normalized.as_of_date ?? "",
      notes: normalized.notes ?? "",
    };
  });
}

function validateColumns(rows) {
  if (!rows.length) {
    throw new Error("Input file has no data rows");
  }
  const headers = new Set(Object.keys(rows[0]).map(normalizeHeader));
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.has(column));
  if (missing.length) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }
}

function getFundName(data) {
  return (
    data?.name ||
    data?.nombre ||
    data?.fund_name ||
    data?.metadata?.name ||
    data?.ms?.name ||
    ""
  );
}

function getCurrentRetrocession(data) {
  const current = data?.manual?.costs?.retrocession;
  return Number.isFinite(Number(current)) ? Number(current) : null;
}

function absDelta(current, next) {
  if (current === null || next === null) return null;
  return roundMaybe(next - current);
}

function relativeChange(current, next) {
  if (current === null || next === null || Math.abs(current) < SAME_TOLERANCE) {
    return null;
  }
  return Math.abs(next - current) / Math.abs(current);
}

function classifyRows(sourceRecords, fundsByIsin) {
  const counts = new Map();
  for (const record of sourceRecords) {
    if (!record.isin) continue;
    counts.set(record.isin, (counts.get(record.isin) || 0) + 1);
  }

  return sourceRecords.map((record) => {
    const newValue =
      record.parsed_retrocession.status === "OK" ||
      record.parsed_retrocession.status === "HIGH_REVIEW"
        ? record.parsed_retrocession.value
        : null;
    const fund = fundsByIsin.get(record.isin);
    const current = fund ? getCurrentRetrocession(fund.data) : null;
    const delta = absDelta(current, newValue);
    const rel = relativeChange(current, newValue);
    const duplicate = record.isin && counts.get(record.isin) > 1;
    const reasons = [];

    let status;
    let action = "SKIP";
    let reviewRequired = false;

    if (duplicate) {
      status = "DUPLICATE_ISIN_IN_SOURCE";
      action = "REVIEW";
      reviewRequired = true;
      reasons.push(`ISIN appears ${counts.get(record.isin)} times in source`);
    } else if (!record.isin || !record.isin_valid) {
      status = "SOURCE_VALUE_INVALID";
      action = "SKIP";
      reviewRequired = true;
      reasons.push("invalid or missing ISIN");
    } else if (record.parsed_retrocession.status === "MISSING") {
      status = "SOURCE_VALUE_MISSING";
      action = "SKIP";
      reasons.push(record.parsed_retrocession.reason);
    } else if (record.parsed_retrocession.status === "INVALID") {
      status = "SOURCE_VALUE_INVALID";
      action = "SKIP";
      reviewRequired = true;
      reasons.push(record.parsed_retrocession.reason);
    } else if (!fund) {
      status = "ISIN_NOT_FOUND";
      action = "SKIP";
      reviewRequired = true;
      reasons.push("ISIN not found in funds_v3");
    } else if (record.parsed_retrocession.status === "HIGH_REVIEW") {
      status = "HIGH_VALUE_REVIEW";
      action = "REVIEW";
      reviewRequired = true;
      reasons.push(record.parsed_retrocession.reason);
    } else if (current === null) {
      status = "NEW_VALUE_MISSING_BEFORE";
      action = "UPDATE_DRY_RUN";
      reasons.push("current retrocession missing");
    } else if (Math.abs(delta) <= SAME_TOLERANCE) {
      status = "UNCHANGED";
      action = "NO_CHANGE";
      reasons.push("new value equals current value");
    } else if (
      Math.abs(delta) >= LARGE_ABS_THRESHOLD ||
      (rel !== null && rel >= LARGE_REL_THRESHOLD)
    ) {
      status = "LARGE_CHANGE_REVIEW";
      action = "REVIEW";
      reviewRequired = true;
      if (Math.abs(delta) >= LARGE_ABS_THRESHOLD) {
        reasons.push(`absolute delta ${Math.abs(delta).toFixed(4)} >= ${LARGE_ABS_THRESHOLD}`);
      }
      if (rel !== null && rel >= LARGE_REL_THRESHOLD) {
        reasons.push(`relative change ${(rel * 100).toFixed(2)}% >= 50%`);
      }
    } else {
      status = "UPDATE_CONFIRMED";
      action = "UPDATE_DRY_RUN";
      reasons.push("deterministic value change");
    }

    return {
      isin: record.isin,
      name: fund ? getFundName(fund.data) : "",
      current_retrocession: current,
      new_retrocession: newValue,
      delta,
      action,
      status,
      review_required: reviewRequired,
      reason: reasons.join("; "),
      source: record.source,
      as_of_date: record.as_of_date,
      notes: record.notes,
      row_number: record.row_number,
      raw_retrocession: record.raw_retrocession,
    };
  });
}

function summarize(detailRows, sourcePath, collection, fundsCount) {
  const byStatus = {};
  for (const row of detailRows) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }

  return {
    generated_at: new Date().toISOString(),
    mode: "DRY_RUN_READ_ONLY",
    collection,
    source_file: sourcePath,
    funds_v3_docs_read: fundsCount,
    source_rows: detailRows.length,
    rows_requiring_review: detailRows.filter((row) => row.review_required).length,
    update_dry_run_rows: detailRows.filter((row) => row.action === "UPDATE_DRY_RUN").length,
    by_status: byStatus,
    canonical_scale:
      "direct percentage points: 1.41 = 1.41%, 0.80 = 0.80%, 0.0155 = 0.0155%",
    no_scale_conversion: true,
    writes_performed: false,
  };
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(filePath, rows) {
  const columns = [
    "isin",
    "name",
    "current_retrocession",
    "new_retrocession",
    "delta",
    "action",
    "status",
    "review_required",
    "reason",
    "source",
    "as_of_date",
    "notes",
  ];
  const lines = [
    columns.join(";"),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(";")),
  ];
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function writeArtifacts(outputDir, summary, detailRows) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, DEFAULT_JSON_OUT);
  const csvPath = path.join(outputDir, DEFAULT_CSV_OUT);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ summary, detail: detailRows }, null, 2),
    "utf8"
  );
  writeCsv(csvPath, detailRows);

  return { jsonPath, csvPath };
}

async function loadFundsByIsin({ projectId, collection }) {
  const admin = require("firebase-admin");

  if (!admin.apps.length) {
    admin.initializeApp(projectId ? { projectId } : {});
  }

  const snapshot = await admin.firestore().collection(collection).get();
  const fundsByIsin = new Map();
  snapshot.forEach((doc) => {
    fundsByIsin.set(doc.id.toUpperCase(), { id: doc.id, data: doc.data() || {} });
  });
  return { fundsByIsin, count: snapshot.size };
}

async function main(argv = process.argv.slice(2)) {
  const args = minimist(argv, {
    string: ["input", "delimiter", "encoding", "output-dir", "project", "collection"],
    boolean: ["help", "apply", "write"],
    default: {
      delimiter: "auto",
      encoding: "utf8",
      "output-dir": DEFAULT_OUTPUT_DIR,
      collection: DEFAULT_COLLECTION,
    },
  });

  if (args.help) {
    console.log(usage());
    return 0;
  }

  if (args.apply || args.write) {
    throw new Error("Writes are not implemented in this block. Use dry-run only.");
  }

  if (!args.input) {
    throw new Error("--input is required");
  }

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const rawRows = readInputRows(inputPath, {
    delimiter: args.delimiter,
    encoding: args.encoding,
  });
  validateColumns(rawRows);
  const sourceRecords = normalizeSourceRows(rawRows);
  const { fundsByIsin, count: fundsCount } = await loadFundsByIsin({
    projectId: args.project,
    collection: args.collection,
  });

  const detailRows = classifyRows(sourceRecords, fundsByIsin);
  const summary = summarize(detailRows, inputPath, args.collection, fundsCount);
  const artifacts = writeArtifacts(args["output-dir"], summary, detailRows);

  console.log(JSON.stringify({ summary, artifacts }, null, 2));
  return 0;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`ERROR: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  retrocessionPercentPoints,
  normalizeHeader,
  normalizeIsin,
  isValidIsin,
  normalizeSourceRows,
  classifyRows,
  summarize,
  readCsvRows,
  detectDelimiter,
  writeCsv,
  writeArtifacts,
  REQUIRED_COLUMNS,
  OPTIONAL_COLUMNS,
};

