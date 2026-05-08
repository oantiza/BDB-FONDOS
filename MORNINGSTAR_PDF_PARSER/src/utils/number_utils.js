/**
 * Pure number / string utility functions extracted from cargador_lotes_v_2.js
 * REFACTOR-1 — Phase A
 *
 * Zero side-effects, zero external deps.
 */

"use strict";

function cleanString(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(/\s+/g, " ");
  return t.length ? t : null;
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

function hasAnyFiniteNumber(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some((v) => Number.isFinite(parseNum(v)));
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

function pctFromAliases(obj, aliases = []) {
  if (!obj || typeof obj !== "object") return null;
  const entries = Object.entries(obj);
  for (const k of aliases) {
    let raw = null;
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      raw = obj[k];
    } else {
      const kNorm = cleanRegionKeyBasic(k);
      const found = entries.find(([rawK]) => cleanRegionKeyBasic(rawK) === kNorm);
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
      const kNorm = cleanRegionKeyBasic(k);
      const found = entries.find(([rawK]) => cleanRegionKeyBasic(rawK) === kNorm);
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
      const kNorm = cleanRegionKeyBasic(k);
      const found = entries.find(([rawK]) => cleanRegionKeyBasic(rawK) === kNorm);
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

/**
 * Basic key normalizer for alias lookups — duplicated from region_normalizer
 * to avoid circular dependency. This is the minimal version used by
 * pctFromAliases / numFromAliases / strFromAliases.
 */
function cleanRegionKeyBasic(k) {
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

module.exports = {
  cleanString,
  isPlainObject,
  parseNum,
  clampPct,
  clamp01,
  approxEqual,
  hasAnyFiniteNumber,
  argmaxKey,
  scalePctMap,
  deleteUndefinedDeep,
  pctFromAliases,
  numFromAliases,
  strFromAliases,
  normalizePctBucketObject,
  cleanRegionKeyBasic,
};
