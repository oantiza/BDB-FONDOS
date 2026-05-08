"use strict";

const { isPlainObject, parseNum } = require("../utils/number_utils");

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
    .replace(/[Ã¢â‚¬Å“Ã¢â‚¬Â]/g, "\"")
    .replace(/[Ã¢â‚¬ËœÃ¢â‚¬â„¢]/g, "'")
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

  throw new Error("Gemini no devolviÃƒÂ³ un JSON objeto parseable");
}

module.exports = {
  validateRawLlMSchema,
  stripCodeFences,
  extractFirstBalancedJsonObject,
  repairJsonCandidate,
  CRITICAL_GEMINI_KEYS,
  hasAnyCriticalGeminiKey,
  unwrapGeminiRootObject,
  parseGeminiJsonResponse,
};
